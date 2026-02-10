import type { TokenSyncPayload } from 'token-sync';
import { SyncClient } from 'token-sync';
import { figmaCollectionAdapter } from '../adapter';
import type { FigmaCollectionPayload } from '../adapter';

interface CollectionInfo {
  id: string;
  name: string;
  modes: Array<{ modeId: string; name: string }>;
}

interface SandboxSyncMessage {
  type: 'sync';
  payload: FigmaCollectionPayload;
  existingCollectionId?: string;
  collectionName?: string;
}

type SyncStatusState = 'connected' | 'error' | 'connecting' | 'disconnected';

const SYNC_SERVER_URL = import.meta.env.VITE_SYNC_SERVER_URL ?? 'ws://localhost:8080';

// --- DOM helpers ---

function getElement<T extends HTMLElement>(id: string): T {
  const el = document.getElementById(id);
  if (!el) throw new Error(`Element #${id} not found`);
  return el as T;
}

// --- DOM refs ---

const tokenInput = getElement<HTMLInputElement>('token-input');
const collectionSelect = getElement<HTMLSelectElement>('collection-select');
const collectionNameInput = getElement<HTMLInputElement>('collection-name-input');
const newNameRow = getElement<HTMLDivElement>('new-name-row');
const connectBtn = getElement<HTMLButtonElement>('connect-btn');
const syncStatusEl = getElement<HTMLDivElement>('sync-status');
const statusEl = getElement<HTMLDivElement>('status');

let syncClient: SyncClient<TokenSyncPayload> | null = null;
let selectedCollectionId: string | null = null;
let createdCollectionId: string | null = null;
let lastCreatedCollectionName: string | null = null;
let pairedOrigin: string | null = null;

// --- Enable connect button when token has content ---

function getSuggestedCollectionName(): string {
  const base = pairedOrigin?.trim() || 'token-sync';
  return `Token Sync (${base})`;
}

function isCollectionValid(): boolean {
  if (collectionSelect.value !== '__new__') return true;
  return !!collectionNameInput.value.trim();
}

function updateConnectEnabled() {
  const tokenReady = !!tokenInput.value.trim();
  connectBtn.disabled = !(tokenReady && isCollectionValid());
}

function updateCollectionNamePlaceholder() {
  if (collectionSelect.value !== '__new__') return;
  collectionNameInput.placeholder = getSuggestedCollectionName();
}

tokenInput.addEventListener('input', () => {
  updateConnectEnabled();
});

collectionNameInput.addEventListener('input', () => {
  updateConnectEnabled();
});

// Show/hide collection name input based on select
collectionSelect.addEventListener('change', () => {
  newNameRow.style.display = collectionSelect.value === '__new__' ? '' : 'none';
  updateCollectionNamePlaceholder();
  updateConnectEnabled();
});

// --- Request collections from Figma sandbox on load ---

parent.postMessage({ pluginMessage: { type: 'request-collections' } }, '*');

// --- Messages from Figma sandbox ---

window.onmessage = (event: MessageEvent) => {
  const msg = event.data?.pluginMessage;
  if (!msg) return;

  if (msg.type === 'collections-list') {
    populateCollections(msg.collections as CollectionInfo[]);
    updateConnectEnabled();
  }
  if (msg.type === 'sync-complete') {
    if (msg.collectionId) {
      createdCollectionId = msg.collectionId as string;
      const existing = collectionSelect.querySelector(
        `option[value="${createdCollectionId}"]`,
      ) as HTMLOptionElement | null;
      if (!existing) {
        const opt = document.createElement('option');
        opt.value = createdCollectionId;
        opt.textContent = lastCreatedCollectionName ?? 'New Collection';
        collectionSelect.appendChild(opt);
      }
      collectionSelect.value = createdCollectionId;
      selectedCollectionId = createdCollectionId;
      newNameRow.style.display = 'none';
    }
    const syncLabel = pairedOrigin ? `Synced with ${pairedOrigin}` : 'Synced!';
    statusEl.textContent = syncLabel;
    updateSyncStatus(syncLabel, 'connected');
  }
  if (msg.type === 'sync-error') {
    statusEl.textContent = `Error: ${msg.error}`;
    updateSyncStatus(`Sync error: ${msg.error}`, 'error');
  }
};

function populateCollections(collections: CollectionInfo[]) {
  collectionSelect.innerHTML = '<option value="__new__">Create new collection</option>';
  for (const c of collections) {
    const opt = document.createElement('option');
    opt.value = c.id;
    opt.textContent = c.name;
    collectionSelect.appendChild(opt);
  }
}

// --- Sync status UI ---

function updateSyncStatus(text: string, state: SyncStatusState) {
  syncStatusEl.classList.remove('hidden');
  syncStatusEl.textContent = text;
  syncStatusEl.className = `sync-status ${state}`;
}

// --- Transform & forward to Figma sandbox ---

function forwardToSandbox(figmaPayload: FigmaCollectionPayload) {
  const message: SandboxSyncMessage = {
    type: 'sync',
    payload: figmaPayload,
  };

  // Use previously created collection, or the selected existing one
  const collectionId = createdCollectionId ?? selectedCollectionId;
  if (collectionId && collectionId !== '__new__') {
    message.existingCollectionId = collectionId;
  }

  // If creating new, use custom name (or fallback to payload name)
  if (!message.existingCollectionId) {
    const customName = collectionNameInput.value.trim();
    if (customName) {
      message.collectionName = customName;
      lastCreatedCollectionName = customName;
    }
  }

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

  selectedCollectionId = collectionSelect.value;
  updateConnectEnabled();
  if (!isCollectionValid()) {
    updateSyncStatus('Enter a collection name', 'error');
    collectionNameInput.focus();
    connectBtn.disabled = true;
    return;
  }

  updateSyncStatus('Connecting...', 'connecting');
  lockUI();

  syncClient = new SyncClient<TokenSyncPayload>({
    serverUrl: SYNC_SERVER_URL,
    clientType: 'figma',
    sessionToken: token,
    onPaired: (_token, origin) => {
      pairedOrigin = origin ?? null;
      updateCollectionNamePlaceholder();
      updateConnectEnabled();
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
      updateSyncStatus(error, 'error');
      unlockUI();
      syncClient = null;
    },
    onDisconnected: () => {
      updateSyncStatus('Disconnected', 'disconnected');
      unlockUI();
      syncClient = null;
    },
  });

  syncClient.connect().catch((err: unknown) => {
    updateSyncStatus(err instanceof Error ? err.message : 'Connection failed', 'error');
    unlockUI();
    syncClient = null;
  });
});

function lockUI() {
  tokenInput.disabled = true;
  collectionSelect.disabled = true;
  collectionNameInput.disabled = true;
  connectBtn.disabled = true;
}

function unlockUI() {
  tokenInput.disabled = false;
  collectionSelect.disabled = false;
  collectionNameInput.disabled = false;
  updateConnectEnabled();
  connectBtn.textContent = 'Connect & Sync';
  createdCollectionId = null;
  lastCreatedCollectionName = null;
  pairedOrigin = null;
}
