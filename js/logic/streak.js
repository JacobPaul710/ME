import { addDays, diffDays } from './dates.js';

export const MILESTONES = [7, 15, 22, 30];
export const MILESTONE_NAMES = { 7: '1 week', 15: 'Half month', 22: '3 weeks', 30: 'Full month' };

// A day counts when it has a Rest or Off check-in, or at least one completed set.
// An Exercise check-in with no completed set does not count yet.
export function qualifyingDates(checkins, sets) {
  const out = new Set();
  for (const s of sets) if (s.done && s.dayType !== 'Forearms') out.add(s.date); // forearms alone don't make a workout day
  for (const c of checkins) if (c.type === 'rest' || c.type === 'off') out.add(c.date);
  return out;
}

// Today not checked in yet does not break the streak.
export function currentStreak(dates, today) {
  let d = dates.has(today) ? today : addDays(today, -1);
  let n = 0;
  while (dates.has(d)) { n++; d = addDays(d, -1); }
  return n;
}

export function streakStart(dates, today) {
  const n = currentStreak(dates, today);
  if (!n) return null;
  const end = dates.has(today) ? today : addDays(today, -1);
  return addDays(end, -(n - 1));
}

export function bestStreak(dates) {
  let best = 0, run = 0, prev = null;
  for (const d of [...dates].sort()) {
    run = prev && diffDays(d, prev) === 1 ? run + 1 : 1;
    if (run > best) best = run;
    prev = d;
  }
  return best;
}

export function milestoneFor(n) {
  if (MILESTONES.includes(n)) return n;
  if (n > 30 && n % 30 === 0) return n;
  return null;
}

export function nextMilestone(n) {
  for (const m of MILESTONES) if (m > n) return m;
  return (Math.floor(n / 30) + 1) * 30;
}

export function milestoneName(m) {
  return MILESTONE_NAMES[m] || `${m / 30} months`;
}
