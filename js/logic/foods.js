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
  };
}

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
