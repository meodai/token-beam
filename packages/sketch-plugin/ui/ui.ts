import {
  filterPayloadByType,
  TargetSession,
} from 'token-beam';

declare const __SYNC_SERVER_URL__: string | undefined;
const SYNC_SERVER_URL =
  typeof __SYNC_SERVER_URL__ !== 'undefined' ? __SYNC_SERVER_URL__ : 'wss://tokenbeam.dev';

const tokenInput = document.getElementById('token-input') as HTMLInputElement;
const connectBtn = document.getElementById('connect-btn') as HTMLButtonElement;
const statusEl = document.getElementById('status') as HTMLDivElement;
const resultEl = document.getElementById('result') as HTMLDivElement;
const resultTextEl = document.getElementById('result-text') as HTMLSpanElement;
const resultTimeEl = document.getElementById('result-time') as HTMLSpanElement;

type SyncMessage = {
  payload?: {
    collections?: Array<{
      name: string;
      modes: Array<{
        name: string;
        tokens: Array<{
          type: string;
          name: string;
          value: string;
        }>;
      }>;
    }>;
  };
};

let session: TargetSession<SyncMessage['payload']> | null = null;
let isConnected = false;
let lastResultAt: number | null = null;
let resultTimer: number | null = null;
const resultRtf = new Intl.RelativeTimeFormat(undefined, { numeric: 'auto' });

// Enable/disable connect button based on token input
tokenInput.addEventListener('input', () => {
  connectBtn.disabled = !tokenInput.value.trim();
});

connectBtn.addEventListener('click', () => {
  if (isConnected) {
    disconnect(true);
  } else {
    connect();
  }
});

function connect() {
  const raw = tokenInput.value.trim();
  if (!raw) return;

  showStatus('Connecting...', 'connecting');
  connectBtn.disabled = true;

  session = new TargetSession<SyncMessage['payload']>({
    serverUrl: SYNC_SERVER_URL,
    clientType: 'sketch',
    sessionToken: raw,
    origin: 'Sketch',
  });

  session.on('paired', ({ origin }) => {
    isConnected = true;
    tokenInput.disabled = true;
    connectBtn.disabled = false;
    connectBtn.textContent = 'Disconnect';
    showStatus(`Paired with ${origin || 'unknown source'}`, 'connected');
  });

  session.on('sync', ({ payload }) => {
    if (payload && payload.collections) {
      showStatus('Syncing colors...', 'connected');

      const filteredPayload = filterPayloadByType(payload, ['color']);
      const collections = filteredPayload?.collections ?? [];

      window.postMessage('syncColors', JSON.stringify(collections));

      const collectionName = collections[0]?.name || 'Unknown';
      showResult(`Updated collection: ${collectionName}`);

      setTimeout(() => {
        const peers = session?.getPeers() ?? [];
        const origin = peers[0]?.origin || 'web';
        showStatus('Paired with ' + origin, 'connected');
      }, 1000);
    }
  });

  session.on('warning', ({ message }) => {
    const normalized = message.startsWith('[warn]') ? message.slice(7) : message;
    console.warn('[token-beam]', normalized);
  });

  session.on('error', ({ message }) => {
    if (message === 'Invalid session token') {
      showStatus('Session not found — check the token or start a new session from the web app', 'error');
    } else if (message === 'Invalid session token format') {
      showStatus('Invalid token format — paste the token from the web app', 'error');
    } else {
      showStatus(message || 'Unknown error', 'error');
    }
    disconnect();
  });

  session.on('disconnected', () => {
    if (isConnected) {
      showStatus('Disconnected', 'error');
    }
    disconnect();
  });

  session.connect().catch(() => {
    showStatus('Failed to connect', 'error');
    disconnect();
  });
}

function disconnect(clearStatus = false) {
  if (session) {
    session.disconnect();
    session = null;
  }

  isConnected = false;
  connectBtn.textContent = 'Connect';
  connectBtn.disabled = false;
  tokenInput.disabled = false;
  if (clearStatus) {
    statusEl.className = 'status';
    if (resultEl) resultEl.className = 'result';
    if (resultTextEl) resultTextEl.textContent = '';
    if (resultTimeEl) resultTimeEl.textContent = '';
    lastResultAt = null;
  }
}

function showStatus(text: string, state: 'connecting' | 'connected' | 'error') {
  statusEl.className = `status visible ${state}`;
  statusEl.textContent = text;
}

function showResult(text: string) {
  if (!resultEl || !resultTextEl || !resultTimeEl) return;
  resultTextEl.textContent = text;
  resultEl.className = 'result visible';
  lastResultAt = Date.now();
  resultTimeEl.textContent = formatRelativeResultTime(lastResultAt);
  ensureResultTimer();
}

function formatRelativeResultTime(timestamp: number) {
  const diffSeconds = Math.max(0, Math.round((Date.now() - timestamp) / 1000));
  if (diffSeconds < 5) return 'just now';
  if (diffSeconds < 60) return resultRtf.format(-diffSeconds, 'second');

  const diffMinutes = Math.round(diffSeconds / 60);
  if (diffMinutes < 60) return resultRtf.format(-diffMinutes, 'minute');

  const diffHours = Math.round(diffMinutes / 60);
  if (diffHours < 24) return resultRtf.format(-diffHours, 'hour');

  const diffDays = Math.round(diffHours / 24);
  return resultRtf.format(-diffDays, 'day');
}

function updateResultTime() {
  if (!lastResultAt || !resultTimeEl) return;
  if (!resultEl.classList.contains('visible')) return;
  resultTimeEl.textContent = formatRelativeResultTime(lastResultAt);
}

function ensureResultTimer() {
  if (resultTimer) return;
  resultTimer = window.setInterval(updateResultTime, 10000);
}

// Initial state
tokenInput.focus();
