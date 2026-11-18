// Food lookups: the USDA basic list kept on the phone, and Open Food Facts online.
import { fromOFF, fromUSDA, fromFDC, looksRight, dataScore, norm } from '../logic/foods.js';
import { FDC } from '../config.js';

const OFF = 'https://world.openfoodfacts.org';
const FIELDS = 'code,product_name,brands,nutriments,serving_size,serving_quantity';

// Give up after 10 s so a weak signal never leaves the screen stuck.
async function get(url) {
  const ctl = new AbortController();
  const t = setTimeout(() => ctl.abort(), 10000);
  try {
    return await fetch(url, { signal: ctl.signal });
  } catch {
    throw new Error("Couldn't reach the food database. Check your signal and try again.");
  } finally {
    clearTimeout(t);
  }
}

let usda = null;
export async function usdaFoods() {
  if (usda) return usda;
  try {
    const res = await fetch('data/usda-foods.json');
    usda = (await res.json()).map(fromUSDA);
  } catch {
    usda = [];
  }
  return usda;
}

async function searchOFF(q) {
  const url = `${OFF}/cgi/search.pl?search_terms=${encodeURIComponent(q)}&search_simple=1&action=process&json=1&page_size=25&fields=${FIELDS}`;
  const res = await get(url);
  if (!res.ok) throw new Error('busy');
  const j = await res.json();
  return (j.products || []).map(fromOFF).filter(Boolean);
}

async function searchFDC(q) {
  const url = `${FDC.url}/foods/search?api_key=${FDC.key}&query=${encodeURIComponent(q)}&pageSize=25&dataType=${encodeURIComponent('Branded,Survey (FNDDS)')}`;
  const res = await get(url);
  if (!res.ok) throw new Error('busy');
  const j = await res.json();
  return (j.foods || []).map(fromFDC).filter(Boolean);
}

// Both online sources at once. Entries that fail the data checks are dropped, and when the
// same food comes back more than once, the copy with the most consistent numbers wins.
export async function searchOnline(q) {
  const got = await Promise.allSettled([searchFDC(q), searchOFF(q)]);
  const all = got.flatMap((r) => (r.status === 'fulfilled' ? r.value : []));
  if (!all.length && got.every((r) => r.status === 'rejected')) throw new Error('Online search is busy. Try again in a minute.');
  const best = new Map();
  for (const f of all.filter(looksRight)) {
    const k = norm(`${f.brand} ${f.name}`);
    if (!best.has(k) || dataScore(f) < dataScore(best.get(k))) best.set(k, f);
  }
  return [...best.values()];
}

// Returns a food, or null when the barcode isn't in the database.
export async function lookupBarcode(code) {
  const res = await get(`${OFF}/api/v2/product/${encodeURIComponent(code)}.json?fields=${FIELDS}`);
  if (res.status === 404) return null;
  if (!res.ok) throw new Error('Barcode lookup failed. Try again.');
  const j = await res.json();
  if (!j.product) return null;
  return fromOFF({ ...j.product, code });
}
