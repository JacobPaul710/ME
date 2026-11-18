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
// Units that fit the food: its serving, pieces when the serving is a count (6 nuggets),
// cups and fl oz for drinks, and grams / oz for anything weighed.
const LIQUID = /\b(milk|juice|soda|cola|pop|water|coffee|latte|tea|shake|smoothie|drink|beverage|broth|kefir|lemonade|sports drink|energy drink)\b/i;
const PIECES = /(\d+(?:\.\d+)?)\s*(pieces?|pcs?|nuggets?|cookies?|wings?|strips?|slices?|crackers?|chips?|tenders?|eggs?|links?|patties|patty|bars?|balls?|rolls?|pancakes?|waffles?|tacos?|burgers?|sandwich(?:es)?)/i;

export function units(food) {
  const u = [];
  if (!food.baseGrams) u.push({ id: 'serving', label: food.baseLabel || 'serving' });
  else if (food.servingGrams) u.push({ id: 'serving', label: food.servingLabel || 'serving' });
  if (food.baseGrams && food.servingGrams && food.servingLabel) {
    const m = String(food.servingLabel).match(PIECES);
    if (m && +m[1] > 1) {
      const word = m[2].toLowerCase().replace(/ies$/, 'y').replace(/(ches|shes)$/, (x) => x.slice(0, -2)).replace(/s$/, '');
      u.push({ id: 'piece', label: `${word || 'piece'} (${Math.round(food.servingGrams / +m[1])} g each)`, grams: food.servingGrams / +m[1] });
    }
  }
  if (food.baseGrams) {
    if (LIQUID.test(food.name) || /\b(ml|fl|cup)/i.test(food.servingLabel || '')) {
      u.push({ id: 'cup', label: 'cups', grams: 240 }, { id: 'floz', label: 'fl oz', grams: 29.57 });
    }
    u.push({ id: 'g', label: 'grams' }, { id: 'oz', label: 'oz', grams: 28.35 });
  }
  return u;
}

const unitGrams = (food, unit) => (units(food).find((u) => u.id === unit) || {}).grams;

export function factor(food, amount, unit) {
  const a = +amount || 0;
  if (unit === 'g') return food.baseGrams ? a / food.baseGrams : 0;
  if (!food.baseGrams) return a;
  if (unit === 'serving') return food.servingGrams ? (a * food.servingGrams) / food.baseGrams : 0;
  const g = unitGrams(food, unit);
  return g ? (a * g) / food.baseGrams : 0;
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
  if (unit === 'oz') return `${amount} oz`;
  if (unit === 'cup') return `${amount} cup${+amount === 1 ? '' : 's'}`;
  if (unit === 'floz') return `${amount} fl oz`;
  if (unit === 'piece') { const u = units(food).find((x) => x.id === 'piece'); return `${amount} × ${u ? u.label.replace(/ \(.*/, '') : 'piece'}`; }
  const lbl = food.baseGrams ? food.servingLabel || 'serving' : food.baseLabel || 'serving';
  return `${amount} × ${lbl}`;
}
