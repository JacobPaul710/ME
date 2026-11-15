import { h } from './dom.js';
import { button, card, header, field, numberInput, toast, confirmSheet } from './components.js';
import { MACROS } from '../logic/nutrition.js';
import { toCSV } from '../logic/csv.js';
import { iso } from '../logic/dates.js';
import { session } from '../core/auth.js';
import { APP_VERSION } from '../config.js';
import * as data from '../data.js';

const EXPORTS = {
  workouts: ['Workouts', [['date', 'date'], ['day', 'dayType'], ['exercise', 'exercise'], ['set', 'n'], ['weight_lb', 'weight'], ['reps', 'reps'], ['minutes', 'minutes'], ['miles', 'miles'], ['done_at', 'doneAt']]],
  food: ['Food log', [['date', 'date'], ['meal', 'meal'], ['name', 'name'], ['brand', 'brand'], ['amount', 'amountLabel'], ['calories', 'cal'], ['protein_g', 'p'], ['carbs_g', 'c'], ['fat_g', 'f']]],
  weighins: ['Weigh-ins', [['date', 'date'], ['weight_lb', 'lb']]],
  checkins: ['Check-ins', [['date', 'date'], ['type', 'type'], ['workout', 'dayType']]],
};

async function exportCSV(key) {
  const [label, cols] = EXPORTS[key];
  const text = toCSV(data.exportRows()[key], cols);
  const name = `me-${key}-${iso()}.csv`;
  const file = new File([text], name, { type: 'text/csv' });
  if (navigator.canShare && navigator.canShare({ files: [file] })) {
    try { await navigator.share({ files: [file], title: label }); return; } catch (e) { if (e.name === 'AbortError') return; }
  }
  const url = URL.createObjectURL(file);
  const a = h('a', { href: url, download: name });
  document.body.append(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 5000);
}

export function renderSettings(root, ctx) {
  const s = data.settings();
  const inputs = Object.fromEntries(MACROS.map((m) => [m.key, numberInput(s.targets[m.key], { 'aria-label': `${m.label} target` })]));
  const sessions = numberInput(s.sessionsToAdvance, { inputmode: 'numeric', step: '1', min: '1', 'aria-label': 'Sessions in a row' });
  const sexSel = h('select', null, h('option', { value: 'men', selected: s.standards !== 'women' }, 'Men'), h('option', { value: 'women', selected: s.standards === 'women' }, 'Women'));
  const save = async () => {
    const targets = Object.fromEntries(MACROS.map((m) => [m.key, inputs[m.key].value === '' ? null : Math.max(0, +inputs[m.key].value)]));
    const n = Math.max(1, Math.round(+sessions.value || 4));
    await data.saveSettings({ ...s, targets, sessionsToAdvance: n, standards: sexSel.value });
    toast('Settings saved');
  };
  const user = session()?.user;
  root.append(
    header('Settings'),
    card(h('h2', { class: 'card-title' }, 'Daily targets'),
      h('div', { class: 'grid2' }, MACROS.map((m) => field(m.label + (m.unit ? ` (${m.unit})` : ''), inputs[m.key])))),
    card(h('h2', { class: 'card-title' }, 'Rep goal'),
      field('Sessions in a row before the rep goal goes up', sessions)),
    card(h('h2', { class: 'card-title' }, 'Strength levels'),
      field('Compare with standards for', sexSel)),
    button('Save settings', save, 'primary block'),
    card(h('h2', { class: 'card-title' }, 'Export (CSV)'),
      h('div', { class: 'grid2' }, Object.entries(EXPORTS).map(([k, [label]]) => button(label, () => exportCSV(k))))),
    card(h('h2', { class: 'card-title' }, 'Account'),
      h('div', { class: 'sub' }, user ? `Signed in as ${user.email}` : ''),
      button('Sign out', () => confirmSheet('Sign out?', 'Anything not yet synced stays on this phone and syncs when you sign in again.', 'Sign out', ctx.signOut), 'block')),
    h('p', { class: 'sub center' }, APP_VERSION));
}
