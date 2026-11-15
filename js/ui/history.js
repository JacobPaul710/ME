import { h, fmt } from './dom.js';
import { button, card, header, segmented, empty, sheet, confirmSheet } from './components.js';
import { lineChart } from './chart.js';
import { weighSheet } from './today.js';
import { nice } from '../logic/dates.js';
import { MACROS } from '../logic/nutrition.js';
import { weightSummary } from '../logic/stats.js';
import * as data from '../data.js';

const state = { workoutView: 'date' };
const signed = (n, d = 1, unit = '') => (n == null ? '—' : `${n > 0 ? '+' : ''}${fmt(n, d)}${unit}`);

function setText(s, cardio) {
  return cardio ? `${s.minutes ?? '—'} min${s.miles ? ` · ${s.miles} mi` : ''}` : `${s.weight ?? 0} lb × ${s.reps}`;
}

function byDate() {
  const days = data.workoutDays();
  if (!days.length) return empty('No workouts yet.');
  return h('div', { class: 'stack' }, days.map((d) => card(
    h('div', { class: 'row' }, h('h2', { class: 'card-title grow' }, nice(d.date)), h('span', { class: 'sub' }, d.dayTypes.join(', '))),
    d.items.map((it) => h('div', { class: 'hist-ex' },
      h('div', { class: 'item-name' }, it.exercise.name),
      h('div', { class: 'sub' }, it.sets.map((s) => setText(s, it.exercise.type === 'cardio')).join('  ·  ')))))));
}

function exerciseDetail(ex) {
  const { series, gain } = data.exerciseProgress(ex);
  const sess = data.workoutDays().filter((d) => d.items.some((i) => i.exercise.id === ex.id));
  sheet(ex.name, h('div', { class: 'stack' },
    ex.type === 'cardio' ? null : h('div', { class: 'sub' }, `Best weight per session${gain != null ? ` · Strength gained ${signed(gain, 0, '%')}` : ''}`),
    ex.type === 'cardio' ? null : lineChart(series, { unit: '', label: `${ex.name} best weight over time` }),
    sess.length ? h('div', { class: 'list' }, sess.map((d) => {
      const it = d.items.find((i) => i.exercise.id === ex.id);
      return h('div', { class: 'item' }, h('div', { class: 'item-main' },
        h('span', { class: 'item-name' }, nice(d.date)),
        h('span', { class: 'sub' }, it.sets.map((s) => setText(s, ex.type === 'cardio')).join('  ·  '))));
    })) : empty('No sessions yet.')));
}

function strengthCard() {
  const sl = data.strengthLevels();
  let body;
  if (!sl.items.length) body = h('p', { class: 'sub' }, 'Shows for bench press, squat and deadlift. Link an exercise under Workout → Edit.');
  else if (!sl.bodyweight) body = h('p', { class: 'sub' }, 'Log a weigh-in to see your levels.');
  else {
    body = h('div', { class: 'list' }, sl.items.map((it) => h('div', { class: 'item' }, h('div', { class: 'item-main' },
      h('span', { class: 'item-name' }, `${it.group}: ${it.result ? it.result.level : 'No standard yet'}`),
      h('span', { class: 'sub' }, it.result
        ? `${it.exercise.name} · est. max ${fmt(it.oneRM)} lb = ${fmt(it.result.ratio, 2)}× bodyweight${it.result.nextLevel ? ` · ${it.result.nextLevel} at ${fmt(it.result.nextWeight)} lb` : ''}`
        : `${it.exercise.name} · ${it.oneRM ? 'no women\'s standard for this lift yet' : 'no sets yet'}`)))));
  }
  return card(h('h2', { class: 'card-title' }, 'Strength levels'), body);
}

