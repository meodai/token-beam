type SyncMessage = {
  type: 'pair' | 'sync' | 'ping' | 'error';
  sessionToken?: string;
  origin?: string;
  payload?: unknown;
  error?: string;
};

type TokenSyncPayload = {
  collections?: Array<{
    modes?: Array<{
      tokens?: Array<{
        name?: string;
        type?: string;
        value?: unknown;
      }>;
    }>;
  }>;
};

const application = require('application') as {
  editDocument: (options: { editLabel: string }, callback: () => void) => void;
};

const assets = require('assets') as {
  colors: {
    get: () => Array<{ toHex: (includeAlpha: boolean) => string }>;
    add: (color: unknown) => void;
  };
};

const { Color } = require('scenegraph') as { Color: new (hex: string) => unknown };

const SYNC_SERVER_URL = (globalThis as Record<string, unknown>).__SYNC_SERVER_URL__ as string || 'wss://token-beam.fly.dev';

let panel: HTMLDivElement | undefined;
let ws: WebSocket | null = null;
let isConnected = false;
let pairedOrigin: string | null = null;

function create() {
  const root = document.createElement('div');
  root.style.padding = '12px';
  root.style.fontFamily = 'Arial, sans-serif';
  root.style.fontSize = '12px';

  root.innerHTML = `
    <div style="display:flex;flex-direction:column;gap:8px;">
      <label for="token-input" style="font-weight:600;">Session token</label>
      <input id="token-input" placeholder="beam://ABC123" style="padding:6px;border:1px solid #ccc;border-radius:4px;" />
      <button id="connect-btn" style="padding:8px;border:0;border-radius:4px;background:#1473e6;color:#fff;cursor:pointer;">Connect</button>
      <div id="status" style="min-height:16px;color:#555;"></div>
      <div id="result" style="min-height:16px;color:#1473e6;"></div>
    </div>
  `;

  const tokenInput = root.querySelector<HTMLInputElement>('#token-input');
  const connectBtn = root.querySelector<HTMLButtonElement>('#connect-btn');
  const statusEl = root.querySelector<HTMLDivElement>('#status');
  const resultEl = root.querySelector<HTMLDivElement>('#result');

  if (!tokenInput || !connectBtn || !statusEl || !resultEl) {
    return root;
  }

  const setStatus = (text: string) => {
    statusEl.textContent = text;
  };

  const setResult = (text: string) => {
    resultEl.textContent = text;
  };

  const validateToken = (raw: string): string | null => {
    const stripped = raw.trim().replace(/^beam:\/\//i, '');
    if (!/^[0-9a-f]+$/i.test(stripped)) return null;
    return `beam://${stripped.toUpperCase()}`;
  };

  const collectHexColors = (payload: TokenSyncPayload) => {
    const result: Array<{ name: string; hex: string }> = [];
    if (!payload || !Array.isArray(payload.collections)) return result;

    for (const collection of payload.collections) {
      if (!collection || !Array.isArray(collection.modes)) continue;
      for (const mode of collection.modes) {
        if (!mode || !Array.isArray(mode.tokens)) continue;
        for (const token of mode.tokens) {
          if (!token || token.type !== 'color' || typeof token.value !== 'string') continue;
          if (/^#([0-9a-f]{3}|[0-9a-f]{6})$/i.test(token.value)) {
            result.push({ name: token.name ?? 'color', hex: token.value });
          }
        }
      }
    }

    return result;
  };

  const applyColors = (colorTokens: Array<{ name: string; hex: string }>) => {
    if (!colorTokens.length) return 0;

    const existing = assets.colors.get().map((c: { toHex: (includeAlpha: boolean) => string }) => c.toHex(true).toLowerCase());
    const existingSet = new Set(existing);
    const toAdd = colorTokens.filter((token) => !existingSet.has(token.hex.toLowerCase()));

    if (!toAdd.length) return 0;

    application.editDocument({ editLabel: 'Token Beam Sync Colors' }, () => {
      for (const token of toAdd) {
        assets.colors.add(new Color(token.hex));
      }
    });

    return toAdd.length;
  };

  const disconnect = (clear = false) => {
    if (ws) {
      try {
        ws.close();
      } catch {
      }
      ws = null;
    }

    isConnected = false;
    pairedOrigin = null;
    connectBtn.textContent = 'Connect';
    tokenInput.disabled = false;

    if (clear) {
      setStatus('');
      setResult('');
      tokenInput.value = '';
    }
  };

  const handleMessage = (message: SyncMessage) => {
    if (message.type === 'pair' && message.sessionToken) {
      isConnected = true;
      pairedOrigin = message.origin ?? null;
      connectBtn.textContent = 'Disconnect';
      tokenInput.disabled = true;
      setStatus(`Paired${pairedOrigin ? ` with ${pairedOrigin}` : ''}`);
      return;
    }

    if (message.type === 'sync' && message.payload) {
      const colorTokens = collectHexColors(message.payload as TokenSyncPayload);
      const count = applyColors(colorTokens);
      setResult(
        count > 0 ? `Added ${count} color${count === 1 ? '' : 's'} to XD assets` : 'No new colors to add',
      );
      setStatus(`Connected${pairedOrigin ? ` to ${pairedOrigin}` : ''}`);
      return;
    }

    if (message.type === 'error' && message.error) {
      if (message.error.startsWith('[warn]')) return;
      setStatus(`Error: ${message.error}`);
      disconnect();
      return;
    }

    if (message.type === 'ping' && ws && ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify({ type: 'ping' }));
    }
  };

  connectBtn.addEventListener('click', () => {
    if (isConnected) {
      disconnect(true);
      return;
    }

    const normalized = validateToken(tokenInput.value);
    if (!normalized) {
      setStatus('Invalid token format');
      return;
    }

    setStatus('Connecting...');
    setResult('');

    ws = new WebSocket(SYNC_SERVER_URL);

    ws.addEventListener('open', () => {
      ws?.send(
        JSON.stringify({
          type: 'pair',
          clientType: 'adobe-xd',
          sessionToken: normalized,
          origin: 'Adobe XD',
        }),
      );
    });

    ws.addEventListener('message', (event) => {
      try {
        handleMessage(JSON.parse(event.data) as SyncMessage);
      } catch {
      }
    });

    ws.addEventListener('close', () => {
      if (isConnected) setStatus('Disconnected');
      disconnect();
    });

    ws.addEventListener('error', () => {
      setStatus('Connection failed');
      disconnect();
    });
  });

  panel = root;
  return root;
}

function show(event: { node: HTMLElement }) {
  if (!panel) {
    event.node.appendChild(create());
  }
}

function hide() {}

function update() {}

module.exports = {
  panels: {
    tokenBeamPanel: {
      show,
      hide,
      update,
    },
  },
};
