// Pop-ups for streak milestones, level-ups and gear tiers, each with its own sound
// and optional voice clip. Only one shows at a time (the app queues the rest).
import { h } from './ui/dom.js';
import { milestoneName } from './logic/streak.js';
import { COMBAT_MAX as MAX } from './logic/skills.js';
import { sfx, voice, stopAudio } from './core/sfx.js';

export const MESSAGES = {
  7: 'One full week of showing up.',
  15: 'Half a month in a row.',
  22: 'Three weeks straight.',
  30: 'A full month. Huge.',
};

// Fireworks fill the dark background behind the card (never over the text).
const FW_COLORS = ['#ffd23f', '#ff5e5b', '#3aa0e3', '#3fbf5a', '#c77dff', '#ffffff', '#ff9f1c'];
function fireworks(big) {
  const box = h('div', { class: 'fireworks', 'aria-hidden': 'true' });
  const bursts = big ? 9 : 6;
  for (let b = 0; b < bursts; b++) {
    // around the card: top band, bottom band, and the sides
    const spot = [[Math.random() * 100, 4 + Math.random() * 18], [Math.random() * 100, 80 + Math.random() * 16], [3 + Math.random() * 12, 20 + Math.random() * 60], [85 + Math.random() * 12, 20 + Math.random() * 60]][b % 4];
    const c1 = FW_COLORS[Math.floor(Math.random() * FW_COLORS.length)], c2 = FW_COLORS[Math.floor(Math.random() * FW_COLORS.length)];
    const delay = (b * (big ? 0.28 : 0.35) + Math.random() * 0.15).toFixed(2);
    const n = 22;
    const burst = h('div', { class: 'fw', style: `left:${spot[0]}%;top:${spot[1]}%;--d:${delay}s` },
      h('b', { class: 'fw-flash', style: `background:${c1}` }),
      Array.from({ length: n }, (_, i) => h('i', { style: `--a:${(360 / n) * i + Math.random() * 8}deg;--r:${50 + Math.random() * 45}px;background:${i % 3 ? c1 : c2};color:${i % 3 ? c1 : c2}` })));
    box.append(burst);
  }
  return box;
}

// Pop-ups wait their turn: if one is open, the next shows after you tap OK.
const waiting = [];
let handing = false; // the next pop-up is about to show
window.addEventListener('tracker-popup-closed', () => {
  const next = waiting.shift();
  if (!next) return;
  handing = true;
  setTimeout(() => { handing = false; next(); }, 250);
});
function popup(opts) {
  if (handing || document.querySelector('.celebrate')) { waiting.push(() => { opts.sound?.(); showPopup(opts); }); return; }
  opts.sound?.();
  showPopup(opts);
}
function showPopup({ big = false, kind = '', label, num, title, text, source, button = 'Keep going', icon = null }) {
  const wrap = h('div', { class: `celebrate${big ? ' big' : ''} ${kind}`, role: 'dialog', 'aria-modal': 'true', 'aria-label': label },
    fireworks(big),
    h('div', { class: 'celebrate-card' },
      h('div', { class: 'celebrate-shine', 'aria-hidden': 'true' }),
      icon ? h('div', { class: 'celebrate-icon', 'aria-hidden': 'true' }, icon) : null,
      num != null ? h('div', { class: 'celebrate-num' }, String(num)) : null,
      h('div', { class: 'celebrate-title' }, title),
      h('p', { class: 'sub' }, text),
      source ? h('p', { class: 'source' }, source) : null,
      h('button', { type: 'button', class: 'btn primary block', onClick: () => { stopAudio(); wrap.remove(); window.dispatchEvent(new Event('tracker-popup-closed')); } }, button)));
  document.body.append(wrap);
}

export function celebrate(n) {
  stopAudio();
  sfx.milestone();
  voice(`streak-${n}`);
  popup({ big: n >= 30, label: `${n}-day streak`, num: n, title: `${milestoneName(n)} streak`, text: MESSAGES[n] || `${n} days in a row.` });
}

export function evolved(name, form, level) {
  stopAudio();
  sfx.levelUp();
  popup({ big: true, kind: 'evolve', label: `${name} evolved`, num: level, title: `Your ${name} evolved!`, text: `Combat level ${level} unlocked its ${form} form. Go see it on the Character tab.` });
}

// Combat level: the grand one (fireworks, fanfare). Tap OK to close.
export function levelUp(level) {
  popup({ sound: () => { stopAudio(); sfx.levelUp(); voice('level-up'); }, big: true, kind: 'combat', label: `Combat level ${level}`, num: level, title: 'Combat level up!', text: level === MAX ? `Combat level ${MAX}. Maxed.` : `You reached combat level ${level}.`, button: 'OK' });
}

// A skill level: smaller and quicker. Tap OK to close.
export function skillUp(name, level, icon) {
  popup({ sound: () => { sfx.skillUp(); }, kind: 'skill', label: `${name} level ${level}`, title: `${name} level ${level}!`, text: `You advanced a ${name} level.`, button: 'OK', icon });
}

export function tierUnlocked(tier) {
  stopAudio();
  sfx.tier();
  voice(`tier-${tier.id}`);
  popup({ kind: 'tier', label: tier.title, title: tier.title, text: tier.text, source: `Based on: ${tier.source}`, button: 'Claim it' });
}
