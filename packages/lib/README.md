# Token Sync (lib)

Core types and sync client for building design-token workflows.

## Widget Example

Use this as a compact, embeddable pairing widget. Clicking the token field copies the session token.

```html
<div class="dts-widget dts-widget--waiting" id="sync-status">
  <div class="dts-widget__row">
    <div class="dts-widget__label">Token Sync</div>
    <button id="sync-token" class="dts-widget__token" type="button" title="Click to copy"></button>
    <button id="unlink-btn" class="dts-widget__unlink" type="button" title="Disconnect">Unlink</button>
  </div>
  <div id="sync-error" class="dts-widget__error" style="display: none;"></div>
</div>
```

```css
.dts-widget {
  padding: 0.5rem;
  border: 1px solid #d4d8d8;
  display: flex;
  flex-direction: column;
  gap: 0.4rem;
}
.dts-widget__row {
  display: flex;
  align-items: center;
  gap: 0.5rem;
}
.dts-widget__label {
  font-size: 0.65rem;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.08em;
  color: #717979;
  white-space: nowrap;
}
.dts-widget__token {
  flex: 1;
  padding: 0.4rem 0.6rem;
  background: #fff;
  border: 2px solid #292f2f;
  font-size: 0.75rem;
  letter-spacing: 0.18em;
  text-align: left;
  cursor: pointer;
}
.dts-widget__unlink {
  background: none;
  border: 1px solid #d4d8d8;
  padding: 0.3rem 0.5rem;
  font-size: 0.6rem;
  text-transform: uppercase;
  letter-spacing: 0.08em;
  cursor: pointer;
}
.dts-widget__error {
  padding: 0.35rem 0.5rem;
  border: 1px solid #c4342d;
  color: #c4342d;
  font-size: 0.65rem;
}
.dts-widget--waiting { border-color: #b07d16; }
.dts-widget--connected { border-color: #1b8a2d; }
.dts-widget--error { border-color: #c4342d; }
```

```ts
import type { TokenSyncPayload } from 'token-sync';
import { SyncClient } from 'token-sync';

const SYNC_SERVER_URL = 'ws://localhost:8080';

type DemoSyncStatus = 'connecting' | 'ready' | 'syncing' | 'disconnected' | 'error';

let syncClient: SyncClient<TokenSyncPayload> | null = null;
let sessionToken: string | null = null;

const syncStatus = document.getElementById('sync-status') as HTMLDivElement;
const tokenEl = document.getElementById('sync-token') as HTMLButtonElement;
const unlinkBtn = document.getElementById('unlink-btn') as HTMLButtonElement;
const errorEl = document.getElementById('sync-error') as HTMLDivElement;

function updateSyncStatus(status: DemoSyncStatus, token?: string, error?: string) {
  syncStatus.classList.remove('dts-widget--waiting', 'dts-widget--connected', 'dts-widget--error');

  switch (status) {
    case 'connecting':
      syncStatus.classList.add('dts-widget--waiting');
      tokenEl.textContent = 'Connecting...';
      tokenEl.disabled = true;
      errorEl.style.display = 'none';
      unlinkBtn.style.display = 'none';
      break;
    case 'ready':
      if (token) tokenEl.textContent = token;
      syncStatus.classList.add('dts-widget--waiting');
      tokenEl.disabled = false;
      unlinkBtn.style.display = 'none';
      errorEl.style.display = 'none';
      break;
    case 'syncing':
      syncStatus.classList.add('dts-widget--connected');
      if (token) tokenEl.textContent = token;
      tokenEl.disabled = false;
      unlinkBtn.style.display = '';
      errorEl.style.display = 'none';
      break;
    case 'disconnected':
      syncStatus.classList.add('dts-widget--waiting');
      tokenEl.textContent = 'Disconnected';
      tokenEl.disabled = true;
      errorEl.style.display = 'none';
      unlinkBtn.style.display = 'none';
      break;
    case 'error':
      syncStatus.classList.add('dts-widget--error');
      tokenEl.textContent = 'Error';
      tokenEl.disabled = true;
      unlinkBtn.style.display = 'none';
      if (error) {
        errorEl.textContent = error;
        errorEl.style.display = 'block';
      } else {
        errorEl.style.display = 'none';
      }
      break;
  }
}

function initSync() {
  if (syncClient) syncClient.disconnect();

  syncClient = new SyncClient<TokenSyncPayload>({
    serverUrl: SYNC_SERVER_URL,
    clientType: 'web',
    origin: 'Token Sync Demo',
    onPaired: (token) => {
      sessionToken = token;
      updateSyncStatus('ready', token);
    },
    onTargetConnected: () => {
      updateSyncStatus('syncing', sessionToken ?? undefined);
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
  });

  syncClient.connect().catch(() => {
    updateSyncStatus('error', undefined, 'Could not connect to sync server');
  });
}

tokenEl.addEventListener('click', () => {
  if (sessionToken) navigator.clipboard.writeText(sessionToken);
});

unlinkBtn.addEventListener('click', () => {
  sessionToken = null;
  syncClient?.disconnect();
  syncClient = null;
  initSync();
});

initSync();
```
