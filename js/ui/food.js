import { h, fmt } from './dom.js';
import { button, card, header, sheet, field, numberInput, toast, segmented, empty, confirmSheet, light } from './components.js';
import { nice, iso } from '../logic/dates.js';
import { MACROS, units, macrosFor, defaultAmount } from '../logic/nutrition.js';
import { search, norm } from '../logic/foods.js';
import { usdaFoods, searchOnline, lookupBarcode } from '../core/foodapi.js';
import { startScan } from '../core/scanner.js';
import * as data from '../data.js';

// Screen state kept between redraws.
const state = { meal: data.mealNow(), q: '', onlineBusy: false, onlineError: '' };
const onlineCache = new Map(); // search words -> online results, so typing more narrows instantly
const clearSearch = () => {
  state.q = ''; state.onlineError = '';
  const box = document.querySelector('#add-food input[type="search"]');
  if (box && box.value) { box.value = ''; box.dispatchEvent(new Event('input')); }
};

const mealName = (id) => (data.MEALS.find((m) => m[0] === id) || [, 'Snacks'])[1];
const mealSelect = (value) => h('select', null, data.MEALS.map(([id, label]) => h('option', { value: id, selected: id === value }, label)));
const macroText = (m) => `${fmt(m.cal)} cal · ${fmt(m.p, 1)} g protein · ${fmt(m.c, 1)} g carbs · ${fmt(m.f, 1)} g fat`;
const sourceLabel = { usda: 'Basic foods', 'usda-online': 'USDA', off: 'Open Food Facts', custom: 'My item' };

export function foodSheet(food, today) {
  const saved = (food.id && food.source && data.savedFoods().find((f) => f.id === food.id)) || data.findSaved(food);
  const base = saved || food;
  const d = defaultAmount(base);
  const amount = numberInput(d.amount, { 'aria-label': 'Amount' });
  const unitSel = h('select', { 'aria-label': 'Unit' }, units(base).map((u) => h('option', { value: u.id, selected: u.id === d.unit }, u.label)));
  const mealSel = mealSelect(state.meal);
  const preview = h('p', { class: 'num-line' });
  const draw = () => { preview.textContent = macroText(macrosFor(base, amount.value, unitSel.value)); };
  amount.addEventListener('input', draw);
  unitSel.addEventListener('change', draw);
  draw();

  const perLabel = base.baseGrams ? 'Per 100 g' : `Per ${base.baseLabel}`;
  const body = h('div', { class: 'stack' },
    base.brand ? h('div', { class: 'sub' }, base.brand) : null,
    h('div', { class: 'sub' }, `${perLabel}: ${macroText(base)}`),
    h('div', { class: 'grid2' }, field('Amount', amount), field('Unit', unitSel)),
    field('Meal', mealSel),
    preview);

  const saveBtn = saved
    ? button('Remove from Frequently used', async () => { await data.unsaveFood(saved.id); s.close(); toast('Removed'); }, 'danger block')
    : button('Save to Frequently used', async () => { clearSearch(); await data.saveFood(food); s.close(); toast('Saved to Frequently used'); }, 'block');

  const s = sheet(base.name, body, [
    button('Add', async () => {
      if (!(+amount.value > 0)) { toast('Enter an amount'); return; }
      state.meal = mealSel.value;
      clearSearch();
      await data.logFood(today, base, +amount.value, unitSel.value, mealSel.value);
      s.close();
      toast(`Added to ${mealName(mealSel.value)}`);
    }, 'primary block'),
    saveBtn,
  ]);
}

