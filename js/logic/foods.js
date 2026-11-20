// Converting outside food data into the app's one food shape, and local search.
const r0 = (n) => Math.round(n);
const r1 = (n) => Math.round(n * 10) / 10;

// USDA rows from data/usda-foods.json: [name, kcal, protein, carbs, fat, portionLabel, portionGrams] per 100 g
export function fromUSDA(row) {
  const [name, cal, p, c, f, pl, pg] = row;
  return {
    name, brand: '', source: 'usda', baseGrams: 100, baseLabel: '100 g',
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
    cal: r0(+kcal), p: r1(+n.proteins_100g || 0), c: r1(+n.carbohydrates_100g || 0), f: r1(+n.fat_100g || 0),
    servingLabel: prod.serving_size || null, servingGrams: sq > 0 ? sq : null,
    packageGrams: +prod.product_quantity > 0 && /g|ml/i.test(prod.quantity || 'g') ? +prod.product_quantity : null,
  };
}

// USDA FoodData Central search result -> food (per 100 g). Returns null without calories.
const NUT = { cal: ['208', 1008], p: ['203', 1003], c: ['205', 1005], f: ['204', 1004] };
export function fromFDC(item) {
  const get = (k) => {
    const n = (item.foodNutrients || []).find((x) => String(x.nutrientNumber) === NUT[k][0] || x.nutrientId === NUT[k][1]);
    return n && n.value != null && (k !== 'cal' || !n.unitName || /kcal/i.test(n.unitName)) ? +n.value : null;
  };
  const cal = get('cal');
  if (cal == null) return null;
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
  const brand = (item.brandName || item.brandOwner || item.restaurant || '').trim();
  return {
    name: titleCase(String(item.description || '').trim()) || 'Unnamed food', brand: titleCase(brand), source: 'usda-online', fdcId: item.fdcId || null,
    baseGrams: 100, baseLabel: '100 g',
    cal: r0(cal), p: r1(get('p') || 0), c: r1(get('c') || 0), f: r1(get('f') || 0),
    servingLabel, servingGrams,
    packageGrams: (() => { const m = String(item.packageWeight || '').match(/([\d.]+)\s*(g|ml)\b/i); return m ? +m[1] : null; })(),
  };
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
export function search(q, items, limit = 30) {
  const toks = norm(q).split(' ').filter(Boolean);
  if (!toks.length) return [];
  const out = [];
  for (const it of items) {
    const name = ' ' + norm(`${it.name} ${it.brand || ''}`) + ' ';
    let score = 0, ok = true;
    for (const t of toks) {
      const w = name.indexOf(' ' + t + ' ');
      if (w >= 0) { score += w === 0 ? 0 : 0.5; continue; } // whole word
      const i = name.indexOf(' ' + t);
      if (i >= 0) { score += i === 0 ? 1 : 1.5; continue; } // start of a word
      if (name.includes(t)) { score += 3; continue; }
      ok = false; break;
    }
    if (ok) out.push([score + name.length / 200, it]);
  }
  return out.sort((a, b) => a[0] - b[0]).slice(0, limit).map((x) => x[1]);
}

export function sameFood(a, b) {
  if (a.barcode && b.barcode) return a.barcode === b.barcode;
  return norm(a.name) === norm(b.name) && norm(a.brand || '') === norm(b.brand || '') && a.source === b.source;
}
