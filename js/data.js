// The app's data layer: reads and writes records and applies the logic modules.
// Screens call these functions and never touch storage directly.
import * as store from './core/store.js';
import { qualifyingDates, currentStreak, bestStreak, streakStart } from './logic/streak.js';
import { sessions, evaluateSets, working } from './logic/progression.js';
import { bestSeries, gainPct, averageGain } from './logic/stats.js';
import { totals, macrosFor, amountLabel } from './logic/nutrition.js';
import { sameFood } from './logic/foods.js';
import { totalXP, progress as levelProgress } from './logic/levels.js';
import { workoutDates, gearStatus } from './logic/gear.js';
import { dailyTargets, workoutMinutes, workoutCalories, intakeCheck } from './logic/targets.js';
import { seedRecords } from './seed.js';
import { skillLevels, combatNeeds } from './logic/skills.js';
import { LIFTS, guessLift, bestOneRepMax, levelOf } from './logic/standards.js';
import { addDays, parse, iso } from './logic/dates.js';

export const DAY_TYPES = [
  { id: 'Push' }, { id: 'Pull' }, { id: 'Legs' }, { id: 'Back' },
];

const byDate = (a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0);
const byCreated = (a, b) => ((a.created || '') < (b.created || '') ? -1 : 1);
const now = () => new Date().toISOString();

// ---- settings ----
const DEFAULTS = { targets: { cal: null, p: null, c: null, f: null }, sessionsToAdvance: 4, standards: 'men', levelTheme: 'parchment', voiceCheers: true, restSeconds: 90, profile: {} };
export function settings() {
  const s = store.get('settings') || {};
  return { ...DEFAULTS, ...s, targets: { ...DEFAULTS.targets, ...(s.targets || {}) } };
}
export const setLevelTheme = (theme) => saveSettings({ ...settings(), levelTheme: theme });
export function saveSettings(s) { const { id, ...rest } = s; return store.put('settings', 'settings', rest); }

// ---- check-ins and streak ----
export const checkin = (date) => store.get('checkin:' + date);
export const setCheckin = (date, type, dayType = null) => store.put('checkin', 'checkin:' + date, { date, type, dayType });
export const clearCheckin = (date) => store.remove('checkin:' + date);

export function streakInfo(today) {
  const dates = qualifyingDates(store.all('checkin'), store.all('set'));
  return { current: currentStreak(dates, today), best: bestStreak(dates), start: streakStart(dates, today), dates };
}
// What each day looked like: workout (with its day type), rest, off, missed, today (not yet), or future.
export function dayStatus(date, today) {
  if (date > today) return { kind: 'future' };
  const c = checkin(date);
  if (c && (c.type === 'rest' || c.type === 'off')) return { kind: c.type };
  const done = allSets().filter((s) => s.date === date && s.done && s.dayType !== 'Forearms');
  if (done.length) return { kind: 'workout', dayType: (c && c.dayType) || done[0].dayType };
  return { kind: date === today ? 'today' : 'missed' };
}
// This week, Sunday to Saturday (same layout as the calendar).
export const weekDays = (today) => { const start = addDays(today, -parse(today).getDay()); return Array.from({ length: 7 }, (_, i) => addDays(start, i)); };

// ---- level and XP ----
export function levelInfo(today) {
  const { total, parts } = totalXP(allSets(), streakInfo(today).dates, exercises());
  return { ...levelProgress(total), parts };
}
export const levelSeen = () => (store.get('levelseen') || {}).level || 0;
export const setLevelSeen = (level) => store.put('levelseen', 'levelseen', { level });

// ---- progress messages ----
// ---- gear tiers ----
export const gearInfo = (today) => gearStatus(workoutDates(allSets()), today);
export const tierShown = (id) => !!store.get(`tier:${id}`);
export const markTier = (id) => store.put('tier', `tier:${id}`, { id });

// ---- strength levels ----
export const liftFor = (ex) => (ex.standard === 'none' ? null : ex.standard || guessLift(ex.name));
export const setStandard = (ex, lift) => store.update(ex.id, { standard: lift || 'none' });
export function strengthLevels() {
  const bw = (weighins().pop() || {}).lb || null;
  const sex = settings().standards;
  const out = [];
  for (const ex of exercises()) {
    const lift = liftFor(ex);
    if (!lift || !LIFTS[lift]) continue;
    const rm = bestOneRepMax(setsFor(ex.id));
    out.push({ exercise: ex, lift, group: LIFTS[lift].group, oneRM: rm, result: levelOf(lift, rm, bw, sex) });
  }
  return { bodyweight: bw, sex, items: out };
}

