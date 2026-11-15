// One overall level, 1 to 99, RuneScape style: quick early levels, then a long
// grind (level 92 is about halfway to 99 in XP). Tuned so 99 takes about 3 years
// at 5 workouts a week of ~100 reps each. Change the numbers here to retune.
import { sessions, working } from './progression.js';
import { MILESTONES } from './streak.js';
import { diffDays } from './dates.js';

export const XP = {
  rep: 10,          // every rep, any exercise, any weight
  weightUp: 250,    // new heaviest working weight on an exercise
  checkin: 10,      // each day that counts toward the streak
  milestone: { 7: 100, 15: 200, 22: 300, 30: 500 }, // and 500 for every 30 days after
};

const MAX = 99;
const A = 45.9;   // exponential part (sets the long late grind)
const B = 1000;   // linear part (about one workout per level at the start)

export const TABLE = [0, 0];
for (let L = 2; L <= MAX; L++) TABLE[L] = Math.round(A * (2 ** ((L - 1) / 7) - 1) + B * (L - 1));

export function levelFor(xp) {
  let L = 1;
  while (L < MAX && xp >= TABLE[L + 1]) L++;
  return L;
}

export function progress(xp) {
  const level = levelFor(xp);
  if (level >= MAX) return { level, xp, into: 0, span: 0, toNext: 0, pct: 100 };
  const into = xp - TABLE[level];
  const span = TABLE[level + 1] - TABLE[level];
  return { level, xp, into, span, toNext: span - into, pct: (into / span) * 100 };
}

// Lengths of every run of consecutive days in a set of dates.
export function runs(dates) {
  const out = [];
  let run = 0, prev = null;
  for (const d of [...dates].sort()) {
    if (prev && diffDays(d, prev) === 1) run++;
    else { if (run) out.push(run); run = 1; }
    prev = d;
  }
  if (run) out.push(run);
  return out;
}

export function milestoneXP(runLength) {
  let xp = 0;
  for (const m of MILESTONES) if (runLength >= m) xp += XP.milestone[m];
  if (runLength >= 60) xp += Math.floor((runLength - 30) / 30) * XP.milestone[30];
  return xp;
}

// sets: all set records; qualifying: Set of streak dates.
export function totalXP(sets, qualifying) {
  const done = sets.filter((s) => s.done);
  let reps = 0;
  for (const s of done) reps += Math.max(0, Math.round(+s.reps || 0));
  let weightUps = 0;
  const byEx = new Map();
  for (const s of done) {
    if (!byEx.has(s.exerciseId)) byEx.set(s.exerciseId, []);
    byEx.get(s.exerciseId).push(s);
  }
  for (const list of byEx.values()) {
    let best = null;
    for (const sess of sessions(list)) {
      const w = working(sess);
      if (!w) continue;
      if (best !== null && w.weight > best) weightUps++;
      if (best === null || w.weight > best) best = w.weight;
    }
  }
  const milestones = runs(qualifying).reduce((t, n) => t + milestoneXP(n), 0);
  const parts = { reps: reps * XP.rep, weightUps: weightUps * XP.weightUp, checkins: qualifying.size * XP.checkin, milestones };
  return { total: parts.reps + parts.weightUps + parts.checkins + parts.milestones, parts };
}
