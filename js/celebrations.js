// Pop-ups for streak milestones, level-ups and gear tiers, each with its own sound
// and optional voice clip. Only one shows at a time (the app queues the rest).
import { h } from './ui/dom.js';
import { milestoneName } from './logic/streak.js';
import { MAX } from './logic/levels.js';
import { sfx, voice, stopAudio } from './core/sfx.js';

export const MESSAGES = {
  7: 'One full week of showing up.',
  15: 'Half a month in a row.',
  22: 'Three weeks straight.',
  30: 'A full month. Huge.',
};

function popup({ big = false, kind = '', label, num, title, text, source, button = 'Keep going' }) {
  const n = big ? 16 : 10;
  const wrap = h('div', { class: `celebrate${big ? ' big' : ''} ${kind}`, role: 'dialog', 'aria-modal': 'true', 'aria-label': label },
    h('div', { class: 'celebrate-card' },
      num != null ? h('div', { class: 'burst', 'aria-hidden': 'true' }, Array.from({ length: n }, (_, i) => h('i', { style: `--a:${(360 / n) * i}deg` }))) : null,
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

export function levelUp(level) {
  stopAudio();
  sfx.levelUp();
  voice('level-up');
  popup({ big: level % 10 === 0 || level === MAX, label: `Level ${level}`, num: level, title: 'Level up!', text: level === MAX ? `Level ${MAX}. Maxed.` : `You reached level ${level}.` });
}

export function tierUnlocked(tier) {
  stopAudio();
  sfx.tier();
  voice(`tier-${tier.id}`);
  popup({ kind: 'tier', label: tier.title, title: tier.title, text: tier.text, source: `Based on: ${tier.source}`, button: 'Claim it' });
}
