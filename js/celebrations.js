// Milestone pop-ups. Kept in one file so the wording and animations can be
// swapped for your own theme later.
import { h } from './ui/dom.js';
import { milestoneName } from './logic/streak.js';

export const MESSAGES = {
  7: 'One full week of showing up.',
  15: 'Half a month in a row.',
  22: 'Three weeks straight.',
  30: 'A full month. Huge.',
};

export function celebrate(n) {
  const big = n >= 30;
  const text = MESSAGES[n] || `${n} days in a row.`;
  const wrap = h('div', { class: `celebrate${big ? ' big' : ''}`, role: 'dialog', 'aria-modal': 'true', 'aria-label': `${n}-day streak` },
    h('div', { class: 'celebrate-card' },
      h('div', { class: 'burst', 'aria-hidden': 'true' }, Array.from({ length: big ? 16 : 10 }, (_, i) => h('i', { style: `--a:${(360 / (big ? 16 : 10)) * i}deg` }))),
      h('div', { class: 'celebrate-num' }, String(n)),
      h('div', { class: 'celebrate-title' }, `${milestoneName(n)} streak`),
      h('p', { class: 'sub' }, text),
      h('button', { type: 'button', class: 'btn primary block', onClick: () => wrap.remove() }, 'Keep going')));
  document.body.append(wrap);
}