export const milestoneShown = (start, n) => !!store.get(`milestone:${start}:${n}`);
export const markMilestone = (start, n) => store.put('milestone', `milestone:${start}:${n}`, { start, n });

// ---- weigh-ins ----
export const weighin = (date) => store.get('weigh:' + date);
export const setWeighin = (date, lb) => store.put('weighin', 'weigh:' + date, { date, lb });
export const removeWeighin = (date) => store.remove('weigh:' + date);
export const weighins = () => store.all('weighin').sort(byDate);

// ---- exercises and sets ----
export const exercises = () => store.all('exercise').sort(byCreated);
export const exercise = (id) => store.get(id);
export const exercisesFor = (dt) => exercises().filter((e) => (e.dayTypes || []).includes(dt));

export function addExercise(name, type, dayType) {
  return store.put('exercise', store.newId('ex'), { name: name.trim(), type, dayTypes: [dayType], created: now() });
}
export function addExerciseToDay(ex, dayType) {
  return store.update(ex.id, { dayTypes: [...new Set([...(ex.dayTypes || []), dayType])] });
}
export function removeExerciseFromDay(ex, dayType) {
  return store.update(ex.id, { dayTypes: (ex.dayTypes || []).filter((d) => d !== dayType) });
}
export const renameExercise = (ex, name) => store.update(ex.id, { name: name.trim() });

export const allSets = () => store.all('set');
export const setsFor = (exId) => allSets().filter((s) => s.exerciseId === exId);
export const setsOn = (date) => allSets().filter((s) => s.date === date);
export const todaysSets = (exId, date) => setsFor(exId).filter((s) => s.date === date).sort((a, b) => a.n - b.n);

export function addSet(exId, date, dayType, values) {
  return store.put('set', store.newId('set'), { exerciseId: exId, date, dayType, done: false, doneAt: null, ...values });
}
export const updateSet = (id, patch) => store.update(id, patch);
export const removeSet = (id) => store.remove(id);
// Forearms: finished early (without the optional 4th set), or rested for the day.
export const exComplete = (exId, date) => !!store.get(`excomplete:${exId}:${date}`);
export const setExComplete = (exId, date, on) => (on ? store.put('excomplete', `excomplete:${exId}:${date}`, { exId, date }) : store.remove(`excomplete:${exId}:${date}`));
// Forearm sets done that day (they show as a pickaxe on the calendar).
export const forearmDay = (date) => allSets().some((s) => s.date === date && s.done && s.dayType === 'Forearms');
export const forearmRest = (date) => !!store.get('farest:' + date);
export const setForearmRest = (date, on) => (on ? store.put('farest', 'farest:' + date, { date }) : store.remove('farest:' + date));
// Everything logged for a day's workout and check-in (food and weigh-in are kept).
export const daySets = (date) => allSets().filter((s) => s.date === date);
export async function clearDay(date) {
  for (const s of daySets(date)) await store.remove(s.id);
  if (checkin(date)) await clearCheckin(date);
}

// Per-set goals from your sessions before `today` (and your starting numbers, if any).
export function exerciseStatus(ex, today) {
  const sess = sessions(setsFor(ex.id)).filter((s) => s.date < today);
  const ev = evaluateSets(ex, sess, settings().sessionsToAdvance);
  const last = sess[sess.length - 1] || null;
  return { ...ev, last, lastWorking: last ? working(last) : null };
}
export const updateExercise = (ex, patch) => store.update(ex.id, patch);
// Latest day (up to `upTo`) with a finished set of this exercise, or null.
export const lastDone = (exId, upTo) => setsFor(exId).filter((s) => s.done && s.date <= upTo).reduce((a, s) => (!a || s.date > a ? s.date : a), null);

// ---- variations: alternate week to week, you pick which one this week ----
const weekKey = (date) => { const d = parse(date); d.setDate(d.getDate() - ((d.getDay() + 6) % 7)); return iso(d); };
export function varPick(key, date) {
  const wk = weekKey(date);
  const mine = store.get(`varpick:${key}:${wk}`);
  if (mine) return mine.n;
  const earlier = store.all('varpick').filter((r) => r.key === key && r.week < wk).sort((a, b) => (a.week < b.week ? 1 : -1))[0];
  return earlier ? (earlier.n === 1 ? 2 : 1) : 1;
}
export const setVarPick = (key, date, n) => { const wk = weekKey(date); return store.put('varpick', `varpick:${key}:${wk}`, { key, week: wk, n }); };

