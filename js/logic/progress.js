// Progress messages: unlock by how long you've been training, and show only
// while you're consistent. Consistent = at least 75% of the target of 5 workout
// days a week over the last 30 days, counting Push, Pull and Legs only.
// A broken streak doesn't matter; only the 30-day count does.
import { addDays, diffDays } from './dates.js';

export const COUNTED = ['Push', 'Pull', 'Legs'];
export const PER_WEEK = 5;
export const SHARE = 0.75;

// Wording to approve. "day" = days since your first Push/Pull/Legs workout.
export const MESSAGES = [
  { day: 7, title: 'One week in', text: 'Your nervous system is already learning these lifts. Early strength jumps come from your brain recruiting more muscle, so expect your numbers to climb fast.' },
  { day: 14, title: 'Two weeks in', text: 'Soreness should be easing as your body adapts. Your lifts keep rising because your muscles are firing better every session.' },
  { day: 28, title: 'One month', text: 'Research starts measuring real muscle growth around now, even before the mirror shows it. Keep stacking sessions.' },
  { day: 42, title: 'Six weeks', text: 'Muscle fibers get measurably bigger by about week 6. Your strength now comes from real muscle, not just practice.' },
  { day: 56, title: 'Eight weeks', text: 'Most people see visible changes between 6 and 12 weeks. Check the mirror: your arms, shoulders and chest should be filling out.' },
  { day: 84, title: 'Twelve weeks', text: 'This is when other people start to notice. Your strength and size gains are real and adding up.' },
  { day: 182, title: 'Six months', text: 'Six months of showing up. Beginner gains slow from here, so every new weight on the bar is hard-earned. Keep going.' },
  { day: 365, title: 'One year', text: 'A full year. Expect around 5 to 10% more muscle in the groups you trained, with lifts far above where you started.' },
];

export function workoutDates(sets) {
  return new Set(sets.filter((s) => s.done && COUNTED.includes(s.dayType)).map((s) => s.date));
}

export function consistency(dates, today) {
  const sorted = [...dates].sort();
  const start = sorted[0] || null;
  const days = start ? Math.min(30, diffDays(today, start) + 1) : 0;
  let done = 0;
  for (let i = 0; i < 30; i++) if (dates.has(addDays(today, -i))) done++;
  const goal = Math.max(1, Math.round((days * PER_WEEK / 7) * SHARE)); // 16 over a full 30 days
  return { done, goal, days, start, on: !!start && done >= goal };
}

export function currentMessage(dates, today) {
  const c = consistency(dates, today);
  if (!c.start) return { ...c, message: null, next: MESSAGES[0] };
  const daysIn = diffDays(today, c.start);
  const unlocked = MESSAGES.filter((m) => daysIn >= m.day);
  return { ...c, daysIn, message: c.on ? unlocked[unlocked.length - 1] || null : null, next: MESSAGES.find((m) => m.day > daysIn) || null };
}
