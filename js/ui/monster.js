// Monsters: 9 designs, each with 6 forms that unlock with combat level (3, 25, 50, 80, 110, 126).
// Later forms are built from the first design: they grow, then gain spikes, horns, heavier
// armour, wings, and finally a crown and aura at 126.
import { svg } from './dom.js';
import { MONSTERS } from './monster-data.js';

export { MONSTERS };
export const FORMS = [
  { level: 3, name: 'Hatchling', size: 104 },
  { level: 25, name: 'Fledgling', size: 124 },
  { level: 50, name: 'Brute', size: 144 },
  { level: 80, name: 'Warlord', size: 160 },
  { level: 110, name: 'Tyrant', size: 176 },
  { level: 126, name: 'Ascended', size: 192 },
];
export const formIndex = (combat) => FORMS.reduce((a, f, i) => (combat >= f.level ? i : a), 0);
export const monsterById = (id) => MONSTERS.find((m) => m.id === id) || MONSTERS[0];

const K = '#1d140c';
const shade = (hex, k) => {
  const n = parseInt(hex.slice(1), 16);
  const f = (v) => Math.max(0, Math.min(255, Math.round(k < 0 ? v * (1 + k) : v + (255 - v) * k)));
  return '#' + [n >> 16, (n >> 8) & 255, n & 255].map((v) => f(v).toString(16).padStart(2, '0')).join('');
};

// Build the pixel map for a form on a 24x24 canvas (the 16x16 design sits bottom-centre).
export function formPixels(m, fi) {
  const W = 24, OX = 4, OY = 8;
  const px = new Map(); // "x,y" -> colour
  const pal = { ...m.pal, k: K };
  m.grid.forEach((row, y) => [...row].forEach((c, x) => { if (c !== '.' && pal[c]) px.set(`${x + OX},${y + OY}`, pal[c]); }));
  const filled = () => [...px.keys()].map((k) => k.split(',').map(Number));
  const at = (x, y) => px.get(`${x},${y}`);
  const set = (x, y, c, over = false) => { if (x >= 0 && y >= 0 && x < W && y < W && (over || !at(x, y))) px.set(`${x},${y}`, c); };
  const pts = filled();
  const xs = pts.map((p) => p[0]), ys = pts.map((p) => p[1]);
  const minX = Math.min(...xs), maxX = Math.max(...xs), minY = Math.min(...ys), maxY = Math.max(...ys);
  const top = (x) => { for (let y = 0; y < W; y++) if (at(x, y)) return y; return null; };
  const main = m.pal.a, dark = shade(m.pal.a, -0.45), bone = '#e8e0cc', gold = '#f2c037';

  // Form 4+: heavier armour (a thicker outline all round)
  if (fi >= 3) for (const [x, y] of filled()) for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) if (y + dy <= maxY) set(x + dx, y + dy, K);
  // Form 5+: wings behind, out to the sides
  if (fi >= 4) {
    const cy = Math.round((minY + maxY) / 2) - 1;
    for (let i = 0; i < 4; i++) for (let j = 0; j <= 3 - i; j++) {
      set(minX - 1 - i, cy - j + i, j === 3 - i ? K : dark);
      set(maxX + 1 + i, cy - j + i, j === 3 - i ? K : dark);
    }
  }
  // Form 2+: a row of spikes along the back
  if (fi >= 1) for (let x = minX + 2; x <= maxX - 2; x += 2) {
    const t = top(x); if (t == null) continue;
    set(x, t - 1, fi >= 5 ? gold : dark);
    if (fi >= 2) set(x, t - 2, fi >= 5 ? gold : K);
  }
  // Form 3+: horns at both top corners
  if (fi >= 2) {
    const lx = minX + 2, rx = maxX - 2, lt = top(lx) ?? minY, rt = top(rx) ?? minY;
    for (let i = 1; i <= (fi >= 4 ? 4 : 3); i++) {
      set(lx - i + 1, lt - i, bone, true); set(rx + i - 1, rt - i, bone, true);
      set(lx - i, lt - i, K); set(rx + i, rt - i, K); // outline so the horns read on light backgrounds
    }
  }
  // Form 6: crown
  if (fi >= 5) {
    const cx = Math.round((minX + maxX) / 2), t = Math.min(...[cx - 2, cx, cx + 2].map((x) => top(x) ?? minY)) - 3;
    for (let x = cx - 3; x <= cx + 3; x++) set(x, t, gold, true);
    for (const x of [cx - 3, cx, cx + 3]) set(x, t - 1, gold, true);
    set(cx, t - 2, '#e3364d', true);
  }
  return { px, W };
}

export function monsterSvg(m, fi) {
  const { px, W } = formPixels(m, fi);
  let rects = '';
  for (const [k, c] of px) { const [x, y] = k.split(','); rects += `<rect x="${x}" y="${y}" width="1.02" height="1.02" fill="${c}"/>`; }
  const size = FORMS[fi].size;
  return svg(`<svg class="sprite monster-sprite form-${fi}" viewBox="0 0 ${W} ${W}" width="${size}" height="${size}" shape-rendering="crispEdges" aria-hidden="true" style="--glow:${m.pal.a}">
    <ellipse cx="12" cy="23.6" rx="7" ry="0.7" fill="rgba(0,0,0,0.25)"/><g class="p-all">${rects}</g></svg>`);
}
