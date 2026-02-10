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

// --- Enable connect button when token has content ---

tokenInput.addEventListener('input', () => {
  connectBtn.disabled = !tokenInput.value.trim();
});

// Show/hide collection name input based on select
collectionSelect.addEventListener('change', () => {
  newNameRow.style.display = collectionSelect.value === '__new__' ? '' : 'none';
});

// --- Request collections from Figma sandbox on load ---

parent.postMessage({ pluginMessage: { type: 'request-collections' } }, '*');

// --- Messages from Figma sandbox ---

window.onmessage = (event: MessageEvent) => {
  const msg = event.data?.pluginMessage;
  if (!msg) return;

  if (msg.type === 'collections-list') {
    populateCollections(msg.collections as CollectionInfo[]);
  }
  if (msg.type === 'sync-complete') {
    if (msg.collectionId) {
      createdCollectionId = msg.collectionId as string;
    }
    statusEl.textContent = 'Synced!';
    updateSyncStatus('Synced!', 'connected');
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

  const token = tokenInput.value.trim().toUpperCase();
  if (!token) return;

  selectedCollectionId = collectionSelect.value;

  updateSyncStatus('Connecting...', 'connecting');
  lockUI();

  syncClient = new SyncClient<TokenSyncPayload>({
    serverUrl: SYNC_SERVER_URL,
    clientType: 'figma',
    sessionToken: token,
    onPaired: () => {
      updateSyncStatus('Paired — waiting for data...', 'connected');
      connectBtn.textContent = 'Disconnect';
      connectBtn.disabled = false;
    },
    onSync: (payload) => {
      updateSyncStatus('Receiving data...', 'connected');

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
  connectBtn.disabled = !tokenInput.value.trim();
  connectBtn.textContent = 'Connect & Sync';
  createdCollectionId = null;
}
