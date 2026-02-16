# ⊷ Token Beam Server

WebSocket server for real-time token synchronization between web and Figma.

## Overview

This package provides a WebSocket server that enables live, bidirectional synchronization between a web application and Figma plugin using simple token-based pairing.

## Quick Start

```bash
# Development (with auto-reload)
npm run dev

# Production
npm run build
npm start

# Custom port
PORT=9000 npm start
```

## Usage

### Transport security

- Recommended (modern clients): `wss://tokenbeam.dev`
- Legacy compatibility (no TLS, e.g. Aseprite): `ws://tokenbeam.dev:8080`

`ws://` is enabled only so older tools can still connect. It is unencrypted and should be considered legacy transport.

### Web Client

```typescript
import { SyncClient } from './sync-client';

const client = new SyncClient({
  serverUrl: 'ws://localhost:8080',
  clientType: 'web',
  onPaired: (token) => {
    console.log('Share this token:', token); // e.g., "beam://A1B2C3D4E5F6"
  },
  onSync: (payload) => {
    console.log('Received update:', payload);
  },
});

await client.connect();

// Send updates
client.sync(myTokenPayload);
```

### Figma Plugin

```typescript
const client = new SyncClient({
  serverUrl: 'ws://localhost:8080',
  clientType: 'figma',
  sessionToken: 'beam://A1B2C3D4E5F6', // Token from web client
  onSync: (payload) => {
    // Apply tokens to Figma
    applyTokensToFigma(payload);
  },
});

await client.connect();
```

## Protocol

### Message Types

#### Pair Request (Client → Server)
```json
{
  "type": "pair",
  "clientType": "web" | "figma",
  "sessionToken": "beam://A1B2C3D4E5F6",
  "icon": { "type": "unicode", "value": "🎨" }
}
```

The `sessionToken` field is only required for target clients (not `web`). The `icon` field is optional — web clients can provide it so design tool plugins can display the source app's branding.

#### Pair Response (Server → Client)
```json
{
  "type": "pair",
  "sessionToken": "beam://A1B2C3D4E5F6",
  "clientType": "web" | "figma",
  "icon": { "type": "unicode", "value": "🎨" }
}
```

Target clients receive the web client's `origin` and `icon` (if provided) in the pair response.
```

#### Sync Message (Client ↔ Server ↔ Client)
```json
{
  "type": "sync",
  "payload": { /* TokenSyncPayload - generic, tool-agnostic */ }
}
```

#### Error Message (Server → Client)
```json
{
  "type": "error",
  "error": "Invalid session token"
}
```

## Features

- **Token-based pairing**: Cryptographically secure hex tokens (e.g., `beam://A1B2C3D4E5F6`) — recognizable for future deep-linking
- **Session management**: Auto-cleanup after 30 minutes of inactivity
- **Payload size limits**: 10MB maximum message size to prevent abuse
- **Reconnection handling**: Automatic reconnection with exponential backoff
- **Health checks**: HTTP endpoint at `/health`
- **Heartbeat ping**: Keeps connections alive
- **App icons**: Source apps can provide a unicode or SVG icon, sanitized server-side (no scripts, event handlers, or dangerous unicode)
- **Origin blocking**: Monitor and block commercial usage based on HTTP Origin header

## Commercial Use Monitoring

The server tracks connection origins to enforce licensing. Origins can be blocked to require commercial licensing.

### How it works

