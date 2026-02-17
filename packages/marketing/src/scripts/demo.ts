import { SourceSession, createCollection } from 'token-beam';
import type { TokenSyncPayload } from 'token-beam';
import { isWarningError, normalizeSessionToken } from 'token-beam';
import { generateColorRamp, colorUtils } from 'rampensau';

// --- State ---
let session: SourceSession<TokenSyncPayload> | null = null;
let currentPayload: TokenSyncPayload | null = null;
let sessionToken: string | null = null;
let suppressOfflineNotice = false;
let copyStatusTimer: ReturnType<typeof setTimeout> | null = null;
let messageTimer: ReturnType<typeof setTimeout> | null = null;

const SYNC_SERVER_URL = 'wss://tokenbeam.dev';
const SYNC_SERVER_HTTP = 'https://tokenbeam.dev';

// --- Color generation with rampensau ---

function generateRamp(): { name: string; colors: Record<string, string> } {
  const hStart = Math.random() * 360;
  const hCycles = (Math.random() - 0.5) * 1.5;
  const colors: Record<string, string> = {};
  const steps = [100, 200, 300, 400, 500, 600, 700, 800, 900];

  const ramp = generateColorRamp({
    total: steps.length,
    hStart,
    hCycles,
    sRange: [0.4 + Math.random() * 0.4, 0.3 + Math.random() * 0.5],
    lRange: [0.05 + Math.random() * 0.1, 0.85 + Math.random() * 0.1],
  });

  ramp.forEach((color, i) => {
    colors[String(steps[i])] = colorUtils.colorToCSS(color, 'oklch');
  });

  return { name: 'token-beam-demo', colors };
}

// --- DOM helpers ---

function showTemporaryMessage(message: string, duration: number = 3000) {
  const widget = document.querySelector<HTMLDivElement>('[data-dts="widget"]');
  if (!widget) return;
  const errorEl = widget.querySelector<HTMLDivElement>('[data-dts="error"]');
  if (!errorEl) return;

  if (messageTimer) clearTimeout(messageTimer);

  errorEl.textContent = message;
  errorEl.style.display = 'block';
  errorEl.classList.remove('dts-widget__error--error');
  errorEl.classList.add('dts-widget__error--info');
  widget.classList.add('dts-widget--message');

  messageTimer = setTimeout(() => {
    errorEl.style.display = 'none';
    errorEl.classList.remove('dts-widget__error--info');
    errorEl.textContent = '';
    widget.classList.remove('dts-widget--message');
    messageTimer = null;
  }, duration);
}

function setOfflineState(isOffline: boolean) {
  const widget = document.querySelector<HTMLDivElement>('[data-dts="widget"]');
  if (!widget) return;
  widget.classList.toggle('dts-widget--offline', isOffline);
}

// --- Rendering ---

function renderSwatches(colors: Record<string, string>) {
  const container = document.getElementById('swatches');
  if (!container) return;
  container.innerHTML = '';

  for (const [name, value] of Object.entries(colors)) {
    const el = document.createElement('div');
    el.className = 'demo__swatch';
    el.style.backgroundColor = value;
    el.innerHTML = `<span class="demo__swatch-label">${name}</span>`;
    container.appendChild(el);
  }
}

function generateAndRender() {
  const { name, colors } = generateRamp();
  currentPayload = createCollection(name, colors);
  renderSwatches(colors);
}

// --- Sync status ---

