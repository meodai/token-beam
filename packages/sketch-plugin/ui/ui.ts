const SYNC_SERVER_URL = 'ws://localhost:8080';

const tokenInput = document.getElementById('token-input') as HTMLInputElement;
const connectBtn = document.getElementById('connect-btn') as HTMLButtonElement;
const statusEl = document.getElementById('status') as HTMLDivElement;
const resultEl = document.getElementById('result') as HTMLDivElement;
const resultTextEl = document.getElementById('result-text') as HTMLSpanElement;
const resultTimeEl = document.getElementById('result-time') as HTMLSpanElement;

type SyncMessage = {
  type: 'pair' | 'sync' | 'ping' | 'error';
  sessionToken?: string;
  origin?: string;
  error?: string;
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

let ws: WebSocket | null = null;
let isConnected = false;
let sessionToken: string | null = null;
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

  // Validate: must be hex chars (with optional beam:// prefix)
  const stripped = raw.replace(/^beam:\/\//i, '');
  if (!/^[0-9a-f]+$/i.test(stripped)) {
    showStatus('Invalid token format — paste the token from the web app', 'error');
    return;
  }

  // Normalize token
  sessionToken = raw.startsWith('beam://') ? raw : `beam://${raw.toUpperCase()}`;

  showStatus('Connecting...', 'connecting');
  connectBtn.disabled = true;

  try {
    ws = new WebSocket(SYNC_SERVER_URL);

    ws.onopen = () => {
      // Send pair message
      ws?.send(
        JSON.stringify({
          type: 'pair',
          clientType: 'sketch',
          sessionToken: sessionToken,
          origin: 'Sketch',
        }),
      );
    };

    ws.onmessage = (event) => {
      try {
        const message = JSON.parse(event.data) as SyncMessage;
        handleMessage(message);
      } catch (err) {
        console.error('Failed to parse message:', err);
      }
    };

    ws.onerror = (error) => {
      console.error('WebSocket error:', error);
      showStatus('Connection failed', 'error');
      disconnect();
    };

    ws.onclose = () => {
      if (isConnected) {
        showStatus('Disconnected', 'error');
      }
      disconnect();
    };
  } catch (_err) {
    showStatus('Failed to connect', 'error');
    disconnect();
  }
}

function disconnect(clearStatus = false) {
  if (ws) {
    ws.close();
    ws = null;
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

function handleMessage(message: SyncMessage) {
  switch (message.type) {
    case 'pair':
      if (message.sessionToken) {
        // Successfully paired
        isConnected = true;
        tokenInput.disabled = true;
        connectBtn.disabled = false;
        connectBtn.textContent = 'Disconnect';

        const origin = message.origin || 'unknown source';
        showStatus(`Paired with ${origin}`, 'connected');
      }
      break;

    case 'sync':
      if (message.payload && message.payload.collections) {
        showStatus('Syncing colors...', 'connected');

        // Transform payload for Sketch
        const collections = transformPayload(message.payload);

        // Send to Sketch plugin via postMessage bridge (sketch-module-web-view)
        window.postMessage('syncColors', JSON.stringify(collections));

        const collectionName = collections[0]?.name || 'Unknown';
        showResult(`Updated collection: ${collectionName}`);

        setTimeout(() => {
          showStatus('Paired with ' + (message.origin || 'web'), 'connected');
        }, 1000);
      }
      break;

    case 'error':
      // Non-fatal warnings — log but stay connected
      if (message.error && message.error.startsWith('[warn]')) {
        console.warn('[token-beam]', message.error.slice(7));
        break;
      }
      if (message.error === 'Invalid session token') {
        showStatus('Session not found — check the token or start a new session from the web app', 'error');
      } else {
        showStatus(message.error || 'Unknown error', 'error');
      }
      disconnect();
      break;

    case 'ping':
      // Respond to ping
      if (ws && ws.readyState === WebSocket.OPEN) {
        ws.send(JSON.stringify({ type: 'ping' }));
      }
      break;
  }
}

function transformPayload(payload: NonNullable<SyncMessage['payload']>) {
  // Transform the token payload to match Sketch's expected format
  return payload.collections?.map((collection) => ({
    name: collection.name,
    modes: collection.modes.map((mode) => ({
      name: mode.name,
      tokens: mode.tokens.filter((token) => token.type === 'color'),
    })),
  })) ?? [];
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
