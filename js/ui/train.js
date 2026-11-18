import { h, fmt } from './dom.js';
import { button, card, header, light, sheet, field, numberInput, toast, segmented, empty, confirmSheet } from './components.js';
import { pickDayType } from './today.js';
import { nice, ago, iso, parse } from '../logic/dates.js';
import { LIFTS } from '../logic/standards.js';
import * as data from '../data.js';
import { cheer } from '../core/cheers.js';
import { startRest } from './restTimer.js';

const num = (v) => (v === '' || v == null || Number.isNaN(+v) ? null : +v);

// Rows to show before anything is logged today: where each set left off, or blanks.
function plan(ex, st) {
  if (ex.type === 'cardio') {
    const prev = st.last ? st.last.sets : [];
    return (prev.length ? prev : [{}]).map((s, i) => ({ n: i + 1, minutes: s.minutes ?? null, miles: s.miles ?? null, done: false, virtual: true }));
  }
  const src = st.sets.length ? st.sets : [{}, {}, {}];
  return src.map((s, i) => ({ n: i + 1, weight: s.weight ?? null, reps: s.reps ?? null, repsR: s.repsR ?? null, repsL: s.repsL ?? null, done: false, virtual: true }));
}

// The previous workout for this exercise (never today's), on its own line.
function lastWorkout(ex, st) {
  if (ex.type === 'cardio') {
    if (!st.last) return h('div', { class: 'last-workout' }, 'No previous workout');
    const s = st.last.sets[0] || {};
    return h('div', { class: 'last-workout' }, h('span', { class: 'lw-label' }, 'Last workout: '), `${dayDate(st.last.date)} · ${s.minutes ?? '—'} min${s.miles ? `, ${s.miles} mi` : ''}`);
  }
  if (st.last) return h('div', { class: 'last-workout' }, h('span', { class: 'lw-label' }, 'Last workout: '), dayDate(st.last.date));
  return h('div', { class: 'last-workout' }, ex.baseline ? 'Last workout: from your sheet' : 'No previous workout');
}
const dayDate = (d) => parse(d).toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' });

// Under each set: how many more workouts at this goal before the goal goes up a rep.
function setMeta(ex, st, i) {
  const s = st.sets[i];
  if (s && s.goal >= st.top && s.hits >= st.needed) return 'Top of the range: ready to go up in weight';
  return `${s ? s.hits : 0} of ${st.needed} workouts until rep increase`;
}

// Notes box under the exercise name: type straight in, it saves by itself.
function notesBox(ex) {
  const t = h('textarea', { class: 'ex-notes-box', rows: '2', placeholder: 'Setup, form cues, machine settings…', 'aria-label': `Notes for ${ex.name}` });
  t.value = ex.notes || '';
  let timer;
  const save = () => { clearTimeout(timer); if (t.value.trim() !== (ex.notes || '')) data.updateExercise(ex, { notes: t.value.trim() }); };
  t.addEventListener('input', () => { clearTimeout(timer); timer = setTimeout(save, 600); });
  t.addEventListener('blur', save);
  return h('label', { class: 'ex-notes-field' }, h('span', { class: 'sub' }, 'Notes'), t);
}

