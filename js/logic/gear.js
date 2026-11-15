// Gear tiers: real-life changes you should be able to see or measure, unlocked by
// time since your first workout, as long as you've done at least 75% of your planned
// workouts over that whole time (planned = 5 a week; Push, Pull, Legs and Back count).
// The wording is based on published studies (sources listed with each tier).
import { diffDays } from './dates.js';

export const COUNTED = ['Push', 'Pull', 'Legs', 'Back'];
export const PER_WEEK = 5;
export const SHARE = 0.75;

export const TIERS = [
  { id: 'bronze', name: 'Bronze', day: 14, title: 'Bronze tier: wired for strength',
    text: 'Two weeks in. Your nervous system has learned these lifts, so the weights already feel lighter. That is real strength, and it comes first.',
    source: 'Early strength gains are mainly neural (Institute of Human Anatomy, 2026)' },
  { id: 'iron', name: 'Iron', day: 28, title: 'Iron tier: muscle under construction',
    text: 'One month. Scans start picking up thicker muscle around now. Your muscles should feel firmer, even if the mirror is still catching up.',
    source: 'Measurable muscle thickness from 3–4 weeks (BoxRox summary of ultrasound studies)' },
  { id: 'steel', name: 'Steel', day: 42, title: 'Steel tier: chest and arms thickening',
    text: 'Six weeks. In studies, chest and triceps muscle got measurably thicker by week 6. Flex in the mirror: you should start to see some definition.',
    source: 'Abe et al. 2000, Eur J Appl Physiol: chest and triceps thickness up at week 6' },
  { id: 'silver', name: 'Silver', day: 56, title: 'Silver tier: bigger arms',
    text: 'Eight weeks. Beginners in an 8-week study grew their flexed arm by about 4–5%. Grab a tape measure: on a 13-inch arm that is roughly half an inch.',
    source: 'Untrained men, 8 weeks: flexed arm circumference +4.0% to +5.2% (PMC6317138)' },
  { id: 'gold', name: 'Gold', day: 84, title: 'Gold tier: people notice',
    text: 'Twelve weeks. Untrained young men gained about 1.3–1.5 cm (around half an inch) of flexed arm in 10–12 weeks, and upper-body muscle thickness rose 12–21%. This is when friends start to comment.',
    source: 'Gentil et al. 2020 (J Clin Transl Res); Abe et al. 2000' },
  { id: 'platinum', name: 'Platinum', day: 147, title: 'Platinum tier: built, not borrowed',
    text: 'Five months. Beginners in a 21-week study grew their thighs by about 5–6%. Your gains are now solid muscle, and your lifts are far above day one.',
    source: 'Ahtiainen et al. 2003: quadriceps +5.6% after 21 weeks (GetFitCraft summary)' },
  { id: 'obsidian', name: 'Obsidian', day: 365, title: 'Obsidian tier: a different body',
    text: 'One full year. Expect around 5–10% more muscle in every group you trained. That is a visible change on a lean frame.',
    source: 'First-year growth of 5–10% per trained muscle group (GetFitCraft research summary)' },
];

export function workoutDates(sets) {
  return new Set(sets.filter((s) => s.done && COUNTED.includes(s.dayType)).map((s) => s.date));
}

// Completion over the whole time since your first counted workout.
export function completion(dates, today) {
  const sorted = [...dates].sort();
  const start = sorted[0] || null;
  if (!start) return { start: null, days: 0, done: 0, planned: 0, pct: 0, on: false };
  const days = diffDays(today, start) + 1;
  const done = sorted.filter((d) => d <= today).length;
  const planned = Math.max(1, Math.round((days * PER_WEEK) / 7));
  const pct = Math.min(1, done / planned);
  return { start, days, done, planned, pct, on: pct >= SHARE };
}

export function gearStatus(dates, today) {
  const c = completion(dates, today);
  const daysIn = c.start ? diffDays(today, c.start) : 0;
  const reached = c.start ? TIERS.filter((t) => daysIn >= t.day) : [];
  const unlocked = c.on ? reached : [];
  return { ...c, daysIn, current: unlocked[unlocked.length - 1] || null, next: TIERS.find((t) => t.day > daysIn) || null, unlocked };
}
