# ⊷ Token Beam - Blender Add-on

Sync design token colors into Blender in real-time.

## Features

- 🎨 Receives `color` tokens from Token Beam payloads
- 🔄 Real-time updates via WebSocket pairing token
- 🧭 Simple panel in Blender sidebar (`View3D > N > Token Beam`)
- 📦 Stores synced colors in `Scene > Token Beam > Colors`

## Installation

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

## Notes

- This first version syncs and stores colors as scene properties.
- You can use those properties in your own scripts/nodes/workflows.

## Project Structure

```text
blender-plugin/
├── package.json
├── README.md
└── token_beam/
    └── __init__.py
```
