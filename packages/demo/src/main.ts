import type { TokenSyncPayload } from 'token-beam';
import { SyncClient } from 'token-beam';

type PluginLink = {
  id: string;
  name: string;
  url: string;
};

// Auto-detect WebSocket URL based on environment
function getSyncServerUrl(): string {
  // Use explicit env var if provided
  if (import.meta.env.VITE_SYNC_SERVER_URL) {
    return import.meta.env.VITE_SYNC_SERVER_URL;
  }
  
  // In development (localhost), use ws://localhost:8080
  if (location.hostname === 'localhost' || location.hostname === '127.0.0.1') {
    return 'ws://localhost:8080';
  }
  
  // In production, build wss:// URL from current location
  const protocol = location.protocol === 'https:' ? 'wss:' : 'ws:';
  const port = location.port ? `:${location.port}` : '';
  return `${protocol}//${location.hostname}${port}`;
}

const API_PATH = '/api/colors';
const SYNC_SERVER_URL = getSyncServerUrl();
const SYNC_SERVER_HTTP = SYNC_SERVER_URL.replace('ws://', 'http://').replace('wss://', 'https://');

type DemoSyncStatus = 'connecting' | 'ready' | 'syncing' | 'disconnected' | 'error';

let syncClient: SyncClient<TokenSyncPayload> | null = null;
let currentPayload: TokenSyncPayload | null = null;
let sessionToken: string | null = null;
let isPaired = false;
const connectedTargets = new Set<string>();
let copyStatusTimer: number | null = null;
let messageTimer: number | null = null;

// --- DOM helpers ---

function getElement<T extends HTMLElement>(id: string): T {
  const el = document.getElementById(id);
  if (!el) throw new Error(`Element #${id} not found`);
  return el as T;
}

function queryElement<T extends HTMLElement>(parent: HTMLElement, selector: string): T | null {
  return parent.querySelector<T>(selector);
}

function showTemporaryMessage(message: string, duration: number = 3000) {
  const syncStatus = document.querySelector<HTMLDivElement>('[data-dts="widget"]');
  if (!syncStatus) return;

  const errorEl = queryElement<HTMLDivElement>(syncStatus, '[data-dts="error"]');
  if (!errorEl) return;

  if (messageTimer) {
    window.clearTimeout(messageTimer);
  }

  errorEl.textContent = message;
  errorEl.style.display = 'block';
  errorEl.classList.remove('dts-widget__error--error');
  errorEl.classList.add('dts-widget__error--info');
  syncStatus.classList.add('dts-widget--message');

  messageTimer = window.setTimeout(() => {
    errorEl.style.display = 'none';
    errorEl.classList.remove('dts-widget__error--info');
    errorEl.textContent = '';
    syncStatus.classList.remove('dts-widget--message');
    messageTimer = null;
  }, duration);
}

// --- Init ---

