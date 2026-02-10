import type { TokenSyncPayload } from 'token-sync';
import { SyncClient } from 'token-sync';
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
const resultEl = getElement<HTMLDivElement>('result');

let syncClient: SyncClient<TokenSyncPayload> | null = null;
let pairedOrigin: string | null = null;

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
  syncStatusEl.classList.remove('plugin__hidden');
  syncStatusEl.textContent = text;
  syncStatusEl.className = `plugin__status plugin__status--${state}`;
}

function showResult(text: string, isSuccess: boolean) {
  resultEl.classList.remove('plugin__hidden', 'plugin__result--success', 'plugin__result--error');
  resultEl.classList.add('plugin__result', isSuccess ? 'plugin__result--success' : 'plugin__result--error');
  resultEl.textContent = text;
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
    unlockUI();
    return;
  }

  const raw = tokenInput.value.trim();
  if (!raw) return;

  // Normalise: accept "dts://ABC123", "ABC123", or "dts://abc123"
  const token = raw.startsWith('dts://') ? raw : `dts://${raw.toUpperCase()}`;

  resultEl.classList.add('plugin__hidden');
  updateSyncStatus('Connecting...', 'connecting');
  lockUI();

  syncClient = new SyncClient<TokenSyncPayload>({
    serverUrl: SYNC_SERVER_URL,
    clientType: 'figma',
    sessionToken: token,
    onPaired: (_token, origin) => {
      pairedOrigin = origin ?? null;
      const label = pairedOrigin ?? 'unknown source';
      updateSyncStatus(`Paired with ${label} — waiting for data...`, 'connected');
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
      console.warn('[token-sync]', error);
      unlockUI();
      syncClient = null;
    },
    onDisconnected: () => {
      console.warn('[token-sync] disconnected');
      unlockUI();
      syncClient = null;
    },
  });

  syncClient.connect().catch((err: unknown) => {
    console.warn('[token-sync] connection failed', err);
    unlockUI();
    syncClient = null;
  });
});

function lockUI() {
  tokenInput.disabled = true;
  connectBtn.disabled = true;
}

function unlockUI() {
  tokenInput.disabled = false;
  tokenInput.value = '';
  updateConnectEnabled();
  connectBtn.textContent = 'Connect & Sync';
  pairedOrigin = null;
  syncStatusEl.classList.add('plugin__hidden');
  resultEl.classList.add('plugin__hidden');
}
