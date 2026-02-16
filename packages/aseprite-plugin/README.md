# ⊷ Token Beam - Aseprite Plugin

Sync design tokens (colors) to Aseprite palettes in real-time.

## Features

- 🎨 Syncs color tokens to Aseprite palette
- 🔄 Real-time updates via WebSocket
- 🎯 Simple dialog interface in Aseprite
- 📦 Filters color tokens only
- ⚡ Automatic palette updates
- 🚀 Direct WebSocket connection (no bridge needed!)

## Architecture

```
Aseprite (Lua with native WebSocket)
    ↓ WebSocket
Sync Server
    ↓ WebSocket
Demo / Other Clients
```

## Installation

### 2. Install the Aseprite Extension

**Option A: Quick Install (macOS)**

Run the install script from the root of the project:

```bash
npm run install:aseprite
```

This copies the Lua script to `~/Library/Application Support/Aseprite/scripts/token-beam.lua`.

**Note:** This script is currently macOS-specific. For Windows/Linux, use Option B or C below.

Restart Aseprite after installation.

To uninstall:

```bash
npm run uninstall:aseprite
```

**Option B: Manual Symlink (Development)**

Create a symlink to the Lua script in Aseprite's scripts folder:

- **macOS**: `~/Library/Application Support/Aseprite/scripts/`
- **Windows**: `%APPDATA%\Aseprite\scripts\`
- **Linux**: `~/.config/aseprite/scripts/`

```bash
# macOS/Linux
ln -s "$(pwd)/token-beam.lua" ~/Library/Application\ Support/Aseprite/scripts/token-beam.lua

# Windows (PowerShell as Admin)
New-Item -ItemType SymbolicLink -Path "$env:APPDATA\Aseprite\scripts\token-beam.lua" -Target "$(pwd)\token-beam.lua"
```

**Option C: Manual Copy**

Copy `token-beam.lua` to Aseprite's scripts directory.

Restart Aseprite after installation.

## Usage

1. **Make sure the sync server is running:**
   ```bash
   # From project root
   npm run start:server
   ```

2. **Open or create a sprite in Aseprite**

3. **Run ⊷ Token Beam:**
   - Go to **File → Scripts → ⊷ Token Beam**
   - Enter your session token (e.g., `beam://ABC123`)
   - Click **Connect**
   - Colors will automatically update your sprite's palette!

## How It Works

1. **Aseprite Plugin (Lua)**: 
   - Creates a dialog for token input
   - Connects to sync server via native WebSocket API
   - Applies colors to the active sprite's palette

2. **WebSocket Communication**:
   - Direct connection to sync server
   - Receives real-time color updates
   - No intermediate server needed!

3. **Color Application**:
   - Only color tokens are synced
   - Palette is updated with new colors
   - First color slot is preserved for transparency

## Configuration

### Sync Server URL

Edit `token-beam.lua` and change:

```lua
local syncServerUrl = "ws://localhost:8080"
```

Default is `ws://localhost:8080`.

You can also set it during install:

```bash
SYNC_SERVER_URL="wss://your-server.example" npm run install:aseprite
```

## Troubleshooting

### "No active sprite" error

Create or open a sprite before running ⊷ Token Beam.

### "Connection failed" or immediate disconnect

1. Make sure the sync server is running (`npm run start:server`)
2. Verify the `syncServerUrl` in the Lua script
3. Check that port 8080 is not blocked by firewall

### Colors not updating

1. Verify the token is correct
2. Make sure the demo/source is sending color tokens
3. Check Aseprite's console for errors (Help → Developer Console)

## Development

Edit `token-beam.lua` and reload the script in Aseprite:
- **File → Scripts → Rescan Scripts Folder**

Or restart Aseprite to reload the script.

## Project Structure

```
aseprite-plugin/
├── package.json           # Aseprite extension manifest
├── token-beam.lua         # Main Lua script with WebSocket support
└── README.md
```

## Aseprite WebSocket API

This plugin uses Aseprite's native [WebSocket API](https://www.aseprite.org/api/websocket) introduced in recent versions. Make sure you're using Aseprite v1.3+ for WebSocket support.

## License

AGPL-3.0 OR Commercial. See [LICENSE](../../LICENSE) for details.
