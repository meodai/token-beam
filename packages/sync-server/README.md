# Token Sync Server

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
    console.log('Share this token:', token); // e.g., "dts://A1B2C3D4E5F6"
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
  sessionToken: 'dts://A1B2C3D4E5F6', // Token from web client
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
  "sessionToken": "dts://A1B2C3D4E5F6" // Only for Figma
}
```

#### Pair Response (Server → Client)
```json
{
  "type": "pair",
  "sessionToken": "dts://A1B2C3D4E5F6",
  "clientType": "web" | "figma"
}
```

#### Sync Message (Client ↔ Server ↔ Client)
```json
{
  "type": "sync",
  "payload": { /* FigmaCollectionPayload */ }
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

- **Token-based pairing**: Cryptographically secure hex tokens (e.g., `dts://A1B2C3D4E5F6`) — recognizable for future deep-linking
- **Session management**: Auto-cleanup after 30 minutes of inactivity
- **Payload size limits**: 10MB maximum message size to prevent abuse
- **Reconnection handling**: Automatic reconnection with exponential backoff
- **Health checks**: HTTP endpoint at `/health`
- **Heartbeat ping**: Keeps connections alive

## API

### Server

```typescript
import { TokenSyncServer } from 'token-sync-server';

const server = new TokenSyncServer(8080);
await server.start();
```

### Client

```typescript
interface SyncClientOptions {
  serverUrl: string;
  clientType: 'web' | 'figma';
  sessionToken?: string; // Required for 'figma' type
  onPaired?: (token: string) => void;
  onSync?: (payload: FigmaCollectionPayload) => void;
  onError?: (error: string) => void;
  onConnected?: () => void;
  onDisconnected?: () => void;
}
```

## Architecture

```
Session Lifecycle:
1. Web connects → Server generates token (e.g., "dts://A1B2C3D4E5F6")
2. User copies token
3. Figma enters token → Server pairs sessions
4. Bidirectional sync active
5. Auto-cleanup on timeout/disconnect
```

## Environment Variables

- `PORT`: Server port (default: `8080`)

## License

MIT
