import type { FigmaCollectionPayload, FigmaColorValue } from 'token-sync';
import { SyncClient } from './sync-client';

const API_PATH = '/api/colors';
const SYNC_SERVER_URL = 'ws://localhost:8080';

let syncClient: SyncClient | null = null;
let currentPayload: FigmaCollectionPayload | null = null;
let sessionToken: string | null = null;

async function init() {
  const res = await fetch(API_PATH);
  const payload: FigmaCollectionPayload = await res.json();
  currentPayload = payload;
  render(payload);
  initSync();
}

function initSync() {
  if (syncClient) {
    syncClient.disconnect();
  }

  syncClient = new SyncClient({
    serverUrl: SYNC_SERVER_URL,
    clientType: 'web',
    onPaired: (token) => {
      sessionToken = token;
      updateSyncStatus('ready', token);
      // Automatically sync current payload when paired
      if (currentPayload) {
        syncClient?.sync(currentPayload);
      }
    },
    onConnected: () => {
      updateSyncStatus('connecting');
    },
    onDisconnected: () => {
      updateSyncStatus('disconnected');
    },
    onError: (error) => {
      updateSyncStatus('error', undefined, error);
    },
    onSync: (payload) => {
      // Handle sync from Figma (if needed)
      console.log('Received sync from Figma:', payload);
    },
  });

  syncClient.connect().catch((error) => {
    console.error('Failed to connect to sync server:', error);
    updateSyncStatus('error', undefined, 'Could not connect to sync server');
  });
}

function updateSyncStatus(status: string, token?: string, error?: string) {
  const syncStatus = document.getElementById('sync-status');
  if (!syncStatus) return;

  const statusEl = syncStatus.querySelector('.status-indicator') as HTMLElement;
  const tokenEl = syncStatus.querySelector('#sync-token') as HTMLElement;
  const errorEl = syncStatus.querySelector('#sync-error') as HTMLElement;

  switch (status) {
    case 'connecting':
      statusEl.className = 'status-indicator connecting';
      statusEl.textContent = 'Connecting...';
      tokenEl.style.display = 'none';
      errorEl.style.display = 'none';
      break;
    case 'ready':
      statusEl.className = 'status-indicator connected';
      statusEl.textContent = 'Live Sync Ready';
      if (token) {
        tokenEl.textContent = token;
        tokenEl.style.display = 'block';
      }
      errorEl.style.display = 'none';
      break;
    case 'disconnected':
      statusEl.className = 'status-indicator disconnected';
      statusEl.textContent = 'Disconnected';
      tokenEl.style.display = 'none';
      errorEl.style.display = 'none';
      break;
    case 'error':
      statusEl.className = 'status-indicator error';
      statusEl.textContent = 'Error';
      tokenEl.style.display = 'none';
      if (error) {
        errorEl.textContent = error;
        errorEl.style.display = 'block';
      }
      break;
  }
}

function figmaColorToCSS(c: FigmaColorValue): string {
  return `rgba(${Math.round(c.r * 255)}, ${Math.round(c.g * 255)}, ${Math.round(c.b * 255)}, ${c.a})`;
}

function render(payload: FigmaCollectionPayload) {
  const app = document.getElementById('app')!;
  const fullUrl = `${window.location.origin}${API_PATH}`;
  const firstMode = payload.modes[0];

  app.innerHTML = `
    <h1>${payload.collectionName}</h1>
    
    <div class="sync-section" id="sync-status">
      <h2>Live Sync</h2>
      <div class="sync-info">
        <div class="status-indicator connecting">Connecting...</div>
        <div class="token-display" style="display: none;">
          <label>Figma Plugin Token:</label>
          <code id="sync-token" class="sync-token"></code>
          <button id="copy-token-btn">Copy Token</button>
        </div>
        <div id="sync-error" class="error-message" style="display: none;"></div>
        <p class="sync-help">Enter this token in the Figma plugin to sync changes in real-time</p>
      </div>
    </div>

    <div class="url-bar">
      <label>HTTP API URL (one-time fetch):</label>
      <div class="url-row">
        <code id="url-code">${fullUrl}</code>
        <button id="copy-btn">Copy URL</button>
      </div>
    </div>
    
    <div class="swatches" id="swatches"></div>
    <button id="regen-btn">Regenerate</button>
  `;

  const swatches = document.getElementById('swatches')!;
  for (const v of firstMode.variables) {
    const el = document.createElement('div');
    el.className = 'swatch';
    if (v.type === 'COLOR') {
      el.style.backgroundColor = figmaColorToCSS(v.value as FigmaColorValue);
    }
    el.innerHTML = `<span class="label">${v.name}</span>`;
    swatches.appendChild(el);
  }

  document.getElementById('copy-btn')!.addEventListener('click', () => {
    navigator.clipboard.writeText(fullUrl);
    const btn = document.getElementById('copy-btn')!;
    btn.textContent = 'Copied!';
    setTimeout(() => (btn.textContent = 'Copy URL'), 1500);
  });

  const copyTokenBtn = document.getElementById('copy-token-btn');
  if (copyTokenBtn) {
    copyTokenBtn.addEventListener('click', () => {
      if (sessionToken) {
        navigator.clipboard.writeText(sessionToken);
        copyTokenBtn.textContent = 'Copied!';
        setTimeout(() => (copyTokenBtn.textContent = 'Copy Token'), 1500);
      }
    });
  }

  document.getElementById('regen-btn')!.addEventListener('click', async () => {
    await init();
    // Sync new payload
    if (syncClient && currentPayload) {
      syncClient.sync(currentPayload);
    }
  });
}

init();
