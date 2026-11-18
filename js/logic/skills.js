// Skills (1–99) and combat level (3–126), the way Old School RuneScape does it.
//
// Each skill counts one thing the app already tracks. "perWeek" is what a steady week
// looks like; keeping that pace gets a skill to 99 in about 2 years (and combat level
// to 126). XP numbers use the real RuneScape XP table (level 99 = 13,034,431 XP).
//
// Combat level (OSRS formula, Discipline in Prayer's place):
//   floor( ¼ × (Defence + Hitpoints + ⌊Discipline ÷ 2⌋) + 0.325 × (Attack + Strength) )
import { repXP } from './levels.js';
import { sessions, working } from './progression.js';

export const SKILL_MAX = 99;
export const COMBAT_MAX = 126;

export const SKILLS = [
  { id: 'attack', name: 'Attack', how: 'Pull day reps (heavier weight = more XP)', perWeek: 470, combat: true },
  { id: 'strength', name: 'Strength', how: 'Push day reps (heavier weight = more XP)', perWeek: 700, combat: true },
  { id: 'defence', name: 'Defence', how: 'Back day reps (heavier weight = more XP)', perWeek: 180, combat: true },
  { id: 'hitpoints', name: 'Hitpoints', how: 'Reps on Push, Pull, Legs and Back days', perWeek: 1580, combat: true, start: 10 },
  { id: 'discipline', name: 'Discipline', how: 'Days that count toward your streak (counts like Prayer for combat)', perWeek: 7, unit: 'days', combat: true },
  { id: 'agility', name: 'Agility', how: 'Legs day reps (heavier weight = more XP)', perWeek: 225 },
  { id: 'cooking', name: 'Cooking', how: 'Days you hit your protein target', perWeek: 7, unit: 'days' },
  { id: 'stamina', name: 'Stamina', how: 'Sets completed', perWeek: 45, unit: 'sets' },
  { id: 'mastery', name: 'Mastery', how: 'Times you went up in weight on a lift', perWeek: 2, unit: 'weight-ups' },
  { id: 'mining', name: 'Mining', how: 'Forearm reps (the optional 4th set earns 50% more)', perWeek: 950 },
  { id: 'herblore', name: 'Herblore', how: 'Supplements taken (check them off on the Food tab)', perWeek: 7, unit: 'full days' },
];

// RuneScape XP table: XP needed to reach each level.
export const XP_TABLE = (() => {
  const t = [0, 0];
  let pts = 0;
  for (let l = 1; l < SKILL_MAX; l++) { pts += Math.floor(l + 300 * 2 ** (l / 7)); t.push(Math.floor(pts / 4)); }
  return t; // t[L] = XP for level L
})();

export function skillLevelFor(xp) {
  let L = 1;
  while (L < SKILL_MAX && xp >= XP_TABLE[L + 1]) L++;
  return L;
}

// Pace: [level, weeks of steady effort]. Matches combat 10 in ~1.5 weeks, 126 in ~2 years.
const PACE = [[1, 0], [8, 1.5], [24, 5], [43, 12], [59, 26], [71, 44], [78, 58], [86, 74], [94, 92], [99, 104]];
export function xpForWeeks(w) {
  if (w <= 0) return 0;
  let lvl = SKILL_MAX;
  for (let i = 1; i < PACE.length; i++) {
    const [l0, w0] = PACE[i - 1], [l1, w1] = PACE[i];
    if (w <= w1) { lvl = l0 + ((w - w0) / (w1 - w0)) * (l1 - l0); break; }
  }
  if (lvl >= SKILL_MAX) {
    // past the 2-year pace: keep earning at the level-99 rate
    const rate = (XP_TABLE[99] - XP_TABLE[94]) / (104 - 92);
    return Math.round(XP_TABLE[99] + Math.max(0, w - 104) * rate);
  }
  const L = Math.floor(lvl), f = lvl - L;
  return Math.round(XP_TABLE[L] + f * (XP_TABLE[L + 1] - XP_TABLE[L]));
}

const repsOf = (s) => (s.repsR != null || s.repsL != null ? ((+s.repsR || 0) + (+s.repsL || 0)) / 2 : +s.reps || 0);

