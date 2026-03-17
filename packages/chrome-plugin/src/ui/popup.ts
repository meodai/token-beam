const content = document.getElementById('content')!;

async function init() {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (!tab?.id || !tab.url) {
    showUnsupported();
    return;
  }

  // Check if content script is loaded, inject if not
  let provider: any = null;
  try {
    provider = await sendToTab(tab.id, { type: 'get-provider' });
  } catch {
    try {
      await chrome.scripting.executeScript({
        target: { tabId: tab.id },
        files: ['content.js'],
      });
      await new Promise((r) => setTimeout(r, 500));
      provider = await sendToTab(tab.id, { type: 'get-provider' });
    } catch {}
  }

  if (!provider || provider.unsupported) {
    showUnsupported(provider?.supportedSites);
    return;
  }

  // Native Token Beam page — just show the existing token
  if (provider.nativeToken) {
    showProvider(provider, tab.id, provider.nativeToken);
    return;
  }

  // Provider-based — get session from background
  const session = await sendToBackground({ type: 'get-session', tabId: tab.id });
  showProvider(provider, tab.id, session?.token);
}

function sendToTab(tabId: number, msg: unknown): Promise<any> {
  return new Promise((resolve, reject) => {
    chrome.tabs.sendMessage(tabId, msg, (r) => {
      if (chrome.runtime.lastError) reject(chrome.runtime.lastError);
      else resolve(r);
    });
  });
}

function sendToBackground(msg: unknown): Promise<any> {
  return new Promise((resolve) => {
    chrome.runtime.sendMessage(msg, resolve);
  });
}

function showUnsupported(sites?: string[]) {
  const siteList = sites?.length
    ? '<div style="margin-top:6px;text-align:left;color:var(--text)">' +
      sites.map((s) => `<div style="font-size:9px;padding:1px 0">· ${s}</div>`).join('') +
      '</div>'
    : '';
  content.innerHTML =
    '<div class="header"><span class="header__logo">⊷ Token Beam</span></div>' +
    '<div class="unsupported">This site is not supported yet.' +
    siteList +
    '<div style="margin-top:6px"><a href="https://github.com/meodai/token-beam/issues/new" target="_blank">Request support</a></div></div>';
}

function showProvider(
  provider: { name: string; capabilities: string[] },
  tabId: number,
  token?: string,
) {
  const arrows = provider.capabilities.map((c) => (c === 'send' ? '↑' : '↓')).join('');

  content.innerHTML = `
    <div class="header">
      <span class="header__logo">⊷ Token Beam</span>
      <span class="header__provider">${provider.name} <span class="header__arrows">${arrows}</span></span>
    </div>
    <div class="token-row" id="token-display">
      <span class="token" id="token-text">${token || 'Connecting...'}</span>
    </div>
    <button class="btn btn--stop" id="disconnect-btn">Disconnect</button>
  `;

  const tokenText = document.getElementById('token-text')!;
  const disconnectBtn = document.getElementById('disconnect-btn')!;

  // Poll for token if not available yet
  if (!token) {
    const poll = setInterval(async () => {
      const session = await sendToBackground({ type: 'get-session', tabId });
      if (session?.token) {
        tokenText.textContent = session.token;
        token = session.token;
        clearInterval(poll);
      }
    }, 500);
  }

  // Copy token on click
  tokenText.addEventListener('click', () => {
    if (token) {
      navigator.clipboard.writeText(token);
      tokenText.textContent = 'Copied!';
      setTimeout(() => {
        tokenText.textContent = token!;
      }, 1000);
    }
  });

  disconnectBtn.addEventListener('click', async () => {
    await sendToBackground({ type: 'stop-session', tabId });
    token = undefined;
    content.innerHTML = `
      <div class="header">
        <span class="header__logo">⊷ Token Beam</span>
        <span class="header__provider">${provider.name} <span class="header__arrows">${arrows}</span></span>
      </div>
      <button class="btn" id="reconnect-btn">Connect</button>
    `;
    document.getElementById('reconnect-btn')!.addEventListener('click', async () => {
      await sendToBackground({ type: 'start-session', tabId, providerName: provider.name });
      // Re-inject content script to re-start observers
      try {
        await chrome.scripting.executeScript({ target: { tabId }, files: ['content.js'] });
      } catch {}
      showProvider(provider, tabId);
    });
  });
}

init();
