# ⊷ Token Beam (lib)

Core types and sync client for building design-token workflows.

## Quick Start

### Installation

```bash
npm install token-beam
```

### Try the Example Widget

The package includes a complete, working example widget (`example-widget.html`). After installing the package, you can find it in:

```
node_modules/token-beam/example-widget.html
```

Open it in your browser to see a fully functional sync widget with demo controls. The file includes:

- Complete HTML markup
- All necessary CSS styling
- Interactive JavaScript demo
- Integration code examples

You can copy and paste from this example directly into your project!

### Basic Usage (Recommended)

```ts
import { SourceSession, createCollection } from 'token-beam';
import type { TokenSyncPayload } from 'token-beam';

const session = new SourceSession<TokenSyncPayload>({
  clientType: 'web',
  origin: 'My Design System',
  icon: { type: 'unicode', value: '🎨' },
});

session.on('paired', ({ sessionToken }) => {
  console.log('Pairing token:', sessionToken);
});

session.on('peer-connected', ({ clientType }) => {
  console.log('Design tool connected:', clientType);
});

await session.connect();

// Send tokens to connected design tools
const payload = createCollection('colors', {
  primary: '#0066cc',
  secondary: '#6b7280',
});

session.sync(payload);
```

### Target-side Usage

```ts
import { TargetSession, filterPayloadByType } from 'token-beam';
import type { TokenSyncPayload } from 'token-beam';

const target = new TargetSession<TokenSyncPayload>({
  clientType: 'figma',
  sessionToken: 'beam://ABC123',
  origin: 'Figma',
});

target.on('sync', ({ payload }) => {
  const colorsOnly = filterPayloadByType(payload, ['color']);
  console.log('Incoming colors:', colorsOnly?.collections ?? []);
});

await target.connect();
```

By default, both `SourceSession` and `TargetSession` connect to `wss://tokenbeam.dev`.

### Advanced: Override Server URL

Override `serverUrl` only when running a fork or when testing changes to the sync server code. For standard usage, keep the default `wss://tokenbeam.dev`.

```ts
import { SourceSession } from 'token-beam';

const session = new SourceSession({
  serverUrl: 'ws://localhost:8080',
  clientType: 'web',
});
```

### Which API Should I Use?

| Use case | Recommended API |
| --- | --- |
| Website/app sending tokens | `SourceSession` |
| Plugin/design-tool receiving tokens | `TargetSession` |
| Custom transport parsing/filter pipeline | Low-level consumer helpers |
| Full manual WebSocket lifecycle control | `SyncClient` |

Use session classes by default. Reach for low-level helpers only when you need custom behavior not covered by session events.

### Session Events and State Semantics

Session classes expose a small typed event model:

- `connected`: WebSocket is open and pair handshake was sent.
- `paired`: session token is confirmed and available via `sessionToken`.
- `peer-connected`: a target client joined this session.
- `peer-disconnected`: a connected target client left the session.
- `sync`: token payload received.
- `warning`: non-fatal warning (`[warn] ...`) from the server.
- `error`: fatal error requiring user/action handling.

State transitions are available via `getState()` and `state` events (`idle → connecting → connected → paired`, then `disconnected` or `error`).

### Error Handling Pattern

```ts
session.on('warning', ({ message }) => {
  console.warn('[token-beam]', message);
});

session.on('error', ({ message }) => {
  if (message === 'Invalid session token') {
    // show friendly "token not found" message
    return;
  }

  // fallback for unknown errors
  console.error('Sync error:', message);
});
```

### Reconnect Behavior

Session classes inherit reconnect behavior from `SyncClient`:

- automatic reconnect on unintentional disconnect
- exponential backoff between attempts
- no reconnect after manual `disconnect()`

## Migration from `SyncClient`

If you currently use callback-based `SyncClient`, migrate by mapping callbacks to typed events:

```ts
// Before
const client = new SyncClient({
  serverUrl: 'wss://tokenbeam.dev',
  clientType: 'web',
  onPaired: (token) => {
    console.log(token);
  },
  onTargetConnected: () => {
    console.log('connected');
  },
});

// After
const session = new SourceSession({ clientType: 'web' });
session.on('paired', ({ sessionToken }) => console.log(sessionToken));
session.on('peer-connected', () => console.log('connected'));
await session.connect();
```

### Consumer API (for JS/TS plugins)

`token-beam` also ships low-level consumer helpers for custom workflows:

```ts
import {
  normalizeSessionToken,
  parseSyncMessage,
  filterPayloadByType,
  extractColorTokens,
  isWarningError,
} from 'token-beam';

const token = normalizeSessionToken(inputValue);
if (!token) throw new Error('Invalid token');

const message = parseSyncMessage(event.data);
if (!message) return;

if (message.type === 'sync') {
  const colorPayload = filterPayloadByType(message.payload, ['color']);
  const colors = extractColorTokens(message.payload);
}

if (message.type === 'error' && message.error && isWarningError(message.error)) {
  console.warn(message.error);
}
```

This gives plugin authors one consistent, tested way to:

- normalize session tokens (`beam://...`)
- parse and validate inbound sync messages
- filter payloads by token type
- extract valid color tokens from payloads

These helpers are used by first-party JS/TS consumers in this monorepo, including the Figma UI, Sketch UI, and marketing-site demo widget.

### Token Support Depends on Target

Token Beam transports DTCG-style tokens, but each target plugin or program decides which token types it can apply. For example:

- Aseprite: colors only.
- Figma: colors, booleans, strings, and sizes.

If a target does not support a token type, it will ignore it or map it differently.

### Naming Strategy for Reliable Updates

Use stable collection and token names when syncing repeatedly.

- Recommended collection pattern: `palette:<toolname>` (for example `palette:figma`)
- Recommended token pattern: `color/01`, `color/02`, `color/03`, ...

Why: tools with richer data models (such as Figma variables) match by name and will create new entries when names change. Stable names make updates overwrite existing entries instead of appending more.

In flatter targets (such as Aseprite palettes), entries are typically replaced by position/workflow anyway, so name drift is less critical.

### App Icon

Source apps can provide an icon that gets displayed in the paired design tool plugin. Two formats are supported:

```ts
// Unicode character (emoji, symbol, etc.)
icon: { type: 'unicode', value: '🎨' }

// SVG string (max 10KB, sanitized server-side)
icon: { type: 'svg', value: '<svg viewBox="0 0 24 24">...</svg>' }
```

The server sanitizes icons before relaying them to target clients. Invalid icons are rejected with a `[warn]` error message (non-fatal — the connection still proceeds).

## Widget Implementation

For a complete, production-ready widget implementation, see the included **[`example-widget.html`](./example-widget.html)** file.

This standalone HTML file includes:

- ✨ Full widget UI with all states (waiting, connected, error)
- 🎨 Complete CSS styling
- ⚡ Interactive demo with live color syncing
- 📝 Copy-pasteable integration code
- 🔧 Working JavaScript examples

**Quick start:**

```bash
# After installation, open in your browser:
open node_modules/token-beam/example-widget.html

# Or copy it to your project:
cp node_modules/token-beam/example-widget.html ./my-widget.html
```

## License

AGPL-3.0 OR Commercial. See [LICENSE](../../LICENSE) for details.
