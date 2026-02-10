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
    <div id="help-wrap" class="dts-widget__help">
      <button
        id="help-btn"
        class="dts-widget__help-btn"
        type="button"
        aria-label="About Token Sync"
        aria-expanded="false"
        aria-controls="help-tooltip"
      >
        ?
      </button>
      <div id="help-tooltip" class="dts-widget__tooltip" role="tooltip">
        <p>
          This widget allows you to sync this website with your favorite design program.
        </p>
        <ul id="plugin-list" class="dts-widget__plugins"></ul>
      </div>
    </div>
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
.dts-widget__help {
  position: relative;
  display: inline-flex;
  align-items: center;
}
.dts-widget__help-btn {
  width: 20px;
  height: 20px;
  padding: 0;
  border: 1px solid #d4d8d8;
  background: #fff;
  color: #717979;
  font-size: 0.65rem;
  line-height: 1;
  cursor: pointer;
}
.dts-widget__tooltip {
  position: absolute;
  right: 0;
  top: calc(100% + 6px);
  width: 240px;
  padding: 0.5rem 0.6rem;
  border: 1px solid #d4d8d8;
  background: #fff;
  font-size: 0.65rem;
  line-height: 1.45;
  opacity: 0;
  pointer-events: none;
  transform: translateY(-4px);
  transition: all 0.2s ease;
}
.dts-widget__help.is-open .dts-widget__tooltip {
  opacity: 1;
  pointer-events: auto;
  transform: translateY(0);
}
.dts-widget__tooltip p {
  margin-bottom: 0.4rem;
  color: #717979;
}
.dts-widget__plugins {
  list-style: none;
  display: flex;
  flex-direction: column;
  gap: 0.2rem;
}
.dts-widget__plugins a {
  color: #292f2f;
  text-decoration: none;
  border-bottom: 1px dotted #d4d8d8;
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
import { pluginLinks, SyncClient } from 'token-sync';

const SYNC_SERVER_URL = 'ws://localhost:8080';

type DemoSyncStatus = 'connecting' | 'ready' | 'syncing' | 'disconnected' | 'error';

let syncClient: SyncClient<TokenSyncPayload> | null = null;
let sessionToken: string | null = null;

const syncStatus = document.getElementById('sync-status') as HTMLDivElement;
const tokenEl = document.getElementById('sync-token') as HTMLButtonElement;
const unlinkBtn = document.getElementById('unlink-btn') as HTMLButtonElement;
const errorEl = document.getElementById('sync-error') as HTMLDivElement;
const helpWrap = document.getElementById('help-wrap') as HTMLDivElement;
const helpBtn = document.getElementById('help-btn') as HTMLButtonElement;
const pluginList = document.getElementById('plugin-list') as HTMLUListElement;

pluginList.innerHTML = pluginLinks
  .map((plugin) => `<li><a href="${plugin.url}">${plugin.name}</a></li>`)
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

function updateSyncStatus(status: DemoSyncStatus, token?: string, error?: string) {
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
      if (token) tokenEl.textContent = token;
      syncStatus.classList.add('dts-widget--waiting');
      tokenEl.disabled = false;
      unlinkBtn.style.display = 'none';
      errorEl.style.display = 'none';
      helpWrap.style.display = '';
      break;
    case 'syncing':
      syncStatus.classList.add('dts-widget--connected');
      if (token) tokenEl.textContent = token;
      tokenEl.disabled = false;
      unlinkBtn.style.display = '';
      errorEl.style.display = 'none';
      closeHelp();
      helpWrap.style.display = 'none';
      break;
    case 'disconnected':
      syncStatus.classList.add('dts-widget--waiting');
      tokenEl.textContent = 'Disconnected';
      tokenEl.disabled = true;
      errorEl.style.display = 'none';
      closeHelp();
      unlinkBtn.style.display = 'none';
      helpWrap.style.display = '';
      break;
    case 'error':
      syncStatus.classList.add('dts-widget--error');
      tokenEl.textContent = 'Error';
      tokenEl.disabled = true;
      unlinkBtn.style.display = 'none';
      closeHelp();
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
