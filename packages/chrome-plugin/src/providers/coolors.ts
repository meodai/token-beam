import type { SiteProvider } from '../types';

export const coolors: SiteProvider = {
  domain: 'coolors.co',
  name: 'Coolors',
  capabilities: ['send'],
  extractors: [
    {
      name: 'palette',
      type: 'color',
      extract: () => {
        // Coolors stores the palette as hex values in the URL path
        const path = window.location.pathname.replace(/^\//, '');
        // Skip non-palette pages like /palettes, /generate, etc.
        if (!path || path.includes('/') || path.length < 6) return [];
        const hexes = path.split('-');
        // Validate they look like hex colors
        if (!hexes.every((h) => /^[0-9a-fA-F]{6}$/.test(h))) return [];
        return hexes.map((hex, i) => ({
          name: String(i),
          value: `#${hex}`,
        }));
      },
      observe: (onChange) => {
        let lastUrl = window.location.href;
        const interval = setInterval(() => {
          if (window.location.href !== lastUrl) {
            lastUrl = window.location.href;
            onChange();
          }
        }, 500);
        return () => clearInterval(interval);
      },
    },
  ],
};
