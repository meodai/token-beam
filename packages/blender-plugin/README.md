# ⊷ Token Beam - Blender Add-on

Sync design token colors into Blender in real-time.

## Features

- 🎨 Receives `color` tokens from Token Beam payloads
- 🔄 Real-time updates via WebSocket pairing token
- 🧭 Simple panel in Blender sidebar (`View3D > N > Token Beam`)
- 📦 Stores synced colors in `Scene > Token Beam > Colors`

## Installation

### From the release zip (recommended)

1. Download `token-beam-blender.zip` from the
   [latest release](https://github.com/meodai/token-beam/releases)
2. In Blender, go to **Edit > Preferences > Get Extensions**
3. Click the dropdown arrow (top-right) and select **Install from Disk**
4. Select the downloaded `.zip` file

The extension and its Python dependencies (`websocket-client`) are installed
automatically.

### Quick install for development (macOS)

From the project root:

```bash
npm run install:blender
```

This copies the add-on into your Blender user scripts folder. When using this
method you need to install the Python dependency manually once from Blender's
Python console:

```python
import ensurepip, subprocess, sys
ensurepip.bootstrap()
subprocess.check_call([sys.executable, "-m", "pip", "install", "websocket-client"])
```

To uninstall:

```bash
npm run uninstall:blender
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
