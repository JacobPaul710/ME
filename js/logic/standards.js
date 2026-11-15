// Strength levels: estimated one-rep max ÷ bodyweight, compared with published
// ratios (winsport.pages.dev strength standards guide). Values to approve.
// Each number is the ratio where that level starts.
export const LEVELS = ['Beginner', 'Novice', 'Intermediate', 'Advanced', 'Elite'];

export const LIFTS = {
  bench: { label: 'Bench press', group: 'Push', men: [0.6, 0.95, 1.3, 1.65, 2.0], women: [0.36, 0.59, 0.84, 1.07, 1.3] },
  squat: { label: 'Squat', group: 'Legs', men: [0.75, 1.25, 1.7, 2.15, 2.6], women: [0.6, 0.95, 1.3, 1.65, 2.0] },
  deadlift: { label: 'Deadlift', group: 'Pull', men: [1.0, 1.5, 2.05, 2.6, 3.1], women: null }, // no sourced women's ratios yet
};

export function guessLift(name) {
  const n = name.toLowerCase();
  if (n.includes('bench')) return 'bench';
  if (n.includes('squat')) return 'squat';
  if (n.includes('deadlift')) return 'deadlift';
  return null;
}

// Epley estimate from one set.
export const oneRepMax = (weight, reps) => (reps <= 1 ? weight : weight * (1 + reps / 30));

export function bestOneRepMax(sets) {
  let best = 0;
  for (const s of sets) if (s.done && +s.reps > 0 && +s.weight > 0) best = Math.max(best, oneRepMax(+s.weight, +s.reps));
  return best;
}

export function levelOf(lift, oneRM, bodyweight, sex = 'men') {
  const table = LIFTS[lift] && LIFTS[lift][sex];
  if (!table || !(bodyweight > 0) || !(oneRM > 0)) return null;
  const ratio = oneRM / bodyweight;
  let i = 0;
  for (let k = 0; k < table.length; k++) if (ratio >= table[k]) i = k;
  const next = i < table.length - 1 ? table[i + 1] : null;
  return { level: LEVELS[i], index: i, ratio, nextLevel: next ? LEVELS[i + 1] : null, nextWeight: next ? next * bodyweight : null };
}
