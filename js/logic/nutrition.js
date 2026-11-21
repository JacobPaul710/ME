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
const LIQUID = /\b(milk|juice|soda|cola|coke|pepsi|sprite|fanta|dr\.? pepper|mountain dew|root beer|ginger ale|pop|water|seltzer|coffee|latte|espresso|cappuccino|cold brew|tea|shake|smoothie|drink|beverage|broth|kefir|lemonade|gatorade|powerade|electrolyte|sports drink|energy drink|red bull|monster|celsius|kombucha|beer|ale|lager|wine|cider|nog|cocoa|hot chocolate|creamer|frappuccino|frosty)\b/i;
// Pourable foods that aren't drinks: these get cups and fl oz too.
const POURABLE = /\begg,? whites?\b|\bwhites?, (raw|liquid)|liquid|egg substitute|\bsoup|\bstew\b|\bchili\b|\bsyrup|\bsauce|\bdressing|\byogh?urt|\bcream\b|\bhalf and half|\boil\b|\bhoney\b|\bbatter\b|\bsalsa|\bgravy|\bpudding|\boatmeal|\bporridge|\bcereal\b|\bbeefaroni|\bravioli|\bspaghettios|\bmac(aroni)? (and|&) cheese/i;
const PIECES = /(?<![\d/.])(\d+(?:\.\d+)?)\s*(pieces?|pcs?|nuggets?|cookies?|biscuits?|wings?|strips?|slices?|crackers?|chips?|tenders?|eggs?|links?|patties|patty|bars?|balls?|rolls?|pancakes?|waffles?|tacos?|burgers?|sandwich(?:es)?|pretzels?|gummies|candies|pieces|halves|wedges|sticks?|packets?|pouches?|scoops?|tablets?|capsules?|softgels?)/i;
const frac = (t) => t.trim().split(/\s+/).reduce((a, x) => a + (x.includes('/') ? +x.split('/')[0] / +x.split('/')[1] : +x), 0);

// What one whole item is called, from the food's name (Baconator -> burger).
const WHOLE = [
  [/burger|baconator|whopper|big mac|cheeseburger|hamburger|quarter pounder|patty melt/i, 'burger'],
  [/sandwich|sub\b|hoagie|panini|club\b|blt\b|biscuit sandwich/i, 'sandwich'], [/burrito/i, 'burrito'], [/\btaco/i, 'taco'],
  [/\bwrap\b/i, 'wrap'], [/pizza/i, 'slice'], [/hot dog|frank/i, 'hot dog'], [/\bbar\b/i, 'bar'], [/muffin/i, 'muffin'],
  [/bagel/i, 'bagel'], [/donut|doughnut/i, 'donut'], [/cookie/i, 'cookie'], [/\begg\b|\beggs\b/i, 'egg'], [/banana/i, 'banana'],
  [/apples?\b/i, 'apple'], [/oranges?\b/i, 'orange'], [/^pears?\b/i, 'pear'], [/^peach(es)?\b/i, 'peach'], [/\bcan\b|soda|cola/i, 'can'], [/bottle|water\b/i, 'bottle'],
  [/salad/i, 'salad'], [/bowl/i, 'bowl'], [/fries/i, 'order'], [/shake|frosty|smoothie/i, 'cup'], [/pie\b/i, 'pie'],
];
const wholeName = (name) => (WHOLE.find(([re]) => re.test(name)) || [, null])[1];
const justWeight = (lbl) => !lbl || /^\s*[\d.]+\s*(g|gr|grams?|ml|oz)\s*$/i.test(lbl);