export function customSheet(today, prefill = {}) {
  const name = h('input', { type: 'text', value: prefill.name || '', placeholder: 'e.g. Chicken rice bowl' });
  const serving = h('input', { type: 'text', value: '1 serving' });
  const nums = Object.fromEntries(MACROS.map((m) => [m.key, numberInput('')]));
  const read = () => ({ name: name.value, servingLabel: serving.value, cal: nums.cal.value, p: nums.p.value, c: nums.c.value, f: nums.f.value });
  const valid = () => { if (!name.value.trim()) { toast('Enter a name'); return false; } return true; };
  const s = sheet('Add item', h('div', { class: 'stack' },
    field('Name', name),
    field('Serving (what the numbers are for)', serving),
    h('div', { class: 'grid2' }, MACROS.map((m) => field(m.label + (m.unit ? ` (${m.unit})` : ''), nums[m.key])))), [
    button('Save and add to today', async () => {
      if (!valid()) return;
      const f = await data.saveCustomFood(read());
      await data.logFood(today, f, 1, 'serving', state.meal);
      s.close();
      toast('Saved and added');
    }, 'primary block'),
    button('Save to Frequently used', async () => {
      if (!valid()) return;
      await data.saveCustomFood(read());
      s.close();
      toast('Saved');
    }, 'block'),
  ]);
}

function scanSheet(today) {
  const video = h('video', { class: 'scan-video', 'aria-label': 'Camera' });
  const msg = h('p', { class: 'sub' }, 'Starting camera…');
  const extra = h('div', { class: 'stack' });
  let stop = null;
  const s = sheet('Scan barcode', h('div', { class: 'stack' }, video, msg, extra), [], { onClose: () => stop && stop() });
  if (!navigator.onLine) { msg.textContent = 'Scanning needs internet. Your Frequently used foods work offline.'; video.remove(); return; }
  startScan(video, async (code) => {
    msg.textContent = `Looking up ${code}…`;
    try {
      const food = await lookupBarcode(code);
      if (food) { s.close(); foodSheet(food, today); return; }
      msg.textContent = `Barcode ${code} isn't in the food database.`;
    } catch (e) {
      msg.textContent = e.message;
    }
    extra.replaceChildren(button('Add it as a new item', () => { s.close(); customSheet(today); }, 'block'));
  }).then((fn) => { stop = fn; if (!s.panel.isConnected) fn(); else msg.textContent = 'Point the camera at the barcode.'; })
    .catch((e) => {
      video.remove();
      msg.textContent = e && e.name === 'NotAllowedError'
        ? 'Camera access was blocked. Allow it in your phone settings and try again.'
        : 'The scanner could not start on this device.';
    });
}

function foodRow(food, today, quickAdd) {
  const d = defaultAmount(food);
  const m = macrosFor(food, d.amount, d.unit);
  return h('div', { class: 'item' },
    h('button', { type: 'button', class: 'item-main', onClick: () => foodSheet(food, today) },
      h('span', { class: 'item-name' }, food.name),
      h('span', { class: 'sub' }, [food.brand, sourceLabel[food.source], `${fmt(m.cal)} cal`].filter(Boolean).join(' · '))),
    quickAdd ? h('button', { type: 'button', class: 'btn add-btn', 'aria-label': `Add ${food.name}`, onClick: async () => {
      clearSearch();
      await data.logFood(today, food, d.amount, d.unit, state.meal);
      toast(`Added ${food.name} to ${mealName(state.meal)}`);
    } }, '+ Add') : null);
}

