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
import { createCollection, createMultiModeCollection, TokenTypeSchema, } from 'token-beam';
import { z } from 'zod';
import WebSocket from 'ws';
// ---------------------------------------------------------------------------
// Session state
// ---------------------------------------------------------------------------
let ws;
let sessionToken;
let pairedOrigin;
let connectedTargets = [];
const serverUrl = process.env.TOKEN_BEAM_SERVER ?? 'ws://localhost:8080';
// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
function sendSync(payload) {
    if (!ws || ws.readyState !== WebSocket.OPEN)
        return false;
    const msg = { type: 'sync', payload };
    ws.send(JSON.stringify(msg));
    return true;
}
function connect() {
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
            const pair = {
                type: 'pair',
                clientType: 'web',
                origin: 'Token Beam MCP',
            };
            socket.send(JSON.stringify(pair));
        };
        socket.onmessage = (event) => {
            try {
                const msg = JSON.parse(String(event.data));
                if (msg.type === 'pair') {
                    if (msg.sessionToken) {
                        sessionToken = msg.sessionToken;
                        pairedOrigin = msg.origin;
                        resolve(sessionToken);
                    }
                    else if (msg.clientType) {
                        // A design tool joined the session
                        connectedTargets.push(msg.clientType);
                    }
                }
                else if (msg.type === 'error') {
                    console.error('[TokenBeam]', msg.error);
                }
            }
            catch {
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
function disconnect() {
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
server.registerTool('create_session', {
    description: 'Start a new Token Beam sync session. Returns a beam:// token ' +
        'that the user pastes into Figma, Krita, Aseprite, or any Token Beam client. ' +
        'You usually don\'t need to call this directly — sync_tokens auto-creates a session.',
    inputSchema: {},
}, async () => {
    try {
        const token = await connect();
        return {
            content: [
                {
                    type: 'text',
                    text: `Session created!\n\nPaste this token in your design tool: **${token}**`,
                },
            ],
        };
    }
    catch (e) {
        return {
            content: [
                { type: 'text', text: `Failed to create session: ${e}` },
            ],
        };
    }
});
// -- Tool: sync_tokens ------------------------------------------------------
const tokenEntrySchema = z.object({
    name: z.string().describe('Token name (e.g. "primary", "spacing/sm", "brand/red")'),
    value: z.union([z.string(), z.number(), z.boolean()]).describe('Token value. Hex colors like "#ff3366" are auto-detected. ' +
        'Numbers, booleans, and other strings are also supported.'),
    type: TokenTypeSchema
        .optional()
        .describe('Explicit token type. If omitted, type is inferred from the value.'),
});
server.registerTool('sync_tokens', {
    description: 'Push design tokens to all paired design tools. ' +
        'Supports any W3C DTCG token type: colors (#hex), numbers, strings, booleans. ' +
        'Auto-creates a session if none exists. ' +
        'Always tell the user the beam:// token so they can paste it in their design tool.',
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
}, async ({ collection, tokens, mode }) => {
    // Auto-connect if no session
    if (!ws || ws.readyState !== WebSocket.OPEN) {
        try {
            await connect();
        }
        catch (e) {
            return {
                content: [
                    {
                        type: 'text',
                        text: `Failed to connect to Token Beam server: ${e}`,
                    },
                ],
            };
        }
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
        const targetInfo = connectedTargets.length > 0
            ? `\nConnected targets: ${connectedTargets.join(', ')}`
            : '\nNo design tools connected yet.';
        return {
            content: [
                {
                    type: 'text',
                    text: `Session: ${sessionToken}\n\nSynced ${tokens.length} tokens in "${collection}":\n${summary}${targetInfo}`,
                },
            ],
        };
    }
    return {
        content: [
            { type: 'text', text: 'Failed to send sync message.' },
        ],
    };
});
// -- Tool: sync_multi_mode --------------------------------------------------
server.registerTool('sync_multi_mode', {
    description: 'Push a multi-mode token collection (e.g. Light/Dark themes). ' +
        'Each mode contains its own set of tokens. ' +
        'Auto-creates a session if none exists. ' +
        'Always tell the user the beam:// token so they can paste it in their design tool.',
    inputSchema: {
        collection: z.string().describe('Collection name'),
        modes: z
            .record(z.string(), z.array(tokenEntrySchema))
            .describe('Object mapping mode names to token arrays. ' +
            'Example: { "Light": [...], "Dark": [...] }'),
    },
}, async ({ collection, modes }) => {
    // Auto-connect if no session
    if (!ws || ws.readyState !== WebSocket.OPEN) {
        try {
            await connect();
        }
        catch (e) {
            return {
                content: [
                    {
                        type: 'text',
                        text: `Failed to connect to Token Beam server: ${e}`,
                    },
                ],
            };
        }
    }
    const modeEntries = {};
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
        const targetInfo = connectedTargets.length > 0
            ? `\nConnected targets: ${connectedTargets.join(', ')}`
            : '\nNo design tools connected yet.';
        return {
            content: [
                {
                    type: 'text',
                    text: `Session: ${sessionToken}\n\nSynced ${totalTokens} tokens across modes [${modeNames}] in "${collection}".${targetInfo}`,
                },
            ],
        };
    }
    return {
        content: [
            { type: 'text', text: 'Failed to send sync message.' },
        ],
    };
});
// -- Tool: get_session_status -----------------------------------------------
server.registerTool('get_session_status', {
    description: 'Check the current Token Beam session status — ' +
        'whether connected, the session token, and which design tools are paired.',
    inputSchema: {},
}, async () => {
    const connected = ws && ws.readyState === WebSocket.OPEN;
    const lines = [
        `Connected: ${connected ? 'yes' : 'no'}`,
        `Server: ${serverUrl}`,
    ];
    if (sessionToken)
        lines.push(`Session token: ${sessionToken}`);
    if (pairedOrigin)
        lines.push(`Paired origin: ${pairedOrigin}`);
    if (connectedTargets.length > 0)
        lines.push(`Connected targets: ${connectedTargets.join(', ')}`);
    return {
        content: [{ type: 'text', text: lines.join('\n') }],
    };
});
// -- Tool: disconnect_session -----------------------------------------------
server.registerTool('disconnect_session', {
    description: 'Disconnect the current Token Beam session.',
    inputSchema: {},
}, async () => {
    disconnect();
    return {
        content: [
            { type: 'text', text: 'Session disconnected.' },
        ],
    };
});
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
