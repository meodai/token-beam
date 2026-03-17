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

## Deployment

The marketing site is deployed to Hetzner as static files served by Nginx on `tokenbeam.dev`.

**Automatic:** Any push to `main` that touches `packages/marketing/` or `packages/lib/` triggers a [GitHub Actions workflow](https://github.com/meodai/token-beam/actions/workflows/deploy-marketing.yml) that builds and deploys via rsync.

**Manual:** The workflow can also be triggered manually via "Run workflow" in GitHub Actions.

Requires repository secrets: `HETZNER_HOST` and `HETZNER_SSH_KEY` (RSA PEM format).

## License

AGPL-3.0 OR Commercial. See [LICENSE](../../LICENSE) for details.
