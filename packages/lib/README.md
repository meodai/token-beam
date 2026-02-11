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

### Basic Usage

```ts
import { SyncClient, createCollection } from 'token-beam';
import type { TokenSyncPayload } from 'token-beam';

const syncClient = new SyncClient<TokenSyncPayload>({
  serverUrl: location.hostname === 'localhost' ? 'ws://localhost:8080' : `wss://${location.host}`,
  clientType: 'web',
  origin: 'My Design System',
  icon: { type: 'unicode', value: '🎨' },
  onPaired: (token) => {
    console.log('Pairing token:', token);
  },
  onTargetConnected: () => {
    console.log('Design tool connected!');
  },
});

syncClient.connect();

// Send tokens to connected design tools
const payload = createCollection('colors', {
  primary: '#0066cc',
  secondary: '#6b7280',
});

syncClient.sync(payload);
```

### Token Support Depends on Target

Token Beam transports DTCG-style tokens, but each target plugin or program decides which token types it can apply. For example:

- Aseprite: colors only.
- Figma: colors, booleans, strings, and sizes.

If a target does not support a token type, it will ignore it or map it differently.

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

