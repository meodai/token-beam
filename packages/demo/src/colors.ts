export function generateRandomRamp(): { name: string; colors: Record<string, string> } {
  const hue = Math.floor(Math.random() * 360);
  const steps = [100, 200, 300, 400, 500, 600, 700, 800, 900];
  const colors: Record<string, string> = {};

  for (const step of steps) {
    const lightness = 95 - (step / 900) * 85;
    const saturation = 70 + Math.sin((step / 900) * Math.PI) * 25;
    const hex = hslToHex(hue, saturation, lightness);
    colors[String(step)] = hex;
  }

  return { name: 'token-sync-demo', colors };
}

function hslToHex(h: number, s: number, l: number): string {
  s /= 100;
  l /= 100;
  const a = s * Math.min(l, 1 - l);
  const f = (n: number) => {
    const k = (n + h / 30) % 12;
    const c = l - a * Math.max(Math.min(k - 3, 9 - k, 1), -1);
    return Math.round(255 * c)
      .toString(16)
      .padStart(2, '0');
  };
  return `#${f(0)}${f(8)}${f(4)}`;
}

function getHueName(hue: number): string {
  const names: [number, string][] = [
    [15, 'Red'],
    [45, 'Orange'],
    [65, 'Yellow'],
    [160, 'Green'],
    [200, 'Cyan'],
    [240, 'Blue'],
    [280, 'Purple'],
    [330, 'Pink'],
    [360, 'Red'],
  ];
  for (const [threshold, name] of names) {
    if (hue <= threshold) return name;
  }
  return 'Red';
}
