# ⊷ Token Beam

A tool-agnostic design token synchronization system aligned with the **W3C Design Tokens Community Group** specification.

## Specification Alignment

This project is aligned with the [W3C Design Tokens Format Module 2025.10](https://www.designtokens.org/tr/2025.10/format/) specification (Final Community Group Report, 28 October 2025), while using a normalized internal transport model.

### Core Features Aligned with Spec

- **Generic Token Types**: Lowercase type names (`color`, `number`, `string`, `boolean`) per spec section 8
- **Normalized Internal Shape**: Runtime payloads use `name`, `type`, and `value` fields, mapped from DTCG token concepts for transport and adapter transforms
- **Color Values**: Stored as spec strings (e.g. `#0066cc`) — each consumer adapter converts to its target format
- **Adapter Ownership**: Tool-specific output details (field naming and value conversion) are handled in consumer adapters

### Architecture

#### Core Library (`packages/lib`)

The generic token data model that is tool-agnostic:

```typescript
interface DesignToken {
  name: string;
  type: TokenType; // 'color' | 'number' | 'string' | 'boolean'
  value: string | number | boolean;
}

interface TokenCollection {
  name: string;
  modes: TokenMode[];
}

interface TokenSyncPayload {
  collections: TokenCollection[];
}
```

#### Target Adapters

Each consumer plugin owns its own adapter — a pure transform function that converts the generic `TokenSyncPayload` into the tool-specific format. The lib provides the `TargetAdapter<T>` interface, but the implementation lives in the plugin:

- **Figma plugin** (`packages/figma-plugin/src/adapter.ts`): Maps `'color'` → `'COLOR'`, `'number'` → `'FLOAT'`, converts hex strings → 0–1 RGBA, transforms `tokens` → `variables`
- **Aseprite plugin** (`packages/aseprite-plugin`): Filters color tokens only, applies to sprite palette via Lua API
- **Blender add-on** (`packages/blender-plugin`): Receives color tokens and stores them as scene color properties via Python add-on panel
- Future plugins (Penpot, etc.) each implement their own adapter

**How it works (Figma example):**

```typescript
// 1. Web sends normalized generic payload via WebSocket
TokenSyncPayload { collections: [...] }

// 2. Figma UI receives generic payload
onSync: (payload: TokenSyncPayload) => { ... }

// 3. Adapter transforms to Figma-specific format
const figmaPayloads = figmaCollectionAdapter.transform(payload);
// → FigmaCollectionPayload[] { collectionName, modes, variables }

// 4. Sandbox code receives transformed payload
figma.ui.onmessage = (msg: { payload: FigmaCollectionPayload }) => { ... }

// 5. Applies to Figma API
figma.variables.createVariable(...)
```

This ensures type safety end-to-end while keeping the core library tool-agnostic.

#### Communication

- **HTTP-based**: REST API serving JSON payloads (one-time fetch)
- **Real-time sync**: WebSocket server for live design-to-code updates via token-based pairing

## Real-Time Sync

The **`packages/sync-server`** package provides a WebSocket server for real-time bidirectional synchronization between the web demo and Figma plugin.

### How It Works

1. **Web client** connects to sync server and receives a prefixed token (e.g., `beam://A3F9K2`)
2. **User** copies the token and pastes it into the Figma plugin
3. **Figma plugin** connects using the token and gets paired with the web session
4. **Changes** made on the website are instantly synced to Figma in real-time
5. **Session** stays alive for 30 minutes of inactivity, then auto-expires

### Running the Sync Server

```bash
# Development mode (with auto-reload)
npm run dev:server

# Production mode
npm run build:server
npm run start:server
```

The server runs on `ws://localhost:8080` by default. Set `PORT` environment variable to change:

```bash
PORT=9000 npm run start:server
```

### Commercial Use Monitoring

The sync server tracks connection origins to enforce licensing:

- **Browser Origin Header**: Automatically captured (can't be spoofed)
- **Blocklist**: Manually curate domains requiring commercial licenses
- **Logs**: Monitor usage patterns to identify commercial users

See [packages/sync-server/README.md](packages/sync-server/README.md) for implementation details.

### Architecture

```
┌─────────────┐         WebSocket          ┌──────────────────┐
│  Web Demo   │ ◄────── Token: beam://A3F9K2 ──── │  Sync Server     │
│  (Browser)  │                             │  (Node.js + WS)  │
└─────────────┘                             └──────────────────┘
                                                     ▲
                                                     │ WebSocket
                                                     │ Token: beam://A3F9K2
                                            ┌────────┴────────┐
                                            │ Figma Plugin    │
                                            │ (Plugin UI)     │
                                            └─────────────────┘
```

### Session Flow

1. Web connects → Server generates token → Web displays token
2. Figma enters token → Server pairs sessions
3. Web updates color → Server forwards to Figma → Figma applies
4. Both clients stay synced until disconnect or timeout

## Aseprite Plugin

The **`packages/aseprite-plugin`** package syncs color tokens to Aseprite palettes using Aseprite's native WebSocket API.

### Quick Start

1. **Install the Aseprite extension:**

   Quick install (macOS):

   ```bash
   npm run install:aseprite
   ```

   Or manually link/copy `packages/aseprite-plugin` to Aseprite's scripts folder:
   - **macOS**: `~/Library/Application Support/Aseprite/scripts/`
   - **Windows**: `%APPDATA%\Aseprite\scripts\`
   - **Linux**: `~/.config/aseprite/scripts/`

   Example (macOS):

   ```bash
   ln -s "$(pwd)/packages/aseprite-plugin" ~/Library/Application\ Support/Aseprite/scripts/token-beam
   ```

2. **Start the sync server:**

   ```bash
   npm run start:server
   ```

3. **Use in Aseprite:**
   - Open or create a sprite
   - Go to **File → Scripts → ⊷ Token Beam**
   - Enter your session token
   - Click **Connect**
   - Colors sync to your palette automatically!

### Architecture

```
Aseprite (Lua + WebSocket)
    ↓ WebSocket
Sync Server
```

Simple and direct! No bridge server needed thanks to Aseprite's native WebSocket support.

See [packages/aseprite-plugin/README.md](packages/aseprite-plugin/README.md) for detailed documentation.

## Blender Add-on

The **`packages/blender-plugin`** package syncs color tokens into Blender scene properties using a Python add-on.

### Blender Quick Start

1. **Install the Blender add-on (macOS):**

```bash
npm run install:blender
```

1. **Start the sync server:**

```bash
npm run start:server
```

1. **Use in Blender:**

- Enable the add-on in **Edit → Preferences → Add-ons**
- Open **3D Viewport → Sidebar (N) → Token Beam**
- Enter your session token and click **Connect**

See [packages/blender-plugin/README.md](packages/blender-plugin/README.md) for detailed setup and dependency notes.

## Project Structure

```
token-beam/
├── packages/
│   ├── lib/              # Core generic token library
│   │   ├── src/
│   │   │   ├── types.ts          # W3C DTCG-aligned types
│   │   │   ├── format.ts         # Token creation utilities
│   │   │   ├── sync-client.ts    # Generic WebSocket SyncClient
│   │   │   └── index.ts
│   │   └── dist/token-beam.js
│   │
│   ├── sync-server/      # WebSocket server for real-time sync
│   │   └── src/server.ts
│   │
│   ├── demo/             # Demo web app (sends generic TokenSyncPayload)
│   │   └── vite.config.ts
│   │
│   ├── figma-plugin/     # Figma plugin (owns its own adapter transform)
│   │   └── src/adapter.ts  # Figma-specific adapter
│   │
│   ├── aseprite-plugin/  # Aseprite extension
│   │   ├── token-beam.lua      # Lua script with WebSocket support
│   │   └── package.json        # Extension manifest
│   │
│   └── blender-plugin/   # Blender add-on
│       └── token_beam/__init__.py
│
├── package.json
└── README.md
```

## Usage

### Creating Tokens (W3C DTCG Format)

```typescript
import { createCollection } from 'token-beam';

const payload = createCollection('My Colors', {
  'color/primary': '#0066cc',
  'spacing/base': 16,
  'text/label': 'Hello',
});

// Returns W3C DTCG-aligned structure:
// {
//   collections: [{
//     name: "My Colors",
//     modes: [{
//       name: "Value",
//       tokens: [
//         { name: "color/primary", type: "color", value: "#0066cc" },
//         { name: "spacing/base", type: "number", value: 16 },
//         { name: "text/label", type: "string", value: "Hello" }
//       ]
//     }]
//   }]
// }
```

### Writing a Custom Adapter

Each consumer implements its own adapter using the `TargetAdapter<T>` interface from the lib:

```typescript
import type { TargetAdapter, TokenSyncPayload } from 'token-beam';

interface MyToolPayload {
  /* tool-specific shape */
}

const myToolAdapter: TargetAdapter<MyToolPayload> = {
  name: 'my-tool',
  transform(payload: TokenSyncPayload): MyToolPayload {
    // transform generic tokens → tool-specific format
  },
};
```

### Serving Tokens

```typescript
import { servePayload } from 'token-beam/node';

const payload = createCollection('Colors', { primary: '#0066cc' });
const { server, url } = await servePayload(payload, { port: 3333 });
console.log(`Serving at ${url}`); // http://localhost:3333
```

## Development

Tooling baseline:

- Node.js 20+
- npm 9+ (repo is pinned via `packageManager` in the root `package.json`)
- Internal package deps intentionally use `"token-beam": "*"` (not `workspace:*`) for compatibility across npm environments used by contributors and CI.

```bash
# Install dependencies
npm install

# Build all packages
npm run build

# Build library only
npm run build:lib

# Build Figma plugin
npm run build:figma

# Build sync server
npm run build:server

# Run demo (with hot reload)
npm run dev:demo

# Run Figma plugin dev mode
npm run dev:figma

# Install Aseprite extension (macOS)
npm run install:aseprite

# Install Blender add-on (macOS)
npm run install:blender

# Install Sketch plugin (macOS)
npm run install:sketch

# Install Krita plugin
npm run install:krita

# Install Adobe XD plugin (symlink for development)
npm run install:adobe-xd

# Run sync server
npm run start:server
```

## W3C DTCG Spec Reference

- **Specification**: [Design Tokens Format Module 2025.10](https://www.designtokens.org/tr/2025.10/format/)
- **Status**: Final Community Group Report (Candidate Recommendation)
- **Published**: 28 October 2025
- **Community Group**: [W3C Design Tokens CG](https://www.w3.org/groups/cg/design-tokens)

### Key Sections Reflected

- Section 5: Design Token concepts (name/type/value mapping in runtime payloads)
- Section 7: Alias/reference concepts (transported as token values; adapter-specific handling)
- Section 8: Core primitive types currently supported (`color`, `number`, `string`, `boolean`)

## License

AGPL-3.0 OR Commercial. Free for personal and open-source use. Commercial use requires a paid license.

See [LICENSE](LICENSE) for details. Contact: token-beam@elastiq.ch

Copyright (c) 2026 David Aerne (meodai)