async function init() {
  const app = getElement<HTMLDivElement>('app');
  app.innerHTML = `
    <div class="dts-widget dts-widget--waiting" data-dts="widget">
      <div class="dts-widget__row">
        <h3 class="dts-widget__label">Token Beam</h3>
        <div class="dts-widget__token-wrap" data-dts="token-wrap">
          <button
            class="dts-widget__token"
            type="button"
            title="Click to copy"
            data-dts="token"
          ></button>
          <span class="dts-widget__status" data-dts="status" aria-live="polite"></span>
        </div>
        <button
          class="dts-widget__unlink"
          type="button"
          title="Disconnect and generate new token"
          data-dts="unlink"
        >
          <span class="dts-widget__dot" aria-hidden="true"></span>
          <span class="dts-widget__unlink-label">Unlink</span>
        </button>
        <div class="dts-widget__help" data-dts="help-wrap">
          <button
            class="dts-widget__help-btn"
            type="button"
            aria-label="About ⊷ Token Beam"
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
      <div class="dts-widget__error" style="display: none;" data-dts="error" aria-live="polite" role="status"></div>
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
  const statusEl = syncStatus.querySelector<HTMLSpanElement>('[data-dts="status"]');

  if (!tokenEl || !unlinkBtn || !pluginList || !helpWrap || !helpBtn || !statusEl) return;

  unlinkBtn.addEventListener('click', () => {
    unlink();
  });

  // Fetch and render plugin links
  fetch(`${SYNC_SERVER_HTTP}/plugins.json`)
    .then((res) => res.json())
    .then((pluginLinks: PluginLink[]) => {
      pluginList.innerHTML = pluginLinks
        .map((plugin) => {
          return `<li><a href="${plugin.url}" target="_blank" rel="noreferrer">${plugin.name}</a></li>`;
        })
        .join('');
    })
    .catch(() => {
      pluginList.innerHTML = '<li>Could not load plugin list</li>';
    });
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
      statusEl.classList.add('is-visible');
      if (copyStatusTimer) {
        window.clearTimeout(copyStatusTimer);
      }
      copyStatusTimer = window.setTimeout(() => {
        statusEl.classList.remove('is-visible');
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

  connectedTargets.clear();
  isPaired = false;

  syncClient = new SyncClient<TokenSyncPayload>({
    serverUrl: SYNC_SERVER_URL,
    clientType: 'web',
    origin: '⊷ Token Beam Demo',
    icon: { type: 'unicode', value: '⊷' },
    onPaired: (token) => {
      sessionToken = token;
      updateSyncStatus('ready', token);
    },
    onTargetConnected: (clientType) => {
      connectedTargets.add(clientType);
      isPaired = connectedTargets.size > 0;
      updateSyncStatus('syncing');
      if (currentPayload) {
        syncClient?.sync(currentPayload);
      }
    },
    onConnected: () => {
      updateSyncStatus('connecting');
    },
    onDisconnected: () => {
      connectedTargets.clear();
      isPaired = false;
      updateSyncStatus('ready', sessionToken ?? undefined);
    },
    onError: (error) => {
      // Non-fatal warnings (e.g. icon rejected) — log but don't break UI
      if (error.startsWith('[warn]')) {
        console.warn('[token-beam]', error.slice(7));
        return;
      }
      if (error.includes('client disconnected')) {
        // Extract client type from message like "figma client disconnected"
        const clientType = error.split(' ')[0];
        connectedTargets.delete(clientType);
        isPaired = connectedTargets.size > 0;
        updateSyncStatus(isPaired ? 'syncing' : 'ready', sessionToken ?? undefined);
        const capitalizedType = clientType.charAt(0).toUpperCase() + clientType.slice(1);
        showTemporaryMessage(`${capitalizedType} disconnected`);
        return;
      }
      updateSyncStatus('error', undefined, error);
    },
    onSync: (payload) => {
      console.log('Received sync from target:', payload);
    },
  });

  syncClient.connect().catch((error: unknown) => {
    console.error('Failed to connect to sync server:', error);
    updateSyncStatus('ready', sessionToken ?? undefined);
    showTemporaryMessage('Sync sever offline');
  });
}

function unlink() {
  isPaired = false;
  connectedTargets.clear();
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
  const statusEl = queryElement<HTMLSpanElement>(syncStatus, '[data-dts="status"]');

  if (!tokenEl || !errorEl || !unlinkBtn || !helpWrap || !helpBtn || !statusEl) return;

  syncStatus.classList.remove(
    'dts-widget--waiting',
    'dts-widget--connected',
    'dts-widget--error',
    'dts-widget--message'
  );
  statusEl.classList.remove('is-visible');
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
      errorEl.classList.remove('dts-widget__error--error', 'dts-widget__error--info');
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
      errorEl.classList.remove('dts-widget__error--error', 'dts-widget__error--info');
      helpWrap.classList.remove('is-open');
      helpBtn.setAttribute('aria-expanded', 'false');
      helpWrap.style.display = 'none';
      break;
    case 'disconnected':
      syncStatus.classList.add('dts-widget--waiting');
      tokenEl.textContent = 'Disconnected';
      tokenEl.disabled = true;
      errorEl.style.display = 'none';
      errorEl.classList.remove('dts-widget__error--error', 'dts-widget__error--info');
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
        errorEl.classList.remove('dts-widget__error--info');
        errorEl.classList.add('dts-widget__error--error');
        syncStatus.classList.add('dts-widget--message');
      } else {
        errorEl.style.display = 'none';
        errorEl.classList.remove('dts-widget__error--error', 'dts-widget__error--info');
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
