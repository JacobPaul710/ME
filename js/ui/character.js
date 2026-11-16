// Character tab: a pixel-art adventurer in your current gear tier (tap him for one of
// 100 random animations), combat level, and the skills panel (tap a skill to flip it).
import { h, svg, fmt } from './dom.js';
import { card, header } from './components.js';
import * as data from '../data.js';
import { combatSheet } from './today.js';

// ---------- the sprite ----------
// Armour colours per gear tier: [main, shade, light]. No tier yet = cloth.
const TIER_COLORS = {
  none: ['#8a6a44', '#5e4630', '#a8875c'], bronze: ['#b0703a', '#7a4a22', '#d8995e'], iron: ['#7a8087', '#50555b', '#a3a9b0'],
  steel: ['#a9b3bd', '#737d87', '#d3dae1'], silver: ['#d3d8dd', '#979fa6', '#f4f6f8'], gold: ['#e0b23c', '#a37a1e', '#f7d77a'],
  platinum: ['#cde3ea', '#8cb0bb', '#eef8fb'], obsidian: ['#3c3150', '#211a2e', '#6a5a86'],
};

// Each part: [x, y, rows]. Letters are colours (see palette below); '.' is empty.
const PARTS = {
  legL: [5, 17, ['.kppk', '.kppk', '.kppk', '.kppk', '.kppk', '.kppk', '.kppk', '.kppk', 'kbbbk', 'kkkkk']],
  legR: [10, 17, ['kppk.', 'kppk.', 'kppk.', 'kppk.', 'kppk.', 'kppk.', 'kppk.', 'kppk.', 'kbbbk', 'kkkkk']],
  body: [6, 8, ['kkmmmmkk', 'kmllmmdk', 'kmlmmmdk', 'kmlmmmdk', 'kBBgBBBk', 'kmlmmmdk', 'kmmmmmdk', 'kmmmmddk', 'kkkkkkkk']],
  armL: [3, 9, ['kak', 'kak', 'kak', 'kak', 'kak', 'kak', 'ksk', 'kSk', 'kkk']],
  sword: [14, 0, ['..k..', '.kwk.', '.kwk.', '.kwk.', '.kwk.', '.kwk.', '.kwk.', '.kwk.', '.kwk.', '.kwk.', '.kwk.', '.kwk.', '.kwk.', 'kgggk', '..B..', '..B..', '..g..']],
  armR: [14, 9, ['kak', 'kak', 'kak', 'kak', 'kak', 'kak', 'ksk', 'kSk', 'kkk']],
  head: [6, 0, ['..kkkk..', '.khhhhk.', 'khhhhhhk', 'khssssSk', 'ksessesk', 'kssssssk', '.kssSSk.', '..kkkk..']],
};

function palette(tierId) {
  const [m, d, l] = TIER_COLORS[tierId] || TIER_COLORS.none;
  const metal = tierId && tierId !== 'none';
  return {
    k: '#1d140c', s: '#e0a878', S: '#b97f52', e: '#1d140c', B: '#5a3a1e', g: '#c99a3a', w: '#d6dde3', b: '#33241a',
    m, d, l, h: metal ? m : '#5a3a1e', a: metal ? m : '#e0a878', p: metal ? d : '#4a3a2a',
  };
}

function part(name, pal) {
  const [x0, y0, rows] = PARTS[name];
  let rects = '';
  rows.forEach((row, y) => [...row].forEach((c, x) => { if (c !== '.') rects += `<rect x="${x0 + x}" y="${y0 + y}" width="1.02" height="1.02" fill="${pal[c]}"/>`; }));
  return `<g class="p-${name}">${rects}</g>`;
}

function sprite(tierId) {
  const pal = palette(tierId);
  return svg(`<svg class="sprite" viewBox="0 0 20 28" width="120" height="168" shape-rendering="crispEdges" aria-hidden="true">
    <ellipse class="p-shadow" cx="10" cy="27.3" rx="6" ry="0.8" fill="rgba(0,0,0,0.25)"/>
    <g class="p-all">${part('legL', pal)}${part('legR', pal)}${part('body', pal)}${part('armL', pal)}<g class="p-right">${part('sword', pal)}${part('armR', pal)}</g>${part('head', pal)}</g>
  </svg>`);
}

