// Daily targets from your details (Mifflin-St Jeor, the formula most modern apps use),
// and calories burned in a workout (MET method, Compendium of Physical Activities).
const LB = 0.45359237, IN = 2.54;

// Activity outside the gym (lifting is added separately on the days you train).
export const ACTIVITY = [
  ['1.2', 'Mostly sitting (desk job, little walking)'],
  ['1.3', 'Lightly active (some walking or errands)'],
  ['1.4', 'Moderately active (on your feet part of the day)'],
  ['1.5', 'Active (on your feet most of the day)'],
  ['1.6', 'Very active (physical work most of the day)'],
  ['1.725', 'Extremely active (hard physical job)'],
];
// Older saved choices map to the closest new one.
export const activityValue = (v) => {
  const n = +v || 1.2;
  return ACTIVITY.reduce((best, [x]) => (Math.abs(+x - n) < Math.abs(+best - n) ? x : best), ACTIVITY[0][0]);
};

export const GOALS = [
  ['cut', 'Cut (lose fat, keep muscle)'],
  ['clean', 'Clean bulk (lean muscle)'],
  ['dirty', 'Dirty bulk (gain fast)'],
];
const GOAL_RULES = {
  cut: { adjust: -500, proteinPerLb: 1.0 },   // ~1 lb a week; high protein protects muscle
  clean: { adjust: 250, proteinPerLb: 0.8 },  // small surplus keeps the gain mostly muscle
  dirty: { adjust: 500, proteinPerLb: 0.8 },  // bigger surplus: faster gain, more of it fat
};

// Age today from a birthday ('YYYY-MM-DD').
export function ageFrom(birthday, today = new Date()) {
  if (!birthday) return null;
  const [y, m, d] = birthday.split('-').map(Number);
  let age = today.getFullYear() - y;
  if (today.getMonth() + 1 < m || (today.getMonth() + 1 === m && today.getDate() < d)) age--;
  return age > 0 && age < 120 ? age : null;
}

export function bmr({ sex, age, heightIn, weightLb }) {
  const kg = weightLb * LB, cm = heightIn * IN;
  return 10 * kg + 6.25 * cm - 5 * age + (sex === 'women' ? -161 : 5);
}

// p: { sex, birthday (or age), heightIn, weightLb, activity, goal: 'cut' | 'clean' | 'dirty' }
export function dailyTargets(p, today = new Date()) {
  const age = ageFrom(p.birthday, today) || +p.age || null;
  if (!(age > 0 && p.heightIn > 0 && p.weightLb > 0)) return null;
  const rule = GOAL_RULES[p.goal] || GOAL_RULES.clean;
  const maintain = bmr({ ...p, age }) * (+p.activity || 1.2);
  const cal = Math.round((maintain + rule.adjust) / 10) * 10;
  const protein = Math.round(rule.proteinPerLb * p.weightLb);
  const f = Math.round((cal * 0.25) / 9);
  const c = Math.max(0, Math.round((cal - protein * 4 - f * 9) / 4));
  return { cal, p: protein, c, f, maintain: Math.round(maintain), adjust: rule.adjust, age };
}

// MET 3.5 = resistance training, multiple exercises, 8–15 reps (2024 Compendium, code 02054).
export const LIFTING_MET = 3.5;

// Minutes from the first to the last completed set, plus one rest period.
export function workoutMinutes(doneTimes, restSeconds = 90) {
  const t = doneTimes.map((x) => Date.parse(x)).filter((x) => !Number.isNaN(x)).sort((a, b) => a - b);
  if (!t.length) return 0;
  const span = (t[t.length - 1] - t[0]) / 60000;
  const perSet = restSeconds / 60 + 1;
  // If sets were logged all at once (or very late), fall back to sets × (rest + 1 min).
  const est = t.length * perSet;
  return Math.round(span > 0 && span < 240 ? span + perSet : est);
}

export function workoutCalories(minutes, weightLb) {
  if (!(minutes > 0 && weightLb > 0)) return 0;
  return Math.round((LIFTING_MET * 3.5 * weightLb * LB) / 200 * minutes);
}

// Is today's eating enough for muscle growth after training?
export function intakeCheck({ eaten, targets, burned, trained, weightLb }) {
  if (!trained) return [];
  const notes = [];
  const pGoal = targets.p || (weightLb ? Math.round(0.7 * weightLb) : null);
  if (pGoal && eaten.p < pGoal) notes.push({ key: 'p', text: `Protein: ${Math.round(pGoal - eaten.p)} g to go (aim for ${pGoal} g on training days).` });
  if (targets.cal) {
    const need = targets.cal + burned;
    if (eaten.cal < need * 0.9) notes.push({ key: 'cal', text: `Calories: ${Math.round(need - eaten.cal)} left, including the ${burned} you burned lifting.` });
  }
  if (targets.c && eaten.c < targets.c * 0.6) notes.push({ key: 'c', text: 'Carbs are low for a training day; they refuel your muscles.' });
  return notes;
}
