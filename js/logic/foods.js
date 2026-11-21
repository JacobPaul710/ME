// Converting outside food data into the app's one food shape, and local search.
const r0 = (n) => Math.round(n);
const r1 = (n) => Math.round(n * 10) / 10;
const r2 = (n) => Math.round(n * 100) / 100; // per-100 g values keep 2 decimals so a whole serving adds up to the label

// USDA rows from data/usda-foods.json: [name, kcal, protein, carbs, fat, portionLabel, portionGrams] per 100 g
// One medium piece of common fruit (USDA standard weights), so "whole apple" is there.
const MEDIUM = [[/^apples, raw/i, 182], [/^bananas, raw/i, 118], [/^oranges, raw/i, 131], [/^pears, raw/i, 178], [/^peaches, raw/i, 150]];
export function fromUSDA(row) {
  const [name, cal, p, c, f, pl, pg] = row;
  const med = MEDIUM.find(([re]) => re.test(name));
  return {
    ...(med ? { packageGrams: med[1] } : {}),
    name: String(name).replace(/\s*\(Includes foods for USDA's Food Distribution Program\)/i, ''), brand: '', source: 'usda', baseGrams: 100, baseLabel: '100 g',
    cal, p, c, f, servingLabel: pl || null, servingGrams: pg || null,
  };
}

// Open Food Facts product -> food (per 100 g). Returns null without calories.
export function fromOFF(prod) {
  const n = prod.nutriments || {};
  let kcal = n['energy-kcal_100g'];
  if (kcal == null && n.energy_100g != null) kcal = n.energy_100g / 4.184;
  if (kcal == null) return null;
  const sq = parseFloat(prod.serving_quantity);
  return {
    name: (prod.product_name || '').trim() || 'Unnamed product',
    brand: (prod.brands || '').split(',')[0].trim(),
    source: 'off', barcode: prod.code || null,
    baseGrams: 100, baseLabel: '100 g',
    cal: r2(+kcal), p: r2(+n.proteins_100g || 0), c: r2(+n.carbohydrates_100g || 0), f: r2(+n.fat_100g || 0),
    servingLabel: prod.serving_size || null, servingGrams: sq > 0 ? sq : null,
    packageGrams: (() => {
      if (+prod.product_quantity > 0 && !/oz|lb/i.test(prod.product_quantity_unit || '')) return +prod.product_quantity;
      const m = String(prod.quantity || '').match(/([\d.]+)\s*(g|ml)\b/i);
      if (m) return +m[1];
      const oz = String(prod.quantity || '').match(/([\d.]+)\s*(fl\.?\s*)?oz\b/i);
      return oz ? Math.round(+oz[1] * (oz[2] ? 29.57 : 28.35)) : null;
    })(),
  };
}

// USDA FoodData Central search result -> food (per 100 g). Returns null without calories.
const NUT = { cal: ['208', 1008], p: ['203', 1003], c: ['205', 1005], f: ['204', 1004] };
export function fromFDC(item) {
  const get = (k) => {
    const n = (item.foodNutrients || []).find((x) => String(x.nutrientNumber ?? (x.nutrient && x.nutrient.number)) === NUT[k][0] || (x.nutrientId ?? (x.nutrient && x.nutrient.id)) === NUT[k][1]);
    const v = n && (n.value ?? n.amount);
    const u = n && (n.unitName || (n.nutrient && n.nutrient.unitName));
    return n && v != null && (k !== 'cal' || !u || /kcal/i.test(u)) ? +v : null;
  };
  let servingGrams = null, servingLabel = null;
  const unit = String(item.servingSizeUnit || '').toLowerCase();
  if (item.servingSize > 0 && (unit === 'g' || unit === 'grm' || unit === 'ml' || unit === 'mlt')) {
    servingGrams = +item.servingSize;
    const hh = (item.householdServingFullText || '').trim();
    servingLabel = hh ? `${hh} (${r0(servingGrams)} g)` : `${r0(servingGrams)} g`;
  } else if ((item.foodMeasures || []).length) {
    const m = item.foodMeasures.find((x) => x.gramWeight > 0 && !/quantity not specified/i.test(x.disseminationText || '')) || item.foodMeasures.find((x) => x.gramWeight > 0);
    if (m) { servingGrams = +m.gramWeight; servingLabel = `${m.disseminationText} (${r0(servingGrams)} g)`; }
  }
  // The printed label (per serving, straight from the maker) wins when we have it.
  const L = item.labelNutrients || {};
  const lv = (k) => (L[k] && L[k].value != null ? +L[k].value : null);
  const label = servingGrams && lv('calories') != null;
  const per100 = (v) => r2((v / servingGrams) * 100);
  const cal = label ? per100(lv('calories')) : get('cal');
  if (cal == null) return null;
  const brand = (item.brandName || item.brandOwner || item.restaurant || '').trim();
  return {
    name: titleCase(String(item.description || '').trim()) || 'Unnamed food', brand: titleCase(brand), source: 'usda-online', fdcId: item.fdcId || null,
    barcode: item.gtinUpc || null,
    baseGrams: 100, baseLabel: '100 g',
    cal: label ? cal : r2(cal),
    p: label ? per100(lv('protein') || 0) : r2(get('p') || 0),
    c: label ? per100(lv('carbohydrates') || 0) : r2(get('c') || 0),
    f: label ? per100(lv('fat') || 0) : r2(get('f') || 0),
    fromLabel: !!label,
    servingLabel, servingGrams,
    packageGrams: packageGrams(item.packageWeight),
  };
}
// "15 oz/425 g", "425 g", "2.25 OZ", "12 fl oz/355 mL"
export function packageGrams(txt) {
  const t = String(txt || '');
  const g = t.match(/([\d.]+)\s*(g|ml)\b/i);
  if (g) return +g[1];
  const oz = t.match(/([\d.]+)\s*(fl\.?\s*)?oz\b/i);
  return oz ? Math.round(+oz[1] * (oz[2] ? 29.57 : 28.35)) : null;
}
const titleCase = (s) => (s === s.toUpperCase() ? s.toLowerCase().replace(/\b([a-z])/g, (m) => m.toUpperCase()) : s);

// Data checks: drop entries whose numbers or labels clearly don't belong to the food.
//  - calories must roughly match 4·protein + 4·carbs + 9·fat
//  - a name like "Wendy's Baconator" filed under a different brand is a mix-up
export function looksRight(food) {
  const fromMacros = 4 * food.p + 4 * food.c + 9 * food.f;
  if (food.cal > 900 || food.p > 100 || food.c > 100 || food.f > 100) return false; // per 100 g, impossible
  if (fromMacros > 40 || food.cal > 40) {
    const diff = Math.abs(food.cal - fromMacros) / Math.max(food.cal, fromMacros);
    if (diff > 0.3) return false;
  }
  if (food.brand) {
    const b = norm(food.brand).replace(/ s\b/g, 's');
    const owner = [...String(food.name).matchAll(/([A-Za-z][A-Za-z.&-]+)['’]s\b/g)].map((m) => norm(m[1]).replace(/ /g, ''));
    if (owner.length && !owner.some((o) => b.replace(/ /g, '').includes(o) || o.includes(b.replace(/ /g, '').slice(0, 5)))) return false;
  }
  return true;
}

// How trustworthy a food's numbers are (lower is better), to pick between duplicates.
export const dataScore = (f) => Math.abs(f.cal - (4 * f.p + 4 * f.c + 9 * f.f)) / Math.max(1, f.cal) - (f.source === 'usda-online' ? 0.05 : 0) - (f.servingGrams ? 0.02 : 0);

export function norm(s) {
  return String(s).toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, ' ').trim();
}

// Every word typed must appear; words matching at the start rank first.
// Ranking: the plain food first. "apple" → "Apples, raw, with skin" before "Apple juice"
// or Applebee's. A food whose main name (before the first comma) is exactly what you typed,
// plural or not, goes to the top; raw/whole versions before processed ones.
export function search(q, items, limit = 30) {
  const toks = norm(q).split(' ').filter(Boolean);
  if (!toks.length) return [];
  const plural = (t) => [t, t + 's', t + 'es', t.replace(/y$/, 'ies')];
  const out = [];
  for (const it of items) {
    const name = ' ' + norm(`${it.name} ${it.brand || ''}`) + ' ';
    let score = 0, ok = true;
    for (const t of toks) {
      const forms = plural(t);
      const w = Math.min(...forms.map((x) => { const i = name.indexOf(' ' + x + ' '); return i < 0 ? Infinity : i; }));
      if (w !== Infinity) { score += w === 0 ? 0 : 0.5; continue; } // whole word (or its plural)
      const i = name.indexOf(' ' + t);
      if (i >= 0) { score += i === 0 ? 1 : 1.5; continue; } // start of a word
      if (name.includes(t)) { score += 3; continue; }
      ok = false; break;
    }
    if (!ok) continue;
    const segs = String(it.name).split(',');
    const words = (n) => norm(segs.slice(0, n).join(' ')).split(' ').filter(Boolean);
    const same = (head) => head.length === toks.length && toks.every((t) => head.some((x) => plural(t).includes(x)));
    const exact = same(words(1)) || same(words(2)); // "Apples, raw" for apple; "Egg, white, raw" for egg white
    if (exact) score -= 4;
    if (exact && / raw /.test(name)) score -= 1;
    if (exact && / whole /.test(name)) score -= 0.5;
    if (/\b(human|sheep|goat|buffalo|imitation|babyfood|infant|substitute|alaska native|navajo|hopi)\b/.test(name)) score += 2;
    if (exact && /cooked|canned|dried|\bdry\b|buttermilk|dehydrated|frozen|sweetened|juice/.test(name)) score += 1;
    if (!it.brand && it.source === 'usda' && it.name === it.name.toUpperCase()) score += 1; // restaurant entries
    out.push([score + name.length / 200, it]);
  }
  return out.sort((a, b) => a[0] - b[0]).slice(0, limit).map((x) => x[1]);
}

export function sameFood(a, b) {
  if (a.barcode && b.barcode) return a.barcode === b.barcode;
  return norm(a.name) === norm(b.name) && norm(a.brand || '') === norm(b.brand || '') && a.source === b.source;
}