// 10 moves × 10 effects = 100 different animations.
export const MOVES = ['jump', 'spin', 'flex', 'wave', 'swing', 'squat', 'headshake', 'bounce', 'kick', 'lunge'];
export const EFFECTS = ['sparkles', 'hearts', 'stars', 'notes', 'lightning', 'coins', 'smoke', 'confetti', 'fire', 'xp'];
const GLYPHS = { sparkles: ['✦', '✧'], hearts: ['♥'], stars: ['★'], notes: ['♪', '♫'], lightning: ['ϟ'], coins: ['●'], smoke: ['☁'], confetti: ['▬', '■', '▲'], fire: ['▲'], xp: ['+XP'] };
const COLORS = { sparkles: ['#fff6a0', '#ffffff'], hearts: ['#e3364d'], stars: ['#ffd23f'], notes: ['#3b2a1a'], lightning: ['#ffe14d', '#7fd3ff'], coins: ['#f2c037'], smoke: ['#9a9a9a'], confetti: ['#e3364d', '#3aa0e3', '#3fbf5a', '#ffd23f'], fire: ['#ff7a1a', '#ffbf1a', '#e33a1a'], xp: ['#ffff00'] };

function animate(box) {
  const move = MOVES[Math.floor(Math.random() * MOVES.length)];
  const fx = EFFECTS[Math.floor(Math.random() * EFFECTS.length)];
  const fig = box.querySelector('.sprite');
  fig.setAttribute('class', 'sprite');
  void fig.getBoundingClientRect();
  fig.setAttribute('class', `sprite mv-${move}`);
  box.dataset.anim = `${move} ${fx}`;
  box.querySelectorAll('.fx').forEach((n) => n.remove());
  const glyphs = GLYPHS[fx], colors = COLORS[fx];
  for (let i = 0; i < 12; i++) {
    const n = h('span', { class: `fx fx-${fx}`, 'aria-hidden': 'true', style: `--x:${Math.round(Math.random() * 160 - 80)}px;--y:${Math.round(-60 - Math.random() * 90)}px;--d:${(Math.random() * 0.35).toFixed(2)}s;--r:${Math.round(Math.random() * 360 - 180)}deg;color:${colors[i % colors.length]}` }, glyphs[i % glyphs.length]);
    box.append(n);
  }
  setTimeout(() => { box.querySelectorAll('.fx').forEach((n) => n.remove()); fig.setAttribute('class', 'sprite'); }, 1600);
}

// ---------- skill icons (original, simple) ----------
const I = (body) => `<svg viewBox="0 0 24 24" width="26" height="26" aria-hidden="true">${body}</svg>`;
export const ICONS = {
  attack: I('<g stroke="#1d140c" stroke-width="1"><path d="M4 3 L15 14 L13 16 L2 5 Z" fill="#d6dde3"/><path d="M20 3 L9 14 L11 16 L22 5 Z" fill="#d6dde3"/></g><path d="M11 15 l-4 4 M13 15 l4 4" stroke="#c99a3a" stroke-width="2.6" stroke-linecap="round"/><path d="M6 20 l-2 2 M18 20 l2 2" stroke="#5a3a1e" stroke-width="2.4" stroke-linecap="round"/>'),
  strength: I('<path d="M6 9 Q6 6 9 6 H17 Q20 6 20 9 V15 Q20 20 15 20 H10 Q6 20 6 16 Z" fill="#e0a878" stroke="#1d140c" stroke-width="1.2"/><path d="M10 6 V11 M13.5 6 V11 M17 6 V11" stroke="#1d140c" stroke-width="1.1"/><path d="M6 12 Q10 11 12 14" fill="none" stroke="#1d140c" stroke-width="1.2"/><rect x="8" y="20" width="9" height="3" fill="#b0703a" stroke="#1d140c" stroke-width="1"/>'),
  defence: I('<path d="M12 2 L20 5 V11 Q20 18 12 22 Q4 18 4 11 V5 Z" fill="#7a8087" stroke="#1d140c" stroke-width="1.2"/><path d="M12 4.5 L17.5 6.5 V11 Q17.5 16.5 12 19.5 Z" fill="#a3a9b0"/><path d="M12 4 V20 M5.5 10.5 H18.5" stroke="#c99a3a" stroke-width="1.6"/>'),
  hitpoints: I('<path d="M12 21 L3.5 12.5 Q1 9.5 3 6.5 Q5.5 3.5 9 5 Q11 6 12 8 Q13 6 15 5 Q18.5 3.5 21 6.5 Q23 9.5 20.5 12.5 Z" fill="#e3364d" stroke="#1d140c" stroke-width="1.2"/><path d="M6 8 Q7 6.5 8.5 6.8" stroke="#ff9aa8" stroke-width="1.6" fill="none" stroke-linecap="round"/>'),
  discipline: I('<path d="M12 2 L14 9 L21 9 L15.5 13.5 L17.5 21 L12 16.5 L6.5 21 L8.5 13.5 L3 9 L10 9 Z" fill="#fff6a0" stroke="#1d140c" stroke-width="1.1"/><circle cx="12" cy="12" r="2.2" fill="#ffd23f"/>'),
  agility: I('<circle cx="15" cy="4" r="2.2" fill="#e0a878" stroke="#1d140c" stroke-width="1"/><path d="M14 7 L10 12 L13 15 L11 21 M10 12 L6 13 M13 9 L18 11 M13 15 L18 18" stroke="#3aa0e3" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" fill="none"/>'),
  cooking: I('<path d="M3 10 H21 V14 Q21 20 15 20 H9 Q3 20 3 14 Z" fill="#50555b" stroke="#1d140c" stroke-width="1.2"/><path d="M1 11 H3 M21 11 H23" stroke="#1d140c" stroke-width="2"/><path d="M8 8 Q7 5.5 9 4 M12 8 Q11 5 13 3 M16 8 Q15 5.5 17 4" stroke="#d6dde3" stroke-width="1.4" fill="none" stroke-linecap="round"/>'),
  stamina: I('<path d="M14 2 L5 13 H11 L9 22 L19 10 H13 Z" fill="#ffd23f" stroke="#1d140c" stroke-width="1.2" stroke-linejoin="round"/>'),
  mastery: I('<path d="M4 9 H18 Q21 9 21 11 H17 L15 14 H9 L7 11 H4 Z" fill="#7a8087" stroke="#1d140c" stroke-width="1.1"/><path d="M9 14 H15 L16 18 H8 Z" fill="#50555b" stroke="#1d140c" stroke-width="1.1"/><rect x="6" y="18" width="12" height="3" fill="#7a8087" stroke="#1d140c" stroke-width="1.1"/><path d="M13 2 L16 6 M16 2 L13 6" stroke="#ffbf1a" stroke-width="1.4"/>'),
  herblore: I('<path d="M9 2 H15 V4 H14 V9 L19 17 Q20.5 21 16.5 21 H7.5 Q3.5 21 5 17 L10 9 V4 H9 Z" fill="#d6eef2" stroke="#1d140c" stroke-width="1.1"/><path d="M7.5 15 H16.5 L18 17.5 Q19 20 16 20 H8 Q5 20 6 17.5 Z" fill="#3fbf5a"/><circle cx="10" cy="17" r="0.9" fill="#b7f5c4"/>'),
};