function updateSyncStatus(
  status: 'connecting' | 'ready' | 'syncing' | 'disconnected' | 'error',
  token?: string,
  error?: string,
) {
  const widget = document.querySelector<HTMLDivElement>('[data-dts="widget"]');
  if (!widget) return;

  const tokenEl = widget.querySelector<HTMLButtonElement>('[data-dts="token"]');
  const errorEl = widget.querySelector<HTMLDivElement>('[data-dts="error"]');
  const unlinkBtn = widget.querySelector<HTMLButtonElement>('[data-dts="unlink"]');
  const helpWrap = widget.querySelector<HTMLDivElement>('[data-dts="help-wrap"]');
  const helpBtn = widget.querySelector<HTMLButtonElement>('[data-dts="help-btn"]');
  const statusEl = widget.querySelector<HTMLSpanElement>('[data-dts="status"]');

  if (!tokenEl || !errorEl || !unlinkBtn || !helpWrap || !helpBtn || !statusEl) return;

  widget.classList.remove(
    'dts-widget--waiting',
    'dts-widget--connected',
    'dts-widget--error',
    'dts-widget--message',
  );
  statusEl.classList.remove('is-visible');
  statusEl.textContent = '';

  switch (status) {
    case 'connecting':
      widget.classList.add('dts-widget--waiting');
      tokenEl.textContent = 'Connecting...';
      tokenEl.disabled = true;
      errorEl.style.display = 'none';
      unlinkBtn.style.display = 'none';
      helpWrap.style.display = '';
      break;
    case 'ready':
      if (token) tokenEl.textContent = token;
      widget.classList.add('dts-widget--waiting');
      tokenEl.disabled = false;
      unlinkBtn.style.display = 'none';
      errorEl.style.display = 'none';
      errorEl.classList.remove('dts-widget__error--error', 'dts-widget__error--info');
      helpWrap.style.display = '';
      break;
    case 'syncing':
      widget.classList.add('dts-widget--connected');
      if (token) tokenEl.textContent = token;
      tokenEl.disabled = false;
      unlinkBtn.style.display = '';
      errorEl.style.display = 'none';
      errorEl.classList.remove('dts-widget__error--error', 'dts-widget__error--info');
      helpWrap.classList.remove('is-open');
      helpBtn.setAttribute('aria-expanded', 'false');
      helpWrap.style.display = 'none';
      break;
    case 'disconnected':
      widget.classList.add('dts-widget--waiting');
      tokenEl.textContent = 'Disconnected';
      tokenEl.disabled = true;
      errorEl.style.display = 'none';
      unlinkBtn.style.display = 'none';
      helpWrap.style.display = '';
      break;
    case 'error':
      widget.classList.add('dts-widget--error');
      tokenEl.textContent = 'Error';
      tokenEl.disabled = true;
      unlinkBtn.style.display = 'none';
      helpWrap.style.display = '';
      if (error) {
        errorEl.textContent = error;
        errorEl.style.display = 'block';
        errorEl.classList.remove('dts-widget__error--info');
        errorEl.classList.add('dts-widget__error--error');
        widget.classList.add('dts-widget--message');
      } else {
        errorEl.style.display = 'none';
      }
      break;
  }
}

// --- Sync ---

function initSync() {
  if (session) {
    suppressOfflineNotice = true;
    session.disconnect();
  }

  setOfflineState(false);

  session = new SourceSession<TokenSyncPayload>({
    serverUrl: SYNC_SERVER_URL,
    clientType: 'web',
    origin: '⊷ Token Beam',
    icon: { type: 'unicode', value: '⊷' },
  });

  session.on('paired', ({ sessionToken: pairedToken }) => {
    sessionToken = normalizeSessionToken(pairedToken) ?? pairedToken;
    setOfflineState(false);
    updateSyncStatus('ready', sessionToken);
  });

  session.on('peer-connected', () => {
    setOfflineState(false);
    updateSyncStatus('syncing');
    if (currentPayload) session?.sync(currentPayload);
  });

  session.on('connected', () => {
    setOfflineState(false);
    updateSyncStatus('connecting');
  });

  session.on('disconnected', () => {
    if (suppressOfflineNotice) {
      suppressOfflineNotice = false;
      return;
    }
    updateSyncStatus('ready', sessionToken ?? undefined);
    setOfflineState(true);
  });

  session.on('warning', ({ message }) => {
    if (isWarningError(message)) {
      console.warn('[token-beam]', message.slice(7));
      return;
    }
    console.warn('[token-beam]', message);
  });

  session.on('peer-disconnected', ({ clientType }) => {
    const hasPeers = session?.hasPeers() ?? false;
    updateSyncStatus(hasPeers ? 'syncing' : 'ready', sessionToken ?? undefined);
    const cap = clientType.charAt(0).toUpperCase() + clientType.slice(1);
    showTemporaryMessage(`${cap} disconnected`);
  });

  session.on('error', ({ message }) => {
    updateSyncStatus('error', undefined, message);
  });

  session.on('sync', ({ payload }) => {
    console.log('Received sync from target:', payload);
  });

  session.connect().catch((err: unknown) => {
    console.error('Failed to connect:', err);
    updateSyncStatus('ready', sessionToken ?? undefined);
    setOfflineState(true);
  });
}

