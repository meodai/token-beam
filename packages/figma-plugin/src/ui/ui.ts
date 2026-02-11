import type { TokenSyncPayload, SyncIcon } from 'token-beam';
import { SyncClient } from 'token-beam';
import { figmaCollectionAdapter } from '../adapter';
import type { FigmaCollectionPayload } from '../adapter';

interface SandboxSyncMessage {
  type: 'sync';
  payload: FigmaCollectionPayload;
}

type SyncStatusState = 'connected' | 'error' | 'connecting' | 'disconnected';

// Auto-detect WebSocket URL based on environment
function getSyncServerUrl(): string {
  // Use explicit env var if provided
  if (import.meta.env.VITE_SYNC_SERVER_URL) {
    return import.meta.env.VITE_SYNC_SERVER_URL;
  }
  
  // Figma plugins don't have window.location, so default to production URL
  // Users can override via VITE_SYNC_SERVER_URL at build time
  return 'wss://token-sync.fly.dev';
}

const SYNC_SERVER_URL = getSyncServerUrl();

// --- DOM helpers ---

function getElement<T extends HTMLElement>(id: string): T {
  const el = document.getElementById(id);
  if (!el) throw new Error(`Element #${id} not found`);
  return el as T;
}

// --- DOM refs ---

const tokenInput = getElement<HTMLInputElement>('token-input');
const connectBtn = getElement<HTMLButtonElement>('connect-btn');
const syncStatusEl = getElement<HTMLDivElement>('sync-status');
const syncStatusTextEl = getElement<HTMLSpanElement>('sync-status-text');
const resultEl = getElement<HTMLDivElement>('result');
const resultTextEl = getElement<HTMLSpanElement>('result-text');
const resultTimeEl = getElement<HTMLSpanElement>('result-time');

let syncClient: SyncClient<TokenSyncPayload> | null = null;
let pairedOrigin: string | null = null;
let lastResultAt: number | null = null;
let resultTimer: number | null = null;
const resultRtf = new Intl.RelativeTimeFormat(undefined, { numeric: 'auto' });

// --- Enable connect button when token has content ---

function updateConnectEnabled() {
  const tokenReady = !!tokenInput.value.trim();
  connectBtn.disabled = !tokenReady;
}

tokenInput.addEventListener('input', () => {
  updateConnectEnabled();
});

// --- Messages from Figma sandbox ---

window.onmessage = (event: MessageEvent) => {
  const msg = event.data?.pluginMessage;
  if (!msg) return;

  if (msg.type === 'sync-complete') {
    const action = msg.isNew ? 'Created' : 'Updated';
    const syncLabel = `${action} collection: ${msg.collectionName}`;
    showResult(syncLabel, true);
  }
  if (msg.type === 'sync-error') {
    showResult(`Error: ${msg.error}`, false);
  }
};

// --- Sync status UI ---

function updateSyncStatus(text: string, state: SyncStatusState) {
  if (!text) {
    syncStatusEl.classList.add('plugin__hidden');
    syncStatusTextEl.textContent = '';
    return;
  }

  syncStatusEl.classList.remove('plugin__hidden');
  syncStatusTextEl.textContent = text;
  syncStatusEl.className = `plugin__status plugin__status--${state}`;
}

function showResult(text: string, isSuccess: boolean) {
  resultEl.classList.remove('plugin__hidden', 'plugin__result--success', 'plugin__result--error');
  resultEl.classList.add('plugin__result', isSuccess ? 'plugin__result--success' : 'plugin__result--error');
  resultTextEl.textContent = text;
  lastResultAt = Date.now();
  resultTimeEl.textContent = formatRelativeResultTime(lastResultAt);
  ensureResultTimer();
}

function clearResultTime() {
  lastResultAt = null;
  resultTimeEl.textContent = '';
  resultTextEl.textContent = '';
}

function formatRelativeResultTime(timestamp: number): string {
  const diffSeconds = Math.max(0, Math.round((Date.now() - timestamp) / 1000));
  if (diffSeconds < 5) return 'just now';
  if (diffSeconds < 60) return resultRtf.format(-diffSeconds, 'second');

  const diffMinutes = Math.round(diffSeconds / 60);
  if (diffMinutes < 60) return resultRtf.format(-diffMinutes, 'minute');

  const diffHours = Math.round(diffMinutes / 60);
  if (diffHours < 24) return resultRtf.format(-diffHours, 'hour');

  const diffDays = Math.round(diffHours / 24);
  return resultRtf.format(-diffDays, 'day');
}

