# ⊷ Token Beam - Aseprite Plugin

Sync design tokens (colors) to and from Aseprite palettes in real-time.

## Installation

Download the latest `token-beam-aseprite.zip` from the [releases page](https://github.com/meodai/token-beam/releases), unzip it, and copy the `token-beam` folder to your Aseprite scripts directory:

- **macOS**: `~/Library/Application Support/Aseprite/scripts/`
- **Windows**: `%APPDATA%\Aseprite\scripts\`
- **Linux**: `~/.config/aseprite/scripts/`

Restart Aseprite after installation.

## Usage

1. **Open or create a sprite in Aseprite**

2. **Run ⊷ Token Beam:**
   - Go to **File → Scripts → ⊷ Token Beam**

3. **Receive mode** (default tab):
   - Paste a session token (e.g., `beam://ABC123`) from another app
   - Click **Connect**
   - Colors will automatically update your sprite's palette

4. **Send mode** (second tab):
   - Switching to the Send tab auto-connects and shows a `beam://` token
   - Click **Copy Token** and paste it into another tool (Figma, web demo, etc.)
   - Your palette is sent automatically whenever it changes
   - Picking a foreground/background color also sends the active color

## Troubleshooting

### "No active sprite" error

Create or open a sprite before running ⊷ Token Beam.

### Connection failed

1. Check that you're connected to the internet
2. Check Aseprite's console for errors (Help → Developer Console)

### Colors not updating

1. Verify the token is correct
2. Make sure the source is sending color tokens
3. Check Aseprite's console for errors (Help → Developer Console)

---

## Development

> The instructions below are for developing the plugin locally, not for installing it.

### Quick Install (macOS)

```bash
npm run install:aseprite
```

Copies `token-beam.lua` to `~/Library/Application Support/Aseprite/scripts/`.

To uninstall:

```bash
npm run uninstall:aseprite
```

### Symlink (live reload)

```bash
# macOS/Linux
ln -s "$(pwd)/token-beam.lua" ~/Library/Application\ Support/Aseprite/scripts/token-beam.lua

# Windows (PowerShell as Admin)
New-Item -ItemType SymbolicLink -Path "$env:APPDATA\Aseprite\scripts\token-beam.lua" -Target "$(pwd)\token-beam.lua"
```

### Reload after changes

**File → Scripts → Rescan Scripts Folder** or restart Aseprite.

### Bundle for release

```bash
npm run bundle
```

Creates `token-beam-aseprite.zip`.

## Project Structure

```
aseprite-plugin/
├── package.json           # Aseprite extension manifest
├── token-beam.lua         # Main Lua script with WebSocket support
└── README.md
```

## Requirements

Aseprite v1.3+ with [WebSocket API](https://www.aseprite.org/api/websocket) support.

## License

AGPL-3.0 OR Commercial. See [LICENSE](../../LICENSE) for details.
