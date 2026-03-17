import type { SiteProvider } from '../types';

export const adobeColor: SiteProvider = {
  domain: 'color.adobe.com',
  name: 'Adobe Color',
  capabilities: ['send'],
  extractors: [
    {
      name: 'theme',
      type: 'color',
      extract: () => {
        // Adobe Color uses swatches with background colors
        const swatches = document.querySelectorAll<HTMLElement>(
          '[class*="swatch"], [class*="ColorSwatch"]',
        );
        return Array.from(swatches).map((el, i) => ({
          name: String(i),
          value: rgbToHex(getComputedStyle(el).backgroundColor),
        }));
      },
      observe: (onChange) => {
        const observer = new MutationObserver(onChange);
        observer.observe(document.body, {
          childList: true,
          subtree: true,
          attributes: true,
          attributeFilter: ['style'],
        });
        return () => observer.disconnect();
      },
    },
  ],
};

function rgbToHex(rgb: string): string {
  const match = rgb.match(/(\d+)/g);
  if (!match || match.length < 3) return '#000000';
  return (
    '#' +
    match
      .slice(0, 3)
      .map((n) => parseInt(n).toString(16).padStart(2, '0'))
      .join('')
  );
}