function exerciseCard(ex, dayType, today) {
  const st = data.exerciseStatus(ex, today);
  const cardio = ex.type === 'cardio';
  const sides = !!ex.sides && !cardio;
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

  // Each set's rep goal is its own box; changing it sets the goal from today on.
  const goalBox = (i) => {
    const g = numberInput(st.sets[i] ? st.sets[i].goal : st.start, { 'aria-label': `Set ${i + 1} rep goal`, inputmode: 'numeric', step: '1', min: '1', class: 'goal-in' });
    g.classList.add('goal-in');
    g.addEventListener('change', () => {
      const v = Math.round(+g.value);
      if (!(v > 0)) { g.value = st.sets[i] ? st.sets[i].goal : st.start; return; }
      data.updateExercise(ex, { goals: { ...(ex.goals || {}), [i]: { goal: v, date: today } } });
    });
    return g;
  };

  const rowEl = (row, i) => {
    let inputs, values, ready;
    if (cardio) {
      const a = numberInput(row.minutes, { 'aria-label': `Set ${row.n} minutes`, placeholder: 'min' });
      const b = numberInput(row.miles, { 'aria-label': `Set ${row.n} miles (optional)`, placeholder: 'mi' });
      inputs = [a, b];
      values = () => ({ minutes: num(a.value), miles: num(b.value) });
      ready = (v) => v.minutes > 0 || 'Enter minutes first';
    } else if (sides) {
      const w = numberInput(row.weight, { 'aria-label': `Set ${row.n} weight in pounds`, placeholder: 'lb' });
      const r = numberInput(row.repsR, { 'aria-label': `Set ${row.n} right reps`, placeholder: 'R', inputmode: 'numeric', step: '1' });
      const l = numberInput(row.repsL, { 'aria-label': `Set ${row.n} left reps`, placeholder: 'L', inputmode: 'numeric', step: '1' });
      inputs = [w, r, l, goalBox(i)];
      values = () => {
        const R = num(r.value), L = num(l.value);
        return { weight: num(w.value), repsR: R, repsL: L, reps: R != null && L != null ? Math.min(R, L) : null };
      };
      ready = (v) => (v.repsR > 0 && v.repsL > 0) || 'Enter right and left reps first';
    } else {
      const w = numberInput(row.weight, { 'aria-label': `Set ${row.n} weight in pounds`, placeholder: 'lb' });
      const r = numberInput(row.reps, { 'aria-label': `Set ${row.n} reps`, placeholder: 'reps', inputmode: 'numeric', step: '1' });
      inputs = [w, r, goalBox(i)];
      values = () => ({ weight: num(w.value), reps: num(r.value) });
      ready = (v) => v.reps > 0 || 'Enter reps first';
    }
    for (const el of inputs) if (!el.classList.contains('goal-in')) el.addEventListener('change', () => commit(row, values()));
    const toggle = async () => {
      const v = values();
      if (row.done) { await commit(row, { ...v, done: false, doneAt: null }); return; }
      const ok = ready(v);
      if (ok !== true) { toast(ok); return; }
      const before = data.skillInfo(iso());
      await commit(row, { ...v, done: true, doneAt: new Date().toISOString() });
      quake();
      if (data.settings().voiceCheers) cheer();
      startRest(data.settings().restSeconds || 90);
      // XP per skill for this set (like RuneScape's XP drops), plus any skill level-ups
      const after = data.skillInfo(iso());
      const gains = after.list.map((s, i) => ({ s, d: s.xp - before.list[i].xp, up: s.level > before.list[i].level })).filter((g) => g.d > 0);
      const ups = gains.filter((g) => g.up).map((g) => `${g.s.name} level ${g.s.level}!`);
      if (gains.length) toast([...gains.map((g) => `+${fmt(g.d, 0)} ${g.s.name} XP`), ...ups].join(' · '));
    };
    const del = row.virtual ? h('span') : h('button', { type: 'button', class: 'icon-btn', 'aria-label': `Remove set ${row.n}`, onClick: () => data.removeSet(row.id) }, '×');
    return h('div', { class: 'set-wrap' },
      h('div', { class: `set-row${sides ? ' sides' : cardio ? '' : ' g3'}${row.done ? ' done' : ''}` },
        light(row.done, toggle, row.done ? `Set ${row.n} done. Tap to undo` : `Mark set ${row.n} done`), inputs, del),
      cardio ? null : h('div', { class: 'set-meta' }, setMeta(ex, st, i)));
  };

  const addSet = async () => {
    const lastRow = rows[rows.length - 1] || {};
    const n = (lastRow.n || 0) + 1;
    const vals = { n, weight: lastRow.weight ?? null, reps: lastRow.reps ?? null, repsR: lastRow.repsR ?? null, repsL: lastRow.repsL ?? null, minutes: lastRow.minutes ?? null, miles: lastRow.miles ?? null, done: false };
    if (isVirtual) await ensureMade();
    await data.addSet(ex.id, today, dayType, vals);
  };

  const heads = cardio ? ['Minutes', 'Miles'] : sides ? ['Weight (lb)', 'Right', 'Left', 'Goal'] : ['Weight (lb)', 'Reps', 'Goal'];
  return card(
    h('div', { class: 'row' },
      h('h2', { class: 'card-title grow' }, ex.name),
      h('button', { type: 'button', class: 'btn ghost', 'aria-label': `Edit ${ex.name}`, onClick: () => exerciseMenu(ex, dayType) }, 'Edit')),
    notesBox(ex),
    lastWorkout(ex, st),
    !cardio && st.ready ? h('div', { class: 'banner' }, `Every set hit ${st.top} reps ${st.needed} sessions in a row. Go up in weight; goals reset to ${st.start}.`) : null,
    h('div', { class: `set-row head${sides ? ' sides' : cardio ? '' : ' g3'}`, 'aria-hidden': 'true' }, h('span'), heads.map((t) => h('span', null, t)), h('span')),
    rows.map(rowEl),
    button('+ Add set', addSet, 'block'));
}

// Shake the whole screen like an earthquake when a set is completed.
function quake() {
  const app = document.getElementById('app');
  if (navigator.vibrate) navigator.vibrate([60, 40, 90]); // Android only; iPhone browsers can't vibrate
  if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
  app.classList.remove('quake');
  void app.offsetWidth; // restart the animation
  app.classList.add('quake');
  setTimeout(() => app.classList.remove('quake'), 700);
}

