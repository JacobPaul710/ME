import { h, fmt, svg } from './dom.js';
import { skillUp } from '../celebrations.js';
import { ICONS } from './character.js';
import { button, card, header, light, checkbox, sheet, field, numberInput, toast, segmented, empty, confirmSheet } from './components.js';
import { pickDayType } from './today.js';
import { nice, ago, iso, parse, addDays } from '../logic/dates.js';
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
  return h('div', { class: 'last-workout' }, 'No previous workout yet');
}
const dayDate = (d) => parse(d).toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' });

// Under each set: how many more workouts at this goal before the goal goes up a rep
// (counting today once the set is done at or above its goal).
function setMeta(ex, st, i, row) {
  const s = st.sets[i];
  const goal = s ? s.goal : st.start;
  let hits = Math.min(st.needed, s ? s.hits : 0); // never more than 4 of 4
  const reps = row && row.done ? (row.repsR != null || row.repsL != null ? Math.min(+row.repsR || 0, +row.repsL || 0) : +row.reps || 0) : null;
  const hitToday = reps != null && reps >= goal;
  if (hitToday) hits = Math.min(st.needed, hits + 1);
  if (goal >= st.top && hits >= st.needed) return `${hitToday ? '✓ Goal hit · ' : ''}Top of the range: ready to go up in weight`;
  if (hitToday && hits >= st.needed) return `✓ Goal hit · goal goes up to ${goal + 1} next workout`;
  return `${hitToday ? '✓ Goal hit · ' : ''}${hits} of ${st.needed} workouts until rep increase`;
}

// Notes: separate cards under the exercise name. "+ Add" starts a new one; tap a card to edit it.
const noteItems = (ex) => ex.noteItems || (ex.notes ? [{ id: 'n0', text: ex.notes }] : []);
const saveNotes = (ex, items) => data.updateExercise(ex, { noteItems: items, notes: items.map((n) => n.text).join('\n') });

function noteEditor(ex, item, items) {
  const t = h('textarea', { class: 'ex-notes-box', rows: '2', 'aria-label': item ? 'Edit note' : 'New note', placeholder: 'Type a note' });
  t.value = item ? item.text : '';
  let done = false;
  const finish = () => {
    if (done) return; done = true;
    const text = t.value.trim();
    if (!item && text) saveNotes(ex, [...items, { id: 'n' + Date.now().toString(36), text }]);
    else if (item && text && text !== item.text) saveNotes(ex, items.map((n) => (n.id === item.id ? { ...n, text } : n)));
    else if (item && !text) saveNotes(ex, items.filter((n) => n.id !== item.id));
    else render();
  };
  let render = () => {};
  t.addEventListener('blur', finish);
  t.addEventListener('keydown', (e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); t.blur(); } });
  return { el: t, onCancel: (fn) => { render = fn; } };
}

function notesBlock(ex) {
  const list = h('div', { class: 'note-list' });
  const draw = (editingId = null, adding = false) => {
    const items = noteItems(ex);
    const kids = items.map((n) => {
      if (n.id === editingId) {
        const ed = noteEditor(ex, n, items); ed.onCancel(() => draw());
        setTimeout(() => ed.el.focus(), 0);
        return ed.el;
      }
      return h('div', { class: 'note-card' },
        h('button', { type: 'button', class: 'note-text', 'aria-label': `Edit note: ${n.text}`, onClick: () => draw(n.id) }, n.text),
        h('button', { type: 'button', class: 'icon-btn', 'aria-label': `Remove note: ${n.text}`, onClick: () => saveNotes(ex, items.filter((x) => x.id !== n.id)) }, '×'));
    });
    if (adding) { const ed = noteEditor(ex, null, items); ed.onCancel(() => draw()); kids.push(ed.el); setTimeout(() => ed.el.focus(), 0); }
    if (!kids.length) kids.push(h('p', { class: 'sub', style: 'margin:0' }, 'No notes yet.'));
    list.replaceChildren(...kids);
  };
  draw();
  return h('div', { class: 'ex-notes-field' },
    h('div', { class: 'row' }, h('span', { class: 'sub grow' }, 'Notes'),
      h('button', { type: 'button', class: 'btn ghost note-add', 'aria-label': `Add a note to ${ex.name}`, onClick: () => draw(null, true) }, '+ Add')),
    list);
}

