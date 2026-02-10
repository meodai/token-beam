import type { TokenSyncPayload, ColorValue } from 'token-sync';
import { SyncClient } from 'token-sync';

const API_PATH = '/api/colors';
const SYNC_SERVER_URL = 'ws://localhost:8080';

type DemoSyncStatus = 'connecting' | 'ready' | 'syncing' | 'disconnected' | 'error';

let syncClient: SyncClient<TokenSyncPayload> | null = null;
let currentPayload: TokenSyncPayload | null = null;
let sessionToken: string | null = null;
let isPaired = false;

// --- DOM helpers ---

function getElement<T extends HTMLElement>(id: string): T {
  const el = document.getElementById(id);
  if (!el) throw new Error(`Element #${id} not found`);
  return el as T;
}

function queryElement<T extends HTMLElement>(parent: HTMLElement, selector: string): T | null {
  return parent.querySelector<T>(selector);
}

function isColorValue(value: unknown): value is ColorValue {
  return (
    typeof value === 'object' &&
    value !== null &&
    'r' in value &&
    'g' in value &&
    'b' in value &&
    'a' in value
  );
}

// --- Init ---

async function init() {
  const app = getElement<HTMLDivElement>('app');
  app.innerHTML = `
    <div class="sync-section" id="sync-status">
      <h2>Live Sync</h2>
      <div class="sync-info">
        <div class="status-indicator connecting">Connecting...</div>
        <div class="token-display" style="display: none;">
          <label>Session Token:</label>
          <code id="sync-token" class="sync-token"></code>
          <button id="copy-token-btn" title="Copy token">Copy</button>
          <button id="unlink-btn" class="unlink-btn" title="Disconnect and generate new token">&#x26D3;&#xFE0E;</button>
        </div>
        <div id="sync-error" class="error-message" style="display: none;"></div>
        <p class="sync-help">Enter this token in the Figma plugin to pair</p>
      </div>
    </div>

    <div id="payload-section"></div>
  `;

  getElement('unlink-btn').addEventListener('click', () => {
    unlink();
  });

  getElement('copy-token-btn').addEventListener('click', () => {
    if (sessionToken) {
      navigator.clipboard.writeText(sessionToken);
      const btn = getElement('copy-token-btn');
      btn.textContent = 'Copied!';
      setTimeout(() => (btn.textContent = 'Copy'), 1500);
    }
  });

  await fetchAndRender();
  initSync();
}

async function fetchAndRender() {
  const res = await fetch(API_PATH);
  const payload = (await res.json()) as TokenSyncPayload;
  currentPayload = payload;
  renderPayload(payload);
}

// --- Sync ---

function initSync() {
  if (syncClient) {
    syncClient.disconnect();
  }

  syncClient = new SyncClient<TokenSyncPayload>({
    serverUrl: SYNC_SERVER_URL,
    clientType: 'web',
    origin: 'Token Sync Demo',
    onPaired: (token) => {
      sessionToken = token;
      updateSyncStatus('ready', token);
    },
    onTargetConnected: () => {
      isPaired = true;
      updateSyncStatus('syncing');
      if (currentPayload) {
        syncClient?.sync(currentPayload);
      }
    },
    onConnected: () => {
      updateSyncStatus('connecting');
    },
    onDisconnected: () => {
      isPaired = false;
      updateSyncStatus('disconnected');
    },
    onError: (error) => {
      updateSyncStatus('error', undefined, error);
    },
    onSync: (payload) => {
      console.log('Received sync from target:', payload);
    },
  });

  syncClient.connect().catch((error: unknown) => {
    console.error('Failed to connect to sync server:', error);
    updateSyncStatus('error', undefined, 'Could not connect to sync server');
  });
}

function unlink() {
  isPaired = false;
  if (syncClient) {
    syncClient.disconnect();
    syncClient = null;
  }
  sessionToken = null;
  initSync();
}

function updateSyncStatus(status: DemoSyncStatus, token?: string, error?: string) {
  const syncStatus = document.getElementById('sync-status');
  if (!syncStatus) return;

  const statusEl = queryElement<HTMLDivElement>(syncStatus, '.status-indicator');
  const tokenDisplay = queryElement<HTMLDivElement>(syncStatus, '.token-display');
  const tokenEl = queryElement<HTMLElement>(syncStatus, '#sync-token');
  const errorEl = queryElement<HTMLDivElement>(syncStatus, '#sync-error');
  const unlinkBtn = queryElement<HTMLButtonElement>(syncStatus, '#unlink-btn');
  const helpEl = queryElement<HTMLParagraphElement>(syncStatus, '.sync-help');

  if (!statusEl || !tokenDisplay || !tokenEl || !errorEl || !unlinkBtn || !helpEl) return;

  switch (status) {
    case 'connecting':
      statusEl.className = 'status-indicator connecting';
      statusEl.textContent = 'Connecting...';
      tokenDisplay.style.display = 'none';
      errorEl.style.display = 'none';
      helpEl.style.display = 'none';
      break;
    case 'ready':
      statusEl.className = 'status-indicator connected';
      statusEl.textContent = 'Waiting for Figma plugin...';
      if (token) {
        tokenEl.textContent = token;
        tokenDisplay.style.display = '';
      }
      unlinkBtn.style.display = 'none';
      errorEl.style.display = 'none';
      helpEl.style.display = '';
      break;
    case 'syncing':
      statusEl.className = 'status-indicator connected';
      statusEl.textContent = 'Figma connected — syncing!';
      unlinkBtn.style.display = '';
      errorEl.style.display = 'none';
      helpEl.style.display = 'none';
      break;
    case 'disconnected':
      statusEl.className = 'status-indicator disconnected';
      statusEl.textContent = 'Disconnected';
      tokenDisplay.style.display = 'none';
      errorEl.style.display = 'none';
      helpEl.style.display = 'none';
      break;
    case 'error':
      statusEl.className = 'status-indicator error';
      statusEl.textContent = 'Error';
      if (error) {
        errorEl.textContent = error;
        errorEl.style.display = 'block';
      }
      helpEl.style.display = 'none';
      break;
  }
}

// --- Render ---

function colorToCSS(c: ColorValue): string {
  return `rgba(${Math.round(c.r * 255)}, ${Math.round(c.g * 255)}, ${Math.round(c.b * 255)}, ${c.a})`;
}

function renderPayload(payload: TokenSyncPayload) {
  const section = getElement<HTMLDivElement>('payload-section');
  const collection = payload.collections[0];
  const firstMode = collection.modes[0];

  section.innerHTML = `
    <h1>${collection.name}</h1>
    <div class="swatches" id="swatches"></div>
    <button id="regen-btn">Regenerate</button>
  `;

  const swatches = getElement<HTMLDivElement>('swatches');
  for (const token of firstMode.tokens) {
    const el = document.createElement('div');
    el.className = 'swatch';
    if (token.type === 'color' && isColorValue(token.value)) {
      el.style.backgroundColor = colorToCSS(token.value);
    }
    el.innerHTML = `<span class="label">${token.name}</span>`;
    swatches.appendChild(el);
  }

  getElement('regen-btn').addEventListener('click', async () => {
    await fetchAndRender();
    if (isPaired && syncClient && currentPayload) {
      syncClient.sync(currentPayload);
    }
  });
}

init();
