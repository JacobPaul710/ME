// The app's data layer: reads and writes records and applies the logic modules.
// Screens call these functions and never touch storage directly.
import * as store from './core/store.js';
import { qualifyingDates, currentStreak, bestStreak, streakStart } from './logic/streak.js';
import { sessions, evaluate, working } from './logic/progression.js';
import { bestSeries, gainPct, averageGain } from './logic/stats.js';
import { totals, macrosFor, amountLabel } from './logic/nutrition.js';
import { sameFood } from './logic/foods.js';
import { totalXP, progress as levelProgress } from './logic/levels.js';
import { workoutDates, currentMessage } from './logic/progress.js';
import { LIFTS, guessLift, bestOneRepMax, levelOf } from './logic/standards.js';
import { addDays } from './logic/dates.js';

export const DAY_TYPES = [
  { id: 'Push' }, { id: 'Pull' }, { id: 'Legs' }, { id: 'Forearms' },
  { id: 'Back', later: true }, // placeholder: switch "later" off to enable
];

const byDate = (a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0);
const byCreated = (a, b) => ((a.created || '') < (b.created || '') ? -1 : 1);
const now = () => new Date().toISOString();

// ---- settings ----
const DEFAULTS = { targets: { cal: null, p: null, c: null, f: null }, sessionsToAdvance: 4, standards: 'men', levelTheme: 'parchment' };
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
  const done = allSets().filter((s) => s.date === date && s.done);
  if (done.length) return { kind: 'workout', dayType: (c && c.dayType) || done[0].dayType };
  return { kind: date === today ? 'today' : 'missed' };
}
export const weekDays = (today) => Array.from({ length: 7 }, (_, i) => addDays(today, i - 6));

// ---- level and XP ----
export function levelInfo(today) {
  const { total, parts } = totalXP(allSets(), streakInfo(today).dates);
  return { ...levelProgress(total), parts };
}
export const levelSeen = () => (store.get('levelseen') || {}).level || 0;
export const setLevelSeen = (level) => store.put('levelseen', 'levelseen', { level });

// ---- progress messages ----
export const progressInfo = (today) => currentMessage(workoutDates(allSets()), today);
export const messageShown = (day) => !!store.get(`progressmsg:${day}`);
export const markMessage = (day) => store.put('progressmsg', `progressmsg:${day}`, { day });

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

export function exerciseStatus(ex, today) {
  const sess = sessions(setsFor(ex.id)).filter((s) => s.date < today);
  const ev = evaluate(sess, settings().sessionsToAdvance);
  const last = sess[sess.length - 1] || null;
  return { ...ev, last, lastWorking: last ? working(last) : null };
}

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
  const label = log.unit === 'g' ? `${amount} g` : log.amountLabel.replace(/^[\d.]+/, String(amount));
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

// Food days, newest first: [{date, totals}]
export function foodDays() {
  const dates = [...new Set(store.all('foodlog').map((l) => l.date))].sort().reverse();
  return dates.map((date) => ({ date, totals: dayTotals(date) }));
}

// ---- export ----
export function exportRows() {
  const exName = (id) => (store.get(id) || {}).name || '';
  return {
    workouts: allSets().filter((s) => s.done).sort(byDate).map((s) => ({ ...s, exercise: exName(s.exerciseId) })),
    food: store.all('foodlog').sort(byDate).map((l) => ({ ...l, meal: mealOf(l) })),
    weighins: weighins(),
    checkins: store.all('checkin').sort(byDate),
  };
}
