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
// Built for maximum muscle ("Hulk mode") on every goal.
// Each goal has a pace you pick: Light, Moderate or Aggressive.
//  - Clean bulk: a smaller surplus; dirty bulk: a bigger one (common usage).
//  - Cut: a share of your body weight lost per week, 0.5–1% (Helms et al. 2014).
// Fat as a share of calories, as coaches commonly set it for bodybuilders:
// cut 20% (more carbs left for training), clean bulk 25%, dirty bulk 30%. Carbs fill the rest.
export const PACES = [['light', 'Light'], ['moderate', 'Moderate'], ['aggressive', 'Aggressive']];
const GOAL_RULES = {
  cut: { cutPct: { light: 0.5, moderate: 0.75, aggressive: 1 }, proteinPerLb: 1.2, fatPct: 0.2 },
  clean: { surplus: { light: 250, moderate: 375, aggressive: 500 }, proteinPerLb: 1.0, fatPct: 0.25 },
  dirty: { surplus: { light: 600, moderate: 800, aggressive: 1000 }, proteinPerLb: 1.0, fatPct: 0.3 },
};
const paceOf = (p) => (['light', 'moderate', 'aggressive'].includes(p) ? p : 'moderate');
// Daily calorie change for a goal and pace (about 3,500 calories per pound).
export function adjustFor(goal, pace, weightLb) {
  const rule = GOAL_RULES[goal] || GOAL_RULES.clean;
  if (rule.cutPct) return -Math.round(((rule.cutPct[paceOf(pace)] / 100) * weightLb * 3500) / 7);
  return rule.surplus[paceOf(pace)];
}

// Weekly pace in pounds and as a share of body weight, plus time to the goal weight.
export function paceInfo({ goal, pace, weightLb, goalWeightLb }) {
  if (!(weightLb > 0)) return null;
  const lbWeek = (adjustFor(goal, pace, weightLb) * 7) / 3500;
  const pct = (Math.abs(lbWeek) / weightLb) * 100;
  const out = { lbWeek, pct, label: PACES.find(([k]) => k === paceOf(pace))[1], range: goal === 'cut' ? '0.5–1%' : '0.25–0.5%' };
  out.inRange = goal === 'cut' ? pct >= 0.5 && pct <= 1.0001 : pct >= 0.25 && pct <= 0.5;
  if (goalWeightLb > 0) {
    const diff = goalWeightLb - weightLb;
    if (Math.abs(diff) < 0.5) out.atGoal = true;
    else if ((diff > 0) !== (lbWeek > 0)) out.wrongWay = true;
    else out.weeks = Math.ceil(Math.abs(diff / lbWeek));
  }
  return out;
}

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
  const adjust = adjustFor(p.goal, p.pace, p.weightLb);
  const cal = Math.round((maintain + adjust) / 10) * 10;
  const protein = Math.round(rule.proteinPerLb * p.weightLb);
  const f = Math.round((cal * rule.fatPct) / 9);
  const c = Math.max(0, Math.round((cal - protein * 4 - f * 9) / 4));
  return { cal, p: protein, c, f, maintain: Math.round(maintain), adjust, age };
}

// MET 3.5 = resistance training, multiple exercises, 8–15 reps (2024 Compendium, code 02054).
export const LIFTING_MET = 3.5;

// Actual lifting time: first completed set to last completed set.
// If sets were logged all at once (or the span looks wrong), fall back to sets × (rest + 1 min).
export function workoutMinutes(doneTimes, restSeconds = 90) {
  const t = doneTimes.map((x) => Date.parse(x)).filter((x) => !Number.isNaN(x)).sort((a, b) => a - b);
  if (!t.length) return 0;
  const span = (t[t.length - 1] - t[0]) / 60000;
  const est = t.length * (restSeconds / 60 + 1);
  return Math.round(t.length > 1 && span >= 1 && span < 240 ? span : est);
}

// Net calories: only the extra burned above resting (MET − 1), so the calories you'd burn
// sitting still aren't counted twice (they're already in your daily goal).
export function workoutCalories(minutes, weightLb) {
  if (!(minutes > 0 && weightLb > 0)) return 0;
  return Math.round(((LIFTING_MET - 1) * 3.5 * weightLb * LB) / 200 * minutes);
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
