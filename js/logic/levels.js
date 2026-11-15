// One overall level, 1 to 126. Like training in RuneScape: early levels come fast,
// later ones take longer, and the XP you earn grows as the weights get heavier
// (light, high-rep work like forearms is the "one-hit monster": little XP per rep).
// Tuned for about 9 sets of 10–12 reps per workout, 5 workouts a week:
// level 10 ≈ 1.5 weeks, 55 ≈ 12 weeks, 75 ≈ 6 months, 90 ≈ 10 months,
// 100 ≈ 13 months, 110 ≈ 17 months, 120 ≈ 21 months, 126 ≈ 2 years.
import { sessions, working, effectiveReps } from './progression.js';
import { MILESTONES } from './streak.js';
import { diffDays, addDays } from './dates.js';

export const MAX = 126;

// [level, weeks of steady training to reach it]
const ANCHORS = [[1, 0], [10, 1.5], [30, 5], [55, 12], [75, 26], [90, 44], [100, 58], [110, 74], [120, 92], [126, 104]];
// Expected XP per week: about 2,000 at the start, rising as weights go up.
const cumXP = (w) => 2000 * w + (500 * w * w) / 104;

function weeksAt(L) {
  for (let i = 1; i < ANCHORS.length; i++) {
    const [l1, w1] = ANCHORS[i - 1], [l2, w2] = ANCHORS[i];
    if (L <= l2) return w1 + ((L - l1) / (l2 - l1)) * (w2 - w1);
  }
  return ANCHORS[ANCHORS.length - 1][1];
}

export const TABLE = [0, 0];
for (let L = 2; L <= MAX; L++) TABLE[L] = Math.round(cumXP(weeksAt(L)));

export const XP = {
  setBonus: 1,             // flat bonus per completed set (a fraction of one rep)
  weightUp: 0.15,          // new heaviest weight on an exercise: 15% of your current level
  checkin: 0.02,           // each day that counts toward the streak: 2% of your current level
  milestone: { 7: 0.5, 15: 0.75, 22: 1, 30: 1.5 }, // streak milestones, in levels' worth; +1.5 every 30 days after
};

// XP for one rep: grows with the weight, and is scaled down for high-rep exercises.
export function repXP(weight, repTop = 12) {
  return (1 + (+weight || 0) / 10) * Math.min(1, 12 / (repTop || 12));
}

export function levelFor(xp) {
  let L = 1;
  while (L < MAX && xp >= TABLE[L + 1]) L++;
  return L;
}

const span = (xp) => { const L = levelFor(xp); return L >= MAX ? TABLE[MAX] - TABLE[MAX - 1] : TABLE[L + 1] - TABLE[L]; };

export function progress(xp) {
  const level = levelFor(xp);
  if (level >= MAX) return { level, xp, into: 0, span: 0, toNext: 0, pct: 100, max: MAX };
  const into = xp - TABLE[level];
  const s = TABLE[level + 1] - TABLE[level];
  return { level, xp, into, span: s, toNext: s - into, pct: (into / s) * 100, max: MAX };
}

// Lengths of consecutive-day runs, each with the date it ends.
export function runs(dates) {
  const out = [];
  let run = 0, prev = null;
  for (const d of [...dates].sort()) {
    if (prev && diffDays(d, prev) === 1) run++;
    else { if (run) out.push({ length: run, start: addDays(prev, 1 - run) }); run = 1; }
    prev = d;
  }
  if (run) out.push({ length: run, start: addDays(prev, 1 - run) });
  return out;
}

export function milestonesIn(runLength) {
  const out = MILESTONES.filter((m) => runLength >= m);
  for (let m = 60; m <= runLength; m += 30) out.push(m);
  return out;
}

// Replays your history day by day, so bonuses use the level you were at that day.
// sets: all set records; qualifying: Set of streak dates; exercises: exercise records.
export function totalXP(sets, qualifying, exercises = []) {
  const exById = new Map(exercises.map((e) => [e.id, e]));
  const events = new Map(); // date -> { flat, levelShares }
  const add = (date, flat, share = 0) => {
    if (!events.has(date)) events.set(date, { flat: 0, share: 0 });
    const e = events.get(date);
    e.flat += flat; e.share += share;
  };
  const parts = { reps: 0, sets: 0, weightUps: 0, checkins: 0, milestones: 0 };

  const done = sets.filter((s) => s.done);
  for (const s of done) {
    const ex = exById.get(s.exerciseId) || {};
    const reps = s.repsR != null || s.repsL != null ? ((+s.repsR || 0) + (+s.repsL || 0)) / 2 : +s.reps || 0;
    if (reps <= 0) continue;
    const xp = reps * repXP(s.weight, ex.repTop) + XP.setBonus;
    parts.reps += xp - XP.setBonus; parts.sets += XP.setBonus;
    add(s.date, xp);
  }
  // New heaviest weight per exercise (starting from the weight you entered it with).
  const byEx = new Map();
  for (const s of done) {
    if (!byEx.has(s.exerciseId)) byEx.set(s.exerciseId, []);
    byEx.get(s.exerciseId).push(s);
  }
  for (const [exId, list] of byEx) {
    const ex = exById.get(exId) || {};
    let best = ex.baseline ? Math.max(0, ...(ex.baseline.sets || []).map((b) => +b.weight || 0)) || null : null;
    for (const sess of sessions(list)) {
      const w = working(sess);
      if (!w) continue;
      if (best !== null && w.weight > best) add(sess.date, 0, XP.weightUp), parts.weightUps++;
      if (best === null || w.weight > best) best = w.weight;
    }
  }
  for (const d of qualifying) add(d, 0, XP.checkin), parts.checkins++;
  for (const r of runs(qualifying)) {
    for (const m of milestonesIn(r.length)) {
      add(addDays(r.start, m - 1), 0, XP.milestone[m] ?? XP.milestone[30]); // credited the day it's reached
      parts.milestones++;
    }
  }

  let xp = 0;
  for (const date of [...events.keys()].sort()) {
    const e = events.get(date);
    xp += e.share ? Math.round(e.share * span(xp)) : 0;
    xp += e.flat;
  }
  return { total: Math.round(xp), parts };
}

export { effectiveReps };
