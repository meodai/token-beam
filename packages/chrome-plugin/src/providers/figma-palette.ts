import type { SiteProvider } from '../types';

function rgbToHex(rgb: string): string {
  // Handle hex directly
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

export const figmaPalette: SiteProvider = {
  domain: 'www.figma.com',
  path: '/color-palette-generator/',
  name: 'Figma Palette Generator',
  capabilities: ['send'],
  extractors: [
    {
      name: 'palette',
      type: 'color',
      extract: () => {
        // Find the palette container — it's a flex row of colored divs
        // Look for elements that have a solid background-color and are siblings
        const allEls = document.querySelectorAll<HTMLElement>('[style*="background-color"]');
        const colors: Array<{ name: string; value: string }> = [];

        for (const el of allEls) {
          const bg = el.style.backgroundColor;
          if (!bg) continue;
          const hex = rgbToHex(bg);
          if (hex && hex !== '#000000' && hex !== '#ffffff') {
            colors.push({ name: String(colors.length), value: hex });
          }
        }

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
