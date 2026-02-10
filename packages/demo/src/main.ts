import type { TokenSyncPayload } from 'token-sync';
import { pluginLinks, SyncClient } from 'token-sync';

const API_PATH = '/api/colors';
const SYNC_SERVER_URL = 'ws://localhost:8080';

type DemoSyncStatus = 'connecting' | 'ready' | 'syncing' | 'disconnected' | 'error';

let syncClient: SyncClient<TokenSyncPayload> | null = null;
let currentPayload: TokenSyncPayload | null = null;
let sessionToken: string | null = null;
let isPaired = false;
let copyStatusTimer: number | null = null;

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
    <div class="dts-widget dts-widget--waiting" data-dts="widget">
      <div class="dts-widget__row">
        <div class="dts-widget__label">Token Sync</div>
        <button
          class="dts-widget__token"
          type="button"
          title="Click to copy"
          data-dts="token"
        ></button>
        <button
          class="dts-widget__unlink"
          type="button"
          title="Disconnect and generate new token"
          data-dts="unlink"
        >
          Unlink
        </button>
        <div class="dts-widget__help" data-dts="help-wrap">
          <button
            class="dts-widget__help-btn"
            type="button"
            aria-label="About Token Sync"
            aria-expanded="false"
            data-dts="help-btn"
          >
            ?
          </button>
          <div class="dts-widget__tooltip" role="tooltip" data-dts="help-tooltip">
            <p>
              This widget allows you to sync this website with your favorite design program.
            </p>
            <ul class="dts-widget__plugins" data-dts="plugin-list"></ul>
          </div>
        </div>
      </div>
      <div class="dts-widget__error" style="display: none;" data-dts="error"></div>
      <div class="dts-widget__status" style="display: none;" data-dts="status"></div>
    </div>

    <div id="payload-section"></div>
  `;

  const syncStatus = getElement<HTMLDivElement>('app').querySelector<HTMLDivElement>(
    '[data-dts="widget"]',
  );
  if (!syncStatus) return;

  const tokenEl = syncStatus.querySelector<HTMLButtonElement>('[data-dts="token"]');
  const unlinkBtn = syncStatus.querySelector<HTMLButtonElement>('[data-dts="unlink"]');
  const pluginList = syncStatus.querySelector<HTMLUListElement>('[data-dts="plugin-list"]');
  const helpWrap = syncStatus.querySelector<HTMLDivElement>('[data-dts="help-wrap"]');
  const helpBtn = syncStatus.querySelector<HTMLButtonElement>('[data-dts="help-btn"]');
  const statusEl = syncStatus.querySelector<HTMLDivElement>('[data-dts="status"]');

  if (!tokenEl || !unlinkBtn || !pluginList || !helpWrap || !helpBtn || !statusEl) return;

  unlinkBtn.addEventListener('click', () => {
    unlink();
  });

  pluginList.innerHTML = pluginLinks
    .map((plugin) => {
      return `<li><a href="${plugin.url}" target="_blank" rel="noreferrer">${plugin.name}</a></li>`;
    })
    .join('');
  const closeHelp = () => {
    helpWrap.classList.remove('is-open');
    helpBtn.setAttribute('aria-expanded', 'false');
  };

  helpBtn.addEventListener('click', (event) => {
    event.stopPropagation();
    const isOpen = helpWrap.classList.toggle('is-open');
    helpBtn.setAttribute('aria-expanded', String(isOpen));
  });

  document.addEventListener('click', (event) => {
    if (!helpWrap.contains(event.target as Node)) {
      closeHelp();
    }
  });

  tokenEl.addEventListener('click', () => {
    if (sessionToken) {
      navigator.clipboard.writeText(sessionToken);
      statusEl.textContent = 'Copied';
      statusEl.style.display = 'block';
      if (copyStatusTimer) {
        window.clearTimeout(copyStatusTimer);
      }
      copyStatusTimer = window.setTimeout(() => {
        statusEl.style.display = 'none';
        statusEl.textContent = '';
        copyStatusTimer = null;
      }, 1500);
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
  const syncStatus = document.querySelector<HTMLDivElement>('[data-dts="widget"]');
  if (!syncStatus) return;

  const tokenEl = queryElement<HTMLButtonElement>(syncStatus, '[data-dts="token"]');
  const errorEl = queryElement<HTMLDivElement>(syncStatus, '[data-dts="error"]');
  const unlinkBtn = queryElement<HTMLButtonElement>(syncStatus, '[data-dts="unlink"]');
  const helpWrap = queryElement<HTMLDivElement>(syncStatus, '[data-dts="help-wrap"]');
  const helpBtn = queryElement<HTMLButtonElement>(syncStatus, '[data-dts="help-btn"]');
  const statusEl = queryElement<HTMLDivElement>(syncStatus, '[data-dts="status"]');

  if (!tokenEl || !errorEl || !unlinkBtn || !helpWrap || !helpBtn || !statusEl) return;

  syncStatus.classList.remove('dts-widget--waiting', 'dts-widget--connected', 'dts-widget--error');
  statusEl.style.display = 'none';
  statusEl.textContent = '';

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
      helpWrap.classList.remove('is-open');
      helpBtn.setAttribute('aria-expanded', 'false');
      helpWrap.style.display = 'none';
      break;
    case 'disconnected':
      syncStatus.classList.add('dts-widget--waiting');
      tokenEl.textContent = 'Disconnected';
      tokenEl.disabled = true;
      errorEl.style.display = 'none';
      helpWrap.classList.remove('is-open');
      helpBtn.setAttribute('aria-expanded', 'false');
      unlinkBtn.style.display = 'none';
      helpWrap.style.display = '';
      break;
    case 'error':
      syncStatus.classList.add('dts-widget--error');
      tokenEl.textContent = 'Error';
      tokenEl.disabled = true;
      unlinkBtn.style.display = 'none';
      helpWrap.classList.remove('is-open');
      helpBtn.setAttribute('aria-expanded', 'false');
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