// Raw counts for each skill.
export function skillCounts({ sets = [], exercises = [], streakDays = new Set(), proteinDays = 0, suppDays = 0 }) {
  const exById = new Map(exercises.map((e) => [e.id, e]));
  const c = { attack: 0, strength: 0, defence: 0, agility: 0, hitpoints: 0, discipline: streakDays.size, cooking: proteinDays, stamina: 0, mastery: 0, mining: 0, herblore: suppDays };
  const done = sets.filter((s) => s.done);
  for (const s of done) {
    const ex = exById.get(s.exerciseId) || {};
    if (ex.type === 'cardio' || s.minutes != null) { c.stamina++; continue; }
    const reps = repsOf(s);
    if (reps <= 0) continue;
    c.stamina++;
    if (s.dayType === 'Forearms' && s.n === 4) c.stamina++; // the optional 4th forearm set: bonus XP
    const xp = reps * repXP(s.weight, ex.repTop);
    if (s.dayType === 'Forearms') { c.mining += s.n === 4 ? xp * 1.5 : xp; continue; } // grip work
    const key = { Pull: 'attack', Push: 'strength', Back: 'defence', Legs: 'agility' }[s.dayType];
    if (key) { c[key] += xp; c.hitpoints += xp; }
  }
  const byEx = new Map();
  for (const s of done) { if (!byEx.has(s.exerciseId)) byEx.set(s.exerciseId, []); byEx.get(s.exerciseId).push(s); }
  for (const [exId, list] of byEx) {
    const ex = exById.get(exId) || {};
    let best = ex.baseline ? Math.max(0, ...(ex.baseline.sets || []).map((b) => +b.weight || 0)) || null : null;
    for (const sess of sessions(list)) {
      const w = working(sess);
      if (!w) continue;
      if (best !== null && w.weight > best) c.mastery++;
      if (best === null || w.weight > best) best = w.weight;
    }
  }
  return c;
}

export function combatExact(lv) {
  return 0.25 * (lv.defence + lv.hitpoints + Math.floor(lv.discipline / 2)) + 0.325 * (lv.attack + lv.strength);
}
export const combatLevel = (lv) => Math.min(COMBAT_MAX, Math.floor(combatExact(lv) + 1e-9));

// Every skill's level and XP, plus combat level.
export function skillLevels(input) {
  const c = skillCounts(input);
  const list = SKILLS.map((s) => {
    let xp = xpForWeeks(c[s.id] / s.perWeek);
    if (s.start) xp += XP_TABLE[s.start]; // Hitpoints starts at level 10 and keeps every XP you earn
    const level = skillLevelFor(xp);
    const max = level >= SKILL_MAX;
    const from = XP_TABLE[level], to = max ? XP_TABLE[SKILL_MAX] : XP_TABLE[level + 1];
    return { ...s, count: c[s.id], xp, level, max, toNext: max ? 0 : to - xp, pct: max ? 100 : ((xp - from) / (to - from)) * 100 };
  });
  const lv = Object.fromEntries(list.map((s) => [s.id, s.level]));
  const exact = combatExact(lv);
  const combat = combatLevel(lv);
  return { list, levels: lv, combat, exact, total: list.reduce((a, s) => a + s.level, 0) };
}

// What it takes to reach the next combat level, any one of these on its own.
export function combatNeeds(lv) {
  const now = combatLevel(lv);
  if (now >= COMBAT_MAX) return [];
  const rem = now + 1 - combatExact(lv) - 1e-9;
  const out = [];
  const add = (ids, names, n) => {
    const room = Math.max(...ids.map((id) => SKILL_MAX - lv[id]));
    if (n <= room) out.push({ ids, names, levels: n });
  };
  add(['attack', 'strength'], 'Attack or Strength', Math.max(1, Math.ceil(rem / 0.325)));
  add(['defence', 'hitpoints'], 'Defence or Hitpoints', Math.max(1, Math.ceil(rem / 0.25)));
  const k = Math.max(1, Math.ceil(rem / 0.25));
  add(['discipline'], 'Discipline', 2 * (Math.floor(lv.discipline / 2) + k) - lv.discipline);
  return out;
}
