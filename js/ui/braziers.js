// Two fire stands beside the level card, in the spirit of old-school MMO login
// screens (our own artwork). The colour cycle is driven from code, so it works
// on iPhone too, where CSS filters on SVG parts are ignored.
import { svg } from './dom.js';

let n = 0;
function stand(side) {
  const id = `bz${++n}`;
  return svg(`<svg class="brazier ${side}" viewBox="0 0 44 150" width="44" height="150" aria-hidden="true">
  <defs>
    <linearGradient id="${id}f" x1="0" y1="1" x2="0" y2="0">
      <stop offset="0%" data-l="62" stop-color="#ffd27a"/>
      <stop offset="45%" data-l="52" stop-color="#ff8a1e"/>
      <stop offset="100%" data-l="38" stop-color="#c2310f" stop-opacity="0.15"/>
    </linearGradient>
    <linearGradient id="${id}c" x1="0" y1="1" x2="0" y2="0">
      <stop offset="0%" data-l="94" stop-color="#fffbe8"/>
      <stop offset="100%" data-l="70" stop-color="#ffd25a" stop-opacity="0.2"/>
    </linearGradient>
    <radialGradient id="${id}g"><stop offset="0%" data-l="60" stop-color="#ff9a2e" stop-opacity="0.5"/><stop offset="100%" data-l="60" stop-color="#ff9a2e" stop-opacity="0"/></radialGradient>
    <linearGradient id="${id}s" x1="0" x2="1"><stop offset="0%" stop-color="#3b3f45"/><stop offset="45%" stop-color="#8e949b"/><stop offset="100%" stop-color="#2c2f34"/></linearGradient>
  </defs>
  <ellipse class="glow" cx="22" cy="44" rx="24" ry="30" fill="url(#${id}g)"/>
  <g class="fire">
    <polygon class="tongue t1" points="22,2 30,22 34,38 31,52 22,58 13,52 10,38 15,22" fill="url(#${id}f)"/>
    <polygon class="tongue t2" points="12,16 18,30 19,44 15,54 9,50 7,38 9,26" fill="url(#${id}f)"/>
    <polygon class="tongue t3" points="33,14 37,28 37,42 33,53 28,48 28,36 30,24" fill="url(#${id}f)"/>
    <polygon class="tongue core" points="22,22 27,36 27,48 22,56 17,48 17,36" fill="url(#${id}c)"/>
  </g>
  <polygon points="4,56 40,56 34,70 10,70" fill="url(#${id}s)" stroke="#16181b" stroke-width="1.2"/>
  <rect x="2" y="53" width="40" height="5" fill="#6d737a" stroke="#16181b" stroke-width="1"/>
  <rect x="17" y="70" width="10" height="64" fill="url(#${id}s)" stroke="#16181b" stroke-width="1"/>
  <rect x="14" y="88" width="16" height="4" fill="#5b6066" stroke="#16181b" stroke-width="0.8"/>
  <rect x="14" y="110" width="16" height="4" fill="#5b6066" stroke="#16181b" stroke-width="0.8"/>
  <polygon points="8,148 17,134 27,134 36,148" fill="#4a4e54" stroke="#16181b" stroke-width="1"/>
</svg>`);
}

export const braziers = () => [stand('left'), stand('right')];

// Slow colour cycle: every flame shifts hue together, the right one half a cycle behind.
const CYCLE_MS = 12000;
let running = false;
export function startFlames() {
  if (running) return;
  running = true;
  if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
  let last = 0;
  const tick = (t) => {
    if (t - last > 80) { // ~12 updates a second is smooth enough and cheap
      last = t;
      for (const el of document.querySelectorAll('.brazier')) {
        const offset = el.classList.contains('right') ? 0.5 : 0;
        const hue = Math.round((((t / CYCLE_MS) + offset) % 1) * 360 + 25) % 360;
        for (const stop of el.querySelectorAll('stop[data-l]')) {
          stop.setAttribute('stop-color', `hsl(${hue}, 100%, ${stop.dataset.l}%)`);
        }
      }
    }
    requestAnimationFrame(tick);
  };
  requestAnimationFrame(tick);
}