function skillTile(s) {
  const tile = h('button', { type: 'button', class: 'skill', 'aria-pressed': 'false', 'aria-label': `${s.name} level ${s.level}. Tap to see XP`, onClick: () => {
    const on = tile.classList.toggle('flipped');
    tile.setAttribute('aria-pressed', on ? 'true' : 'false');
  } },
    h('span', { class: 'skill-inner' },
      h('span', { class: 'skill-face front' },
        h('span', { class: 'skill-icon' }, svg(ICONS[s.id])),
        h('span', { class: 'skill-name' }, s.name),
        h('span', { class: 'skill-lvl pixel' }, String(s.level))),
      h('span', { class: 'skill-face back' },
        h('span', { class: 'skill-name' }, s.name),
        h('span', { class: 'skill-xp pixel' }, `XP ${fmt(s.xp)}`),
        h('span', { class: 'skill-left pixel' }, s.max ? 'Maxed' : `Next ${fmt(s.toNext)}`),
        h('span', { class: 'skill-how' }, s.how))));
  return tile;
}

export function renderCharacter(root, ctx) {
  const { today } = ctx;
  const gear = data.gearInfo(today);
  const streak = data.streakInfo(today);
  const skills = data.skillInfo(today);
  const tier = gear.current;
  const box = h('button', { type: 'button', class: 'char-figure', 'aria-label': 'Your character. Tap for an animation' }, sprite(tier?.id || 'none'));
  box.addEventListener('click', () => animate(box));
  root.append(
    header('Character'),
    card(h('div', { class: 'char-hero' }, box,
      h('button', { type: 'button', class: 'char-name', onClick: () => combatSheet(today) }, `Combat level ${skills.combat}`),
      h('div', { class: 'sub' }, `${tier ? `${tier.name} gear` : 'No gear tier yet'} · ${streak.current} day streak`))),
    h('section', { class: 'card skills-panel', 'aria-label': 'Skills' },
      h('div', { class: 'row' }, h('h2', { class: 'card-title grow' }, 'Skills'), h('span', { class: 'skills-total' }, 'Total ', h('span', { class: 'pixel' }, String(skills.total)))),
      h('div', { class: 'skills' }, skills.list.map(skillTile)),
      h('p', { class: 'sub', style: 'margin:0' }, 'Tap a skill to flip it and see its XP.')));
}