// ---- your routine (loaded once) ----
export async function ensureRoutine() {
  if (store.get('seed:routine-v1')) return false;
  for (const r of seedRecords()) if (!store.get(r.id)) await store.put('exercise', r.id, r.data);
  await store.put('seed', 'seed:routine-v1', { at: new Date().toISOString() });
  return true;
}

// ---- calories burned and intake check ----
export function bodyweight() {
  return (weighins().pop() || {}).lb || +settings().profile.weightLb || null;
}
export function burned(date) {
  const done = setsOn(date).filter((s) => s.done && s.doneAt);
  const minutes = workoutMinutes(done.map((s) => s.doneAt), settings().restSeconds);
  return { minutes, kcal: workoutCalories(minutes, bodyweight()) };
}
export function intakeNotes(date) {
  const trained = setsOn(date).some((s) => s.done);
  return intakeCheck({ eaten: dayTotals(date), targets: settings().targets, burned: burned(date).kcal, trained, weightLb: bodyweight() });
}
export const calculateTargets = (profile) => dailyTargets({ ...profile, weightLb: +profile.weightLb || bodyweight() });

export function lastDayOfType(dt, today) {
  const ds = allSets().filter((s) => s.done && s.dayType === dt && s.date < today).map((s) => s.date);
  return ds.sort().pop() || null;
}

export function exerciseProgress(ex) {
  const series = bestSeries(sessions(setsFor(ex.id)));
  return { series, gain: gainPct(series) };
}

export function overallGain() {
  return averageGain(exercises().filter((e) => e.type !== 'cardio').map((e) => exerciseProgress(e).gain));
}

// Workout days, newest first: [{date, dayTypes, items:[{exercise, sets}]}]
export function workoutDays() {
  const by = new Map();
  for (const s of allSets()) {
    if (!s.done) continue;
    if (!by.has(s.date)) by.set(s.date, []);
    by.get(s.date).push(s);
  }
  return [...by.entries()].sort((a, b) => (a[0] < b[0] ? 1 : -1)).map(([date, ss]) => {
    const groups = new Map();
    for (const s of ss.sort((a, b) => a.n - b.n)) {
      if (!groups.has(s.exerciseId)) groups.set(s.exerciseId, []);
      groups.get(s.exerciseId).push(s);
    }
    return {
      date,
      dayTypes: [...new Set(ss.map((s) => s.dayType).filter(Boolean))],
      items: [...groups.entries()].map(([id, sets]) => ({ exercise: store.get(id) || { name: 'Deleted exercise' }, sets })),
    };
  });
}

// ---- food ----
export const savedFoods = () => store.all('food').sort((a, b) => (b.uses || 0) - (a.uses || 0) || a.name.localeCompare(b.name));
export const findSaved = (food) => store.all('food').find((f) => sameFood(f, food)) || null;

const FOOD_FIELDS = ['name', 'brand', 'source', 'barcode', 'baseGrams', 'baseLabel', 'cal', 'p', 'c', 'f', 'servingLabel', 'servingGrams'];
const pick = (o) => Object.fromEntries(FOOD_FIELDS.map((k) => [k, o[k] ?? null]));

export function saveFood(food) {
  const existing = findSaved(food);
  if (existing) return existing;
  return store.put('food', store.newId('food'), { ...pick(food), uses: 0 });
}
export const unsaveFood = (id) => store.remove(id);
export function saveCustomFood({ name, servingLabel, cal, p, c, f }) {
  return store.put('food', store.newId('food'), {
    name: name.trim(), brand: '', source: 'custom', barcode: null,
    baseGrams: null, baseLabel: servingLabel.trim() || '1 serving',
    cal: +cal || 0, p: +p || 0, c: +c || 0, f: +f || 0, servingLabel: null, servingGrams: null, uses: 0,
  });
}

export const foodLogs = (date) => store.all('foodlog').filter((l) => l.date === date).sort((a, b) => ((a.at || '') < (b.at || '') ? -1 : 1));
export const dayTotals = (date) => totals(foodLogs(date));
export const totalsOf = (logs) => totals(logs);

export const MEALS = [['breakfast', 'Breakfast'], ['lunch', 'Lunch'], ['dinner', 'Dinner'], ['snacks', 'Snacks']];
// Default meal from the time of day.
export function mealNow(d = new Date()) {
  const h = d.getHours() + d.getMinutes() / 60;
  return h < 10.5 ? 'breakfast' : h < 15 ? 'lunch' : h < 20.5 ? 'dinner' : 'snacks';
}
export const mealOf = (log) => log.meal || mealNow(new Date(log.at || Date.now()));