function byExercise() {
  const exs = data.exercises();
  if (!exs.length) return empty('No exercises yet.');
  const overall = data.overallGain();
  return h('div', { class: 'stack' },
    strengthCard(),
    card(h('div', { class: 'sub' }, 'Overall strength gained'), h('div', { class: 'big-num' }, overall == null ? '—' : signed(overall, 0, '%')),
      h('div', { class: 'sub' }, 'Average across exercises: best weight now vs your first session.')),
    h('div', { class: 'list' }, exs.map((ex) => {
      const p = data.exerciseProgress(ex);
      const best = p.series.length ? Math.max(...p.series.map((x) => x.value)) : null;
      return h('button', { type: 'button', class: 'item item-main', onClick: () => exerciseDetail(ex) },
        h('span', { class: 'item-name' }, ex.name),
        h('span', { class: 'sub' }, ex.type === 'cardio' ? 'Cardio' : `Best ${best ?? '—'} lb · ${p.gain == null ? 'needs 2 sessions' : `${signed(p.gain, 0, '%')} strength`}`));
    })));
}

function foodHistory() {
  const days = data.foodDays();
  if (!days.length) return empty('No food logged yet.');
  const tg = data.settings().targets;
  return h('div', { class: 'list' }, days.map((d) => h('button', { type: 'button', class: 'item item-main', onClick: () => foodDay(d.date) },
    h('span', { class: 'item-name' }, nice(d.date)),
    h('span', { class: 'sub' }, MACROS.map((m) => `${m.label} ${fmt(d.totals[m.key], m.key === 'cal' ? 0 : 1)}${tg[m.key] ? `/${fmt(tg[m.key])}` : ''}`).join(' · ')))));
}

function foodDay(date) {
  const logs = data.foodLogs(date);
  sheet(nice(date), h('div', { class: 'list' }, logs.map((l) => h('div', { class: 'item' }, h('div', { class: 'item-main' },
    h('span', { class: 'item-name' }, l.name),
    h('span', { class: 'sub' }, `${l.amountLabel} · ${fmt(l.cal)} cal · ${fmt(l.p, 1)} P · ${fmt(l.c, 1)} C · ${fmt(l.f, 1)} F`))))));
}

function weightHistory(today) {
  const ws = data.weighins();
  const sum = weightSummary(ws, today);
  return h('div', { class: 'stack' },
    card(
      h('div', { class: 'row' },
        h('div', { class: 'grow' }, h('div', { class: 'sub' }, 'Latest'), h('div', { class: 'big-num' }, sum ? `${sum.latest.lb} lb` : '—')),
        button('Log weigh-in', () => weighSheet(today), 'primary')),
      sum ? h('div', { class: 'grid3' },
        h('div', null, h('div', { class: 'sub' }, '7 days'), h('div', { class: 'num' }, signed(sum.week, 1, ' lb'))),
        h('div', null, h('div', { class: 'sub' }, '30 days'), h('div', { class: 'num' }, signed(sum.month, 1, ' lb'))),
        h('div', null, h('div', { class: 'sub' }, 'Since start'), h('div', { class: 'num' }, signed(sum.total, 1, ' lb')))) : null,
      lineChart(ws.map((w) => ({ date: w.date, value: w.lb })), { unit: '', label: 'Weight over time' })),
    ws.length ? h('div', { class: 'list' }, [...ws].reverse().map((w) => h('button', { type: 'button', class: 'item item-main', onClick: () =>
      confirmSheet('Delete weigh-in?', `${nice(w.date)}: ${w.lb} lb`, 'Delete', () => data.removeWeighin(w.date)) },
    h('span', { class: 'item-name' }, `${w.lb} lb`), h('span', { class: 'sub' }, nice(w.date))))) : empty('No weigh-ins yet.'));
}

export function renderHistory(root, ctx) {
  const tab = ['workouts', 'food', 'weight'].includes(ctx.sub) ? ctx.sub : 'workouts';
  root.append(header('History'),
    segmented([['workouts', 'Workouts'], ['food', 'Food'], ['weight', 'Weight']], tab, (v) => ctx.go(`#history/${v}`)));
  if (tab === 'workouts') {
    root.append(segmented([['date', 'By date'], ['exercise', 'By exercise']], state.workoutView, (v) => { state.workoutView = v; ctx.rerender(); }),
      state.workoutView === 'date' ? byDate() : byExercise());
  } else if (tab === 'food') root.append(foodHistory());
  else root.append(weightHistory(ctx.today));
}