1. **Browser Origin Header**: Automatically captured from WebSocket upgrade (can't be spoofed)
2. **User-provided Origin**: Sent in pairing message for logging/monitoring
3. **Blocklist**: Manually curate domains requiring commercial licenses

### Blocking Origins

Edit `BLOCKED_ORIGINS` in `src/server.ts`:

```typescript
private readonly BLOCKED_ORIGINS = [
  'acme-design-system.com',
  'bigcorp-ui.io',
];
```

### Monitoring Logs

Watch for commercial usage patterns:

```
New WebSocket connection { origin: 'https://startup-design.io' }
Session paired with origin: Startup Design System
```

When you identify commercial use:
1. Add domain to blocklist
2. Contact them: token-beam@elastiq.ch
3. Server will reject future connections with upgrade message

## API

### Server

```typescript
import { TokenSyncServer } from 'token-beam-server';

const server = new TokenSyncServer(8080);
await server.start();
```

### Client

```typescript
interface SyncClientOptions<T = unknown> {
  serverUrl: string;
  clientType: string; // e.g., 'web', 'figma', 'sketch', 'aseprite'
  sessionToken?: string; // Required for target clients (not 'web')
  origin?: string; // Display name for this client
  icon?: SyncIcon; // Icon shown in paired plugins (unicode or SVG)
  onPaired?: (token: string, origin?: string, icon?: SyncIcon) => void;
  onTargetConnected?: (clientType: string, origin?: string) => void;
  onSync?: (payload: T) => void; // Generic payload (e.g., TokenSyncPayload)
  onError?: (error: string) => void;
  onConnected?: () => void;
  onDisconnected?: () => void;
}
```

## Architecture

```
Session Lifecycle:
1. Web connects → Server generates token (e.g., "beam://A1B2C3D4E5F6")
2. User copies token
3. Figma enters token → Server pairs sessions
4. Bidirectional sync active
5. Auto-cleanup on timeout/disconnect
```

## Deployment

The server runs on a Hetzner VPS (Ubuntu 24.04) with Nginx as a TLS-terminating reverse proxy.

### Infrastructure

| Component | Details |
|---|---|
| VPS | Hetzner CPX22 (Nuremberg) |
| Domain | `tokenbeam.dev` (Cloudflare DNS, **DNS-only mode** — no proxy) |
| Node.js | v20 LTS |
| Process manager | systemd |
| TLS | Let's Encrypt via Certbot + Nginx |

### Endpoints

| URL | Port | For |
|---|---|---|
| `wss://tokenbeam.dev` | 443 | Browsers, Figma, Blender, Krita, Sketch (TLS via Nginx) |
| `ws://tokenbeam.dev:8080` | 8080 | Aseprite (direct to Node.js, no TLS — required because Aseprite's IXWebSocket has no TLS support) |

### Server setup (from scratch)

```bash
# 1. SSH into the VPS
ssh root@<IP>

# 2. Install Node.js 20
curl -fsSL https://deb.nodesource.com/setup_20.x | bash -
apt-get install -y nodejs

# 3. Deploy the app to /opt/token-beam
mkdir -p /opt/token-beam
# Copy package.json, tsconfig.json, src/, lib-dist/ to /opt/token-beam
# Rewrite the token-beam dependency to use the local copy:
cd /opt/token-beam
sed -i 's|"token-beam": "\*"|"token-beam": "file:./lib-dist"|' package.json
npm install
npm run build

# 4. Create systemd service
cat > /etc/systemd/system/token-beam.service << 'EOF'
[Unit]
Description=Token Beam WebSocket Server
After=network.target

[Service]
Type=simple
User=root
WorkingDirectory=/opt/token-beam
ExecStart=/usr/bin/node dist/cli.js
Restart=on-failure
RestartSec=5
Environment=PORT=8080
StandardOutput=journal
StandardError=journal

[Install]
WantedBy=multi-user.target
EOF

systemctl daemon-reload
systemctl enable token-beam
systemctl start token-beam

# 5. Install Nginx + Certbot
apt-get install -y nginx certbot python3-certbot-nginx

# 6. Configure Nginx (WebSocket proxy)
cat > /etc/nginx/sites-available/tokenbeam.dev << 'EOF'
server {
    listen 80;
    server_name tokenbeam.dev;

    location / {
        proxy_pass http://127.0.0.1:8080;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_read_timeout 86400;
        proxy_send_timeout 86400;
    }
}
EOF

ln -sf /etc/nginx/sites-available/tokenbeam.dev /etc/nginx/sites-enabled/
rm -f /etc/nginx/sites-enabled/default
systemctl reload nginx

# 7. Get TLS certificate (auto-configures Nginx for HTTPS + redirect)
certbot --nginx -d tokenbeam.dev --non-interactive --agree-tos --email <EMAIL>
```

### Redeployment

```bash
# On your local machine — build and upload:
cd packages/sync-server
npm run predeploy
tar czf /tmp/tb-deploy.tar.gz -C . package.json tsconfig.docker.json src/ lib-dist/
scp /tmp/tb-deploy.tar.gz root@<IP>:/tmp/

# On the VPS — extract and rebuild:
ssh root@<IP>
cd /opt/token-beam
rm -rf src lib-dist
tar xzf /tmp/tb-deploy.tar.gz
sed -i 's|"token-beam": "\*"|"token-beam": "file:./lib-dist"|' package.json
npm install
npm run build
systemctl restart token-beam
```

### Useful commands

```bash
# Check server status
systemctl status token-beam

# View logs (live)
journalctl -u token-beam -f

# Restart after code changes
systemctl restart token-beam

# Test WebSocket handshake
curl -v -m 5 --http1.1 \
  -H "Connection: Upgrade" -H "Upgrade: websocket" \
  -H "Sec-WebSocket-Key: dGhlIHNhbXBsZSBub25jZQ==" \
  -H "Sec-WebSocket-Version: 13" \
  https://tokenbeam.dev

# TLS certificate auto-renews via certbot timer:
systemctl list-timers certbot.timer
```

### DNS (Cloudflare)

| Type | Name | Content | Proxy |
|---|---|---|---|
| A | `@` | `<VPS IP>` | DNS only (grey cloud) |

Cloudflare proxy **must** be off (DNS only). Cloudflare's HTTP proxy lowercases WebSocket upgrade headers, which breaks Aseprite's IXWebSocket client.

### Why not Fly.io?

The server was originally deployed on Fly.io, but Fly's HTTP proxy lowercases WebSocket upgrade response headers (`Upgrade:` → `upgrade:`). This is valid per HTTP spec, but Aseprite bundles an older IXWebSocket (v11.4.x) that cannot parse these modified responses, failing with "Failed reading HTTP status line". A direct VPS avoids any intermediary proxy.

## Environment Variables

- `PORT`: Server port (default: `8080`)

## License

AGPL-3.0 OR Commercial. See [LICENSE](../../LICENSE) for details.
