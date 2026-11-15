// Pop-ups for streak milestones, level-ups and progress notes. Kept in one file
// so the wording and animations can be swapped for your own theme later.
import { h } from './ui/dom.js';
import { milestoneName } from './logic/streak.js';

export const MESSAGES = {
  7: 'One full week of showing up.',
  15: 'Half a month in a row.',
  22: 'Three weeks straight.',
  30: 'A full month. Huge.',
};

function popup({ big = false, label, num, title, text, button = 'Keep going' }) {
  const n = big ? 16 : 10;
  const wrap = h('div', { class: `celebrate${big ? ' big' : ''}`, role: 'dialog', 'aria-modal': 'true', 'aria-label': label },
    h('div', { class: 'celebrate-card' },
      num != null ? h('div', { class: 'burst', 'aria-hidden': 'true' }, Array.from({ length: n }, (_, i) => h('i', { style: `--a:${(360 / n) * i}deg` }))) : null,
      num != null ? h('div', { class: 'celebrate-num' }, String(num)) : null,
      h('div', { class: 'celebrate-title' }, title),
      h('p', { class: 'sub' }, text),
      h('button', { type: 'button', class: 'btn primary block', onClick: () => { wrap.remove(); window.dispatchEvent(new Event('tracker-popup-closed')); } }, button)));
  document.body.append(wrap);
}

export function celebrate(n) {
  popup({ big: n >= 30, label: `${n}-day streak`, num: n, title: `${milestoneName(n)} streak`, text: MESSAGES[n] || `${n} days in a row.` });
}

export function levelUp(level) {
  popup({ big: level % 10 === 0 || level === 99, label: `Level ${level}`, num: level, title: 'Level up!', text: level === 99 ? 'Level 99. Maxed.' : `You reached level ${level}.` });
}

export function progressNote(msg) {
  popup({ label: msg.title, title: msg.title, text: msg.text, button: 'Got it' });
}
