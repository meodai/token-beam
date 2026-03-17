import type { SiteProvider } from '../types';

export const colorhunt: SiteProvider = {
  domain: 'colorhunt.co',
  path: '/palette/',
  name: 'Color Hunt',
  capabilities: ['send'],
  extractors: [
    {
      name: 'palette',
      type: 'color',
      extract: () => {
        // Color Hunt stores hex in span text inside .c0-.c3 elements
        const colors: Array<{ name: string; value: string }> = [];
        for (let i = 0; i < 4; i++) {
          const el = document.querySelector(`.c${i} span`);
          const hex = el?.textContent?.trim();
          if (hex && /^#?[0-9a-fA-F]{6}$/.test(hex)) {
            colors.push({ name: String(i), value: hex.startsWith('#') ? hex : `#${hex}` });
          }
        }
        return colors;
      },
      observe: (onChange) => {
        let lastUrl = window.location.href;
        const interval = setInterval(() => {
          if (window.location.href !== lastUrl) {
            lastUrl = window.location.href;
            setTimeout(onChange, 500);
          }
        }, 300);
        return () => clearInterval(interval);
      },
    },
  ],
};
