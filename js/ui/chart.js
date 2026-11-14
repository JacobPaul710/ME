// Simple line chart: points [{date, value}] oldest first.
import { short } from '../logic/dates.js';
import { fmt } from './dom.js';

const NS = 'http://www.w3.org/2000/svg';
const el = (tag, attrs, text) => {
  const e = document.createElementNS(NS, tag);
  for (const [k, v] of Object.entries(attrs)) e.setAttribute(k, v);
  if (text != null) e.textContent = text;
  return e;
};

export function lineChart(points, { unit = '', label = 'Chart' } = {}) {
  const W = 340, H = 180, L = 44, R = 12, T = 12, B = 28;
  const s = el('svg', { viewBox: `0 0 ${W} ${H}`, class: 'chart', role: 'img', 'aria-label': label });
  if (points.length < 2) {
    s.append(el('text', { x: W / 2, y: H / 2, 'text-anchor': 'middle', class: 'chart-note' }, 'Log at least two days to see a chart'));
    return s;
  }
  const t0 = Date.parse(points[0].date), t1 = Date.parse(points[points.length - 1].date);
  let lo = Math.min(...points.map((p) => p.value)), hi = Math.max(...points.map((p) => p.value));
  if (lo === hi) { lo -= 1; hi += 1; }
  const pad = (hi - lo) * 0.1; lo -= pad; hi += pad;
  const x = (d) => L + ((Date.parse(d) - t0) / (t1 - t0 || 1)) * (W - L - R);
  const y = (v) => T + (1 - (v - lo) / (hi - lo)) * (H - T - B);
  for (const v of [lo + pad, hi - pad]) {
    s.append(el('line', { x1: L, x2: W - R, y1: y(v), y2: y(v), class: 'chart-grid' }));
    s.append(el('text', { x: L - 6, y: y(v) + 4, 'text-anchor': 'end', class: 'chart-label' }, `${fmt(v, 1)}${unit}`));
  }
  s.append(el('polyline', { points: points.map((p) => `${x(p.date)},${y(p.value)}`).join(' '), class: 'chart-line' }));
  for (const p of points) s.append(el('circle', { cx: x(p.date), cy: y(p.value), r: 3.5, class: 'chart-dot' }));
  s.append(el('text', { x: L, y: H - 8, class: 'chart-label' }, short(points[0].date)));
  s.append(el('text', { x: W - R, y: H - 8, 'text-anchor': 'end', class: 'chart-label' }, short(points[points.length - 1].date)));
  return s;
}
