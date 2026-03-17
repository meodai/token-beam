import type { SiteProvider } from '../types';

export const realtimeColors: SiteProvider = {
  domain: 'www.realtimecolors.com',
  name: 'Realtime Colors',
  capabilities: ['send'],
  extractors: [
    {
      name: 'theme',
      type: 'color',
      extract: () => {
        // Realtime Colors stores palette in CSS custom properties on :root
        const style = getComputedStyle(document.documentElement);
        const names = ['--text', '--background', '--primary', '--secondary', '--accent'];
        return names
          .map((name) => {
            const value = style.getPropertyValue(name).trim();
            return value ? { name: name.replace('--', ''), value } : null;
          })
          .filter(Boolean) as Array<{ name: string; value: string }>;
      },
      observe: (onChange) => {
        const observer = new MutationObserver(onChange);
        observer.observe(document.documentElement, {
          attributes: true,
          attributeFilter: ['style'],
        });
        return () => observer.disconnect();
      },
    },
  ],
};
