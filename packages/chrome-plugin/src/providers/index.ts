import type { SiteProvider } from '../types';
import { coolors } from './coolors';
import { adobeColor } from './adobe-color';
import { realtimeColors } from './realtime-colors';
import { uicolors } from './uicolors';
import { lospec } from './lospec';
import { colorhunt } from './colorhunt';

export const providers: SiteProvider[] = [
  coolors,
  adobeColor,
  realtimeColors,
  uicolors,
  lospec,
  colorhunt,
];

/** List of supported site names for display */
export const supportedSites = providers.map((p) => p.name);

/** Find a matching provider for the current page */
export function matchProvider(url: string): SiteProvider | undefined {
  const { hostname, pathname } = new URL(url);
  return providers.find(
    (p) =>
      (hostname === p.domain || hostname.endsWith('.' + p.domain)) &&
      (!p.path || pathname.startsWith(p.path)),
  );
}
