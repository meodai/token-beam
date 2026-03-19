# Token Beam Integration Spec

This document describes how to integrate with the Token Beam sync server as a client (web or design tool plugin). It covers connection flow, message schema, expected behaviors, and responsibilities for consuming tokens.

## Scope

- WebSocket-based pairing and sync protocol.
- Session token lifecycle and reconnection behavior.
- Client responsibilities when receiving token payloads.

## Token Format Responsibility

Token payloads follow the Design Tokens Community Group (DTCG) draft format. Token Beam transports these payloads but does not transform them.

As an integration author, you are responsible for:
- Parsing the DTCG token structure.
- Converting tokens to your tool's native format.
- Handling unsupported token types or modes.
- Applying tokens to your target environment safely.

## Connection Overview

There are two client roles:

- **Receiver** (source): creates a session and receives a session token. Typically the web app that receives design tokens.
- **Sender** (target): joins an existing session using the token. Typically a design tool plugin that sends tokens.

All clients connect to the sync server via WebSocket.

### Server URL

- Local development: ws://localhost:8080
- Production: wss://<your-host>

## Message Schema

All messages are JSON objects.

```json
{
  "type": "pair" | "sync" | "ping" | "error",
  "sessionToken": "beam://ABC123...",
  "clientType": "receiver" | "sender" | "figma" | "sketch" | "aseprite" | "custom",
  "origin": "Your App Name",
  "icon": { "type": "unicode", "value": "*" } | { "type": "svg", "value": "<svg...>" },
  "payload": { "collections": [ ... ] },
  "error": "string"
}
```

### Fields

- type: required. One of pair, sync, ping, error.
- sessionToken: required for target clients when pairing.
- clientType: required. Identifies your app to paired clients. Canonical values are `"receiver"` (creates session, receives tokens) and `"sender"` (joins session, sends tokens). You can use any string up to 32 characters (letters, numbers, spaces, hyphens, underscores). Legacy values (`"web"`, `"figma"`, `"sketch"`, etc.) continue to work.
- origin: optional display name shown to other clients.
- icon: optional. Unicode or SVG (server sanitizes SVG).
- payload: used by sync messages only.
- error: used by error messages only.

## Pairing Flow

### Receiver (Source)

1. Connect to server.
2. Send pair message without a sessionToken.
3. Receive a pair response with sessionToken.

Request:
```json
{ "type": "pair", "clientType": "receiver", "origin": "My App" }
```

Response:
```json
{ "type": "pair", "sessionToken": "beam://ABC123", "clientType": "receiver" }
```

You can use a custom name instead of `"receiver"`:
```json
{ "type": "pair", "clientType": "My Dashboard", "origin": "My App" }
```
Note: only `"receiver"` and `"web"` (legacy) are recognized as source clients. Any other value will be treated as a target/sender.

### Sender (Target)

1. Connect to server.
2. Send pair message with sessionToken.
3. Receive pair response with origin and icon (if provided by source client).

Request:
```json
{ "type": "pair", "clientType": "sender", "sessionToken": "beam://ABC123" }
```

Response:
```json
{ "type": "pair", "clientType": "sender", "sessionToken": "beam://ABC123", "origin": "My App", "icon": { "type": "unicode", "value": "*" } }
```

You can use a custom name to identify your app:
```json
{ "type": "pair", "clientType": "My Figma Plugin", "sessionToken": "beam://ABC123", "origin": "My App" }
```

## Sync Flow

### Web Client -> Targets

```json
{ "type": "sync", "payload": { "collections": [ ... ] } }
```

The server broadcasts the payload to all connected target clients in the session.

### Target Client -> Web Client

Targets may also send sync messages to the web client. This is optional but supported.

## Ping

The server and clients may exchange ping messages to keep connections alive.

```json
{ "type": "ping" }
```

## Errors and Warnings

Errors are delivered as:
```json
{ "type": "error", "error": "message" }
```

Notes:
- Warnings may be prefixed with [warn]. Treat them as non-fatal.
- Invalid session tokens return an error and should prompt user action.
- If the web client disconnects, targets may receive an error indicating the web client disconnected.

## Reconnect Behavior

Recommended client behavior:
- Attempt reconnect with exponential backoff.
- Keep session token and re-pair on reconnect.
- Treat network errors as transient and surface a user-friendly status.

Suggested defaults:
- Initial delay: 1s, exponential backoff up to 30s.
- Re-pair after reconnect using the same session token.

## Icon Support

- Unicode icon: 1-3 visible characters.
- SVG icon: sanitized by server (no scripts, no external refs, size limited).

If the icon is rejected, the server sends a [warn] error but the session continues.

## Payload Example (DTCG-like)

The payload follows the DTCG structure. Example:

```json
{
  "collections": [
    {
      "name": "Base",
      "modes": [
        {
          "name": "Light",
          "tokens": [
            { "name": "color.primary", "type": "color", "value": "#3366ff" },
            { "name": "size.sm", "type": "dimension", "value": "4px" }
          ]
        }
      ]
    }
  ]
}
```

Mapping is integration-specific. For example, a design tool plugin might convert:
- color tokens to swatches or styles.
- dimension tokens to spacing variables.
- typography tokens to text styles.

## UI/UX Guidance

Recommended states to surface to users:
- Connecting: initial socket connection.
- Ready: paired, waiting for data.
- Syncing: receiving data.
- Offline: server unreachable or connection dropped.
- Error: invalid token or fatal error.

## Limits and Constraints

- Max payload size: 10MB (server-enforced).
- SVG icon size: max 10KB after sanitization.
- Unicode icon: 1-3 visible characters.

## Versioning and Compatibility

- The protocol is lightweight and may evolve.
- Treat unknown message fields as optional.
- Ignore unknown message types but log for diagnostics.
- Prefer tolerant parsing to avoid breaking on minor schema changes.

## Security Notes

- Use wss:// in production.
- Validate and sanitize any token values before applying them to your tool.
- Do not execute or render token content as code.

## Minimal Target Client Example (Pseudo-code)

```ts
const ws = new WebSocket(SYNC_SERVER_URL);
ws.onopen = () => {
  ws.send(JSON.stringify({
    type: 'pair',
    clientType: 'sender',
    sessionToken: token,
    origin: 'My Plugin'
  }));
};

ws.onmessage = (event) => {
  const msg = JSON.parse(event.data);
  if (msg.type === 'sync') {
    // Parse DTCG payload and apply to your tool.
  }
};
```

## Troubleshooting Checklist

- Confirm sync server is reachable.
- Verify session token format: beam://<HEX>.
- Ensure your clientType is 1-32 characters (letters, numbers, spaces, hyphens, underscores).
- Log error messages; treat [warn] as non-fatal.

## Contact

If you are building an integration and need help, open an issue in the main repository with your clientType, environment, and sample payloads.

## Legacy clientType Values

The following values are still supported for backward compatibility:

| Legacy value | Mapped role | Notes |
|---|---|---|
| `web` | source (receiver) | Original value for web clients |
| `figma` | target (sender) | Figma plugin |
| `sketch` | target (sender) | Sketch plugin |
| `aseprite` | target (sender) | Aseprite plugin |
| `blender` | target (sender) | Blender plugin |
| `krita` | target (sender) | Krita plugin |
| `adobe-xd` | target (sender) | Adobe XD plugin |

New integrations should use `"sender"` or `"receiver"`, or a custom name for their app.
