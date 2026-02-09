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

const urlInput = document.getElementById('url-input') as HTMLInputElement;
const fetchBtn = document.getElementById('fetch-btn') as HTMLButtonElement;
const previewSection = document.getElementById('preview-section')!;
const collectionNameEl = document.getElementById('collection-name')!;
const varPreview = document.getElementById('var-preview')!;
const targetSection = document.getElementById('target-section')!;
const collectionSelect = document.getElementById('collection-select') as HTMLSelectElement;
const syncBtn = document.getElementById('sync-btn') as HTMLButtonElement;
const statusEl = document.getElementById('status')!;

let currentPayload: FigmaSyncPayload | null = null;

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
