import { TargetSession, extractColorTokens, normalizeSessionToken } from 'token-beam';
import type { TokenSyncPayload } from 'token-beam';

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

const SYNC_SERVER_URL =
  ((globalThis as Record<string, unknown>).__SYNC_SERVER_URL__ as string) || 'wss://tokenbeam.dev';

let panel: HTMLDivElement | undefined;
let session: TargetSession<TokenSyncPayload> | null = null;
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

  const applyColors = (hexValues: string[]) => {
    if (!hexValues.length) return 0;

    const existing = assets.colors
      .get()
      .map((c: { toHex: (includeAlpha: boolean) => string }) => c.toHex(true).toLowerCase());
    const existingSet = new Set(existing);
    const toAdd = hexValues.filter((hex) => !existingSet.has(hex.toLowerCase()));

    if (!toAdd.length) return 0;

    application.editDocument({ editLabel: 'Token Beam Sync Colors' }, () => {
      for (const hex of toAdd) {
        assets.colors.add(new Color(hex));
      }
    });

    return toAdd.length;
  };

  const disconnect = (clear = false) => {
    if (session) {
      session.disconnect();
      session = null;
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

  connectBtn.addEventListener('click', () => {
    if (isConnected) {
      disconnect(true);
      return;
    }

    const normalized = normalizeSessionToken(tokenInput.value);
    if (!normalized) {
      setStatus('Invalid token format');
      return;
    }

    setStatus('Connecting...');
    setResult('');

    session = new TargetSession<TokenSyncPayload>({
      serverUrl: SYNC_SERVER_URL,
      clientType: 'adobe-xd',
      sessionToken: normalized,
      origin: 'Adobe XD',
    });

    session.on('paired', ({ origin }) => {
      isConnected = true;
      pairedOrigin = origin ?? null;
      connectBtn.textContent = 'Disconnect';
      tokenInput.disabled = true;
      setStatus(`Paired${pairedOrigin ? ` with ${pairedOrigin}` : ''}`);
    });

    session.on('sync', ({ payload }) => {
      const colorTokens = extractColorTokens(payload);
      const hexValues = colorTokens.map((token) => token.hex);
      const count = applyColors(hexValues);
      setResult(
        count > 0
          ? `Added ${count} color${count === 1 ? '' : 's'} to XD assets`
          : 'No new colors to add',
      );
      setStatus(`Connected${pairedOrigin ? ` to ${pairedOrigin}` : ''}`);
    });

    session.on('warning', ({ message }) => {
      console.warn('[token-beam]', message);
    });

    session.on('error', ({ message }) => {
      setStatus(`Error: ${message}`);
      disconnect();
    });

    session.on('disconnected', () => {
      if (isConnected) {
        setStatus('Disconnected');
      }
      disconnect();
    });

    session.connect().catch(() => {
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
