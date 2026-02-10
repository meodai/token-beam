interface FigmaColorValue {
  r: number;
  g: number;
  b: number;
  a: number;
}

type FigmaVariableType = 'COLOR' | 'FLOAT' | 'STRING' | 'BOOLEAN';

interface SyncVariable {
  name: string;
  type: FigmaVariableType;
  value: FigmaColorValue | number | string | boolean;
}

interface FigmaSyncPayload {
  collectionName: string;
  modes: Array<{
    name: string;
    variables: SyncVariable[];
  }>;
}

interface CollectionInfo {
  id: string;
  name: string;
  modes: Array<{ modeId: string; name: string }>;
}

interface SyncMessage {
  type: 'pair' | 'sync' | 'ping' | 'error';
  sessionToken?: string;
  clientType?: 'web' | 'figma';
  payload?: FigmaSyncPayload;
  error?: string;
}

// Server URL from env var (set at build time), fallback to localhost
const SYNC_SERVER_URL = (import.meta as any).env?.VITE_SYNC_SERVER_URL || 'ws://localhost:8080';

// --- Inline SyncClient ---

class SyncClient {
  private ws?: WebSocket;
  private pingTimer?: ReturnType<typeof setInterval>;
  private readonly PING_INTERVAL = 30000;

  constructor(
    private serverUrl: string,
    private sessionToken: string,
    private callbacks: {
      onPaired: () => void;
      onSync: (payload: FigmaSyncPayload) => void;
      onError: (error: string) => void;
      onDisconnected: () => void;
    },
  ) {}

  connect(): Promise<void> {
    return new Promise((resolve, reject) => {
      this.ws = new WebSocket(this.serverUrl);

      this.ws.onopen = () => {
        this.send({ type: 'pair', clientType: 'figma', sessionToken: this.sessionToken });
        this.pingTimer = setInterval(() => this.send({ type: 'ping' }), this.PING_INTERVAL);
        resolve();
      };

      this.ws.onmessage = (event) => {
        try {
          const msg: SyncMessage = JSON.parse(event.data);
          if (msg.type === 'pair') this.callbacks.onPaired();
          else if (msg.type === 'sync' && msg.payload) this.callbacks.onSync(msg.payload);
          else if (msg.type === 'error' && msg.error) this.callbacks.onError(msg.error);
        } catch { /* ignore malformed */ }
      };

      this.ws.onerror = () => reject(new Error('WebSocket connection failed'));
      this.ws.onclose = () => {
        this.stopPing();
        this.callbacks.onDisconnected();
      };
    });
  }

  disconnect() {
    this.stopPing();
    this.ws?.close();
    this.ws = undefined;
  }

  private send(msg: SyncMessage) {
    if (this.ws?.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify(msg));
    }
  }

  private stopPing() {
    if (this.pingTimer) {
      clearInterval(this.pingTimer);
      this.pingTimer = undefined;
    }
  }
}

// --- DOM refs ---

const tokenInput = document.getElementById('token-input') as HTMLInputElement;
const collectionSelect = document.getElementById('collection-select') as HTMLSelectElement;
const collectionNameInput = document.getElementById('collection-name-input') as HTMLInputElement;
const newNameRow = document.getElementById('new-name-row')!;
const connectBtn = document.getElementById('connect-btn') as HTMLButtonElement;
const syncStatusEl = document.getElementById('sync-status')!;
const statusEl = document.getElementById('status')!;

let syncClient: SyncClient | null = null;
let selectedCollectionId: string | null = null;
// Once a collection is created, we remember its ID for subsequent syncs
let createdCollectionId: string | null = null;

// --- Enable connect button when token has content ---

tokenInput.addEventListener('input', () => {
  connectBtn.disabled = !tokenInput.value.trim();
});

// Show/hide collection name input based on select
collectionSelect.addEventListener('change', () => {
  newNameRow.style.display = collectionSelect.value === '__new__' ? '' : 'none';
});
// Initially visible since __new__ is default

// --- Request collections from Figma sandbox on load ---

parent.postMessage({ pluginMessage: { type: 'request-collections' } }, '*');

// --- Messages from Figma sandbox ---

window.onmessage = (event) => {
  const msg = event.data.pluginMessage;
  if (!msg) return;

  if (msg.type === 'collections-list') {
    populateCollections(msg.collections);
  }
  if (msg.type === 'sync-complete') {
    // Remember the collection ID so subsequent syncs update the same collection
    if (msg.collectionId) {
      createdCollectionId = msg.collectionId;
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

function updateSyncStatus(text: string, state: 'connected' | 'error' | 'connecting' | 'disconnected') {
  syncStatusEl.classList.remove('hidden');
  syncStatusEl.textContent = text;
  syncStatusEl.className = `sync-status ${state}`;
}

// --- Connect & Sync ---

connectBtn.addEventListener('click', () => {
  // Disconnect if already connected
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

  syncClient = new SyncClient(SYNC_SERVER_URL, token, {
    onPaired: () => {
      updateSyncStatus('Paired — waiting for data...', 'connected');
      connectBtn.textContent = 'Disconnect';
      connectBtn.disabled = false;
    },
    onSync: (payload) => {
      updateSyncStatus('Receiving data...', 'connected');

      // Forward payload directly to Figma sandbox for sync
      const message: Record<string, unknown> = {
        type: 'sync',
        payload,
      };

      // Use previously created collection, or the selected existing one
      const collectionId = createdCollectionId || selectedCollectionId;
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

  syncClient.connect().catch((err) => {
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