export async function updateLog(log, { amount, meal }) {
  const k = log.amount ? amount / log.amount : 1;
  const r1 = (n) => Math.round(n * 10) / 10;
  const label = log.amountLabel.replace(/^[\d.]+/, String(amount));
  return store.update(log.id, { amount, meal, amountLabel: label, cal: Math.round(log.cal * k), p: r1(log.p * k), c: r1(log.c * k), f: r1(log.f * k) });
}

export async function logFood(date, food, amount, unit, meal = mealNow()) {
  const m = macrosFor(food, amount, unit);
  const saved = food.id && store.get(food.id) ? food : findSaved(food);
  if (saved) await store.update(saved.id, { uses: (saved.uses || 0) + 1, lastAmount: +amount, lastUnit: unit });
  return store.put('foodlog', store.newId('log'), {
    date, at: now(), name: food.name, brand: food.brand || '', foodId: saved ? saved.id : null,
    amount: +amount, unit, meal, amountLabel: amountLabel(food, amount, unit), ...m,
  });
}
export const removeLog = (id) => store.remove(id);

// ---- supplements (list lives in settings; one check-in record per day) ----
export const supplements = () => settings().supplements || [];
export const setSupplements = (list) => saveSettings({ ...settings(), supplements: list });
export const suppTaken = (date) => (store.get('supp:' + date) || {}).taken || [];
export function toggleSupp(date, id) {
  const t = suppTaken(date);
  return store.put('supp', 'supp:' + date, { date, taken: t.includes(id) ? t.filter((x) => x !== id) : [...t, id] });
}
// Each day counts as the share of your current supplements you took (all = 1).
export function suppDays(asOf = '9999', keep = () => true) {
  const ids = new Set(supplements().map((s) => s.id));
  if (!ids.size) return 0;
  return store.all('supp').filter((r) => r.date <= asOf && keep(r.date)).reduce((a, r) => a + (r.taken || []).filter((x) => ids.has(x)).length / ids.size, 0);
}

// ---- weekly recap (Monday to Sunday) ----
export const weekStart = (date) => { const d = parse(date); return addDays(date, -((d.getDay() + 6) % 7)); };
export function weekRecap(start, today) {
  const end = addDays(start, 6);
  const inWeek = (d) => d >= start && d <= end;
  const sets = allSets().filter((s) => s.done && inWeek(s.date));
  const days = new Set(sets.map((s) => s.date));
  const lifted = sets.reduce((a, s) => a + (+s.weight || 0) * (s.repsR != null || s.repsL != null ? (+s.repsR || 0) + (+s.repsL || 0) : +s.reps || 0), 0);
  const before = skillInfo(today, addDays(start, -1)), after = skillInfo(today, end < today ? end : today);
  const gained = after.list.map((sk, i) => ({ name: sk.name, n: sk.level - before.list[i].level })).filter((g) => g.n > 0);
  const food = foodDays().filter((d) => inWeek(d.date));
  const avg = (k) => (food.length ? food.reduce((a, d) => a + d.totals[k], 0) / food.length : null);
  const ws = weighins().filter((w) => inWeek(w.date));
  const streakDays = [...streakInfo(today).dates].filter(inWeek).length;
  return {
    start, end, workouts: days.size, sets: sets.length, lifted: Math.round(lifted), gained,
    combatFrom: before.combat, combatTo: after.combat, streakDays,
    foodDays: food.length, avgCal: avg('cal'), avgProtein: avg('p'), targets: settings().targets,
    weightChange: ws.length >= 2 ? ws[ws.length - 1].lb - ws[0].lb : null,
  };
}
// Every finished week with anything logged, newest first.
export function weekRecaps(today) {
  const dates = [...allSets().filter((s) => s.done).map((s) => s.date), ...foodDays().map((d) => d.date), ...weighins().map((w) => w.date)];
  const thisWeek = weekStart(today);
  const starts = [...new Set(dates.map(weekStart))].filter((w) => w < thisWeek).sort().reverse();
  return starts.map((w) => weekRecap(w, today));
}

