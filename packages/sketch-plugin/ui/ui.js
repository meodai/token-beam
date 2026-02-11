const SYNC_SERVER_URL = 'ws://localhost:8080';

const tokenInput = document.getElementById('token-input');
const connectBtn = document.getElementById('connect-btn');
const statusEl = document.getElementById('status');

let ws = null;
let isConnected = false;
let sessionToken = null;

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
      ws.send(JSON.stringify({
        type: 'pair',
        clientType: 'sketch',
        sessionToken: sessionToken,
        origin: 'Sketch'
      }));
    };

    ws.onmessage = (event) => {
      try {
        const message = JSON.parse(event.data);
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
  } catch (err) {
    showStatus('Failed to connect', 'error');
    disconnect();
  }
}

function disconnect(clearStatus) {
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
  }
}

function handleMessage(message) {
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
        
        // Send to Sketch plugin via webkit message handler
        if (window.webkit && window.webkit.messageHandlers && window.webkit.messageHandlers.sketchBridge) {
          window.webkit.messageHandlers.sketchBridge.postMessage({
            type: 'syncColors',
            data: collections
          });
        }
        
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

function transformPayload(payload) {
  // Transform the token payload to match Sketch's expected format
  return payload.collections.map(collection => ({
    name: collection.name,
    modes: collection.modes.map(mode => ({
      name: mode.name,
      tokens: mode.tokens.filter(token => token.type === 'color')
    }))
  }));
}

function showStatus(text, state) {
  statusEl.textContent = text;
  statusEl.className = `status visible ${state}`;
}

// Initial state
tokenInput.focus();