function exerciseMenu(ex, dayType) {
  const name = h('input', { type: 'text', value: ex.name });
  const notes = h('textarea', { rows: '3', placeholder: 'Setup, form cues, machine settings…' });
  notes.value = ex.notes || '';
  const group = h('input', { type: 'text', value: ex.group || '', placeholder: 'e.g. Chest', list: 'groups' });
  const groups = h('datalist', { id: 'groups' }, ['Chest', 'Shoulders', 'Triceps', 'Biceps', 'Back', 'Legs', 'Forearms', 'Core'].map((g) => h('option', { value: g })));
  const rs = numberInput(ex.repStart ?? 10, { inputmode: 'numeric', step: '1', min: '1' });
  const rt = numberInput(ex.repTop ?? 12, { inputmode: 'numeric', step: '1', min: '1' });
  const sides = h('input', { type: 'checkbox', class: 'check', checked: !!ex.sides });
  const current = data.liftFor(ex) || '';
  const std = h('select', null, h('option', { value: '' }, 'None'),
    Object.entries(LIFTS).map(([k, l]) => h('option', { value: k, selected: k === current }, l.label)));
  const strength = ex.type !== 'cardio';
  const body = h('div', { class: 'stack' }, field('Name', name), field('Notes', notes), field('Muscle group', group), groups,
    strength ? h('div', { class: 'grid2' }, field('Rep goal starts at', rs), field('Rep goal tops out at', rt)) : null,
    strength ? h('label', { class: 'check-row' }, sides, h('span', null, 'Count left and right reps separately')) : null,
    strength ? field('Strength level based on', std) : null);
  const s = sheet(ex.name, body, [
    button('Save', async () => {
      if (!name.value.trim()) { toast('Enter a name'); return; }
      const start = Math.max(1, Math.round(+rs.value || 10));
      const patch = { name: name.value.trim(), notes: notes.value.trim(), group: group.value.trim() || null };
      if (strength) Object.assign(patch, { repStart: start, repTop: Math.max(start, Math.round(+rt.value || start)), sides: sides.checked, standard: std.value || 'none' });
      await data.updateExercise(ex, patch);
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

// Exercises grouped by muscle group; variations show as one card with a picker.
function dayBlocks(exs, dayType, today, root) {
  const order = [];
  const byGroup = new Map();
  for (const ex of exs) {
    const g = ex.group || '';
    if (!byGroup.has(g)) { byGroup.set(g, []); order.push(g); }
    byGroup.get(g).push(ex);
  }
  for (const g of order) {
    if (g && order.length > 1) root.append(h('h3', { class: 'group-head' }, g));
    const seen = new Set();
    for (const ex of byGroup.get(g)) {
      const key = ex.variant && ex.variant.key;
      if (!key) { root.append(exerciseCard(ex, dayType, today)); continue; }
      if (seen.has(key)) continue;
      seen.add(key);
      const options = exs.filter((e) => e.variant && e.variant.key === key).sort((a, b) => a.variant.n - b.variant.n);
      if (options.length === 1) { root.append(exerciseCard(options[0], dayType, today)); continue; }
      const pick = data.varPick(key, today);
      const chosen = options.find((e) => e.variant.n === pick) || options[0];
      const recent = options.map((e) => ({ e, d: data.lastDone(e.id, today) })).filter((x) => x.d).sort((a, b) => (a.d < b.d ? 1 : -1))[0];
      root.append(h('div', { class: 'stack tight var-pick' },
        h('div', { class: 'sub' }, recent ? `Most recent variation: ${recent.e.variant.n}` : 'No variation done yet'),
        segmented(options.map((e) => [e.variant.n, `Var ${e.variant.n}: ${e.name}`]), chosen.variant.n, (n) => data.setVarPick(key, today, n))));
      root.append(exerciseCard(chosen, dayType, today));
    }
  }
}

export function renderTrain(root, ctx) {
  const { go } = ctx;
  // #train/YYYY-MM-DD logs a past day; otherwise today.
  const past = /^\d{4}-\d{2}-\d{2}$/.test(ctx.sub || '') && ctx.sub < ctx.today;
  const today = past ? ctx.sub : ctx.today;
  const c = data.checkin(today);
  const dayType = c && c.type === 'exercise' ? c.dayType : null;
  if (!dayType) {
    root.append(header('Workout', nice(today)),
      card(h('h2', { class: 'card-title' }, past ? 'Pick the workout for this day' : "Pick today's workout"),
        h('div', { class: 'stack' }, data.DAY_TYPES.map((d) => button(d.later ? `${d.id} (coming later)` : d.id,
          () => data.setCheckin(today, 'exercise', d.id), d.later ? 'block' : 'primary block', { disabled: d.later })))));
    return;
  }
  const last = data.lastDayOfType(dayType, today);
  root.append(header(`${dayType} day`, (past ? `${nice(today)} · ` : '') + (last ? `Last ${dayType} day: ${nice(last)} (${ago(last, today)})` : `First ${dayType} day`),
    button('Change', () => pickDayType(today, go), 'ghost')));
  const exs = data.exercisesFor(dayType);
  if (!exs.length) root.append(empty(`No exercises saved for ${dayType} day yet. Add the ones you do and they'll be here every time.`));
  dayBlocks(exs, dayType, today, root);
  root.append(button('+ Add exercise', () => addExerciseSheet(dayType), 'block'));
}