// ---- skills and combat level ----
// ---- characters: each one levels only from the days it was the active one ----
// { id, kind: 'monster' | 'knight', monster, name, periods: [[from, to|null]] }
// Before any character is saved, the first one covers all of your history.
export function characters() {
  const st = settings();
  if (st.characters && st.characters.length) return st.characters;
  return [{ id: 'c1', kind: st.avatar === 'knight' ? 'knight' : 'monster', monster: st.monster || 'sandqueen', name: '', periods: [['', null]] }];
}
export const activeChar = () => { const cs = characters(); return cs.find((c) => c.id === settings().activeChar) || cs[0]; };
const inPeriods = (c, d) => c.periods.some(([a, b]) => d >= a && (b == null || d <= b));
const saveChars = (list, activeId) => saveSettings({ ...settings(), characters: list, activeChar: activeId });
export const renameChar = (id, name) => { const cs = characters(); return saveChars(cs.map((c) => (c.id === id ? { ...c, name } : c)), activeChar().id); };
// Pause the current character (its last day is yesterday) and start or resume another from today.
function pauseAndStart(cs, today, next) {
  const cur = activeChar();
  const y = addDays(today, -1);
  const paused = cs.map((c) => (c.id === cur.id ? { ...c, periods: c.periods.map(([a, b]) => [a, b == null ? y : b]) } : c));
  return paused.map((c) => (c.id === next.id ? next : c)).concat(paused.some((c) => c.id === next.id) ? [] : [next]);
}
export async function newCharacter({ kind, monster, name }, today) {
  const id = 'c' + Date.now().toString(36);
  const next = { id, kind, monster, name, periods: [[today, null]] };
  await saveChars(pauseAndStart(characters(), today, next), id);
  await store.put('combatseen', 'combatseen:' + id, { level: 3 });
}
export async function switchCharacter(id, today) {
  const cs = characters();
  const c = cs.find((x) => x.id === id);
  if (!c || c.id === activeChar().id) return;
  await saveChars(pauseAndStart(cs, today, { ...c, periods: [...c.periods, [today, null]] }), id);
}

function skillInput(today, asOf = today, char = activeChar()) {
  const target = +settings().targets.p || 0;
  const keep = (d) => d <= asOf && inPeriods(char, d);
  return {
    sets: allSets().filter((s) => keep(s.date)), exercises: exercises(),
    streakDays: new Set([...streakInfo(today).dates].filter(keep)),
    proteinDays: target ? foodDays().filter((d) => keep(d.date) && d.totals.p >= target).length : 0,
    suppDays: suppDays(asOf, keep),
  };
}
export const skillInfo = (today, asOf = today, char) => skillLevels(skillInput(today, asOf, char));

// Combat level card: progress since the current combat level was reached, and what's still needed.
export function combatInfo(today) {
  const now = skillInfo(today);
  const dates = [...new Set([
    ...allSets().filter((s) => s.done).map((s) => s.date),
    ...streakInfo(today).dates, ...foodDays().map((d) => d.date), ...store.all('supp').map((r) => r.date),
  ])].filter((d) => d <= today).sort();
  // first day the current combat level was reached (combat level never goes down)
  let lo = 0, hi = dates.length - 1, reached = null;
  while (lo <= hi) {
    const mid = (lo + hi) >> 1;
    if (skillInfo(today, dates[mid]).combat >= now.combat) { reached = dates[mid]; hi = mid - 1; } else lo = mid + 1;
  }
  const then = reached ? skillInfo(today, reached) : now;
  const done = now.list.filter((s) => s.combat && s.level > then.levels[s.id]).map((s) => ({ id: s.id, name: s.name, gained: s.level - then.levels[s.id] }));
  return { ...now, reached, done, needs: combatNeeds(now.levels) };
}
const seenKey = () => (activeChar().id === 'c1' ? 'combatseen' : 'combatseen:' + activeChar().id);
export const combatSeen = () => (store.get(seenKey()) || {}).level || 0;
export const setCombatSeen = (level) => store.put('combatseen', seenKey(), { level });

// Food days, newest first: [{date, totals}]
export function foodDays() {
  const dates = [...new Set(store.all('foodlog').map((l) => l.date))].sort().reverse();
  return dates.map((date) => ({ date, totals: dayTotals(date) }));
}

// ---- export ----
export function exportRows() {
  const exName = (id) => (store.get(id) || {}).name || '';
  return {
    workouts: allSets().filter((s) => s.done).sort(byDate).map((s) => ({ ...s, exercise: exName(s.exerciseId), reps: s.reps ?? '' })),
    food: store.all('foodlog').sort(byDate).map((l) => ({ ...l, meal: mealOf(l) })),
    weighins: weighins(),
    checkins: store.all('checkin').sort(byDate),
  };
}
