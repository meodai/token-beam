# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Added
- `SourceSession` and `TargetSession` high-level sync APIs
- Typed session event model (`paired`, `peer-connected`, `peer-disconnected`, `sync`, `warning`, `error`, `state`)
- `DEFAULT_SYNC_SERVER_URL` constant (`wss://tokenbeam.dev`)
- Consumer helpers: `normalizeSessionToken`, `isWarningError`, `isSyncMessage`, `parseSyncMessage`, `flattenPayload`, `filterPayloadByType`, `extractColorTokens`

### Changed
- `SourceSessionOptions` and `TargetSessionOptions` now accept optional `serverUrl` and default to `wss://tokenbeam.dev`
- README updated to document class-first usage, migration guidance, naming strategy, and advanced server override behavior

## [0.1.0] - 2026-02-11

### Added
- Initial release of token-beam library
- `SyncClient` for WebSocket-based real-time synchronization
- W3C Design Tokens Community Group (DTCG) spec compliance
- `createCollection` and `createMultiModeCollection` helpers
- `resolveToken` for token value resolution
- TypeScript type definitions for all APIs
- Support for multiple token types (color, dimension, fontFamily, fontWeight, duration, cubicBezier, number, strokeStyle, border, transition, shadow, gradient, typography)
- Node.js utilities for server-side usage
- Plugin architecture with adapter pattern
- Built-in plugin links for Figma, Sketch, and Aseprite
- **Complete example widget** (`example-widget.html`) with interactive demo
- Comprehensive README with widget implementation guide

[0.1.0]: https://github.com/meodai/token-beam/releases/tag/v0.1.0
