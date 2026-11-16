import { h } from './dom.js';
import { button, card, header, field, numberInput, toast, confirmSheet } from './components.js';
import { MACROS } from '../logic/nutrition.js';
import { toCSV } from '../logic/csv.js';
import { iso } from '../logic/dates.js';
import { session } from '../core/auth.js';
import { APP_VERSION } from '../config.js';
import * as data from '../data.js';
import { LEVEL_THEMES } from './levelThemes.js';
import { ACTIVITY, GOALS, activityValue } from '../logic/targets.js';
import { checkForUpdate } from '../core/update.js';
import { levelCardView } from './today.js';
import { iso as todayIso } from '../logic/dates.js';

const EXPORTS = {
  workouts: ['Workouts', [['date', 'date'], ['day', 'dayType'], ['exercise', 'exercise'], ['set', 'n'], ['weight_lb', 'weight'], ['reps', 'reps'], ['right_reps', 'repsR'], ['left_reps', 'repsL'], ['minutes', 'minutes'], ['miles', 'miles'], ['done_at', 'doneAt']]],
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

// Pick the level card background. Saves as soon as you tap one.
function themePicker(current) {
  const L = data.levelInfo(todayIso());
  return card(h('h2', { class: 'card-title' }, 'Level card theme'),
    h('div', { class: 'stack' }, LEVEL_THEMES.map(([id, label]) =>
      h('button', { type: 'button', class: 'theme-option', 'aria-pressed': id === current ? 'true' : 'false', onClick: async () => {
        await data.setLevelTheme(id);
        toast(`${label} theme on`);
      } },
      h('span', { class: 'theme-label' }, label, id === current ? h('span', { class: 'sub' }, ' · in use') : null),
      levelCardView(L, id)))));
}

export function renderSettings(root, ctx) {
  const s = data.settings();
  const inputs = Object.fromEntries(MACROS.map((m) => [m.key, numberInput(s.targets[m.key], { 'aria-label': `${m.label} target` })]));
  const sessions = numberInput(s.sessionsToAdvance, { inputmode: 'numeric', step: '1', min: '1', 'aria-label': 'Sessions in a row' });
  const pr = s.profile || {};
  const sexSel = h('select', null, h('option', { value: 'men', selected: s.standards !== 'women' }, 'Male'), h('option', { value: 'women', selected: s.standards === 'women' }, 'Female'));
  const bday = h('input', { type: 'date', value: pr.birthday || '', max: new Date().toISOString().slice(0, 10) });
  const ft = numberInput(pr.heightIn ? Math.floor(pr.heightIn / 12) : '', { inputmode: 'numeric', step: '1' });
  const inch = numberInput(pr.heightIn ? Math.round(pr.heightIn % 12) : '', { inputmode: 'numeric', step: '1' });
  const wt = numberInput(data.bodyweight() || pr.weightLb || '', {});
  const goalSel = h('select', null, GOALS.map(([v, label]) => h('option', { value: v, selected: (pr.goal || 'clean') === v }, label)));
  const act = h('select', null, ACTIVITY.map(([v, label]) => h('option', { value: v, selected: activityValue(pr.activity) === v }, label)));
  const profile = () => ({ birthday: bday.value || null, heightIn: (+ft.value || 0) * 12 + (+inch.value || 0) || null, weightLb: +wt.value || null, goal: goalSel.value, activity: act.value });
  const calc = () => {
    const t = data.calculateTargets(profile());
    if (!t) { toast('Fill in birthday, height and weight first'); return; }
    inputs.cal.value = t.cal; inputs.p.value = t.p; inputs.c.value = t.c; inputs.f.value = t.f;
    toast(`Maintenance ≈ ${t.maintain} cal, ${t.adjust > 0 ? '+' : ''}${t.adjust} for your goal. Tap Save settings.`);
  };
  const save = async () => {
    const targets = Object.fromEntries(MACROS.map((m) => [m.key, inputs[m.key].value === '' ? null : Math.max(0, +inputs[m.key].value)]));
    const n = Math.max(1, Math.round(+sessions.value || 4));
    await data.saveSettings({ ...data.settings(), targets, sessionsToAdvance: n, standards: sexSel.value, profile: profile() });
    toast('Settings saved');
  };
  const user = session()?.user;
  root.append(
    header('Settings'),
    card(h('h2', { class: 'card-title' }, 'Your details'),
      h('div', { class: 'grid2' }, field('Sex', sexSel), field('Birthday', bday)),
      h('div', { class: 'grid2' }, field('Height (feet)', ft), field('Height (inches)', inch)),
      h('div', { class: 'grid2' }, field('Weight (lb)', wt), field('Goal', goalSel)),
      field('Activity outside the gym', act),
      h('p', { class: 'sub', style: 'margin:0' }, 'Workouts are added on the days you train, so leave them out of activity.'),
      button('Calculate my targets', calc, 'block')),
    card(h('h2', { class: 'card-title' }, 'Daily targets'),
      h('div', { class: 'grid2' }, MACROS.map((m) => field(m.label + (m.unit ? ` (${m.unit})` : ''), inputs[m.key])))),
    card(h('h2', { class: 'card-title' }, 'Rep goal'),
      field('Sessions in a row before the rep goal goes up', sessions)),
    button('Save settings', save, 'primary block'),
    card(h('h2', { class: 'card-title' }, 'Export (CSV)'),
      h('div', { class: 'grid2' }, Object.entries(EXPORTS).map(([k, [label]]) => button(label, () => exportCSV(k))))),
    card(h('div', { class: 'row' }, h('h2', { class: 'card-title grow' }, 'Account'), ctx.syncBadge()),
      h('div', { class: 'sub' }, user ? `Signed in as ${user.email}` : ''),
      button('Sign out', () => confirmSheet('Sign out?', 'Anything not yet synced stays on this phone and syncs when you sign in again.', 'Sign out', ctx.signOut), 'block')),
    card(h('h2', { class: 'card-title' }, 'Voice cheers'),
      h('label', { class: 'check-row' },
        h('input', { type: 'checkbox', class: 'check', checked: s.voiceCheers !== false, onChange: async (e) => {
          await data.saveSettings({ ...data.settings(), voiceCheers: e.target.checked });
          toast(e.target.checked ? 'Voice cheers on' : 'Voice cheers off');
        } }),
        h('span', null, 'Play a cheer when I finish a set'))),
    themePicker(s.levelTheme),
    h('p', { class: 'sub center version' }, `Version ${APP_VERSION}`),
    // Invisible: tap the space just under the version number to check for updates.
    h('button', { type: 'button', class: 'ghost-tap', 'aria-label': 'Check for updates', onClick: checkForUpdate }));
}
