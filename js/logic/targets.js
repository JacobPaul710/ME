// Daily targets from your details (Mifflin-St Jeor, the formula most modern apps use),
// and calories burned in a workout (MET method, Compendium of Physical Activities).
const LB = 0.45359237, IN = 2.54;

export const ACTIVITY = [
  ['1.2', 'Mostly sitting (desk job)'],
  ['1.375', 'Lightly active (on your feet some of the day)'],
  ['1.55', 'Active (on your feet most of the day)'],
  ['1.725', 'Very active (physical job)'],
];

export function bmr({ sex, age, heightIn, weightLb }) {
  const kg = weightLb * LB, cm = heightIn * IN;
  return 10 * kg + 6.25 * cm - 5 * age + (sex === 'women' ? -161 : 5);
}

// Workouts are not in the activity level: their calories are added on the day you train.
export function dailyTargets(p) {
  if (!(p.age > 0 && p.heightIn > 0 && p.weightLb > 0)) return null;
  const maintain = bmr(p) * (+p.activity || 1.2);
  const goal = +p.goalLb || p.weightLb;
  const diff = goal - p.weightLb;
  // Lose about 1 lb a week, or gain slowly (lean gain) to keep fat low.
  const adjust = diff < -1 ? -500 : diff > 1 ? 250 : 0;
  const cal = Math.round((maintain + adjust) / 10) * 10;
  const p_ = Math.round(0.8 * Math.max(p.weightLb, goal > p.weightLb ? goal : p.weightLb)); // 0.8 g per lb
  const f = Math.round((cal * 0.25) / 9);
  const c = Math.max(0, Math.round((cal - p_ * 4 - f * 9) / 4));
  return { cal, p: p_, c, f, maintain: Math.round(maintain), adjust };
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