function updateResultTime() {
  if (!lastResultAt) return;
  if (resultEl.classList.contains('plugin__hidden')) return;
  resultTimeEl.textContent = formatRelativeResultTime(lastResultAt);
}

function ensureResultTimer() {
  if (resultTimer) return;
  resultTimer = window.setInterval(updateResultTime, 10000);
}

// --- Transform & forward to Figma sandbox ---

function forwardToSandbox(figmaPayload: FigmaCollectionPayload) {
  const message: SandboxSyncMessage = {
    type: 'sync',
    payload: figmaPayload,
  };

  parent.postMessage({ pluginMessage: message }, '*');
}

// --- Connect & Sync ---

connectBtn.addEventListener('click', () => {
  if (syncClient) {
    syncClient.disconnect();
    syncClient = null;
    unlockUI(true);
    return;
  }

  const raw = tokenInput.value.trim();
  if (!raw) return;

  // Validate: must be hex chars (with optional beam:// prefix)
  const stripped = raw.replace(/^beam:\/\//i, '');
  if (!/^[0-9a-f]+$/i.test(stripped)) {
    showResult('Invalid token format — paste the token from the web app', false);
    return;
  }

  // Normalise: accept "beam://ABC123", "ABC123", or "beam://abc123"
  const token = raw.startsWith('beam://') ? raw : `beam://${raw.toUpperCase()}`;

  resultEl.classList.add('plugin__hidden');
  clearResultTime();
  updateSyncStatus('Connecting...', 'connecting');
  lockUI();

  syncClient = new SyncClient<TokenSyncPayload>({
    serverUrl: SYNC_SERVER_URL,
    clientType: 'figma',
    sessionToken: token,
    onPaired: (_token, origin, icon?: SyncIcon) => {
      pairedOrigin = origin ?? null;
      const label = pairedOrigin ?? 'unknown source';
      const iconPrefix = icon?.type === 'unicode' ? `${icon.value} ` : '';
      updateSyncStatus(`Paired with ${iconPrefix}${label} — waiting for data...`, 'connected');
      connectBtn.textContent = 'Disconnect';
      connectBtn.disabled = false;
    },
    onSync: (payload) => {
      const recvLabel = pairedOrigin ? `Receiving from ${pairedOrigin}...` : 'Receiving data...';
      updateSyncStatus(recvLabel, 'connected');

      const figmaCollections = figmaCollectionAdapter.transform(payload);

      for (const collection of figmaCollections) {
        forwardToSandbox(collection);
      }
    },
    onError: (error) => {
      // Non-fatal warnings — log but stay connected
      if (error.startsWith('[warn]')) {
        console.warn('[token-beam]', error.slice(7));
        return;
      }
      console.warn('[token-beam]', error);

      // Show user-friendly messages for known errors
      if (error === 'Invalid session token') {
        showResult('Session not found — check the token or start a new session from the web app', false);
      } else {
        showResult(error, false);
      }
      updateSyncStatus('', 'error');
      unlockUI();
      syncClient = null;
    },
    onDisconnected: () => {
      console.warn('[token-beam] disconnected');
      updateSyncStatus('Disconnected', 'disconnected');
      unlockUI();
      syncClient = null;
    },
  });

  syncClient.connect().catch((err: unknown) => {
    console.warn('[token-beam] connection failed', err);
    showResult('Could not connect to sync server', false);
    unlockUI();
    syncClient = null;
  });
});

function lockUI() {
  tokenInput.disabled = true;
  connectBtn.disabled = true;
}

function unlockUI(clearResult = false) {
  tokenInput.disabled = false;
  updateConnectEnabled();
  connectBtn.textContent = 'Connect & Sync';
  pairedOrigin = null;
  syncStatusEl.classList.add('plugin__hidden');
  syncStatusTextEl.textContent = '';
  if (clearResult) {
    clearResultTime();
  }
  if (clearResult) {
    tokenInput.value = '';
    resultEl.classList.add('plugin__hidden');
  }
}
