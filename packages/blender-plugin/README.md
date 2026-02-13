# ⊷ Token Beam - Blender Add-on

Sync design token colors into Blender in real-time.

## Features

- 🎨 Receives `color` tokens from Token Beam payloads
- 🔄 Real-time updates via WebSocket pairing token
- 🧭 Simple panel in Blender sidebar (`View3D > N > Token Beam`)
- 📦 Stores synced colors in `Scene > Token Beam > Colors`

## Installation

For Blender 4.2+ extension zip import, the bundled archive includes both top-level `__init__.py` and `blender_manifest.toml`.

### Quick install (macOS)

From the project root:

```bash
npm run install:blender
```

This installs the add-on into your latest Blender user scripts folder under:

`~/Library/Application Support/Blender/<version>/scripts/addons/token_beam`

To uninstall:

```bash
npm run uninstall:blender
```

## Enable in Blender

1. Open Blender
2. Go to **Edit → Preferences → Add-ons**
3. Search for **Token Beam**
4. Enable **Token Beam: Sync design token colors via WebSocket**

## Python Dependency

This add-on uses `websocket-client` inside Blender's Python environment.

Install once from Blender's Python console or terminal:

```python
import ensurepip, subprocess, sys
ensurepip.bootstrap()
subprocess.check_call([sys.executable, "-m", "pip", "install", "websocket-client"])
```

## Usage

1. Start the sync server:

   ```bash
   npm run start:server
   ```

2. In Blender, open the sidebar panel:
   - 3D Viewport → press `N`
   - **Token Beam** tab

3. Paste your pairing token (e.g. `beam://ABC123`) and click **Connect**

4. Color tokens are synced into `Scene > Token Beam > Colors`.

## Where to find color palettes in Blender

Blender palettes are tied to paint contexts — they're not globally visible.

1. Switch to **Texture Paint** (or Vertex/Weight Paint)
2. Press **N** to open the right sidebar
3. Look for the **Color Palette** panel
4. If empty, click **New** to create one

Token Beam automatically creates a palette called **"Token Beam"** when colors are synced. You'll find it in the palette dropdown once you're in a paint context.

## Notes

- Synced colors are stored both as scene properties and as a native Blender palette
- The palette persists when you save your `.blend` file
- Materials are also created for each color so you can apply them to meshes directly

## License

AGPL-3.0 OR Commercial. See [LICENSE](../../LICENSE) for details.
