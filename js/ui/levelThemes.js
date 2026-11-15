// Backgrounds for the level card. Each one is drawn in code (no image files),
// so they work offline and in a store app.
import { svg } from './dom.js';

export const LEVEL_THEMES = [
  ['parchment', 'Parchment'],
  ['stone', 'Stone wall'],
  ['wood', 'Dark wood'],
];

const W = 560, H = 160;
let n = 0;

// Same stones every time (seeded), so the wall doesn't jump around between redraws.
function stones() {
  let seed = 7;
  const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
  const out = [];
  for (let y = 0; y < H;) {
    const h = [34, 38, 42][Math.floor(rnd() * 3)];
    for (let x = -Math.floor(rnd() * 40); x < W;) {
      const w = 54 + Math.floor(rnd() * 38);
      const g = 40 + Math.floor(rnd() * 18);
      out.push(`<rect x="${x + 2}" y="${y + 2}" width="${w - 4}" height="${h - 4}" rx="5" fill="rgb(${g},${g + 3},${g + 7})"/>`,
        `<rect x="${x + 3}" y="${y + 3}" width="${w - 6}" height="3" rx="1.5" fill="rgba(255,255,255,0.06)"/>`);
      x += w;
    }
    y += h;
  }
  return out.join('');
}

export function themeBackground(theme) {
  const id = `lt${++n}`;
  const open = `<svg class="level-bg" viewBox="0 0 ${W} ${H}" preserveAspectRatio="xMidYMid slice" aria-hidden="true">`;
  if (theme === 'stone') {
    return svg(`${open}<defs><filter id="${id}"><feTurbulence type="fractalNoise" baseFrequency="0.9" numOctaves="2" seed="3"/><feColorMatrix values="0 0 0 0 0  0 0 0 0 0  0 0 0 0 0  0 0 0 0.35 0"/></filter></defs><rect width="${W}" height="${H}" fill="#16181b"/>${stones()}<rect width="${W}" height="${H}" filter="url(#${id})"/></svg>`);
  }
  if (theme === 'wood') {
    return svg(`${open}<defs><filter id="${id}" x="0" y="0" width="100%" height="100%"><feTurbulence type="fractalNoise" baseFrequency="0.012 0.32" numOctaves="3" seed="11"/><feColorMatrix values="0 0 0 0 0.24  0 0 0 0 0.14  0 0 0 0 0.07  0 0 0 0.9 0"/></filter></defs><rect width="${W}" height="${H}" fill="#2b1a0e"/><rect width="${W}" height="${H}" filter="url(#${id})" opacity="0.9"/><line x1="0" y1="54" x2="${W}" y2="54" stroke="#170d06" stroke-width="2" opacity="0.7"/><line x1="0" y1="108" x2="${W}" y2="108" stroke="#170d06" stroke-width="2" opacity="0.7"/></svg>`);
  }
  return svg(`${open}<defs><filter id="${id}" x="0" y="0" width="100%" height="100%"><feTurbulence type="fractalNoise" baseFrequency="0.035" numOctaves="4" seed="5"/><feColorMatrix values="0 0 0 0 0.45  0 0 0 0 0.3  0 0 0 0 0.12  0 0 0 0.28 0"/></filter><radialGradient id="${id}v" cx="50%" cy="45%" r="75%"><stop offset="55%" stop-color="#000" stop-opacity="0"/><stop offset="100%" stop-color="#5a3812" stop-opacity="0.5"/></radialGradient></defs><rect width="${W}" height="${H}" fill="#ecdbb0"/><rect width="${W}" height="${H}" filter="url(#${id})"/><rect width="${W}" height="${H}" fill="url(#${id}v)"/></svg>`);
}
