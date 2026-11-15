import { h } from './dom.js';
import { button, card, header, light, sheet, field, numberInput, toast, segmented, empty, confirmSheet } from './components.js';
import { pickDayType } from './today.js';
import { nice, ago, short } from '../logic/dates.js';
import { XP } from '../logic/levels.js';
import { LIFTS } from '../logic/standards.js';
import * as data from '../data.js';

const num = (v) => (v === '' || v == null || Number.isNaN(+v) ? null : +v);

// Rows to show before anything is logged today: last session's sets, or blanks.
function plan(ex, st) {
  const cardio = ex.type === 'cardio';
  const prev = st.last ? st.last.sets : [];
  if (prev.length) {
    return prev.map((s, i) => ({ n: i + 1, weight: s.weight ?? null, reps: s.reps ?? null, minutes: s.minutes ?? null, miles: s.miles ?? null, done: false, virtual: true }));
  }
  return Array.from({ length: cardio ? 1 : 3 }, (_, i) => ({ n: i + 1, weight: null, reps: null, minutes: null, miles: null, done: false, virtual: true }));
}

function infoLine(ex, st) {
  if (ex.type === 'cardio') {
    if (!st.last) return [h('span', { class: 'chip' }, 'No previous session')];
    const s = st.last.sets[0] || {};
    return [h('span', { class: 'chip' }, `Last: ${s.minutes ?? '—'} min${s.miles ? `, ${s.miles} mi` : ''} · ${short(st.last.date)}`)];
  }
  const out = [
    h('span', { class: 'chip strong' }, `Goal ${st.goal} reps`),
    h('span', { class: 'chip' }, `In a row ${st.count}/${st.needed}`),
  ];
  if (st.lastWorking) out.push(h('span', { class: 'chip' }, `Last: ${st.lastWorking.weight} lb × ${st.lastWorking.reps.join(', ')} · ${short(st.last.date)}`));
  else out.push(h('span', { class: 'chip' }, 'No previous session'));
  return out;
}

function exerciseCard(ex, dayType, today) {
  const st = data.exerciseStatus(ex, today);
  const cardio = ex.type === 'cardio';
  let rows = data.todaysSets(ex.id, today);
  const isVirtual = !rows.length;
  if (isVirtual) rows = plan(ex, st);

  // Save every planned row the first time one is touched, so the list stays put.
  let made = null; // one shared promise, so two quick taps can't save the rows twice
  const ensureMade = () => {
    if (!made) {
      made = (async () => {
        const ids = new Map();
        for (const r of rows) {
          const { virtual, ...vals } = r;
          ids.set(r.n, (await data.addSet(ex.id, today, dayType, vals)).id);
        }
        return ids;
      })();
    }
    return made;
  };
  const commit = async (row, patch) => {
    const id = row.virtual ? (await ensureMade()).get(row.n) : row.id;
    return data.updateSet(id, patch);
  };

  const rowEl = (row) => {
    const a = cardio
      ? numberInput(row.minutes, { 'aria-label': `Set ${row.n} minutes`, placeholder: 'min' })
      : numberInput(row.weight, { 'aria-label': `Set ${row.n} weight in pounds`, placeholder: 'lb' });
    const b = cardio
      ? numberInput(row.miles, { 'aria-label': `Set ${row.n} miles (optional)`, placeholder: 'mi' })
      : numberInput(row.reps, { 'aria-label': `Set ${row.n} reps`, placeholder: 'reps', inputmode: 'numeric', step: '1' });
    const values = () => (cardio ? { minutes: num(a.value), miles: num(b.value) } : { weight: num(a.value), reps: num(b.value) });
    a.addEventListener('change', () => commit(row, values()));
    b.addEventListener('change', () => commit(row, values()));
    const toggle = async () => {
      const v = values();
      if (row.done) { await commit(row, { ...v, done: false, doneAt: null }); return; }
      if (cardio ? !(v.minutes > 0) : !(v.reps > 0)) { toast(cardio ? 'Enter minutes first' : 'Enter reps first'); return; }
      await commit(row, { ...v, done: true, doneAt: new Date().toISOString() });
      if (!cardio) toast(`+${Math.round(v.reps) * XP.rep} XP`);
    };
    const del = row.virtual ? h('span') : h('button', { type: 'button', class: 'icon-btn', 'aria-label': `Remove set ${row.n}`, onClick: () => data.removeSet(row.id) }, '×');
    return h('div', { class: `set-row${row.done ? ' done' : ''}` },
      light(row.done, toggle, row.done ? `Set ${row.n} done. Tap to undo` : `Mark set ${row.n} done`), a, b, del);
  };

  const addSet = async () => {
    const lastRow = rows[rows.length - 1] || {};
    const n = (lastRow.n || 0) + 1;
    const vals = { n, weight: lastRow.weight ?? null, reps: lastRow.reps ?? null, minutes: lastRow.minutes ?? null, miles: lastRow.miles ?? null, done: false };
    if (isVirtual) await ensureMade();
    await data.addSet(ex.id, today, dayType, vals);
  };

  return card(
    h('div', { class: 'row' },
      h('h2', { class: 'card-title grow' }, ex.name),
      h('button', { type: 'button', class: 'btn ghost', 'aria-label': `Options for ${ex.name}`, onClick: () => exerciseMenu(ex, dayType) }, 'Edit')),
    h('div', { class: 'chips' }, infoLine(ex, st)),
    !cardio && st.ready ? h('div', { class: 'banner' }, `You hit ${st.goal} reps ${st.needed} times in a row. Go up in weight; your goal goes back to 10.`) : null,
    h('div', { class: 'set-row head', 'aria-hidden': 'true' }, h('span'), h('span', null, cardio ? 'Minutes' : 'Weight (lb)'), h('span', null, cardio ? 'Miles' : 'Reps'), h('span')),
    rows.map(rowEl),
    button('+ Add set', addSet, 'block'));
}

