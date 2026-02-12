#!/usr/bin/env node

/**
 * Token Beam MCP Server
 *
 * Exposes design-token sync as MCP tools so any LLM can push
 * tokens (colors, numbers, strings, booleans) to Figma, Krita,
 * Aseprite, Sketch — or any app connected via Token Beam.
 */

import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { z } from 'zod';
import WebSocket from 'ws';

// ---------------------------------------------------------------------------
// Types (mirrored from token-beam lib)
// ---------------------------------------------------------------------------

type TokenType = 'color' | 'number' | 'string' | 'boolean';

interface DesignToken {
  name: string;
  type: TokenType;
  value: string | number | boolean;
}

interface TokenMode {
  name: string;
  tokens: DesignToken[];
}

interface TokenCollection {
  name: string;
  modes: TokenMode[];
}

interface TokenSyncPayload {
  collections: TokenCollection[];
}

interface SyncMessage {
  type: 'pair' | 'sync' | 'ping' | 'error';
  sessionToken?: string;
  clientType?: string;
  origin?: string;
  payload?: TokenSyncPayload;
  error?: string;
}

// ---------------------------------------------------------------------------
// Session state
// ---------------------------------------------------------------------------

let ws: WebSocket | undefined;
let sessionToken: string | undefined;
let pairedOrigin: string | undefined;
let connectedTargets: string[] = [];
const serverUrl = process.env.TOKEN_BEAM_SERVER ?? 'ws://localhost:8080';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function isHexColor(v: string): boolean {
  return /^#([0-9a-fA-F]{3,4}|[0-9a-fA-F]{6}|[0-9a-fA-F]{8})$/.test(v);
}

function resolveToken(
  name: string,
  value: string | number | boolean,
  explicitType?: TokenType,
): DesignToken {
  if (explicitType) return { name, type: explicitType, value };
  if (typeof value === 'boolean') return { name, type: 'boolean', value };
  if (typeof value === 'number') return { name, type: 'number', value };
  if (typeof value === 'string' && isHexColor(value))
    return { name, type: 'color', value };
  return { name, type: 'string', value: String(value) };
}

function buildPayload(
  collectionName: string,
  tokens: Record<string, string | number | boolean>,
  modeName = 'Value',
): TokenSyncPayload {
  const resolved = Object.entries(tokens).map(([k, v]) => resolveToken(k, v));
  return {
    collections: [{ name: collectionName, modes: [{ name: modeName, tokens: resolved }] }],
  };
}

function buildMultiModePayload(
  collectionName: string,
  modes: Record<string, Record<string, string | number | boolean>>,
): TokenSyncPayload {
  const modeList: TokenMode[] = Object.entries(modes).map(([modeName, tokens]) => ({
    name: modeName,
    tokens: Object.entries(tokens).map(([k, v]) => resolveToken(k, v)),
  }));
  return { collections: [{ name: collectionName, modes: modeList }] };
}

function sendSync(payload: TokenSyncPayload): boolean {
  if (!ws || ws.readyState !== WebSocket.OPEN) return false;
  const msg: SyncMessage = { type: 'sync', payload };
  ws.send(JSON.stringify(msg));
  return true;
}

function connect(): Promise<string> {
  return new Promise((resolve, reject) => {
    if (ws && ws.readyState === WebSocket.OPEN) {
      resolve(sessionToken ?? 'already connected');
      return;
    }

    connectedTargets = [];
    pairedOrigin = undefined;

    const socket = new WebSocket(serverUrl);
    const timeout = setTimeout(() => {
      socket.close();
      reject(new Error('Connection timeout'));
    }, 10_000);

    socket.onopen = () => {
      clearTimeout(timeout);
      const pair: SyncMessage = {
        type: 'pair',
        clientType: 'mcp',
        origin: 'Token Beam MCP',
      };
      socket.send(JSON.stringify(pair));
    };

    socket.onmessage = (event) => {
      try {
        const msg: SyncMessage = JSON.parse(String(event.data));
        if (msg.type === 'pair') {
          if (msg.sessionToken) {
            sessionToken = msg.sessionToken;
            pairedOrigin = msg.origin;
            resolve(sessionToken);
          } else if (msg.clientType) {
            connectedTargets.push(msg.clientType);
          }
        } else if (msg.type === 'error') {
          console.error('[TokenBeam]', msg.error);
        }
      } catch {
        // ignore malformed
      }
    };

    socket.onclose = () => {
      ws = undefined;
      sessionToken = undefined;
    };

    socket.onerror = (err) => {
      clearTimeout(timeout);
      reject(new Error('WebSocket error: ' + String(err)));
    };

    ws = socket;
  });
}

function disconnect(): void {
  connectedTargets = [];
  pairedOrigin = undefined;
  sessionToken = undefined;
  if (ws) {
    ws.close();
    ws = undefined;
  }
}

// ---------------------------------------------------------------------------
// MCP Server
// ---------------------------------------------------------------------------

const server = new McpServer({
  name: 'token-beam',
  version: '0.1.0',
});

// -- Tool: create_session ---------------------------------------------------

server.registerTool(
  'create_session',
  {
    description:
      'Start a new Token Beam sync session. Returns a session token ' +
      'that can be pasted into Figma, Krita, Aseprite, or any Token Beam client ' +
      'to establish a live connection. The token looks like beam://ABC123...',
    inputSchema: {},
  },
  async () => {
    try {
      const token = await connect();
      return {
        content: [
          {
            type: 'text' as const,
            text: `Session created. Token: ${token}\n\nPaste this token into any Token Beam-enabled design tool to pair.`,
          },
        ],
      };
    } catch (e) {
      return {
        content: [
          { type: 'text' as const, text: `Failed to create session: ${e}` },
        ],
      };
    }
  },
);

