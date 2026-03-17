import type { SiteProvider } from '../types';

export const lospec: SiteProvider = {
  domain: 'lospec.com',
  path: '/palette-list/',
  name: 'Lospec',
  capabilities: ['send'],
  extractors: [
    {
      name: 'palette',
      type: 'color',
      extract: () => {
        const swatches = document.querySelectorAll<HTMLElement>('.palette > .color');
        return Array.from(swatches)
          .map((el, i) => ({
            name: String(i),
            value: el.textContent?.trim() || '',
          }))
          .filter((t) => /^#[0-9a-fA-F]{6}$/.test(t.value));
      },
      observe: (onChange) => {
        let lastUrl = window.location.href;
        let lastColorCount = document.querySelectorAll('.palette > .color').length;

        // Poll for URL changes and palette content changes
        const interval = setInterval(() => {
          const currentUrl = window.location.href;
          const currentCount = document.querySelectorAll('.palette > .color').length;

          if (currentUrl !== lastUrl || currentCount !== lastColorCount) {
            lastUrl = currentUrl;
            lastColorCount = currentCount;
            onChange();
          }
        }, 300);

        return () => clearInterval(interval);
      },
    },
  ],
};
