import { h, fmt } from './dom.js';
import { button, card, header, light, progressRow, sheet, field, numberInput, toast, statusDot } from './components.js';
import { streakWidget } from './streakWidget.js';
import { nice } from '../logic/dates.js';
import { MACROS } from '../logic/nutrition.js';
import * as data from '../data.js';

export function pickDayType(today, go) {
  const s = sheet('Which workout?', h('div', { class: 'stack' },
    data.DAY_TYPES.map((d) => button(d.later ? `${d.id} (coming later)` : d.id, async () => {
      await data.setCheckin(today, 'exercise', d.id);
      s.close();
      go('#train');
    }, d.later ? 'block' : 'primary block', { disabled: d.later }))));
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
    h('div', { class: 'row' }, h('h2', { class: 'card-title grow' }, 'Food today'), button('Add food', () => go('#food'), 'ghost')),
    MACROS.map((m) => progressRow(m.label, t[m.key], tg[m.key], m.unit)));
}

export function levelCard(today) {
  const L = data.levelInfo(today);
  return h('section', { class: 'card level', 'aria-label': `Level ${L.level}` },
    h('div', { class: 'row' },
      h('div', { class: 'level-badge' }, h('span', { class: 'sub' }, 'Level'), h('span', { class: 'level-num' }, String(L.level))),
      h('div', { class: 'grow stack tight' },
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

export function renderToday(root, ctx) {
  const { today, go } = ctx;
  root.append(
    header('Today', nice(today), ctx.syncBadge()),
    levelCard(today),
    streakWidget(data.streakInfo(today), today),
    checkinCard(today, go),
    weighCard(today, go),
    progressCard(today),
    foodCard(today, go));
}
