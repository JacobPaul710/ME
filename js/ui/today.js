import { h, fmt, svg } from './dom.js';
import { button, card, header, light, progressRow, sheet, field, numberInput, toast, statusDot } from './components.js';
import { streakWidget } from './streakWidget.js';
import { nice, iso, parse } from '../logic/dates.js';
import { MACROS } from '../logic/nutrition.js';
import * as data from '../data.js';
import { session } from '../core/auth.js';

// Pick a workout type for a day, then open the logger for that day.
// A workout only counts once at least one set is logged as done.
export function pickDayType(date, go) {
  const s = sheet('Which workout?', h('div', { class: 'stack' },
    data.DAY_TYPES.map((d) => button(d.later ? `${d.id} (coming later)` : d.id, async () => {
      await data.setCheckin(date, 'exercise', d.id);
      s.close();
      go(date === iso() ? '#train' : `#train/${date}`);
    }, d.later ? 'block' : 'primary block', { disabled: d.later }))));
}

// Change what a day was (from the calendar or week row).
export function editDaySheet(date, go) {
  const st = data.dayStatus(date, iso());
  const now = st.kind === 'workout' ? `${st.dayType} workout` : { rest: 'Rest day', off: 'Off day', missed: 'Not checked in', today: 'Not checked in yet' }[st.kind];
  const s = sheet(nice(date), h('div', { class: 'stack' },
    h('p', { class: 'sub', style: 'margin:0' }, `Now: ${now}`),
    button(st.kind === 'workout' ? 'Open this workout' : 'Log a workout', () => {
      s.close();
      if (st.kind === 'workout') go(date === iso() ? '#train' : `#train/${date}`);
      else pickDayType(date, go);
    }, 'primary block'),
    h('p', { class: 'sub', style: 'margin:0' }, 'A workout counts once you log at least one set as done.'),
    button('Rest', async () => { await data.setCheckin(date, 'rest'); s.close(); }, 'block'),
    button('Off', async () => { await data.setCheckin(date, 'off'); s.close(); }, 'block'),
    data.checkin(date) ? button('Clear check-in', async () => { await data.clearCheckin(date); s.close(); }, 'danger block') : null));
}

function checkinCard(today, go) {
  const c = data.checkin(today);
  if (!c) {
    return card(
      h('div', { class: 'row' }, statusDot(false), h('h2', { class: 'card-title grow' }, 'What are we doing today?')),
      h('div', { class: 'grid3' },
        button('Exercise', () => pickDayType(today, go), 'primary'),
        button('Rest', () => data.setCheckin(today, 'rest')),
        button('Off', () => data.setCheckin(today, 'off'))));
  }
  if (c.type === 'exercise') {
    const done = data.setsOn(today).filter((s) => s.done).length;
    return card(
      h('div', { class: 'row' }, statusDot(done > 0),
        h('div', { class: 'grow' },
          h('h2', { class: 'card-title' }, `${c.dayType} day`),
          h('div', { class: 'sub' }, done ? `${done} set${done === 1 ? '' : 's'} done` : 'Finish a set to count today'))),
      h('div', { class: 'grid2' },
        button('Open workout', () => go('#train'), 'primary'),
        button('Change', () => changeCheckin(today, go))));
  }
  return card(
    h('div', { class: 'row' }, statusDot(true),
      h('div', { class: 'grow' }, h('h2', { class: 'card-title' }, c.type === 'rest' ? 'Rest day' : 'Off day'), h('div', { class: 'sub' }, 'Checked in'))),
    button('Change', () => changeCheckin(today, go), 'block'));
}

function changeCheckin(today, go) {
  const s = sheet('Change today', h('div', { class: 'stack' },
    button('Exercise', () => { s.close(); pickDayType(today, go); }, 'primary block'),
    button('Rest', async () => { await data.setCheckin(today, 'rest'); s.close(); }, 'block'),
    button('Off', async () => { await data.setCheckin(today, 'off'); s.close(); }, 'block'),
    button('Clear check-in', async () => { await data.clearCheckin(today); s.close(); }, 'danger block')));
}

export function weighSheet(today) {
  const cur = data.weighin(today);
  const input = numberInput(cur?.lb, { 'aria-label': 'Weight in pounds', placeholder: 'e.g. 182.4' });
  const save = async () => {
    const lb = parseFloat(input.value);
    if (!(lb > 0)) { toast('Enter your weight'); return; }
    await data.setWeighin(today, Math.round(lb * 10) / 10);
    s.close();
    toast('Weigh-in saved');
  };
  input.addEventListener('keydown', (e) => { if (e.key === 'Enter') save(); });
  const s = sheet('Weigh-in', field('Weight (lb)', input), [button('Save', save, 'primary block')]);
}

