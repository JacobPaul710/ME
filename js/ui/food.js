import { h, fmt } from './dom.js';
import { button, card, header, sheet, field, numberInput, toast, segmented, empty, confirmSheet } from './components.js';
import { nice } from '../logic/dates.js';
import { MACROS, units, macrosFor, defaultAmount } from '../logic/nutrition.js';
import { search } from '../logic/foods.js';
import { usdaFoods, searchOnline, lookupBarcode } from '../core/foodapi.js';
import { startScan } from '../core/scanner.js';
import * as data from '../data.js';

// Screen state kept between redraws.
const state = { meal: data.mealNow(), tab: 'search', q: '', online: [], onlineFor: '', onlineBusy: false, onlineError: '' };

const mealName = (id) => (data.MEALS.find((m) => m[0] === id) || [, 'Snacks'])[1];
const mealSelect = (value) => h('select', null, data.MEALS.map(([id, label]) => h('option', { value: id, selected: id === value }, label)));
const macroText = (m) => `${fmt(m.cal)} cal · ${fmt(m.p, 1)} g protein · ${fmt(m.c, 1)} g carbs · ${fmt(m.f, 1)} g fat`;
const sourceLabel = { usda: 'Basic foods', off: 'Online', custom: 'My item' };

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
    : button('Save to Frequently used', async () => { await data.saveFood(food); s.close(); toast('Saved to Frequently used'); }, 'block');

  const s = sheet(base.name, body, [
    button('Add', async () => {
      if (!(+amount.value > 0)) { toast('Enter an amount'); return; }
      state.meal = mealSel.value;
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
  const s = sheet('Custom item', h('div', { class: 'stack' },
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
    extra.replaceChildren(button('Create a custom item', () => { s.close(); customSheet(today); }, 'block'));
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
      await data.logFood(today, food, d.amount, d.unit, state.meal);
      toast(`Added ${food.name} to ${mealName(state.meal)}`);
    } }, '+ Add') : null);
}

function searchPanel(today) {
  const input = h('input', { type: 'search', value: state.q, placeholder: 'Search foods', 'aria-label': 'Search foods', enterkeyhint: 'search' });
  const results = h('div', { class: 'list' });
  const draw = async () => {
    const q = state.q.trim();
    if (!q) { results.replaceChildren(empty('Type a food. Basic foods and your saved items work offline.')); return; }
    const local = search(q, [...data.savedFoods(), ...(await usdaFoods())], 25);
    if (q !== state.q.trim()) return; // typed again meanwhile
    const kids = local.map((f) => foodRow(f, today, false));
    if (!local.length) kids.push(empty('No match on the phone.'));
    if (state.onlineFor === q && state.online.length) {
      kids.push(h('h3', { class: 'list-head' }, 'Online results'), state.online.map((f) => foodRow(f, today, false)));
    } else if (state.onlineFor === q && !state.onlineBusy) {
      kids.push(empty(state.onlineError || 'Nothing found online.'));
    }
    kids.push(button(state.onlineBusy ? 'Searching…' : `Search online for “${q}”`, goOnline, 'block', { disabled: state.onlineBusy }));
    results.replaceChildren(...kids.flat());
  };
  const goOnline = async () => {
    const q = state.q.trim();
    if (!q) return;
    if (!navigator.onLine) { toast("You're offline. Online search needs signal."); return; }
    state.onlineBusy = true; state.onlineError = ''; draw();
    try { state.online = await searchOnline(q); } catch (e) { state.online = []; state.onlineError = e.message; }
    state.onlineFor = q; state.onlineBusy = false; draw();
  };
  input.addEventListener('input', () => { state.q = input.value; draw(); });
  input.addEventListener('keydown', (e) => { if (e.key === 'Enter') { input.blur(); goOnline(); } });
  draw();
  return h('div', { class: 'stack' }, input, results);
}

function savedPanel(today) {
  const foods = data.savedFoods();
  if (!foods.length) return empty('Nothing saved yet. Open any food and tap "Save to Frequently used", or create a custom item.');
  return h('div', { class: 'list' }, foods.map((f) => foodRow(f, today, true)));
}

const pct = (n, d) => (d > 0 ? Math.round((n / d) * 100) : 0);
const pcf = (x) => `P ${fmt(x.p, 1)} · C ${fmt(x.c, 1)} · F ${fmt(x.f, 1)}`;

function editLogSheet(log) {
  const amount = numberInput(log.amount, { 'aria-label': 'Amount' });
  const mealSel = mealSelect(data.mealOf(log));
  const s = sheet(log.name, h('div', { class: 'stack' },
    h('div', { class: 'sub' }, `${log.amountLabel} · ${fmt(log.cal)} cal · ${pcf(log)}`),
    h('div', { class: 'grid2' }, field(`Amount (${log.unit === 'g' ? 'grams' : 'servings'})`, amount), field('Meal', mealSel))), [
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

export function renderFood(root, ctx) {
  const { today } = ctx;
  const addSection = h('section', { class: 'card', id: 'add-food', 'aria-label': 'Add food' },
    h('div', { class: 'row' }, h('h2', { class: 'card-title grow' }, 'Add food')),
    h('div', { class: 'field' }, h('span', null, 'Adding to'), segmented(data.MEALS, state.meal, (v) => { state.meal = v; ctx.rerender(); })),
    h('div', { class: 'grid2' }, button('Scan barcode', () => scanSheet(today)), button('Custom item', () => customSheet(today))),
    segmented([['search', 'Search'], ['saved', 'Frequently used']], state.tab, (v) => { state.tab = v; ctx.rerender(); }),
    state.tab === 'search' ? searchPanel(today) : savedPanel(today));
  const onAdd = (meal) => {
    state.meal = meal;
    ctx.rerender();
    requestAnimationFrame(() => {
      document.getElementById('add-food')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
      document.querySelector('#add-food input[type=search]')?.focus({ preventScroll: true });
    });
  };
  root.append(
    header('Food', nice(today)),
    summaryCard(today),
    mealBreakdown(today, { editable: true, onAdd }),
    addSection);
}
