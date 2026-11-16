// Two burning braziers for the top of Today, inspired by old-school MMO login screens.
// Drawn in code (our own artwork). The flames flicker and slowly cycle colour.
import { svg } from './dom.js';

let n = 0;
function brazier(side) {
  const id = `bz${++n}`;
  return svg(`<svg class="brazier ${side}" viewBox="0 0 60 110" width="54" height="99" aria-hidden="true">
  <defs>
    <radialGradient id="${id}o" cx="50%" cy="80%" r="70%"><stop offset="0%" stop-color="#ffe9a6"/><stop offset="45%" stop-color="#ff9a2e"/><stop offset="100%" stop-color="#d1361a" stop-opacity="0"/></radialGradient>
    <radialGradient id="${id}i" cx="50%" cy="85%" r="60%"><stop offset="0%" stop-color="#fffbe6"/><stop offset="60%" stop-color="#ffd25a"/><stop offset="100%" stop-color="#ff8a1e" stop-opacity="0"/></radialGradient>
    <radialGradient id="${id}g" cx="50%" cy="50%" r="50%"><stop offset="0%" stop-color="#ff9a2e" stop-opacity="0.55"/><stop offset="100%" stop-color="#ff9a2e" stop-opacity="0"/></radialGradient>
    <linearGradient id="${id}m" x1="0" x2="0" y1="0" y2="1"><stop offset="0%" stop-color="#8a8f96"/><stop offset="100%" stop-color="#3a3d42"/></linearGradient>
  </defs>
  <g class="fire">
    <ellipse class="glow" cx="30" cy="40" rx="30" ry="34" fill="url(#${id}g)"/>
    <path class="flame f1" d="M30 4 C 38 18, 48 26, 44 42 C 42 52, 36 58, 30 58 C 24 58, 16 52, 15 42 C 13 30, 24 22, 30 4 Z" fill="url(#${id}o)"/>
    <path class="flame f2" d="M22 14 C 26 24, 30 30, 28 42 C 27 50, 23 56, 19 54 C 15 50, 15 42, 17 34 C 19 26, 22 22, 22 14 Z" fill="url(#${id}o)" opacity="0.8"/>
    <path class="flame f3" d="M39 16 C 43 26, 46 34, 43 44 C 41 51, 37 55, 34 53 C 31 49, 32 40, 34 33 C 36 27, 39 22, 39 16 Z" fill="url(#${id}o)" opacity="0.8"/>
    <path class="flame core" d="M30 26 C 34 34, 38 40, 36 48 C 35 53, 33 56, 30 56 C 27 56, 24 53, 24 48 C 23 41, 27 34, 30 26 Z" fill="url(#${id}i)"/>
  </g>
  <path d="M8 56 H52 L46 70 H14 Z" fill="url(#${id}m)" stroke="#1e2023" stroke-width="1.5"/>
  <rect x="6" y="53" width="48" height="5" rx="2" fill="#6b7077" stroke="#1e2023" stroke-width="1.2"/>
  <rect x="26" y="70" width="8" height="30" fill="url(#${id}m)" stroke="#1e2023" stroke-width="1.2"/>
  <path d="M14 106 L26 96 H34 L46 106 Z" fill="#4a4e54" stroke="#1e2023" stroke-width="1.2"/>
  <circle cx="20" cy="63" r="1.6" fill="#1e2023"/><circle cx="30" cy="63" r="1.6" fill="#1e2023"/><circle cx="40" cy="63" r="1.6" fill="#1e2023"/>
</svg>`);
}

export const braziers = () => [brazier('left'), brazier('right')];