const opened = new Set(); // finished exercises you tapped open again (this session)

function exerciseCard(ex, dayType, today, { forearm = false, tag = null, due = false } = {}) {
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
      inputs = forearm ? [w, r, l] : [w, r, l, goalBox(i)];
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
      const goal = st.sets[i] ? st.sets[i].goal : st.start;
      const hitGoal = !cardio && !forearm && v.reps != null && v.reps >= goal;
      await commit(row, { ...v, done: true, doneAt: new Date().toISOString() });
      quake();
      if (data.settings().voiceCheers) cheer();
      if (!forearm && today >= iso() && data.settings().restOn) startRest(data.settings().restSeconds || 90); // no timer for forearms or when editing a past day
      // XP per skill for this set (like RuneScape's XP drops), plus any skill level-ups
      const after = data.skillInfo(iso());
      const gains = after.list.map((s, i) => ({ s, d: s.xp - before.list[i].xp, up: s.level > before.list[i].level })).filter((g) => g.d > 0);
      const ups = gains.filter((g) => g.up).map((g) => `${g.s.name} level ${g.s.level}!`);
      for (const g of gains.filter((x) => x.up)) skillUp(g.s.name, g.s.level, svg(ICONS[g.s.id]));
      if (after.combat > before.combat) document.dispatchEvent(new CustomEvent('me:check')); // combat pop-up
      const hits = st.sets[i] ? st.sets[i].hits : 0;
      const goalMsg = hitGoal ? (hits + 1 >= st.needed && goal < st.top ? `Goal hit! ${hits + 1} of ${st.needed}: goal goes up to ${goal + 1} next time.` : `Goal hit! ${Math.min(hits + 1, st.needed)} of ${st.needed} workouts.`) : null;
      const xp = [...gains.map((g) => `+${fmt(g.d, 0)} ${g.s.name} XP`), ...ups].join(' · ');
      if (goalMsg || xp) toast([goalMsg, xp].filter(Boolean).join(' '));
    };
    const del = row.virtual ? h('span') : h('button', { type: 'button', class: 'icon-btn', 'aria-label': `Remove set ${row.n}`, onClick: () => data.removeSet(row.id) }, '×');
    return h('div', { class: 'set-wrap' },
      h('div', { class: `set-row${forearm ? ' g3' : sides ? ' sides' : cardio ? '' : ' g3'}${row.done ? ' done' : ''}` },
        checkbox(row.done, toggle, row.done ? `Set ${row.n} done. Tap to undo` : `Mark set ${row.n} done`), inputs, del),
      forearm ? (row.n === 4 ? h('div', { class: 'set-meta optional' }, 'Optional set · bonus XP') : null)
        : cardio ? null : h('div', { class: `set-meta${row.done && /Goal hit/.test(setMeta(ex, st, i, row)) ? ' hit' : ''}` }, setMeta(ex, st, i, row)));
  };

  const addSet = async () => {
    const lastRow = rows[rows.length - 1] || {};
    const n = (lastRow.n || 0) + 1;
    const vals = { n, weight: lastRow.weight ?? null, reps: lastRow.reps ?? null, repsR: lastRow.repsR ?? null, repsL: lastRow.repsL ?? null, minutes: lastRow.minutes ?? null, miles: lastRow.miles ?? null, done: false };
    if (isVirtual) await ensureMade();
    await data.addSet(ex.id, today, dayType, vals);
  };

  const heads = cardio ? ['Minutes', 'Miles'] : forearm ? ['Weight (lb)', 'Right', 'Left'] : sides ? ['Weight (lb)', 'Right', 'Left', 'Goal'] : ['Weight (lb)', 'Reps', 'Goal'];

  // Finished: every set done (forearms: the 3 required sets plus the optional one, or "Complete").
  const real = !isVirtual;
  const required = forearm ? rows.filter((r) => r.n <= 3) : rows;
  const reqDone = real && required.length > 0 && required.every((r) => r.done);
  const finished = (real && rows.every((r) => r.done)) || (data.exComplete(ex.id, today) && rows.some((r) => r.done));
  const key = `${ex.id}:${today}`;
  if (finished && !opened.has(key)) {
    const n = rows.filter((r) => r.done).length;
    return h('button', { type: 'button', class: 'card ex-done', 'aria-label': `${ex.name} done. Tap to open`, onClick: () => { opened.add(key); document.dispatchEvent(new CustomEvent('me:rerender')); } },
      h('span', { class: 'tick', 'aria-hidden': 'true' }, '✓'),
      h('span', { class: 'grow' }, h('span', { class: 'item-name' }, ex.name), h('span', { class: 'sub block' }, `${n} set${n === 1 ? '' : 's'} done · tap to open`)));
  }
  // "Done" under the last set: finish the exercise after any number of sets.
  const completeBtn = !finished && !cardio
    ? button('Done', async () => {
      opened.delete(key);
      if (!rows.some((r) => r.done)) { toast('Mark at least one set done first'); return; }
      await data.setExComplete(ex.id, today, true);
    }, 'primary block', { 'aria-label': `Done with ${ex.name}` }) : null;
  const el = card(
    tag ? h('div', { class: 'up-next' }, tag) : null,
    h('div', { class: 'row' },
      h('h2', { class: 'card-title grow' }, ex.name),
      h('button', { type: 'button', class: 'btn ghost', 'aria-label': `Edit ${ex.name}`, onClick: () => exerciseMenu(ex, dayType) }, 'Edit')),
    notesBlock(ex),
    lastWorkout(ex, st),
    !cardio && st.ready ? h('div', { class: 'banner' }, `Every set hit ${st.top} reps ${st.needed} sessions in a row. Go up in weight; goals reset to ${st.start}.`) : null,
    h('div', { class: `set-row head${sides ? ' sides' : cardio ? '' : ' g3'}`, 'aria-hidden': 'true' }, h('span'), heads.map((t) => h('span', null, t)), h('span')),
    rows.map(rowEl),
    completeBtn,
    forearm ? null : button('+ Add set', addSet, 'block'),
    finished ? button('Close', () => { opened.delete(key); document.dispatchEvent(new CustomEvent('me:rerender')); }, 'ghost block') : null);
  if (due) el.classList.add('due');
  return el;
}

