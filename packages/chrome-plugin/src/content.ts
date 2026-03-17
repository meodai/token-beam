import { matchProvider, supportedSites } from './providers';
import { detectNativeProvider } from './providers/native';
import type { SiteProvider } from './types';

let cleanupObservers: (() => void)[] = [];
let nativeToken: string | null = null;

function extractTokens(provider: SiteProvider): Record<string, string | number | boolean> {
  const tokens: Record<string, string | number | boolean> = {};
  if (!provider.extractors) return tokens;

  for (const extractor of provider.extractors) {
    const values = extractor.extract();
    for (const { name, value } of values) {
      tokens[`${extractor.name}/${name}`] = value;
    }
  }
  return tokens;
}

function sendTokens(provider: SiteProvider) {
  const tokens = extractTokens(provider);
  chrome.runtime
    .sendMessage({
      type: 'sync-tokens',
      providerName: provider.name,
      tokens,
    })
    .catch(() => {});
}

// Check for native Token Beam integration first
const native = detectNativeProvider();
if (native) {
  nativeToken = (native as SiteProvider & { nativeToken: string }).nativeToken;
  // Listen for token updates from the page
  window.addEventListener('token-beam:paired', ((e: CustomEvent) => {
    nativeToken = e.detail?.sessionToken ?? null;
  }) as EventListener);
}

// Fall back to provider-based scraping
const provider = !native ? matchProvider(window.location.href) : null;
if (provider) {
  // Start or reuse session in background
  chrome.runtime
    .sendMessage({
      type: 'start-session',
      providerName: provider.name,
    })
    .then((response) => {
      // If session already existed with a token, send tokens immediately
      if (response?.token) {
        sendTokens(provider);
      }
    })
    .catch(() => {});

  if (provider.extractors) {
    for (const extractor of provider.extractors) {
      const cleanup = extractor.observe(() => sendTokens(provider));
      cleanupObservers.push(cleanup);
    }
  }

  // Also send tokens after a short delay to catch initial render
  setTimeout(() => sendTokens(provider), 1000);
}

// Clean up observers when page is left (session stays alive in background)
window.addEventListener('beforeunload', () => {
  cleanupObservers.forEach((fn) => fn());
  cleanupObservers = [];
});

// Listen for messages from popup
chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
  if (msg.type === 'get-provider') {
    // Native Token Beam page
    if (native && nativeToken) {
      sendResponse({
        name: native.name,
        capabilities: native.capabilities,
        domain: native.domain,
        nativeToken,
      });
      return true;
    }
    // Provider-based scraping
    const p = matchProvider(window.location.href);
    sendResponse(
      p
        ? { name: p.name, capabilities: p.capabilities, domain: p.domain }
        : { unsupported: true, supportedSites },
    );
  }

  if (msg.type === 'extract-tokens') {
    const p = provider || matchProvider(window.location.href);
    if (p) {
      sendTokens(p);
      sendResponse({ ok: true });
    } else {
      sendResponse({ ok: false });
    }
  }

  return true;
});
