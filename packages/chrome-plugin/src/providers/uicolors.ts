import type { SiteProvider } from '../types';

function rgbToHex(rgb: string): string {
  if (rgb.startsWith('#')) return rgb;
  const match = rgb.match(/(\d+)/g);
  if (!match || match.length < 3) return '';
  return (
    '#' +
    match
      .slice(0, 3)
      .map((n) => parseInt(n).toString(16).padStart(2, '0'))
      .join('')
  );
}

export const uicolors: SiteProvider = {
  domain: 'uicolors.app',
  name: 'UI Colors',
  capabilities: ['send'],
  extractors: [
    {
      name: 'palette',
      type: 'color',
      extract: () => {
        const containers = document.querySelectorAll('.color-family-outline');
        const colors: Array<{ name: string; value: string }> = [];

        containers.forEach((container, groupIdx) => {
          const swatches = container.querySelectorAll<HTMLElement>('[style*="background"]');
          swatches.forEach((el, i) => {
            const bg = el.style.backgroundColor || getComputedStyle(el).backgroundColor;
            if (!bg || bg === 'transparent') return;
            const hex = rgbToHex(bg);
            if (hex) {
              colors.push({ name: `${groupIdx}-${i}`, value: hex });
            }
          });
        });

        return colors;
      },
      observe: (onChange) => {
        const observer = new MutationObserver(onChange);
        observer.observe(document.body, {
          subtree: true,
          attributes: true,
          attributeFilter: ['style'],
        });
        return () => observer.disconnect();
      },
    },
  ],
};