export function units(food) {
  const u = [];
  if (!food.baseGrams) u.push({ id: 'serving', label: food.baseLabel || 'serving' });
  else if (food.servingGrams) {
    // the whole thing comes first: "1 burger (330 g)", never just "330 g"
    const g = Math.round(food.servingGrams);
    u.push({ id: 'serving', label: justWeight(food.servingLabel) ? `${wholeName(food.name) || 'serving'} (${g} g)` : food.servingLabel });
  }
  if (food.baseGrams && food.servingGrams && food.servingLabel) {
    const m = String(food.servingLabel).match(PIECES);
    const SINGULAR = { cookies: 'cookie', pieces: 'piece', halves: 'half', patties: 'patty', candies: 'candy', gummies: 'gummy' };
    const w0 = m && m[2].toLowerCase();
    const word = m && (SINGULAR[w0] || w0.replace(/(ches|shes)$/, (x) => x.slice(0, -2)).replace(/s$/, ''));
    // count by the piece whenever the serving is a count (3 cookies → cookies). Mixed-up entries
    // (crackers on a burger) were already dropped by the data checks.
    if (m && +m[1] >= 1 && !(+m[1] === 1 && !/(piece|pc)/.test(word))) {
      u.push({ id: 'piece', label: `${word || 'piece'} (${Math.round(food.servingGrams / +m[1])} g each)`, grams: food.servingGrams / +m[1] });
    }
  }
  // the whole thing (can / bottle / package): its listed size, or one serving when that's all we know
  if (food.baseGrams && (food.packageGrams || food.servingGrams) && food.packageGrams !== food.servingGrams) {
    const g = food.packageGrams || food.servingGrams;
    const what = /\bcan(ned)?\b|peach|beans|soup|tuna/i.test(food.name) ? 'whole can' : LIQUID.test(food.name) ? 'whole bottle / can' : wholeName(food.name) ? `whole ${wholeName(food.name)}` : 'whole item';
    if (food.packageGrams) u.push({ id: 'package', label: `${what} (${Math.round(g)} g)`, grams: g });
  }
  if (food.baseGrams) {
    // cups: from the label when it says "1/2 cup (122 g)", otherwise 240 g for drinks
    const cm = String(food.servingLabel || '').match(/^\s*([\d./ ]+)\s*cups?\b/i);
    const cupG = cm && food.servingGrams && frac(cm[1]) > 0 ? food.servingGrams / frac(cm[1]) : null;
    const drink = LIQUID.test(food.name) || /\b(ml|fl)/i.test(food.servingLabel || '');
    const pour = drink || POURABLE.test(food.name);
    // cups from the label when it gives them; otherwise a cup of something pourable ≈ 240 g
    if (cupG || pour) u.push({ id: 'cup', label: 'cups', grams: cupG || 240 });
    if (pour) u.push({ id: 'floz', label: 'fl oz', grams: (cupG || 240) / 8 });
    if (drink) u.push({ id: 'swallow', label: 'swallows (about 25 ml each)', grams: 25 });
    u.push({ id: 'g', label: 'grams' }, { id: 'oz', label: 'oz', grams: 28.35 });
  }
  // Basic fruit (whole apple, banana…): the whole piece comes first
  const pk = u.findIndex((x) => x.id === 'package');
  if (food.source === 'usda' && pk > 0) u.unshift(...u.splice(pk, 1));
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
  if (u[0].id === 'serving' || u[0].id === 'package') return { amount: 1, unit: u[0].id };
  return { amount: food.baseGrams || 100, unit: 'g' };
}

const norm = (x) => String(x).toLowerCase();

export function amountLabel(food, amount, unit) {
  if (unit === 'g') return `${amount} g`;
  if (unit === 'oz') return `${amount} oz`;
  if (unit === 'cup') return `${amount} cup${+amount === 1 ? '' : 's'}`;
  if (unit === 'floz') return `${amount} fl oz`;
  if (unit === 'swallow') return `${amount} swallow${+amount === 1 ? '' : 's'}`;
  if (unit === 'package') { const u = units(food).find((x) => x.id === 'package'); return `${amount} × ${u ? u.label.replace(/ \(.*/, '') : 'package'}`; }
  if (unit === 'piece') { const u = units(food).find((x) => x.id === 'piece'); return `${amount} × ${u ? u.label.replace(/ \(.*/, '') : 'piece'}`; }
  const lbl = food.baseGrams ? (units(food).find((x) => x.id === 'serving') || {}).label || 'serving' : food.baseLabel || 'serving';
  return `${amount} × ${lbl}`;
}
