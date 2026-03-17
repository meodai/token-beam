import type { SiteProvider } from '../types';

/** Detects pages that already have Token Beam integrated natively */
export function detectNativeProvider(): SiteProvider | null {
  const token = document.documentElement.getAttribute('data-token-beam');
  const origin =
    document.documentElement.getAttribute('data-token-beam-origin') || window.location.hostname;

  if (!token) return null;

  return {
    domain: window.location.hostname,
    name: origin,
    capabilities: ['send'],
    // No extractors needed — the page handles syncing itself
    // The extension just shows the token for easy copying
    nativeToken: token,
  } as SiteProvider & { nativeToken: string };
}