// Forearms: back curl one day, front curl the next. The one that's due is on top with a glow;
// the one you did last sits underneath. They never count as the day's workout.
const uniqueByName = (list) => [...new Map(list.map((e) => [e.name.trim().toLowerCase(), e])).values()];
function forearmOrder(today) {
  const exs = uniqueByName(data.exercisesFor('Forearms'));
  const last = exs.map((e) => ({ e, d: data.lastDone(e.id, addDays(today, -1)) })).filter((x) => x.d).sort((a, b) => (a.d < b.d ? 1 : -1))[0];
  const ordered = last && exs.length > 1 ? [...exs.filter((e) => e.id !== last.e.id), last.e] : exs;
  return { exs: ordered, last };
}

function forearmsView(root, today, past, go) {
  const { exs, last } = forearmOrder(today);
  const resting = data.forearmRest(today);
  root.append(header('Forearms', (past ? `${nice(today)} · ` : '') + "Doesn't count as a workout day",
    button('Change', () => go(past ? `#train/${today}.pick` : '#train/pick'), 'ghost')));
  root.append(h('div', { class: 'row' },
    h('p', { class: 'sub grow', style: 'margin:0' }, last ? `Last: ${last.e.name}, ${dayDate(last.d)}` : 'Alternate back curl and front curl.'),
    button(resting ? 'Undo rest' : 'Rest today', () => data.setForearmRest(today, !resting), 'ghost')));
  if (resting) { root.append(h('div', { class: 'card ex-done static' }, h('span', { class: 'tick' }, '✓'), h('span', null, 'Resting forearms today'))); return; }
  if (!exs.length) { root.append(empty('No forearm exercises saved yet.')); return; }
  exs.forEach((e, i) => root.append(exerciseCard(e, 'Forearms', today, { forearm: true, tag: i === 0 ? 'Up next' : null, due: i === 0 })));
}

