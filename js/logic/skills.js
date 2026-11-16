// Ten skills, each on the same 1–126 curve as your overall level. Each skill counts one
// thing the app already tracks. "Per week" is what steady training looks like; keeping
// that pace takes a skill to 126 in about 2 years, like the overall level.
import { cumXP, progress, repXP } from './levels.js';
import { sessions, working } from './progression.js';

export const SKILLS = [
  { id: 'attack', name: 'Attack', how: 'Push day reps (heavier weight = more XP)', perWeek: 600 },
  { id: 'strength', name: 'Strength', how: 'Legs day reps (heavier weight = more XP)', perWeek: 600 },
  { id: 'defence', name: 'Defence', how: 'Pull and Back day reps (heavier weight = more XP)', perWeek: 800 },
  { id: 'agility', name: 'Agility', how: 'Cardio minutes', perWeek: 60, unit: 'min' },
  { id: 'hitpoints', name: 'Hitpoints', how: 'Weigh-ins logged', perWeek: 7, unit: 'weigh-ins' },
  { id: 'discipline', name: 'Discipline', how: 'Days that count toward your streak', perWeek: 7, unit: 'days' },
  { id: 'cooking', name: 'Cooking', how: 'Days you hit your protein target', perWeek: 7, unit: 'days' },
  { id: 'stamina', name: 'Stamina', how: 'Sets completed', perWeek: 45, unit: 'sets' },
  { id: 'mastery', name: 'Mastery', how: 'Times you went up in weight on a lift', perWeek: 2, unit: 'weight-ups' },
  { id: 'herblore', name: 'Herblore', how: 'Supplements taken (check them off on the Food tab)', perWeek: 7, unit: 'full days' },
];

const repsOf = (s) => (s.repsR != null || s.repsL != null ? ((+s.repsR || 0) + (+s.repsL || 0)) / 2 : +s.reps || 0);

// Raw counts for each skill.
// sets, exercises: records. streakDays: Set of dates. weighins: count.
// proteinDays: days at or over the protein target. suppDays: sum over days of (taken / listed).
export function skillCounts({ sets = [], exercises = [], streakDays = new Set(), weighins = 0, proteinDays = 0, suppDays = 0 }) {
  const exById = new Map(exercises.map((e) => [e.id, e]));
  const c = { attack: 0, strength: 0, defence: 0, agility: 0, hitpoints: weighins, discipline: streakDays.size, cooking: proteinDays, stamina: 0, mastery: 0, herblore: suppDays };
  const done = sets.filter((s) => s.done);
  for (const s of done) {
    const ex = exById.get(s.exerciseId) || {};
    if (ex.type === 'cardio' || s.minutes != null) { c.agility += +s.minutes || 0; c.stamina++; continue; }
    const reps = repsOf(s);
    if (reps <= 0) continue;
    c.stamina++;
    const xp = reps * repXP(s.weight, ex.repTop);
    if (s.dayType === 'Push') c.attack += xp;
    else if (s.dayType === 'Legs') c.strength += xp;
    else if (s.dayType === 'Pull' || s.dayType === 'Back') c.defence += xp;
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

// Levels for every skill: counts are turned into "weeks of steady effort" on the shared curve.
export function skillLevels(input) {
  const c = skillCounts(input);
  const list = SKILLS.map((s) => {
    const xp = Math.round(cumXP(c[s.id] / s.perWeek));
    return { ...s, count: c[s.id], ...progress(xp) };
  });
  return { list, total: list.reduce((a, s) => a + s.level, 0) };
}
