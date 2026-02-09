import type { FigmaSyncPayload, FigmaColorValue } from 'figma-sync';

const API_PATH = '/api/colors';

async function init() {
  const res = await fetch(API_PATH);
  const payload: FigmaSyncPayload = await res.json();
  render(payload);
}

function figmaColorToCSS(c: FigmaColorValue): string {
  return `rgba(${Math.round(c.r * 255)}, ${Math.round(c.g * 255)}, ${Math.round(c.b * 255)}, ${c.a})`;
}

function render(payload: FigmaSyncPayload) {
  const app = document.getElementById('app')!;
  const fullUrl = `${window.location.origin}${API_PATH}`;
  const firstMode = payload.modes[0];

  app.innerHTML = `
    <h1>${payload.collectionName}</h1>
    <div class="url-bar">
      <label>Paste into Figma plugin:</label>
      <div class="url-row">
        <code id="url-code">${fullUrl}</code>
        <button id="copy-btn">Copy</button>
      </div>
    </div>
    <div class="swatches" id="swatches"></div>
    <button id="regen-btn">Regenerate</button>
  `;

  const swatches = document.getElementById('swatches')!;
  for (const v of firstMode.variables) {
    const el = document.createElement('div');
    el.className = 'swatch';
    if (v.type === 'COLOR') {
      el.style.backgroundColor = figmaColorToCSS(v.value as FigmaColorValue);
    }
    el.innerHTML = `<span class="label">${v.name}</span>`;
    swatches.appendChild(el);
  }

  document.getElementById('copy-btn')!.addEventListener('click', () => {
    navigator.clipboard.writeText(fullUrl);
    const btn = document.getElementById('copy-btn')!;
    btn.textContent = 'Copied!';
    setTimeout(() => (btn.textContent = 'Copy'), 1500);
  });

  document.getElementById('regen-btn')!.addEventListener('click', () => init());
}

init();
