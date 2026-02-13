# ⊷ Token Beam - Sketch Plugin

Sync design tokens from your web app to Sketch color variables in real-time.

## Installation

```bash
npm run install:sketch
```

This will build and install the plugin to Sketch.

## Usage

1. Open Sketch
2. Go to **Plugins → ⊷ Token Beam → ⊷ Token Beam**
3. Enter your session token from the web demo (e.g., `beam://ABC123`)
4. Click **Connect**
5. Colors will sync automatically to your document's color variables

## Uninstall

```bash
npm run uninstall:sketch
```

## Requirements

- Sketch 3.0 or later
- macOS
- Sync server running on `ws://localhost:8080`

## How it Works

The plugin creates a WebView window that connects to the sync server via WebSocket. When colors are synced from the web demo, they're automatically added to your document's color variables.

## Development

The plugin is built using:
- TypeScript source files transpiled to Sketch-compatible JavaScript
- Native Sketch JavaScript API (CocoaScript)
- WKWebView for the UI
- WebSocket for real-time communication

To rebuild after making changes:

```bash
npm run build
npm run install:sketch
```

Then restart Sketch or use **Plugins → Custom Plugin → Reload Plugins**.

## License

AGPL-3.0 OR Commercial. See [LICENSE](../../LICENSE) for details.