function weighCard(today, go) {
  const w = data.weighin(today);
  return card(
    h('div', { class: 'row' },
      light(!!w, () => weighSheet(today), w ? 'Edit weigh-in' : 'Log weigh-in'),
      h('div', { class: 'grow' }, h('h2', { class: 'card-title' }, 'Weigh-in'), h('div', { class: 'sub' }, w ? `${w.lb} lb today` : 'Not logged today')),
      button('History', () => go('#history/weight'), 'ghost')));
}

function foodCard(today, go) {
  const t = data.dayTotals(today);
  const tg = data.settings().targets;
  return card(
    h('div', { class: 'row' }, h('h2', { class: 'card-title grow' }, parse(today).toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })), button('Add food', () => go('#food'), 'ghost')),
    MACROS.map((m) => progressRow(m.label, t[m.key], tg[m.key], m.unit)));
}

const SWORDS = '<svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><polyline points="14.5 17.5 3 6 3 3 6 3 17.5 14.5"/><line x1="13" x2="19" y1="19" y2="13"/><line x1="16" x2="20" y1="16" y2="20"/><line x1="19" x2="21" y1="21" y2="19"/><polyline points="14.5 6.5 18 3 21 3 21 6 17.5 9.5"/><line x1="5" x2="9" y1="14" y2="18"/><line x1="7" x2="4" y1="17" y2="20"/><line x1="3" x2="5" y1="19" y2="21"/></svg>';

export function levelCard(today) {
  const L = data.levelInfo(today);
  return h('section', { class: 'card level', 'aria-label': `Level ${L.level}` },
    h('div', { class: 'row' },
      h('div', { class: 'level-badge' }, svg(SWORDS), h('span', { class: 'level-num' }, String(L.level))),
      h('div', { class: 'grow stack tight' },
        h('div', { class: 'level-title' }, `Level ${L.level}`),
        h('div', { class: 'row prog-top' }, h('span', { class: 'grow' }, `${fmt(L.xp)} XP`),
          h('span', { class: 'sub' }, L.level >= 99 ? 'Max level' : `${fmt(L.toNext)} to level ${L.level + 1}`)),
        h('div', { class: 'bar xp' }, h('i', { style: `width:${L.pct}%` })))));
}

function progressCard(today) {
  const p = data.progressInfo(today);
  if (!p.start) return null;
  return card(
    h('div', { class: 'row' }, h('h2', { class: 'card-title grow' }, 'Consistency'), h('span', { class: 'sub' }, 'Push, Pull, Legs · last 30 days')),
    h('div', { class: 'row prog-top' }, h('span', { class: 'grow' }, 'Workout days'), h('span', { class: 'num' }, `${p.done} `, h('span', { class: 'sub' }, `/ ${p.goal} goal`))),
    h('div', { class: `bar${p.on ? ' good' : ''}` }, h('i', { style: `width:${Math.min(100, (p.done / p.goal) * 100)}%` })),
    p.message
      ? h('div', { class: 'msg' }, h('div', { class: 'msg-title' }, p.message.title), h('p', null, p.message.text))
      : h('p', { class: 'sub' }, p.on
        ? `Your first progress note unlocks ${p.next ? `on day ${p.next.day}` : 'soon'}.`
        : `Get to ${p.goal} workout days to keep your progress notes coming.`));
}

// Small, out-of-the-way account button: shows who's signed in, with Sign out.
function accountButton(ctx) {
  const email = session()?.user?.email || '';
  return h('button', { type: 'button', class: 'account-btn', 'aria-label': `Account: ${email}`, onClick: () => {
    const s = sheet('Account', h('p', { class: 'sub', style: 'margin:0' }, `Signed in as ${email}`), [
      button('Sign out', () => { s.close(); ctx.signOut(); }, 'block'),
    ]);
  } }, (email[0] || '?').toUpperCase());
}

export function renderToday(root, ctx) {
  const { today, go } = ctx;
  root.append(...[
    header('Today', nice(today), h('div', { class: 'row head-right' }, ctx.syncBadge(), accountButton(ctx))),
    levelCard(today),
    streakWidget(data.streakInfo(today), today, (d) => editDaySheet(d, go)),
    checkinCard(today, go),
    weighCard(today, go),
    progressCard(today),
    foodCard(today, go)].filter(Boolean));
}
