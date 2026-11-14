// Streak indicator on the home screen. Placeholder (flame and number) until you
// pick a design; replacing this one file swaps the look everywhere.
import { h, svg } from './dom.js';
import { nextMilestone, milestoneName } from '../logic/streak.js';

const FLAME = '<svg width="44" height="44" viewBox="0 0 24 24" aria-hidden="true"><path d="M12 2C12 2 6.5 7.5 6.5 13a5.5 5.5 0 0 0 11 0c0-2.4-1.2-4.2-2.3-5.3 0 2-1 3.3-2.3 3.3 1-3.2.2-6.4-.9-9z" fill="currentColor"/></svg>';

export function streakWidget({ current, best }) {
  const next = nextMilestone(current);
  return h('section', { class: 'card streak', 'aria-label': `${current}-day streak` },
    h('div', { class: 'row' },
      h('span', { class: `flame${current ? '' : ' cold'}` }, svg(FLAME)),
      h('div', { class: 'grow' },
        h('div', { class: 'streak-num' }, String(current), h('span', null, current === 1 ? ' day streak' : ' day streak')),
        h('div', { class: 'sub' }, `Best ${best} · ${next - current} to ${milestoneName(next)}`))));
}
