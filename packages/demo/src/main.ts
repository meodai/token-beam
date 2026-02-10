import type { TokenSyncPayload } from 'token-sync';
import { pluginLinks, SyncClient } from 'token-sync';

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

// --- Init ---

async function init() {
  const app = getElement<HTMLDivElement>('app');
  app.innerHTML = `
    <div class="dts-widget dts-widget--waiting" id="sync-status">
      <div class="dts-widget__row">
        <div class="dts-widget__label">Token Sync</div>
        <button id="sync-token" class="dts-widget__token" type="button" title="Click to copy"></button>
        <button id="unlink-btn" class="dts-widget__unlink" type="button" title="Disconnect and generate new token">Unlink</button>
        <div id="help-wrap" class="dts-widget__help">
          <button id="help-btn" class="dts-widget__help-btn" type="button" aria-label="About Token Sync">?</button>
          <div class="dts-widget__tooltip" role="tooltip">
            <p>
              This widget allows you to sync this website with your favorite design program.
            </p>
            <ul id="plugin-list" class="dts-widget__plugins"></ul>
          </div>
        </div>
      </div>
      <div id="sync-error" class="dts-widget__error" style="display: none;"></div>
    </div>

    <div id="payload-section"></div>
  `;

  getElement('unlink-btn').addEventListener('click', () => {
    unlink();
  });

  const pluginList = getElement<HTMLUListElement>('plugin-list');
  pluginList.innerHTML = pluginLinks
    .map((plugin) => {
      return `<li><a href="${plugin.url}" target="_blank" rel="noreferrer">${plugin.name}</a></li>`;
    })
    .join('');

  getElement('sync-token').addEventListener('click', () => {
    if (sessionToken) {
      navigator.clipboard.writeText(sessionToken);
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

  const tokenEl = queryElement<HTMLButtonElement>(syncStatus, '#sync-token');
  const errorEl = queryElement<HTMLDivElement>(syncStatus, '#sync-error');
  const unlinkBtn = queryElement<HTMLButtonElement>(syncStatus, '#unlink-btn');
  const helpWrap = queryElement<HTMLDivElement>(syncStatus, '#help-wrap');

  if (!tokenEl || !errorEl || !unlinkBtn || !helpWrap) return;

  syncStatus.classList.remove('dts-widget--waiting', 'dts-widget--connected', 'dts-widget--error');

  switch (status) {
    case 'connecting':
      syncStatus.classList.add('dts-widget--waiting');
      tokenEl.textContent = 'Connecting...';
      tokenEl.disabled = true;
      errorEl.style.display = 'none';
      unlinkBtn.style.display = 'none';
      helpWrap.style.display = '';
      break;
    case 'ready':
      if (token) {
        tokenEl.textContent = token;
      }
      syncStatus.classList.add('dts-widget--waiting');
      tokenEl.disabled = false;
      unlinkBtn.style.display = 'none';
      errorEl.style.display = 'none';
      helpWrap.style.display = '';
      break;
    case 'syncing':
      syncStatus.classList.add('dts-widget--connected');
      if (token) {
        tokenEl.textContent = token;
      }
      tokenEl.disabled = false;
      unlinkBtn.style.display = '';
      errorEl.style.display = 'none';
      helpWrap.style.display = 'none';
      break;
    case 'disconnected':
      syncStatus.classList.add('dts-widget--waiting');
      tokenEl.textContent = 'Disconnected';
      tokenEl.disabled = true;
      errorEl.style.display = 'none';
      unlinkBtn.style.display = 'none';
      helpWrap.style.display = '';
      break;
    case 'error':
      syncStatus.classList.add('dts-widget--error');
      tokenEl.textContent = 'Error';
      tokenEl.disabled = true;
      unlinkBtn.style.display = 'none';
      helpWrap.style.display = '';
      if (error) {
        errorEl.textContent = error;
        errorEl.style.display = 'block';
      } else {
        errorEl.style.display = 'none';
      }
      break;
  }
}

// --- Render ---

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
    if (token.type === 'color' && typeof token.value === 'string') {
      el.style.backgroundColor = token.value;
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
