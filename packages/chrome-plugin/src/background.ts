import { SourceSession, createCollection } from 'token-beam';
import type { TokenSyncPayload } from 'token-beam';

interface TabSession {
  session: SourceSession<TokenSyncPayload>;
  token: string | null;
  providerName: string;
  domain: string;
}

const sessions = new Map<number, TabSession>();

// Handle messages from content script and popup
chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  const tabId = msg.tabId ?? sender.tab?.id;

  if (msg.type === 'start-session' && tabId) {
    // Content script detected a provider — start a session in the background
    if (sessions.has(tabId)) {
      const existing = sessions.get(tabId)!;
      sendResponse({ token: existing.token });
      return true;
    }

    (async () => {
      const session = new SourceSession<TokenSyncPayload>({
        serverUrl: 'wss://tokenbeam.dev',
        clientType: 'web',
        origin: msg.providerName,
        icon: { type: 'unicode', value: '⊷' },
      });

      // Get the tab's domain
      let domain = '';
      try {
        const tab = await chrome.tabs.get(tabId);
        if (tab.url) domain = new URL(tab.url).hostname;
      } catch {}

      const tabSession: TabSession = {
        session,
        token: null,
        providerName: msg.providerName,
        domain,
      };
      sessions.set(tabId, tabSession);

      console.log('[token-beam] starting session for', msg.providerName, 'tab', tabId);

      session.on('connected', () => {
        console.log('[token-beam] WebSocket connected');
      });

      session.on('error', ({ message }) => {
        console.error('[token-beam] session error:', message);
      });

      session.on('disconnected', () => {
        console.log('[token-beam] disconnected');
      });

      session.on('paired', ({ sessionToken }) => {
        console.log('[token-beam] paired with token:', sessionToken);
        tabSession.token = sessionToken;
        // Notify content script and popup
        chrome.tabs
          .sendMessage(tabId, { type: 'session-paired', token: sessionToken })
          .catch(() => {});
        chrome.action.setBadgeText({ tabId, text: '⊷' });
        chrome.action.setBadgeBackgroundColor({ tabId, color: '#ff6347' });
      });

      session.on('peer-connected', () => {
        // Ask content script to extract and send tokens
        chrome.tabs.sendMessage(tabId, { type: 'extract-tokens' }).catch(() => {});
      });

      session.connect();
      sendResponse({ ok: true });
    })();
    return true;
  }

  if (msg.type === 'sync-tokens' && tabId) {
    const tabSession = sessions.get(tabId);
    if (tabSession?.session.hasPeers()) {
      const payload = createCollection(msg.providerName, msg.tokens);
      tabSession.session.sync(payload);
    }
    sendResponse({ ok: true });
    return true;
  }

  if (msg.type === 'get-session' && tabId) {
    const tabSession = sessions.get(tabId);
    sendResponse(
      tabSession ? { token: tabSession.token, providerName: tabSession.providerName } : null,
    );
    return true;
  }

  if (msg.type === 'stop-session' && tabId) {
    const tabSession = sessions.get(tabId);
    if (tabSession) {
      tabSession.session.disconnect();
      sessions.delete(tabId);
      chrome.action.setBadgeText({ tabId, text: '' });
    }
    sendResponse({ ok: true });
    return true;
  }

  return true;
});

// When tab navigates, keep session alive if same provider domain
chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
  if (changeInfo.status !== 'complete' || !tab.url) return;
  const tabSession = sessions.get(tabId);
  if (!tabSession) return;

  // Check if still on a supported domain
  try {
    const hostname = new URL(tab.url).hostname;
    if (hostname === tabSession.domain || hostname.endsWith('.' + tabSession.domain)) {
      // Same domain — ask the new content script to extract tokens
      // Retry a few times as the content script may not be ready yet
      const tryExtract = (attempts: number) => {
        chrome.tabs.sendMessage(tabId, { type: 'extract-tokens' }).catch(() => {
          if (attempts > 0) setTimeout(() => tryExtract(attempts - 1), 500);
        });
      };
      setTimeout(() => tryExtract(3), 500);
      return;
    }
  } catch {}

  // Different domain — disconnect
  tabSession.session.disconnect();
  sessions.delete(tabId);
  chrome.action.setBadgeText({ tabId, text: '' });
});

// Clean up when tab closes
chrome.tabs.onRemoved.addListener((tabId) => {
  const tabSession = sessions.get(tabId);
  if (tabSession) {
    tabSession.session.disconnect();
    sessions.delete(tabId);
  }
});
