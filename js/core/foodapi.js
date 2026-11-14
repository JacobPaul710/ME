// Food lookups: the USDA basic list kept on the phone, and Open Food Facts online.
import { fromOFF, fromUSDA } from '../logic/foods.js';

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

export async function searchOnline(q) {
  const url = `${OFF}/cgi/search.pl?search_terms=${encodeURIComponent(q)}&search_simple=1&action=process&json=1&page_size=25&fields=${FIELDS}`;
  const res = await get(url);
  if (!res.ok) throw new Error('Online search is busy. Try again in a minute.');
  const j = await res.json();
  return (j.products || []).map(fromOFF).filter(Boolean);
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
