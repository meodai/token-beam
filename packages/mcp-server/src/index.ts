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
import {
  createCollection,
  createMultiModeCollection,
  TokenTypeSchema,
} from 'token-beam';
import type { SyncMessage, TokenSyncPayload } from 'token-beam';
import { z } from 'zod';
import WebSocket from 'ws';

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

function sendSync(payload: TokenSyncPayload): boolean {
  if (!ws || ws.readyState !== WebSocket.OPEN) return false;
  const msg: SyncMessage<TokenSyncPayload> = { type: 'sync', payload };
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
      // MCP acts as a "web" client (the token source).
      // Design tools (Figma, Krita, Aseprite) join as targets.
      const pair: SyncMessage = {
        type: 'pair',
        clientType: 'web',
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
            // A design tool joined the session
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
  type: TokenTypeSchema
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

    const entries = tokens.map((t) => ({
      name: t.name,
      value: t.value,
      type: t.type,
    }));

    const payload = createCollection(collection, entries, mode);
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

    const modeEntries: Record<string, { name: string; value: string | number | boolean; type?: 'color' | 'number' | 'string' | 'boolean' }[]> = {};
    for (const [modeName, tokenArr] of Object.entries(modes)) {
      modeEntries[modeName] = tokenArr.map((t) => ({
        name: t.name,
        value: t.value,
        type: t.type,
      }));
    }

    const payload = createMultiModeCollection(collection, modeEntries);
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