// "Push day done ✓": exercises, weight lifted, XP, rep goals reached, weight increases earned.
function workoutSummary(dayType, exs, today) {
  const sets = data.daySets(today).filter((x) => x.done && x.dayType === dayType);
  const repsOf = (x) => (x.repsR != null || x.repsL != null ? (+x.repsR || 0) + (+x.repsL || 0) : +x.reps || 0);
  const exDone = exs.filter((e) => sets.some((x) => x.exerciseId === e.id));
  const lifted = sets.reduce((a, x) => a + (+x.weight || 0) * repsOf(x), 0);
  const now = data.skillInfo(today), before = data.skillInfo(today, addDays(today, -1));
  const xp = now.list.reduce((a, sk, i) => a + Math.max(0, sk.xp - before.list[i].xp), 0);
  const goals = [], heavier = [];
  for (const e of exDone) {
    const st = data.exerciseStatus(e, today);
    const mine = sets.filter((x) => x.exerciseId === e.id).sort((a, b) => a.n - b.n);
    const hit = mine.filter((x, i) => { const g = st.sets[i] ? st.sets[i].goal : st.start; const r = x.repsR != null || x.repsL != null ? Math.min(+x.repsR || 0, +x.repsL || 0) : +x.reps || 0; return r >= g; }).length;
    if (hit) goals.push(`${e.name}: ${hit} set${hit === 1 ? '' : 's'}`);
    if (data.exerciseStatus(e, addDays(today, 1)).ready) heavier.push(e.name);
  }
  const n = new Set(data.allSetsDone().filter((x) => x.dayType === dayType && x.date <= today).map((x) => x.date)).size;
  const line = (label, value) => h('div', { class: 'recap-line' }, h('span', { class: 'grow' }, label), h('span', { class: 'num' }, value));
  return h('section', { class: 'card workout-done', 'aria-label': `${dayType} day done` },
    h('h2', { class: 'card-title' }, `${dayType} day done ✓`),
    line('Exercises done', String(exDone.length)),
    line('Weight lifted', `${fmt(lifted)} lb`),
    line('XP gained', `+${fmt(xp)}`),
    line('Rep goals reached', goals.length ? goals.join(' · ') : 'None this time'),
    line('Ready to go up in weight', heavier.length ? heavier.join(', ') : 'Not yet'),
    h('p', { class: 'workout-done-msg' }, `${dayType} workout number ${n}. Discipline earns consistency. You're growing.`));
}