function unlink() {
  if (session) {
    suppressOfflineNotice = true;
    session.disconnect();
    session = null;
  }
  setOfflineState(false);
  sessionToken = null;
  initSync();
}

// --- Init ---

function init() {
  const widget = document.querySelector<HTMLDivElement>('[data-dts="widget"]');
  if (!widget) return;

  const tokenEl = widget.querySelector<HTMLButtonElement>('[data-dts="token"]');
  const unlinkBtn = widget.querySelector<HTMLButtonElement>('[data-dts="unlink"]');
  const pluginList = widget.querySelector<HTMLUListElement>('[data-dts="plugin-list"]');
  const helpWrap = widget.querySelector<HTMLDivElement>('[data-dts="help-wrap"]');
  const helpBtn = widget.querySelector<HTMLButtonElement>('[data-dts="help-btn"]');
  const statusEl = widget.querySelector<HTMLSpanElement>('[data-dts="status"]');
  const regenBtn = document.getElementById('regen-btn');

  if (!tokenEl || !unlinkBtn || !pluginList || !helpWrap || !helpBtn || !statusEl) return;

  unlinkBtn.addEventListener('click', () => unlink());

  // Fetch plugin list
  fetch(`${SYNC_SERVER_HTTP}/plugins.json`)
    .then((res) => res.json())
    .then((plugins: Array<{ id: string; name: string; url: string }>) => {
      pluginList.innerHTML = plugins
        .map((p) => `<li><a href="${p.url}" target="_blank" rel="noreferrer">${p.name}</a></li>`)
        .join('');
    })
    .catch(() => {
      pluginList.innerHTML = '<li>Could not load plugin list</li>';
    });

  // Help tooltip
  const closeHelp = () => {
    helpWrap.classList.remove('is-open');
    helpBtn.setAttribute('aria-expanded', 'false');
  };

  helpBtn.addEventListener('click', (e) => {
    e.stopPropagation();
    const isOpen = helpWrap.classList.toggle('is-open');
    helpBtn.setAttribute('aria-expanded', String(isOpen));
  });

  document.addEventListener('click', (e) => {
    if (!helpWrap.contains(e.target as Node)) closeHelp();
  });

  // Copy token
  tokenEl.addEventListener('click', () => {
    if (sessionToken) {
      navigator.clipboard.writeText(sessionToken);
      statusEl.textContent = 'Copied';
      statusEl.classList.add('is-visible');
      if (copyStatusTimer) clearTimeout(copyStatusTimer);
      copyStatusTimer = setTimeout(() => {
        statusEl.classList.remove('is-visible');
        statusEl.textContent = '';
        copyStatusTimer = null;
      }, 1500);
    }
  });

  // Regenerate button
  if (regenBtn) {
    regenBtn.addEventListener('click', () => {
      generateAndRender();
      if (session?.hasPeers() && session && currentPayload) {
        session.sync(currentPayload);
      }
    });
  }

  // Generate initial colors and start sync
  generateAndRender();
  initSync();
}

init();
