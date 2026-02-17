# ⊷ Token Beam - Marketing Site

Landing page and interactive website demo for Token Beam.

## Purpose

The marketing site (`packages/marketing`) provides:

- product overview and positioning
- plugin download links
- a live in-page sync demo widget

## Development

Run from the monorepo root:

```bash
npm run dev:marketing
```

Build:

```bash
npm run build:marketing
```

## Key Files

- `src/pages/index.astro` — page structure and sections
- `src/scripts/demo.ts` — live sync demo logic
- `src/styles/widget.css` — demo widget styles

## Live Demo Sync Architecture

The demo script uses the high-level `SourceSession` class from `token-beam` as its primary integration API.

Current usage in `src/scripts/demo.ts`:

- `SourceSession` for connection lifecycle, pairing state, peer tracking, and typed events
- `isWarningError(error)` for non-fatal warning filtering
- `normalizeSessionToken(token)` for consistent session token display

This keeps web-demo behavior consistent with other JS/TS consumers such as the Figma and Sketch plugin UIs.

## License

AGPL-3.0 OR Commercial. See [LICENSE](../../LICENSE) for details.