// The picker: tapping the Workout tab always lands here.
function pickerView(root, today, past, go, current) {
  const base = past ? `#train/${today}` : '#train';
  const { exs } = forearmOrder(today);
  root.append(header('Workout', nice(today)),
    card(h('h2', { class: 'card-title' }, past ? 'Pick the workout for this day' : "Pick today's workout"),
      h('div', { class: 'stack' }, data.DAY_TYPES.map((d) => button(d.id === current ? `${d.id} ✓` : d.id,
        async () => { if (d.id !== current) await data.setCheckin(today, 'exercise', d.id); go(base); },
        d.id === current ? 'primary block current-pick' : 'primary block')))),
    card(h('h2', { class: 'card-title' }, 'Forearms'),
      h('p', { class: 'sub', style: 'margin:0' }, `${exs.length ? `Up next: ${exs[0].name}. ` : ''}Doesn't count as a workout day.`),
      button('Forearms', () => go(past ? `#train/${today}.forearms` : '#train/forearms'), 'block')));
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
  const group = h('input', { type: 'text', value: ex.group || '', placeholder: 'e.g. Chest', list: 'groups' });
  const groups = h('datalist', { id: 'groups' }, ['Chest', 'Shoulders', 'Triceps', 'Biceps', 'Back', 'Legs', 'Forearms', 'Core'].map((g) => h('option', { value: g })));
  const rs = numberInput(ex.repStart ?? 10, { inputmode: 'numeric', step: '1', min: '1' });
  const rt = numberInput(ex.repTop ?? 12, { inputmode: 'numeric', step: '1', min: '1' });
  const sides = h('input', { type: 'checkbox', class: 'check', checked: !!ex.sides });
  const current = data.liftFor(ex) || '';
  const std = h('select', null, h('option', { value: '' }, 'None'),
    Object.entries(LIFTS).map(([k, l]) => h('option', { value: k, selected: k === current }, l.label)));
  const strength = ex.type !== 'cardio';
  const body = h('div', { class: 'stack' }, field('Name', name), field('Muscle group', group), groups,
    strength ? h('div', { class: 'grid2' }, field('Rep goal starts at', rs), field('Rep goal tops out at', rt)) : null,
    strength ? h('label', { class: 'check-row' }, sides, h('span', null, 'Count left and right reps separately')) : null,
    strength ? field('Strength level based on', std) : null);
  const s = sheet(ex.name, body, [
    button('Save', async () => {
      if (!name.value.trim()) { toast('Enter a name'); return; }
      const start = Math.max(1, Math.round(+rs.value || 10));
      const patch = { name: name.value.trim(), group: group.value.trim() || null };
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
  // #train, #train/pick, #train/forearms; past days: #train/YYYY-MM-DD, …/YYYY-MM-DD.pick, …/YYYY-MM-DD.forearms
  const [d, mode] = String(ctx.sub || '').split('.');
  const isDate = /^\d{4}-\d{2}-\d{2}$/.test(d);
  const past = isDate && d < ctx.today;
  const today = past ? d : ctx.today;
  const view = isDate ? mode || '' : d || '';
  const c = data.checkin(today);
  // an old "Forearms" day pick is treated as no main workout: forearms have their own page
  const dayType = c && c.type === 'exercise' && c.dayType !== 'Forearms' ? c.dayType : null;
  if (view === 'forearms') return forearmsView(root, today, past, go);
  if (view === 'pick' || !dayType) return pickerView(root, today, past, go, dayType);
  const last = data.lastDayOfType(dayType, today);
  root.append(header(`${dayType} day`, (past ? `${nice(today)} · ` : '') + (last ? `Last ${dayType} day: ${nice(last)} (${ago(last, today)})` : `First ${dayType} day`),
    button('Change', () => go(past ? `#train/${today}.pick` : '#train/pick'), 'ghost')));
  const exs = data.exercisesFor(dayType);
  if (!exs.length) root.append(empty(`No exercises saved for ${dayType} day yet. Add the ones you do and they'll be here every time.`));
  dayBlocks(exs, dayType, today, root);
  // Every exercise done: the summary card goes on top.
  if (exs.length && root.querySelectorAll('.ex-done').length >= exs.length) root.querySelector('.page-head')?.after(workoutSummary(dayType, exs, today));
  root.append(button('+ Add exercise', () => addExerciseSheet(dayType), 'block'));
  if (past && data.forearmDay(today)) root.append(button('Forearms for this day', () => go(`#train/${today}.forearms`), 'block'));
}
