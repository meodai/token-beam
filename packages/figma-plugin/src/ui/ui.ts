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

// --- Inline SyncClient (Figma plugin UI can't import external modules) ---

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

const urlInput = document.getElementById('url-input') as HTMLInputElement;
const fetchBtn = document.getElementById('fetch-btn') as HTMLButtonElement;
const previewSection = document.getElementById('preview-section')!;
const collectionNameEl = document.getElementById('collection-name')!;
const varPreview = document.getElementById('var-preview')!;
const targetSection = document.getElementById('target-section')!;
const collectionSelect = document.getElementById('collection-select') as HTMLSelectElement;
const syncBtn = document.getElementById('sync-btn') as HTMLButtonElement;
const statusEl = document.getElementById('status')!;

const serverInput = document.getElementById('server-input') as HTMLInputElement;
const tokenInput = document.getElementById('token-input') as HTMLInputElement;
const connectBtn = document.getElementById('connect-btn') as HTMLButtonElement;
const syncStatusEl = document.getElementById('sync-status')!;

let currentPayload: FigmaSyncPayload | null = null;
let syncClient: SyncClient | null = null;

// --- Live Sync ---

function updateSyncStatus(text: string, state: 'connected' | 'error' | 'connecting' | 'disconnected') {
  syncStatusEl.classList.remove('hidden');
  syncStatusEl.textContent = text;
  syncStatusEl.className = `sync-status ${state}`;
}

connectBtn.addEventListener('click', () => {
  // Toggle: disconnect if already connected
  if (syncClient) {
    syncClient.disconnect();
    syncClient = null;
    return;
  }

  const token = tokenInput.value.trim().toUpperCase();
  const server = serverInput.value.trim();
  if (!token || !server) return;

  updateSyncStatus('Connecting...', 'connecting');
  connectBtn.disabled = true;

  syncClient = new SyncClient(server, token, {
    onPaired: () => {
      updateSyncStatus('Connected', 'connected');
      connectBtn.textContent = 'Disconnect';
      connectBtn.disabled = false;
    },
    onSync: (payload) => {
      currentPayload = payload;
      renderPreview(payload);
      statusEl.textContent = '';
      parent.postMessage({ pluginMessage: { type: 'request-collections' } }, '*');
    },
    onError: (error) => {
      updateSyncStatus(error, 'error');
      connectBtn.disabled = false;
    },
    onDisconnected: () => {
      updateSyncStatus('Disconnected', 'disconnected');
      connectBtn.textContent = 'Connect';
      connectBtn.disabled = false;
      syncClient = null;
    },
  });

  syncClient.connect().catch((err) => {
    updateSyncStatus(err instanceof Error ? err.message : 'Connection failed', 'error');
    connectBtn.textContent = 'Connect';
    connectBtn.disabled = false;
    syncClient = null;
  });
});

// --- URL Fetch ---

fetchBtn.addEventListener('click', async () => {
  const url = urlInput.value.trim();
  if (!url) return;

  statusEl.textContent = 'Fetching...';
  try {
    const res = await fetch(url);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data: FigmaSyncPayload = await res.json();
    currentPayload = data;
    renderPreview(data);
    statusEl.textContent = '';
    parent.postMessage({ pluginMessage: { type: 'request-collections' } }, '*');
  } catch (err) {
    statusEl.textContent = `Error: ${err instanceof Error ? err.message : err}`;
    currentPayload = null;
  }
});

function renderPreview(payload: FigmaSyncPayload) {
  collectionNameEl.textContent = payload.collectionName;
  const firstMode = payload.modes[0];
  varPreview.innerHTML = '';

  for (const v of firstMode.variables) {
    const row = document.createElement('div');
    row.className = 'var-row';

    if (v.type === 'COLOR') {
      const color = v.value as FigmaColorValue;
      const r = Math.round(color.r * 255);
      const g = Math.round(color.g * 255);
      const b = Math.round(color.b * 255);
      row.innerHTML = `
        <span class="swatch" style="background:rgba(${r},${g},${b},${color.a})"></span>
        <span class="var-name">${v.name}</span>
      `;
    } else {
      const typeLabel = v.type.toLowerCase();
      row.innerHTML = `
        <span class="type-badge">${typeLabel}</span>
        <span class="var-name">${v.name}</span>
        <span class="var-value">${v.value}</span>
      `;
    }

    varPreview.appendChild(row);
  }

  previewSection.classList.remove('hidden');
  targetSection.classList.remove('hidden');
  syncBtn.classList.remove('hidden');
  syncBtn.disabled = false;
}

window.onmessage = (event) => {
  const msg = event.data.pluginMessage;
  if (!msg) return;

  if (msg.type === 'collections-list') {
    populateCollections(msg.collections);
  }
  if (msg.type === 'sync-complete') {
    statusEl.textContent = 'Synced!';
    syncBtn.disabled = false;
  }
  if (msg.type === 'sync-error') {
    statusEl.textContent = `Error: ${msg.error}`;
    syncBtn.disabled = false;
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

syncBtn.addEventListener('click', () => {
  if (!currentPayload) return;
  syncBtn.disabled = true;
  statusEl.textContent = 'Syncing...';

  const selected = collectionSelect.value;
  const message: Record<string, unknown> = {
    type: 'sync',
    payload: currentPayload,
  };

  if (selected !== '__new__') {
    message.existingCollectionId = selected;
  }

  parent.postMessage({ pluginMessage: message }, '*');
});