// Live search: results narrow with every letter. Foods on the phone show right away;
// online results load when you pause typing, and typing more filters what's already loaded.
function searchPanel(today) {
  const input = h('input', { type: 'search', value: state.q, placeholder: 'Search foods (e.g. Wendy\'s nuggets)', 'aria-label': 'Search foods', enterkeyhint: 'search', autocomplete: 'off' });
  const results = h('div', { class: 'list' });
  let timer = null;
  const key = (q) => norm(q);
  // best online results for q: exact cache, else the longest cached shorter search, filtered down
  const onlineFor = (q) => {
    const k = key(q);
    if (onlineCache.has(k)) return { list: search(q, onlineCache.get(k), 40), exact: true };
    let best = null;
    for (const c of onlineCache.keys()) if (k.startsWith(c) && (!best || c.length > best.length)) best = c;
    return best ? { list: search(q, onlineCache.get(best), 40), exact: false } : { list: [], exact: false };
  };
  const draw = async () => {
    const q = state.q.trim();
    if (!q) { results.replaceChildren(); return; }
    const local = search(q, [...data.savedFoods(), ...(await usdaFoods())], 15);
    if (q !== state.q.trim()) return; // typed again meanwhile
    const on = onlineFor(q);
    const seen = new Set(local.map((f) => norm(`${f.name} ${f.brand || ''}`)));
    const online = on.list.filter((f) => !seen.has(norm(`${f.name} ${f.brand || ''}`)));
    const kids = [...local.map((f) => foodRow(f, today, false)), ...online.map((f) => foodRow(f, today, false))];
    if (state.onlineBusy) kids.push(h('p', { class: 'sub search-status' }, 'Searching online…'));
    else if (!kids.length) kids.push(empty(state.onlineError || (navigator.onLine ? 'No matches yet. Keep typing or try other words.' : "No match on the phone, and you're offline.")));
    results.replaceChildren(...kids);
  };
  const goOnline = async () => {
    const q = state.q.trim();
    if (q.length < 2 || !navigator.onLine) return;
    const k = key(q);
    if (onlineCache.has(k)) return;
    const on = onlineFor(q);
    if (on.list.length >= 8) return; // a shorter search already covers this; no need to ask again
    state.onlineBusy = true; state.onlineError = ''; draw();
    try { onlineCache.set(k, await searchOnline(q)); } catch (e) { state.onlineError = e.message; }
    state.onlineBusy = false;
    if (key(state.q.trim()).startsWith(k) || k.startsWith(key(state.q.trim()))) draw();
  };
  input.addEventListener('input', () => {
    state.q = input.value; draw();
    clearTimeout(timer); timer = setTimeout(goOnline, 450);
  });
  input.addEventListener('keydown', (e) => { if (e.key === 'Enter') { input.blur(); clearTimeout(timer); goOnline(); } });
  draw();
  return h('div', { class: 'stack' }, input, results);
}

function frequentSheet(today) {
  sheet('Frequently used', savedPanel(today));
}

function savedPanel(today) {
  const foods = data.savedFoods();
  if (!foods.length) return empty('Nothing saved yet. Open any food and tap "Save to Frequently used", or tap Add item.');
  return h('div', { class: 'list' }, foods.map((f) => foodRow(f, today, true)));
}

const pct = (n, d) => (d > 0 ? Math.round((n / d) * 100) : 0);
const pcf = (x) => `P ${fmt(x.p, 1)} · C ${fmt(x.c, 1)} · F ${fmt(x.f, 1)}`;

function editLogSheet(log) {
  const amount = numberInput(log.amount, { 'aria-label': 'Amount' });
  const mealSel = mealSelect(data.mealOf(log));
  const s = sheet(log.name, h('div', { class: 'stack' },
    h('div', { class: 'sub' }, `${log.amountLabel} · ${fmt(log.cal)} cal · ${pcf(log)}`),
    h('div', { class: 'grid2' }, field(`Amount (${log.amountLabel.replace(/^[\d.]+\s*(× )?/, '')})`, amount), field('Meal', mealSel))), [
    button('Save', async () => {
      if (!(+amount.value > 0)) { toast('Enter an amount'); return; }
      await data.updateLog(log, { amount: +amount.value, meal: mealSel.value });
      s.close();
    }, 'primary block'),
    button('Remove', async () => { await data.removeLog(log.id); s.close(); toast('Removed'); }, 'danger block'),
  ]);
}

