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
2. Contact them: sales@token-beam.dev
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

## Environment Variables

- `PORT`: Server port (default: `8080`)

## Pricing & Licensing

**Free (AGPL-3.0)**: Personal projects, self-hosted

**Pro: $29/month**
- Hosted service (we manage the infrastructure)
- Unlimited sessions
- Commercial use allowed
- Standard plugins only

**Enterprise: $299/month**
- Self-hosting with commercial license
- Modify plugins for your needs
- Source code access
- SSO & SAML
- Priority support (24h SLA)
- Custom integrations

### Open Source Exception

Open source projects with an OSI-approved license can request a **free commercial license**.

**Requirements:**
- Project must be publicly available (e.g., GitHub)
- Must use an OSI-approved open source license
- Must not be a commercial/proprietary product

To apply, email: opensource@token-beam.dev

## Contact

For commercial licensing inquiries:
- Email: sales@token-beam.dev
- Website: https://token-beam.dev

---

Copyright (c) 2026 David Aerne (meodai)
All rights reserved.
