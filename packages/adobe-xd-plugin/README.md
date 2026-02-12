# ⊷ Token Beam - Adobe XD (UXP) Plugin

Sync design token colors from Token Beam sessions directly into Adobe XD color assets.

## What it does

- Connects Adobe XD to the Token Beam sync server via WebSocket
- Accepts a `beam://...` session token
- Listens for token sync events
- Adds new color tokens to XD document assets

## Install (macOS)

From the monorepo root:

```bash
npm run install:adobe-xd
```

This installs the plugin to:

`~/Library/Application Support/Adobe/UXP/Plugins/External/token-beam-adobe-xd`

Then in Adobe XD, enable/load the plugin from your development plugins panel.

## Uninstall

```bash
npm run uninstall:adobe-xd
```

## Usage

1. Start the sync server (`npm run start:server`)
2. Open the Token Beam panel in Adobe XD
3. Paste your session token
4. Click **Connect**
5. When sync payloads arrive, new colors are added to XD assets

## Notes

- Current scope is color tokens only (`type: "color"`)
- Server URL defaults to `ws://localhost:8080`
- This is a minimal UXP panel implementation designed for quick shipping