// Every item eaten, grouped by meal, with per-item and per-meal macros.
export function mealBreakdown(date, { editable = false, onAdd = null } = {}) {
  const logs = data.foodLogs(date);
  return h('div', { class: 'stack' }, data.MEALS.map(([id, label]) => {
    const items = logs.filter((l) => data.mealOf(l) === id);
    if (!items.length && !editable) return null;
    const t = data.totalsOf(items);
    return h('section', { class: 'card meal', 'aria-label': label },
      h('div', { class: 'row' }, h('h2', { class: 'card-title grow' }, label), h('span', { class: 'num' }, `${fmt(t.cal)} cal`)),
      items.length ? h('div', { class: 'sub' }, pcf(t)) : null,
      items.length ? h('div', { class: 'list' }, items.map((l) => {
        const kids = [
          h('span', { class: 'meal-item-top' }, h('span', { class: 'item-name' }, l.name), h('span', { class: 'num' }, fmt(l.cal))),
          h('span', { class: 'sub' }, `${[l.brand, l.amountLabel].filter(Boolean).join(' · ')} · ${pcf(l)}`),
        ];
        return editable
          ? h('button', { type: 'button', class: 'item item-main meal-item', onClick: () => editLogSheet(l) }, kids)
          : h('div', { class: 'item item-main meal-item' }, kids);
      })) : h('p', { class: 'sub', style: 'margin:0' }, 'Nothing yet.'),
      editable ? button(`+ Add to ${label}`, () => onAdd(id), 'ghost block') : null);
  }).filter(Boolean));
}

function summaryCard(date) {
  const t = data.dayTotals(date);
  const tg = data.settings().targets;
  const col = (num, label, cls = '') => h('div', { class: 'eq-col' }, h('div', { class: `eq-num ${cls}` }, num), h('div', { class: 'sub' }, label));
  const kcalP = t.p * 4, kcalC = t.c * 4, kcalF = t.f * 9, kcal = kcalP + kcalC + kcalF;
  const macro = (key, label, eaten, kc) => h('div', { class: 'macro' },
    h('div', { class: 'row prog-top' }, h('span', { class: 'grow' }, label),
      h('span', { class: 'num' }, `${fmt(eaten, 1)}g`, h('span', { class: 'sub' }, tg[key] ? ` / ${fmt(tg[key])}g` : ''))),
    h('div', { class: 'bar' }, h('i', { style: `width:${tg[key] ? Math.min(100, (eaten / tg[key]) * 100) : 0}%` })),
    h('div', { class: 'sub' }, `${pct(kc, kcal)}% of calories${tg[key] ? ` · ${fmt(Math.max(0, tg[key] - eaten), 1)}g left` : ''}`));
  const burn = data.burned(date);
  const notes = data.intakeNotes(date);
  const goal = tg.cal ? tg.cal + burn.kcal : null;
  return h('div', { class: 'stack' }, card(
    h('h2', { class: 'card-title' }, 'Calories remaining'),
    tg.cal
      ? h('div', { class: 'eq' }, col(fmt(tg.cal), 'Goal'),
        burn.kcal ? [h('span', { class: 'eq-op' }, '+'), col(fmt(burn.kcal), 'Exercise')] : null,
        h('span', { class: 'eq-op' }, '−'), col(fmt(t.cal), 'Food'), h('span', { class: 'eq-op' }, '='),
        col(fmt(goal - t.cal), 'Remaining', goal - t.cal < 0 ? 'over' : 'left'))
      : h('div', { class: 'eq' }, col(fmt(t.cal), 'Food'), burn.kcal ? col(fmt(burn.kcal), 'Exercise') : null,
        h('p', { class: 'sub', style: 'margin:0' }, 'Set your targets in Settings to see what\'s left.')),
    burn.kcal ? h('p', { class: 'sub', style: 'margin:0' }, `Lifting today: about ${burn.minutes} min, ${fmt(burn.kcal)} cal burned (estimate).`) : null,
    macro('p', 'Protein', t.p, kcalP), macro('c', 'Carbs', t.c, kcalC), macro('f', 'Fat', t.f, kcalF)),
  notes.length ? h('section', { class: 'card fuel', 'aria-label': 'Training day check' },
    h('h2', { class: 'card-title' }, 'Fuel for muscle growth'),
    h('ul', { class: 'fuel-list' }, notes.map((n) => h('li', null, n.text)))) : null);
}

