# ⊷ Token Beam – MCP Server

Let any LLM push design tokens to Figma, Krita, Aseprite, Sketch — or any Token Beam-enabled tool — via the [Model Context Protocol](https://modelcontextprotocol.io/).

```
LLM (Claude, GPT, …)
    ↓ MCP (stdio)
Token Beam MCP Server
    ↓ WebSocket
Token Beam Sync Server
    ↓ WebSocket
Design Tools (Figma, Krita, Aseprite, …)
```

## Features

- 🎨 Push any W3C DTCG token type: **colors**, **numbers**, **strings**, **booleans**
- 🔄 Multi-mode collections (e.g. Light / Dark themes)
- ⚡ Real-time sync — tokens appear instantly in paired design tools
- 🧩 Works with Claude Desktop, Claude Code, or any MCP-compatible client

## Tools

| Tool | Description |
|---|---|
| `create_session` | Start a sync session and get a `beam://` pairing token |
| `sync_tokens` | Push a named collection of tokens to all paired tools |
| `sync_multi_mode` | Push multi-mode collections (e.g. Light/Dark themes) |
| `get_session_status` | Check connection status and paired targets |
| `disconnect_session` | End the current session |

## Installation

### Prerequisites

- Node.js 18+
- The Token Beam sync server running (see [`packages/sync-server`](../sync-server/))

### Build from source

```bash
# From the monorepo root
npm install
npm run build -w packages/mcp-server
```

### Configure in Claude Desktop

Add to `~/Library/Application Support/Claude/claude_desktop_config.json` (macOS) or `%APPDATA%\Claude\claude_desktop_config.json` (Windows):

```json
{
  "mcpServers": {
    "token-beam": {
      "command": "node",
      "args": ["/absolute/path/to/packages/mcp-server/build/index.js"],
      "env": {
        "TOKEN_BEAM_SERVER": "ws://localhost:8080"
      }
    }
  }
}
```

Restart Claude Desktop after saving.

### Configure in Claude Code

Add to your project's `.claude/settings.json`:

```json
{
  "mcpServers": {
    "token-beam": {
      "command": "node",
      "args": ["/absolute/path/to/packages/mcp-server/build/index.js"],
      "env": {
        "TOKEN_BEAM_SERVER": "ws://localhost:8080"
      }
    }
  }
}
```

Restart Claude Code after saving.

### Configure with any MCP client

The server communicates over **stdio**. Point your MCP client at:

```bash
node /path/to/packages/mcp-server/build/index.js
```

Set the `TOKEN_BEAM_SERVER` environment variable to your sync server URL (defaults to `ws://localhost:8080`).

## Usage

### 1. Start the sync server

```bash
# From monorepo root
npm run start:server
```

### 2. Ask the LLM to create a session

> "Create a Token Beam session"

The LLM calls `create_session` and gets back a token like `beam://7B8BB1991386`.

### 3. Pair a design tool

Paste the token into Figma (Token Beam plugin), Krita, Aseprite, or any Token Beam client.

### 4. Push tokens

> "Send me a warm sunset palette"

The LLM calls `sync_tokens` — colors appear instantly in your design tool.

### Example prompts

- *"Push a warm sunset palette with 6 colors to Figma"*
- *"Create design tokens for a dark theme: background #1a1a2e, text #e0e0e0, primary #e94560, accent #0f3460"*
- *"Send spacing tokens: xs=4, sm=8, md=16, lg=24, xl=32"*
- *"Create Light and Dark mode tokens for a dashboard"*

### Example tool calls

**Simple color palette:**

```json
{
  "collection": "Sunset",
  "tokens": [
    { "name": "sun", "value": "#ff6b35" },
    { "name": "sky", "value": "#f7c59f" },
    { "name": "horizon", "value": "#efa48b" }
  ]
}
```

**Mixed token types:**

```json
{
  "collection": "Brand",
  "tokens": [
    { "name": "primary", "value": "#0066cc" },
    { "name": "border-radius", "value": 8 },
    { "name": "font-family", "value": "Inter" },
    { "name": "dark-mode", "value": true }
  ]
}
```

**Multi-mode (Light/Dark):**

```json
{
  "collection": "Theme",
  "modes": {
    "Light": [
      { "name": "bg", "value": "#ffffff" },
      { "name": "text", "value": "#111111" }
    ],
    "Dark": [
      { "name": "bg", "value": "#111111" },
      { "name": "text", "value": "#eeeeee" }
    ]
  }
}
```

## Testing with MCP Inspector

The [MCP Inspector](https://github.com/modelcontextprotocol/inspector) gives you a web UI to call each tool interactively:

```bash
npx @modelcontextprotocol/inspector node /absolute/path/to/packages/mcp-server/build/index.js
```

## Environment Variables

| Variable | Default | Description |
|---|---|---|
| `TOKEN_BEAM_SERVER` | `ws://localhost:8080` | WebSocket URL of the Token Beam sync server |

## Token Type Detection

When no explicit `type` is provided, tokens are auto-detected:

| Value | Detected Type |
|---|---|
| `"#ff3366"` | `color` |
| `16` | `number` |
| `true` / `false` | `boolean` |
| `"Inter"` | `string` |

You can always override with an explicit `type` field on any token entry.

## Project Structure

```
mcp-server/
├── src/
│   └── index.ts       # MCP server with 5 tools
├── build/             # Compiled output
├── package.json
├── tsconfig.json
└── README.md
```

## License

AGPL-3.0 OR Commercial. See [LICENSE](../../LICENSE) for details.
