// Streak card: streak + countdown, this week (Sunday to Saturday), and this month's calendar.
import { h, svg } from './dom.js';
import { nextMilestone, milestoneName } from '../logic/streak.js';
import { parse, iso } from '../logic/dates.js';
import * as data from '../data.js';

const FLAME = '<svg width="32" height="32" viewBox="0 0 24 24" aria-hidden="true"><path d="M12 2C12 2 6.5 7.5 6.5 13a5.5 5.5 0 0 0 11 0c0-2.4-1.2-4.2-2.3-5.3 0 2-1 3.3-2.3 3.3 1-3.2.2-6.4-.9-9z" fill="currentColor"/></svg>';
const SHORT = { Push: 'Pu', Pull: 'Pl', Legs: 'Lg', Forearms: 'Fa', Back: 'Bk' };
const NAMES = { workout: 'Workout', rest: 'Rest', off: 'Off', missed: 'Not checked in', today: 'Today, not checked in yet', future: '' };

function mark(st) {
  if (st.kind === 'workout') return SHORT[st.dayType] || 'W';
  if (st.kind === 'rest') return 'R';
  if (st.kind === 'off') return 'O';
  return '';
}
const label = (date, st) => `${parse(date).toLocaleDateString('en-US', { weekday: 'long', month: 'short', day: 'numeric' })}: ${st.kind === 'workout' ? `${st.dayType} workout` : NAMES[st.kind]}`;

function weekRow(today, onDay) {
  return h('div', { class: 'week' }, data.weekDays(today).map((d) => {
    const st = data.dayStatus(d, today);
    return h('div', { class: 'week-day' },
      h('span', { class: 'sub' }, parse(d).toLocaleDateString('en-US', { weekday: 'narrow' })),
      st.kind === 'future'
        ? h('span', { class: 'daymark future', 'aria-hidden': 'true' })
        : h('button', { type: 'button', class: `daymark ${st.kind}`, 'aria-label': `${label(d, st)}. Tap to change`, onClick: () => onDay(d) }, mark(st)));
  }));
}

function month(today, onDay) {
  const t = parse(today);
  const first = new Date(t.getFullYear(), t.getMonth(), 1);
  const daysIn = new Date(t.getFullYear(), t.getMonth() + 1, 0).getDate();
  const cells = [];
  for (let i = 0; i < first.getDay(); i++) cells.push(h('span'));
  for (let n = 1; n <= daysIn; n++) {
    const d = iso(new Date(t.getFullYear(), t.getMonth(), n));
    const st = data.dayStatus(d, today);
    cells.push(st.kind === 'future'
      ? h('span', { class: 'calday future', 'aria-hidden': 'true' }, String(n))
      : h('button', { type: 'button', class: `calday ${st.kind}`, 'aria-label': `${label(d, st)}. Tap to change`, onClick: () => onDay(d) }, String(n)));
  }
  return h('div', { class: 'stack tight' },
    h('div', { class: 'sub' }, t.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })),
    h('div', { class: 'cal' }, ['S', 'M', 'T', 'W', 'T', 'F', 'S'].map((x) => h('span', { class: 'cal-head', 'aria-hidden': 'true' }, x)), cells));
}

const legend = () => h('div', { class: 'legend' },
  [['workout', 'Workout'], ['rest', 'Rest'], ['off', 'Off'], ['missed', 'Not checked in']].map(([k, t]) =>
    h('span', { class: 'legend-item' }, h('span', { class: `daymark mini ${k}`, 'aria-hidden': 'true' }), t)));

export function streakWidget({ current }, today, onDay = () => {}) {
  const next = nextMilestone(current);
  return h('section', { class: 'card streak', 'aria-label': 'Streak' },
    h('div', { class: 'row' },
      h('span', { class: `flame${current ? '' : ' cold'}` }, svg(FLAME)),
      h('div', { class: 'grow' },
        h('div', { class: 'streak-num' }, String(current), h('span', null, ' day streak')),
        h('div', { class: 'sub' }, `${next - current} day${next - current === 1 ? '' : 's'} to ${milestoneName(next)}`))),
    weekRow(today, onDay),
    month(today, onDay),
    legend());
}