// Everything eaten today in one list; tap an item to change its amount or remove it.
function loggedToday(date) {
  const logs = data.foodLogs(date);
  return card(h('h2', { class: 'card-title' }, 'Logged today'),
    logs.length ? h('div', { class: 'list' }, logs.map((l) => h('button', { type: 'button', class: 'item item-main meal-item', onClick: () => editLogSheet(l) },
      h('span', { class: 'meal-item-top' }, h('span', { class: 'item-name' }, l.name), h('span', { class: 'num' }, `${fmt(l.cal)} cal`)),
      h('span', { class: 'sub' }, `${[l.brand, l.amountLabel].filter(Boolean).join(' · ')} · ${pcf(l)}`)))) : empty('Nothing logged yet today.'));
}

// Daily supplement check-in (set the list in ☰ Settings → Supplements).
function supplementsCard(date) {
  const list = data.supplements();
  if (!list.length) return null;
  const taken = new Set(data.suppTaken(date));
  const n = list.filter((x) => taken.has(x.id)).length;
  // Check one off and show the Herblore XP it earned (or lost, when unchecked).
  const tick = async (x) => {
    const herb = () => data.skillInfo(iso()).list.find((sk) => sk.id === 'herblore');
    const before = herb();
    await data.toggleSupp(date, x.id);
    const after = herb();
    const d = after.xp - before.xp;
    if (d) toast(`${d > 0 ? '+' : '−'}${fmt(Math.abs(d), 0)} Herblore XP${after.level > before.level ? ` · Herblore level ${after.level}!` : ''}`);
  };
  return h('section', { class: 'card', 'aria-label': 'Supplements' },
    h('div', { class: 'row' }, h('h2', { class: 'card-title grow' }, 'Supplements'), h('span', { class: 'sub' }, `${n} of ${list.length}`)),
    h('div', { class: 'list' }, list.map((x) => h('div', { class: 'item' },
      light(taken.has(x.id), () => tick(x), `${x.name} ${taken.has(x.id) ? 'taken' : 'not taken'}`),
      h('button', { type: 'button', class: 'item-main', onClick: () => tick(x) },
        h('span', { class: 'item-name' }, x.name), h('span', { class: 'sub' }, x.dose || ''))))));
}

export const setFoodMeal = (meal) => { state.meal = meal; };

// The Food tab is for today, or for a past day opened from History (#food/2026-11-16).
export function renderFood(root, ctx) {
  const past = /^\d{4}-\d{2}-\d{2}$/.test(ctx.sub || '') && ctx.sub < ctx.today ? ctx.sub : null;
  const today = past || ctx.today;
  const addSection = h('section', { class: 'card', id: 'add-food', 'aria-label': 'Add food' },
    h('h2', { class: 'card-title' }, 'Add food'),
    h('div', { class: 'field' }, h('span', null, 'Adding to'), segmented(data.MEALS, state.meal, (v) => { state.meal = v; ctx.rerender(); })),
    h('div', { class: 'grid3' }, button('Scan barcode', () => scanSheet(today)), button('Add item', () => customSheet(today)), button('Frequently used', () => frequentSheet(today))),
    searchPanel(today));
  root.append(...[
    past ? header(`Food · ${nice(today)}`, 'Editing a past day', button('Back to today', () => ctx.go('#food'), 'ghost')) : header('Food', nice(today)),
    summaryCard(today),
    addSection,
    past ? mealBreakdown(today, { editable: true, onAdd: (meal) => { state.meal = meal; ctx.rerender(); document.querySelector('#add-food input[type="search"]')?.focus(); } }) : loggedToday(today),
    supplementsCard(today)].filter(Boolean));
}
