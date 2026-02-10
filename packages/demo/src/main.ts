import type { FigmaCollectionPayload, ColorValue } from 'token-sync';
import { SyncClient } from './sync-client';

const API_PATH = '/api/colors';
const SYNC_SERVER_URL = 'ws://localhost:8080';

let syncClient: SyncClient<FigmaCollectionPayload> | null = null;
let currentPayload: FigmaCollectionPayload | null = null;
let sessionToken: string | null = null;
let isPaired = false;

// --- Init ---

async function init() {
  const app = document.getElementById('app')!;
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

  document.getElementById('unlink-btn')!.addEventListener('click', () => {
    unlink();
  });

  document.getElementById('copy-token-btn')!.addEventListener('click', () => {
    if (sessionToken) {
      navigator.clipboard.writeText(sessionToken);
      const btn = document.getElementById('copy-token-btn')!;
      btn.textContent = 'Copied!';
      setTimeout(() => (btn.textContent = 'Copy'), 1500);
    }
  });

  await fetchAndRender();
  initSync();
}

async function fetchAndRender() {
  const res = await fetch(API_PATH);
  const payload: FigmaCollectionPayload = await res.json();
  currentPayload = payload;
  renderPayload(payload);
}

// --- Sync ---

function initSync() {
  if (syncClient) {
    syncClient.disconnect();
  }

  syncClient = new SyncClient<FigmaCollectionPayload>({
    serverUrl: SYNC_SERVER_URL,
    clientType: 'web',
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
      console.log('Received sync from Figma:', payload);
    },
  });

  syncClient.connect().catch((error) => {
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

function updateSyncStatus(status: string, token?: string, error?: string) {
  const syncStatus = document.getElementById('sync-status');
  if (!syncStatus) return;

  const statusEl = syncStatus.querySelector('.status-indicator') as HTMLElement;
  const tokenDisplay = syncStatus.querySelector('.token-display') as HTMLElement;
  const tokenEl = syncStatus.querySelector('#sync-token') as HTMLElement;
  const errorEl = syncStatus.querySelector('#sync-error') as HTMLElement;
  const unlinkBtn = syncStatus.querySelector('#unlink-btn') as HTMLElement;
  const helpEl = syncStatus.querySelector('.sync-help') as HTMLElement;

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

function renderPayload(payload: FigmaCollectionPayload) {
  const section = document.getElementById('payload-section')!;
  const firstMode = payload.modes[0];

  section.innerHTML = `
    <h1>${payload.collectionName}</h1>
    <div class="swatches" id="swatches"></div>
    <button id="regen-btn">Regenerate</button>
  `;

  const swatches = document.getElementById('swatches')!;
  for (const v of firstMode.variables) {
    const el = document.createElement('div');
    el.className = 'swatch';
    if (v.type === 'COLOR') {
      el.style.backgroundColor = colorToCSS(v.value as ColorValue);
    }
    el.innerHTML = `<span class="label">${v.name}</span>`;
    swatches.appendChild(el);
  }

  document.getElementById('regen-btn')!.addEventListener('click', async () => {
    await fetchAndRender();
    // Re-sync if paired
    if (isPaired && syncClient && currentPayload) {
      syncClient.sync(currentPayload);
    }
  });
}

init();
