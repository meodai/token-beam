# Token Sync (lib)

Core types and sync client for building design-token workflows.

## Widget Example

Use this as a compact, embeddable pairing widget. Clicking the token field copies the session token.

```html
<div class="dts-widget dts-widget--waiting" data-dts="widget">
  <div class="dts-widget__row">
    <div class="dts-widget__label">Token Sync</div>
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
      title="Disconnect"
      data-dts="unlink"
    >
      <span class="dts-widget__unlink-icon dts-widget__unlink-icon--linked" aria-hidden="true">
        <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="square" stroke-linejoin="miter">
          <path d="M10 13a5 5 0 0 1 0-7l2-2a5 5 0 0 1 7 7l-2 2" />
          <path d="M14 11a5 5 0 0 1 0 7l-2 2a5 5 0 0 1-7-7l2-2" />
        </svg>
      </span>
      <span class="dts-widget__unlink-icon dts-widget__unlink-icon--broken" aria-hidden="true">
        <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="square" stroke-linejoin="miter">
          <path d="M8 8l2-2a5 5 0 0 1 7 7l-2 2" />
          <path d="M16 16l-2 2a5 5 0 0 1-7-7l2-2" />
          <path d="M7 17l-2 2" />
          <path d="M17 7l2-2" />
        </svg>
      </span>
      <span class="dts-widget__unlink-label">Unlink</span>
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
  gap: 0;
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
  height: 32px;
}
.dts-widget__token-wrap {
  position: relative;
  flex: 1;
  display: flex;
  align-items: center;
}
.dts-widget__token-wrap .dts-widget__token {
  width: 100%;
  padding-right: 3.6rem;
}
.dts-widget__unlink {
  display: inline-flex;
  align-items: center;
  gap: 0.3rem;
  background: none;
  border: 2px solid #292f2f;
  border-left: 0;
  padding: 0.3rem 0.5rem;
  font-size: 0.6rem;
  text-transform: uppercase;
  letter-spacing: 0.08em;
  cursor: pointer;
  height: 32px;
}
.dts-widget__unlink-icon {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 14px;
  height: 14px;
}
.dts-widget__unlink-icon--broken {
  display: none;
}
.dts-widget__unlink-label {
  max-width: 0;
  opacity: 0;
  overflow: hidden;
  white-space: nowrap;
  transition: all 0.2s ease;
}
.dts-widget__unlink:hover .dts-widget__unlink-icon--linked {
  display: none;
}
.dts-widget__unlink:hover .dts-widget__unlink-icon--broken {
  display: inline-flex;
}
.dts-widget__unlink:hover .dts-widget__unlink-label {
  max-width: 60px;
  opacity: 1;
}
.dts-widget__help {
  position: relative;
  display: inline-flex;
  align-items: center;
}
.dts-widget__help-btn {
  width: 20px;
  height: 32px;
  padding: 0;
  border: 2px solid #292f2f;
  border-left: 0;
  background: #292f2f;
  color: #fff;
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
.dts-widget__status {
  position: absolute;
  right: 0.35rem;
  top: 50%;
  transform: translateY(-50%) translateX(6px);
  padding: 0.1rem 0.35rem;
  font-size: 0.55rem;
  text-transform: uppercase;
  letter-spacing: 0.08em;
  color: #717979;
  opacity: 0;
  pointer-events: none;
  transition: all 0.2s ease;
  border: 1px solid #d4d8d8;
  background: #fff;
}
.dts-widget__status.is-visible {
  opacity: 1;
  transform: translateY(-50%) translateX(0);
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

const syncStatus = document.querySelector('[data-dts="widget"]') as HTMLDivElement;
const tokenEl = syncStatus.querySelector('[data-dts="token"]') as HTMLButtonElement;
const unlinkBtn = syncStatus.querySelector('[data-dts="unlink"]') as HTMLButtonElement;
const errorEl = syncStatus.querySelector('[data-dts="error"]') as HTMLDivElement;
const helpWrap = syncStatus.querySelector('[data-dts="help-wrap"]') as HTMLDivElement;
const helpBtn = syncStatus.querySelector('[data-dts="help-btn"]') as HTMLButtonElement;
const pluginList = syncStatus.querySelector('[data-dts="plugin-list"]') as HTMLUListElement;
const statusEl = syncStatus.querySelector('[data-dts="status"]') as HTMLSpanElement;

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
  if (sessionToken) {
    navigator.clipboard.writeText(sessionToken);
    statusEl.textContent = 'Copied';
    statusEl.classList.add('is-visible');
    window.setTimeout(() => {
      statusEl.classList.remove('is-visible');
      statusEl.textContent = '';
    }, 1500);
  }
});

unlinkBtn.addEventListener('click', () => {
  sessionToken = null;
  syncClient?.disconnect();
  syncClient = null;
  initSync();
});

initSync();
```