// -- Tool: sync_tokens ------------------------------------------------------

const tokenEntrySchema = z.object({
  name: z.string().describe('Token name (e.g. "primary", "spacing/sm", "brand/red")'),
  value: z.union([z.string(), z.number(), z.boolean()]).describe(
    'Token value. Hex colors like "#ff3366" are auto-detected. ' +
    'Numbers, booleans, and other strings are also supported.',
  ),
  type: z
    .enum(['color', 'number', 'string', 'boolean'])
    .optional()
    .describe('Explicit token type. If omitted, type is inferred from the value.'),
});

server.registerTool(
  'sync_tokens',
  {
    description:
      'Push design tokens to all paired design tools. ' +
      'Supports any W3C DTCG token type: colors (#hex), numbers, strings, booleans. ' +
      'A session must be active (use create_session first). ' +
      'Tokens are sent as a named collection.',
    inputSchema: {
      collection: z
        .string()
        .describe('Collection name (e.g. "my palette", "spacing", "brand tokens")'),
      tokens: z
        .array(tokenEntrySchema)
        .min(1)
        .describe('Array of tokens to sync'),
      mode: z
        .string()
        .optional()
        .describe('Optional mode name (e.g. "Light", "Dark"). Defaults to "Value".'),
    },
  },
  async ({ collection, tokens, mode }) => {
    if (!ws || ws.readyState !== WebSocket.OPEN) {
      return {
        content: [
          {
            type: 'text' as const,
            text: 'No active session. Use create_session first.',
          },
        ],
      };
    }

    const tokenMap: Record<string, string | number | boolean> = {};
    for (const t of tokens) {
      tokenMap[t.name] = t.value;
    }

    const payload = buildPayload(collection, tokenMap, mode);
    const ok = sendSync(payload);

    if (ok) {
      const summary = tokens
        .map((t) => `  ${t.name}: ${t.value}`)
        .join('\n');
      return {
        content: [
          {
            type: 'text' as const,
            text: `Synced ${tokens.length} tokens in "${collection}":\n${summary}`,
          },
        ],
      };
    }

    return {
      content: [
        { type: 'text' as const, text: 'Failed to send sync message.' },
      ],
    };
  },
);

// -- Tool: sync_multi_mode --------------------------------------------------

server.registerTool(
  'sync_multi_mode',
  {
    description:
      'Push a multi-mode token collection (e.g. Light/Dark themes). ' +
      'Each mode contains its own set of tokens. ' +
      'A session must be active (use create_session first).',
    inputSchema: {
      collection: z.string().describe('Collection name'),
      modes: z
        .record(
          z.string(),
          z.array(tokenEntrySchema),
        )
        .describe(
          'Object mapping mode names to token arrays. ' +
          'Example: { "Light": [...], "Dark": [...] }',
        ),
    },
  },
  async ({ collection, modes }) => {
    if (!ws || ws.readyState !== WebSocket.OPEN) {
      return {
        content: [
          {
            type: 'text' as const,
            text: 'No active session. Use create_session first.',
          },
        ],
      };
    }

    const modeMap: Record<string, Record<string, string | number | boolean>> = {};
    for (const [modeName, tokenArr] of Object.entries(modes)) {
      const map: Record<string, string | number | boolean> = {};
      for (const t of tokenArr) {
        map[t.name] = t.value;
      }
      modeMap[modeName] = map;
    }

    const payload = buildMultiModePayload(collection, modeMap);
    const ok = sendSync(payload);

    if (ok) {
      const modeNames = Object.keys(modes).join(', ');
      const totalTokens = Object.values(modes).reduce((sum, arr) => sum + arr.length, 0);
      return {
        content: [
          {
            type: 'text' as const,
            text: `Synced ${totalTokens} tokens across modes [${modeNames}] in "${collection}".`,
          },
        ],
      };
    }

    return {
      content: [
        { type: 'text' as const, text: 'Failed to send sync message.' },
      ],
    };
  },
);

// -- Tool: get_session_status -----------------------------------------------

server.registerTool(
  'get_session_status',
  {
    description:
      'Check the current Token Beam session status — ' +
      'whether connected, the session token, and which design tools are paired.',
    inputSchema: {},
  },
  async () => {
    const connected = ws && ws.readyState === WebSocket.OPEN;
    const lines = [
      `Connected: ${connected ? 'yes' : 'no'}`,
      `Server: ${serverUrl}`,
    ];
    if (sessionToken) lines.push(`Session token: ${sessionToken}`);
    if (pairedOrigin) lines.push(`Paired origin: ${pairedOrigin}`);
    if (connectedTargets.length > 0)
      lines.push(`Connected targets: ${connectedTargets.join(', ')}`);

    return {
      content: [{ type: 'text' as const, text: lines.join('\n') }],
    };
  },
);

// -- Tool: disconnect_session -----------------------------------------------

server.registerTool(
  'disconnect_session',
  {
    description: 'Disconnect the current Token Beam session.',
    inputSchema: {},
  },
  async () => {
    disconnect();
    return {
      content: [
        { type: 'text' as const, text: 'Session disconnected.' },
      ],
    };
  },
);

// ---------------------------------------------------------------------------
// Start
// ---------------------------------------------------------------------------

async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error('Token Beam MCP Server running on stdio');
}

main().catch((error) => {
  console.error('Fatal error:', error);
  process.exit(1);
});
