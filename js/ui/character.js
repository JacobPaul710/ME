// Character tab: a pixel-art adventurer in your current gear tier (tap him for one of
// 100 random animations), combat level, and the skills panel (tap a skill to flip it).
import { h, svg, fmt } from './dom.js';
import { card, header } from './components.js';
import * as data from '../data.js';
import { combatSheet } from './today.js';
import { MONSTERS, FORMS, formIndex, monsterById, monsterSvg } from './monster.js';

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
  shield: [0, 12, ['.kkkk.', 'kmmmdk', 'kmgmdk', 'kmmmdk', '.kmdk.', '..kk..']],
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
    <g class="p-all">${part('legL', pal)}${part('legR', pal)}${part('body', pal)}<g class="p-left">${part('armL', pal)}${part('shield', pal)}</g><g class="p-right">${part('sword', pal)}${part('armR', pal)}</g>${part('head', pal)}</g>
  </svg>`);
}

// 10 moves × 10 effects = 100 different animations.
export const MOVES = ['jump', 'spin', 'flex', 'wave', 'swing', 'squat', 'headshake', 'bounce', 'kick', 'lunge'];
export const EFFECTS = ['sparkles', 'hearts', 'stars', 'notes', 'lightning', 'coins', 'smoke', 'confetti', 'fire', 'xp'];
const GLYPHS = { sparkles: ['✦', '✧'], hearts: ['♥'], stars: ['★'], notes: ['♪', '♫'], lightning: ['ϟ'], coins: ['●'], smoke: ['☁'], confetti: ['▬', '■', '▲'], fire: ['▲'], xp: ['+XP'] };
const COLORS = { sparkles: ['#fff6a0', '#ffffff'], hearts: ['#e3364d'], stars: ['#ffd23f'], notes: ['#3b2a1a'], lightning: ['#ffe14d', '#7fd3ff'], coins: ['#f2c037'], smoke: ['#9a9a9a'], confetti: ['#e3364d', '#3aa0e3', '#3fbf5a', '#ffd23f'], fire: ['#ff7a1a', '#ffbf1a', '#e33a1a'], xp: ['#ffff00'] };

// Puffs of particles from a point on the figure (fire breath, steam, sparks…), as % of the box.
function puff(box, { x, y, dx, dy, glyphs, colors, n = 8, cls = '' }) {
  for (let i = 0; i < n; i++) {
    box.append(h('span', { class: `fx puff ${cls}`, 'aria-hidden': 'true', style: `left:${x}%;top:${y}%;--x:${Math.round(dx + (Math.random() - 0.5) * 30)}px;--y:${Math.round(dy + (Math.random() - 0.5) * 24)}px;--d:${(i * 0.05).toFixed(2)}s;--r:${Math.round(Math.random() * 90 - 45)}deg;color:${colors[i % colors.length]}` }, glyphs[i % glyphs.length]));
  }
}

// A quiet backdrop for each one, drawn in soft, low-contrast colours so the figure stays the focus.
const SCENES = {
  knight: `<rect width="300" height="200" fill="#dfe8ee"/><path d="M0 120 h40 v-30 h12 v-8 h8 v8 h12 v-8 h8 v8 h12 v30 h208 v80 H0z" fill="#c9cfd4"/><rect x="58" y="96" width="14" height="24" rx="7" fill="#b7bec4"/><rect y="150" width="300" height="50" fill="#c8d6b4"/>`,
  sandqueen: `<rect width="300" height="200" fill="#f3e2bd"/><circle cx="240" cy="48" r="22" fill="#f7eacb"/><path d="M0 140 Q60 110 130 135 T300 125 V200 H0z" fill="#e8cf9c"/><path d="M0 165 Q90 140 170 162 T300 158 V200 H0z" fill="#dfc28a"/>`,
  emberwyrm: `<rect width="300" height="200" fill="#3a2422"/><path d="M0 150 L50 95 L90 130 L140 70 L190 125 L240 90 L300 140 V200 H0z" fill="#4a2c27"/><path d="M135 78 l5 -10 l5 10z" fill="#c85a2a" opacity=".6"/><rect y="168" width="300" height="32" fill="#2c1b19"/><circle cx="70" cy="60" r="1.6" fill="#ff9a4a" opacity=".5"/><circle cx="220" cy="40" r="1.4" fill="#ff9a4a" opacity=".5"/>`,
  mosslump: `<rect width="300" height="200" fill="#dce6d2"/><path d="M0 150 Q40 120 80 150 Q130 115 180 148 Q240 118 300 150 V200 H0z" fill="#b9cda5"/><rect x="20" y="40" width="10" height="120" fill="#c7d3b8"/><rect x="262" y="30" width="12" height="130" fill="#c7d3b8"/><rect y="170" width="300" height="30" fill="#a8bf93"/>`,
  gloomwing: `<rect width="300" height="200" fill="#2e2a3a"/><path d="M0 0 H300 V18 L280 50 L268 18 L240 40 L226 18 L190 60 L176 18 L120 36 L104 18 L70 48 L56 18 L30 34 L18 18 L0 30z" fill="#3a3549"/><rect y="170" width="300" height="30" fill="#25222f"/>`,
  voidling: `<rect width="300" height="200" fill="#1e1a2e"/><circle cx="40" cy="30" r="1.2" fill="#c9b8ff" opacity=".6"/><circle cx="120" cy="60" r="1" fill="#c9b8ff" opacity=".5"/><circle cx="210" cy="25" r="1.4" fill="#c9b8ff" opacity=".6"/><circle cx="270" cy="80" r="1" fill="#c9b8ff" opacity=".5"/><circle cx="80" cy="110" r="1" fill="#c9b8ff" opacity=".4"/><ellipse cx="150" cy="178" rx="120" ry="14" fill="#2c2545"/>`,
  antlerghast: `<rect width="300" height="200" fill="#2a2d2a"/><path d="M30 200 V60 M28 90 l-14 -16 M32 110 l14 -14 M270 200 V50 M268 80 l-16 -14 M272 105 l14 -12" stroke="#3a3e3a" stroke-width="6"/><rect y="150" width="300" height="50" fill="#353a35" opacity=".8"/><rect y="130" width="300" height="20" fill="#4a504a" opacity=".25"/>`,
  wraithling: `<rect width="300" height="200" fill="#2b2f3d"/><circle cx="235" cy="45" r="18" fill="#c9d2e3" opacity=".35"/><path d="M40 170 v-24 a10 10 0 0 1 20 0 v24z M235 170 v-18 a8 8 0 0 1 16 0 v18z" fill="#3a3f50"/><rect y="168" width="300" height="32" fill="#232633"/><rect y="150" width="300" height="18" fill="#cfd8e3" opacity=".08"/>`,
  leechmaw: `<rect width="300" height="200" fill="#2e2224"/><ellipse cx="150" cy="95" rx="140" ry="110" fill="#3a2a2d"/><ellipse cx="150" cy="95" rx="95" ry="75" fill="#33252a"/><rect y="168" width="300" height="32" fill="#271c1e"/><ellipse cx="80" cy="172" rx="30" ry="4" fill="#4a5a32" opacity=".5"/>`,
};
const scene = (id) => svg(`<svg class="char-scene" viewBox="0 0 300 200" preserveAspectRatio="xMidYMax slice" aria-hidden="true">${SCENES[id] || SCENES.knight}</svg>`);

// Idles: one plays every 4–6 seconds and lasts about 2–3 seconds.
export const KNIGHT_IDLES = ['spin', 'swing', 'flex', 'polish', 'stab', 'steam'];
export const MONSTER_IDLES = ['fire', 'stomp', 'roar', 'snap', 'swish', 'swell'];
const BREATH = { emberwyrm: ['fire'], sandqueen: ['sand'], mosslump: ['spores'], gloomwing: ['shriek'], tidefang: ['bubbles'], voidling: ['void'], antlerghast: ['mist'], wraithling: ['mist'], leechmaw: ['spit'] };
const BREATH_FX = {
  fire: { glyphs: ['▲', '●'], colors: ['#ff7a1a', '#ffbf1a', '#e33a1a'] }, sand: { glyphs: ['●', '■'], colors: ['#e0c27a', '#c99a3a'] },
  spores: { glyphs: ['●'], colors: ['#b7f5c4', '#7fc25a'] }, shriek: { glyphs: [')', '))'], colors: ['#c77dff', '#ff5e9a'] },
  bubbles: { glyphs: ['○', '◦'], colors: ['#9fd0ef', '#ffffff'] }, void: { glyphs: ['✦', '●'], colors: ['#a560d8', '#e3364d'] },
  mist: { glyphs: ['☁'], colors: ['#cfd8e3', '#7fe9ff'] }, spit: { glyphs: ['●'], colors: ['#a6ff3b', '#e3364d'] },
};

export function playIdle(box, kind, name, monsterId) {
  const fig = box.querySelector('.sprite');
  if (!fig) return;
  fig.classList.remove(...[...fig.classList].filter((c) => c.startsWith('id-') || c.startsWith('mv-')));
  void fig.getBoundingClientRect();
  fig.classList.add(`id-${name}`);
  box.dataset.idle = name;
  if (kind === 'knight' && name === 'steam') {
    puff(box, { x: 47, y: 22, dx: -40, dy: -30, glyphs: ['☁'], colors: ['#ffffff', '#dddddd'], n: 4, cls: 'steam' });
    puff(box, { x: 53, y: 22, dx: 40, dy: -30, glyphs: ['☁'], colors: ['#ffffff', '#dddddd'], n: 4, cls: 'steam' });
  }
  if (kind === 'knight' && name === 'polish') puff(box, { x: 32, y: 55, dx: 0, dy: -20, glyphs: ['✦'], colors: ['#ffffff', '#fff6a0'], n: 3 });
  if (kind === 'monster' && name === 'fire') {
    const f = BREATH_FX[(BREATH[monsterId] || ['fire'])[0]];
    puff(box, { x: 58, y: 55, dx: 90, dy: -10, ...f, n: 10, cls: 'breath' });
  }
  if (kind === 'monster' && name === 'roar') puff(box, { x: 55, y: 35, dx: 60, dy: -50, glyphs: ['!'], colors: ['#e3364d'], n: 2 });
  setTimeout(() => { fig.classList.remove(`id-${name}`); box.querySelectorAll('.puff').forEach((n) => n.remove()); }, 3000);
}

function startIdles(box, kind, monsterId) {
  const list = kind === 'knight' ? KNIGHT_IDLES : MONSTER_IDLES;
  const tick = () => {
    if (!box.isConnected) return; // left the screen
    if (!box.dataset.busy) playIdle(box, kind, list[Math.floor(Math.random() * list.length)], monsterId);
    setTimeout(tick, 4000 + Math.random() * 2000);
  };
  setTimeout(tick, 1200);
}

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
  setTimeout(() => { box.querySelectorAll('.fx').forEach((n) => n.remove()); fig.setAttribute('class', 'sprite'); }, 3200);
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
  mining: I('<path d="M3 8 Q12 1 21 8 Q12 5 3 8 Z" fill="#a3a9b0" stroke="#1d140c" stroke-width="1.1"/><path d="M12 5 L12 22" stroke="#7a4a22" stroke-width="2.6" stroke-linecap="round"/><path d="M12 5 L12 22" stroke="#1d140c" stroke-width="0.6" stroke-dasharray="2 3"/><circle cx="18.5" cy="19" r="2.5" fill="#7a8087" stroke="#1d140c" stroke-width="1"/>'),
  herblore: I('<path d="M12 2 L18 17 H6 Z" fill="#6b3fa0" stroke="#1d140c" stroke-width="1.2" stroke-linejoin="round"/><path d="M3 18 Q12 15 21 18 Q12 21 3 18 Z" fill="#4a2a78" stroke="#1d140c" stroke-width="1.2"/><path d="M10 9 l.6 1.4 1.4.2-1 1 .3 1.4-1.3-.7-1.3.7.3-1.4-1-1 1.4-.2z" fill="#ffd23f"/><circle cx="14" cy="13" r=".9" fill="#ffd23f"/>'), // Magic: wizard hat
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
  const tier = null; // gear tiers are in the icebox for now
  const ch = data.activeChar();
  const kind = ch.kind === 'knight' ? 'knight' : 'monster';
  const mon = monsterById(ch.monster);
  const title = ch.name || (kind === 'knight' ? 'Your knight' : mon.name);
  const fi = formIndex(skills.combat);
  const next = FORMS[fi + 1];
  const box = h('button', { type: 'button', class: `char-figure ${kind}`, 'aria-label': kind === 'knight' ? 'Your character. Tap for an animation' : `Your ${mon.name}. Tap for an animation` },
    scene(kind === 'knight' ? 'knight' : mon.id), kind === 'knight' ? sprite(tier?.id || 'none') : monsterSvg(mon, fi));
  box.addEventListener('click', () => {
    box.dataset.busy = '1'; setTimeout(() => delete box.dataset.busy, 3400);
    // you bonded: a heart floats up every time you touch him
    box.querySelectorAll('.bond-heart').forEach((n) => n.remove());
    const heart = h('span', { class: 'bond-heart', 'aria-hidden': 'true' }, '♥');
    box.append(heart); setTimeout(() => heart.remove(), 2300);
    if (kind === 'knight') animate(box);
    else { const name = MONSTER_IDLES[Math.floor(Math.random() * MONSTER_IDLES.length)]; playIdle(box, 'monster', name, mon.id); box.dataset.anim = name; }
  });
  startIdles(box, kind, mon.id);
  root.append(
    header('Character'),
    card(h('div', { class: 'char-hero' }, box,
      h('button', { type: 'button', class: 'char-name', onClick: () => combatSheet(today) }, `Combat level ${skills.combat}`),
      h('div', { class: 'char-form' }, kind === 'monster' ? `${title}${ch.name ? ` the ${mon.name}` : ''} · ${FORMS[fi].name} form` : title),
      h('div', { class: 'sub' }, kind === 'monster'
        ? (next ? `Evolves at combat level ${next.level} · ${streak.current} day streak` : `Final form · ${streak.current} day streak`)
        : `${tier ? `${tier.name} gear` : 'No gear tier yet'} · ${streak.current} day streak`))),
    h('section', { class: 'card skills-panel', 'aria-label': 'Skills' },
      h('div', { class: 'row' }, h('h2', { class: 'card-title grow' }, 'Skills'), h('span', { class: 'skills-total' }, 'Total ', h('span', { class: 'pixel' }, String(skills.total)))),
      h('div', { class: 'skills' }, skills.list.map(skillTile)),
      h('p', { class: 'sub', style: 'margin:0' }, 'Tap a skill to flip it and see its XP.')));
}