function exerciseMenu(ex, dayType) {
  const name = h('input', { type: 'text', value: ex.name });
  const current = data.liftFor(ex) || '';
  const std = h('select', null, h('option', { value: '' }, 'None'),
    Object.entries(LIFTS).map(([k, l]) => h('option', { value: k, selected: k === current }, l.label)));
  const body = h('div', { class: 'stack' }, field('Name', name),
    ex.type === 'cardio' ? null : field('Strength level based on', std));
  const s = sheet(ex.name, body, [
    button('Save', async () => {
      if (!name.value.trim()) return;
      await data.renameExercise(ex, name.value);
      if (ex.type !== 'cardio' && std.value !== current) await data.setStandard(data.exercise(ex.id), std.value);
      s.close();
    }, 'primary block'),
    button(`Remove from ${dayType} day`, () => {
      s.close();
      confirmSheet('Remove exercise?', `${ex.name} will no longer show on ${dayType} day. Its history is kept.`, 'Remove', () => data.removeExerciseFromDay(ex, dayType));
    }, 'danger block'),
  ]);
}

function addExerciseSheet(dayType) {
  const others = data.exercises().filter((e) => !(e.dayTypes || []).includes(dayType));
  const select = h('select', { 'aria-label': 'Saved exercises' },
    h('option', { value: '' }, 'Choose…'), others.map((e) => h('option', { value: e.id }, e.name)));
  const name = h('input', { type: 'text', placeholder: 'e.g. Bench press', 'aria-label': 'New exercise name' });
  let type = 'strength';
  const segWrap = h('div');
  const drawSeg = () => segWrap.replaceChildren(segmented([['strength', 'Weights'], ['cardio', 'Cardio']], type, (v) => { type = v; drawSeg(); }));
  drawSeg();

  const body = h('div', { class: 'stack' },
    others.length ? [
      field('Saved exercise', select),
      button('Add', async () => {
        const ex = others.find((e) => e.id === select.value);
        if (!ex) { toast('Choose an exercise'); return; }
        await data.addExerciseToDay(ex, dayType);
        s.close();
      }, 'primary block'),
      h('div', { class: 'divider' }, 'or create a new one'),
    ] : null,
    field('Name', name),
    segWrap,
    button('Create and add', async () => {
      if (!name.value.trim()) { toast('Enter a name'); return; }
      await data.addExercise(name.value, type, dayType);
      s.close();
    }, others.length ? 'block' : 'primary block'));
  const s = sheet(`Add to ${dayType} day`, body);
}

export function renderTrain(root, ctx) {
  const { today, go } = ctx;
  const c = data.checkin(today);
  const dayType = c && c.type === 'exercise' ? c.dayType : null;
  if (!dayType) {
    root.append(header('Workout', nice(today)),
      card(h('h2', { class: 'card-title' }, "Pick today's workout"),
        h('div', { class: 'stack' }, data.DAY_TYPES.map((d) => button(d.later ? `${d.id} (coming later)` : d.id,
          () => data.setCheckin(today, 'exercise', d.id), d.later ? 'block' : 'primary block', { disabled: d.later })))));
    return;
  }
  const last = data.lastDayOfType(dayType, today);
  root.append(header(`${dayType} day`, last ? `Last ${dayType} day: ${nice(last)} (${ago(last, today)})` : `First ${dayType} day`,
    button('Change', () => pickDayType(today, go), 'ghost')));
  const exs = data.exercisesFor(dayType);
  if (!exs.length) root.append(empty(`No exercises saved for ${dayType} day yet. Add the ones you do and they'll be here every time.`));
  for (const ex of exs) root.append(exerciseCard(ex, dayType, today));
  root.append(button('+ Add exercise', () => addExerciseSheet(dayType), 'block'));
}
