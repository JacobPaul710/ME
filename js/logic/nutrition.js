export const MACROS = [
  { key: 'cal', label: 'Calories', unit: '' },
  { key: 'p', label: 'Protein', unit: 'g' },
  { key: 'c', label: 'Carbs', unit: 'g' },
  { key: 'f', label: 'Fat', unit: 'g' },
];

const r0 = (n) => Math.round(n);
const r1 = (n) => Math.round(n * 10) / 10;

export function totals(logs) {
  const t = { cal: 0, p: 0, c: 0, f: 0 };
  for (const l of logs) for (const k in t) t[k] += +l[k] || 0;
  return { cal: r0(t.cal), p: r1(t.p), c: r1(t.c), f: r1(t.f) };
}

// A food's numbers are per "base": either baseGrams of it (e.g. 100 g),
// or one serving when baseGrams is null (custom items).
export function units(food) {
  const u = [];
  if (!food.baseGrams) u.push({ id: 'serving', label: food.baseLabel || 'serving' });
  else if (food.servingGrams) u.push({ id: 'serving', label: food.servingLabel || 'serving' });
  if (food.baseGrams) u.push({ id: 'g', label: 'grams' });
  return u;
}

export function factor(food, amount, unit) {
  const a = +amount || 0;
  if (unit === 'g') return food.baseGrams ? a / food.baseGrams : 0;
  if (!food.baseGrams) return a;
  return food.servingGrams ? (a * food.servingGrams) / food.baseGrams : 0;
}

export function macrosFor(food, amount, unit) {
  const k = factor(food, amount, unit);
  return { cal: r0(food.cal * k), p: r1(food.p * k), c: r1(food.c * k), f: r1(food.f * k) };
}

export function defaultAmount(food) {
  if (food.lastAmount && food.lastUnit) return { amount: food.lastAmount, unit: food.lastUnit };
  const u = units(food);
  if (u[0].id === 'serving') return { amount: 1, unit: 'serving' };
  return { amount: food.baseGrams || 100, unit: 'g' };
}

export function amountLabel(food, amount, unit) {
  if (unit === 'g') return `${amount} g`;
  const lbl = food.baseGrams ? food.servingLabel || 'serving' : food.baseLabel || 'serving';
  return `${amount} × ${lbl}`;
}
