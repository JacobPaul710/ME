import { h } from './dom.js';
import { button, card, header, field, numberInput, toast, confirmSheet, segmented } from './components.js';
import { MACROS } from '../logic/nutrition.js';
import { toCSV } from '../logic/csv.js';
import { iso } from '../logic/dates.js';
import { session } from '../core/auth.js';
import { APP_VERSION } from '../config.js';
import * as data from '../data.js';
import * as store from '../core/store.js';
import { LEVEL_THEMES } from './levelThemes.js';
import { ACTIVITY, GOALS, PACES, activityValue, paceInfo } from '../logic/targets.js';
import { checkForUpdate } from '../core/update.js';
import { PRESETS, suggest } from '../logic/supplements.js';
import { REST_CHOICES } from './restTimer.js';
import { MONSTERS, monsterById } from './monster.js';
import { evolved } from '../celebrations.js';
import { sfx } from '../core/sfx.js';
import { cheer } from '../core/cheers.js';
import { celebrate, levelUp, tierUnlocked } from '../celebrations.js';
import { TIERS } from '../logic/gear.js';
import { sheet } from './components.js';
import { levelCardView } from './today.js';
import { iso as todayIso } from '../logic/dates.js';

const EXPORTS = {
  workouts: ['Workouts', [['date', 'date'], ['day', 'dayType'], ['exercise', 'exercise'], ['set', 'n'], ['weight_lb', 'weight'], ['reps', 'reps'], ['right_reps', 'repsR'], ['left_reps', 'repsL'], ['minutes', 'minutes'], ['miles', 'miles'], ['done_at', 'doneAt']]],
  food: ['Food log', [['date', 'date'], ['meal', 'meal'], ['name', 'name'], ['brand', 'brand'], ['amount', 'amountLabel'], ['calories', 'cal'], ['protein_g', 'p'], ['carbs_g', 'c'], ['fat_g', 'f']]],
  weighins: ['Weigh-ins', [['date', 'date'], ['weight_lb', 'lb']]],
  checkins: ['Check-ins', [['date', 'date'], ['type', 'type'], ['workout', 'dayType']]],
};

// Full backup to a file, and restore from it. Your data also lives on the phone and in your
// account and app updates never touch it; this is an extra copy you keep.
async function shareFile(file, title) {
  if (navigator.canShare && navigator.canShare({ files: [file] })) {
    try { await navigator.share({ files: [file], title }); return; } catch (e) { if (e.name === 'AbortError') return; }
  }
  const url = URL.createObjectURL(file);
  const a = h('a', { href: url, download: file.name });
  document.body.append(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 5000);
}
function backupCard() {
  const pick = h('input', { type: 'file', accept: '.json,application/json', hidden: true, 'aria-label': 'Backup file' });
  pick.addEventListener('change', async () => {
    const f = pick.files[0]; if (!f) return;
    try {
      const j = JSON.parse(await f.text());
      if (!j || j.app !== 'ME' || !Array.isArray(j.records)) throw new Error('bad');
      confirmSheet('Restore this backup?', `It has ${j.records.length} entries from ${j.date}. Anything in it replaces the same entry here; nothing else is removed.`, 'Restore', async () => {
        const n = await store.restore(j.records); toast(`Restored ${n} entries`);
      });
    } catch { toast("That file isn't an ME backup"); }
    pick.value = '';
  });
  return card(h('h2', { class: 'card-title' }, 'Backup'),
    h('p', { class: 'sub', style: 'margin:0' }, 'Updates never erase your data: it stays on your phone and in your account. A backup is an extra copy you can keep in Files.'),
    button('Download backup', () => shareFile(new File([JSON.stringify({ app: 'ME', version: APP_VERSION, date: iso(), records: store.backup() })], `me-backup-${iso()}.json`, { type: 'application/json' }), 'ME backup'), 'block'),
    button('Restore from backup', () => pick.click(), 'block'), pick);
}

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

// Hear and see every sound and pop-up without waiting weeks. Nothing is saved.
function previewSheet() {
  const row = (label, fn) => button(label, fn, 'block');
  sheet('Preview sounds and messages', h('div', { class: 'stack' },
    h('h3', { class: 'list-head' }, 'Sounds'),
    h('div', { class: 'grid2' }, row('Level-up', () => sfx.levelUp()), row('Gear tier', () => sfx.tier()),
      row('Streak milestone', () => sfx.milestone()), row('Rest bell', () => sfx.restDone())),
    row('Voice cheer', async () => { if (!(await cheer())) toast('No voice clips yet. Add them to audio/cheers.'); }),
    h('h3', { class: 'list-head' }, 'Pop-ups'),
    h('div', { class: 'grid2' }, row('Combat level 14', () => levelUp(14)), row('Combat level 20', () => levelUp(20)), row('Monster evolves', () => evolved(data.activeChar().name || monsterById(data.activeChar().monster).name, 'Fledgling', 25)),
      row('7-day streak', () => celebrate(7)), row('30-day streak', () => celebrate(30))),
    h('h3', { class: 'list-head' }, 'Gear tiers'),
    TIERS.map((t) => row(`${t.name} (day ${t.day})`, () => tierUnlocked(t)))));
}

// Your character is locked in once picked. Starting a new one pauses the current one at its
// level; you can switch back any time and keep levelling it.
const charLabel = (c) => `${c.name || (c.kind === 'knight' ? 'Knight' : monsterById(c.monster).name)} (${c.kind === 'knight' ? 'Knight' : monsterById(c.monster).name})`;

function renameSheet(c) {
  const name = h('input', { type: 'text', value: c.name || '', maxlength: '24', placeholder: 'Name' });
  const s = sheet('Name your character', field('Name', name), [button('Save', async () => {
    if (!name.value.trim()) { name.focus(); return; }
    await data.renameChar(c.id, name.value.trim()); s.close();
  }, 'primary block')]);
}

function newCharSheet() {
  const today = todayIso();
  const cur = data.activeChar();
  const curLevel = data.skillInfo(today).combat;
  let kind = 'monster';
  const pick = h('select', { 'aria-label': 'Monster' }, MONSTERS.map((m) => h('option', { value: m.id }, `${m.name} (${m.kind})`)));
  const name = h('input', { type: 'text', maxlength: '24', placeholder: 'e.g. Grimjaw' });
  const pickWrap = h('div', null, field('Monster', pick));
  const kindSeg = h('div', null);
  const drawKind = () => { kindSeg.replaceChildren(segmented([['monster', 'Monster'], ['knight', 'Knight']], kind, (v) => { kind = v; pickWrap.hidden = v !== 'monster'; drawKind(); })); };
  drawKind();
  const s = sheet('Start a new character', h('div', { class: 'stack' },
    h('p', { class: 'sub', style: 'margin:0' }, `Current: ${charLabel(cur)} · combat level ${curLevel}. It pauses at this level, and you can switch back to it any time.`),
    kindSeg, pickWrap, field('Name', name),
    h('p', { class: 'sub', style: 'margin:0' }, 'The new character starts at combat level 3. Only workouts and check-ins from today on count toward it.')), [
    button('Start new character', async () => {
      if (!name.value.trim()) { toast('Give it a name'); name.focus(); return; }
      await data.newCharacter({ kind, monster: kind === 'monster' ? pick.value : null, name: name.value.trim() }, today);
      s.close(); toast(`${name.value.trim()} is ready`);
    }, 'primary block')]);
}

function avatarCard() {
  const today = todayIso();
  const cur = data.activeChar();
  const others = data.characters().filter((c) => c.id !== cur.id);
  return card(h('h2', { class: 'card-title' }, 'Character'),
    h('div', { class: 'row' }, h('div', { class: 'grow' }, h('div', { class: 'sub' }, 'Current'), h('div', { class: 'item-name' }, `${charLabel(cur)} · combat level ${data.skillInfo(today).combat}`)),
      button(cur.name ? 'Rename' : 'Name it', () => renameSheet(cur), 'ghost')),
    others.length ? h('div', { class: 'list' }, others.map((c) => h('div', { class: 'item' },
      h('span', { class: 'item-main' }, h('span', { class: 'item-name' }, charLabel(c)), h('span', { class: 'sub' }, `Paused · combat level ${data.skillInfo(today, today, c).combat}`)),
      button('Switch', () => confirmSheet(`Switch to ${c.name || charLabel(c)}?`, `${cur.name || charLabel(cur)} pauses at combat level ${data.skillInfo(today).combat}. You can switch back any time.`, 'Switch', () => data.switchCharacter(c.id, today)), 'ghost')))) : null,
    button('Start a new character', newCharSheet, 'block'));
}

// Pick the level card background. Saves as soon as you tap one.
function themePicker(current) {
  const L = data.skillInfo(todayIso());
  return card(h('h2', { class: 'card-title' }, 'Level card theme'),
    h('div', { class: 'stack' }, LEVEL_THEMES.map(([id, label]) =>
      h('button', { type: 'button', class: 'theme-option', 'aria-pressed': id === current ? 'true' : 'false', onClick: async () => {
        await data.setLevelTheme(id);
        toast(`${label} theme on`);
      } },
      h('span', { class: 'theme-label' }, label, id === current ? h('span', { class: 'sub' }, ' · in use') : null),
      levelCardView(L, id)))));
}

// ---- supplements: what you take, checked off daily on the Food tab ----
const details = () => { const s = data.settings(); return { ...(s.profile || {}), sex: s.standards, weightLb: data.bodyweight() || (s.profile || {}).weightLb }; };
const newId = () => 'sp' + Date.now().toString(36) + Math.random().toString(36).slice(2, 5);

function editSupplement(item) {
  const list = data.supplements();
  const name = h('input', { type: 'text', value: item?.name || '', placeholder: 'e.g. Creatine' });
  const dose = h('input', { type: 'text', value: item?.dose || '', placeholder: 'e.g. 2.5 g' });
  const times = h('select', null, [1, 2, 3, 4].map((n) => h('option', { value: String(n), selected: n === (+item?.times || 1) }, n === 1 ? 'Once a day' : `${n} times a day (separate check-offs)`)));
  const s = sheet(item ? 'Edit supplement' : 'Other supplement', h('div', { class: 'stack' }, field('Name', name), field('Amount each time', dose), field('How often', times)), [
    button('Save', async () => {
      if (!name.value.trim()) { name.focus(); return; }
      const rec = { ...(item || {}), id: item?.id || newId(), name: name.value.trim(), dose: dose.value.trim(), times: +times.value };
      await data.setSupplements(item ? list.map((x) => (x.id === item.id ? rec : x)) : [...list, rec]);
      s.close();
    }, 'primary block'),
    item ? button('Remove', async () => { await data.setSupplements(list.filter((x) => x.id !== item.id)); s.close(); }, 'danger block') : null,
  ].filter(Boolean));
}

function addSupplementSheet() {
  const have = new Set(data.supplements().map((x) => x.preset).filter(Boolean));
  const p = details();
  const s = sheet('Add supplement', h('div', { class: 'stack' },
    h('p', { class: 'sub', style: 'margin:0' }, 'Amounts are worked out from your details above. Typical research doses, not medical advice.'),
    h('div', { class: 'list' }, PRESETS.filter((x) => !have.has(x.id)).map((x) => h('button', { type: 'button', class: 'item item-main', onClick: async () => {
      await data.setSupplements([...data.supplements(), { id: newId(), preset: x.id, name: x.name, dose: suggest(x.id, p) }]);
      s.close(); toast(`${x.name} added`);
    } }, h('span', { class: 'item-name' }, `${x.name} · ${suggest(x.id, p)}`), h('span', { class: 'sub' }, x.note))))),
  [button('Other…', () => { s.close(); editSupplement(null); }, 'block')]);
}

function supplementsCard() {
  const list = data.supplements();
  return card(h('h2', { class: 'card-title' }, 'Supplements'),
    h('p', { class: 'sub', style: 'margin:0' }, 'Check them off each day on the Food tab. Each one levels up Herblore.'),
    list.length ? h('div', { class: 'list' }, list.map((x) => h('button', { type: 'button', class: 'item item-main', 'aria-label': `Edit ${x.name}`, onClick: () => editSupplement(x) },
      h('span', { class: 'item-name' }, x.name), h('span', { class: 'sub' }, [x.dose, +x.times > 1 ? `${x.times}× a day` : null].filter(Boolean).join(' · '))))) : null,
    button('Add supplement', addSupplementSheet, 'block'));
}

// Rest timer length (saves as soon as you pick).
function restCard() {
  const rest = h('select', { 'aria-label': 'Rest between sets' },
    REST_CHOICES.map(([sec, label]) => h('option', { value: String(sec), selected: sec === (data.settings().restSeconds || 90) }, label)));
  rest.addEventListener('change', () => data.saveSettings({ ...data.settings(), restSeconds: +rest.value }));
  const on = h('input', { type: 'checkbox', checked: !!data.settings().restOn, 'aria-label': 'Rest timer on' });
  on.addEventListener('change', () => data.saveSettings({ ...data.settings(), restOn: on.checked }));
  return card(h('h2', { class: 'card-title' }, 'Rest between sets'),
    h('label', { class: 'row check' }, on, h('span', null, 'Rest timer on (it only alerts inside the app)')), rest);
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
  const gw = numberInput(pr.goalWeightLb || '', { placeholder: 'e.g. 210' });
  const paceBox = h('div', { class: 'pace', 'aria-live': 'polite' });
  const drawPace = () => {
    const pi = paceInfo({ goal: goalSel.value, pace: paceSel.value, weightLb: +wt.value, goalWeightLb: +gw.value });
    if (!pi) { paceBox.replaceChildren(); return; }
    const lb = `${pi.lbWeek > 0 ? '+' : '−'}${Math.abs(pi.lbWeek).toFixed(1)} lb a week (${pi.pct.toFixed(2)}% of your weight)`;
    const when = pi.atGoal ? 'You\'re at your goal weight.' : pi.wrongWay ? 'Your goal weight is the other way from this goal. Pick Cut to lose or a bulk to gain.'
      : pi.weeks ? `About ${pi.weeks} week${pi.weeks === 1 ? '' : 's'} to ${+gw.value} lb (around ${new Date(Date.now() + pi.weeks * 7 * 864e5).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })}).` : 'Add a goal weight to see how long it takes.';
    paceBox.replaceChildren(
      h('div', { class: 'row' }, h('span', { class: 'grow' }, lb), h('span', { class: `pace-tag ${pi.label.toLowerCase()}` }, pi.label)),
      h('div', { class: 'sub' }, `${pi.inRange ? 'Within' : pi.pct > (goalSel.value === 'cut' ? 1 : 0.5) ? 'Faster than' : 'Slower than'} the ${pi.range}-a-week research range for ${goalSel.value === 'cut' ? 'cutting' : 'lean gain'}. ${when}`));
  };
  const goalSel = h('select', null, GOALS.map(([v, label]) => h('option', { value: v, selected: (pr.goal || 'clean') === v }, label)));
  const paceSel = h('select', null, PACES.map(([v, label]) => h('option', { value: v, selected: (pr.pace || 'moderate') === v }, label)));
  const act = h('select', null, ACTIVITY.map(([v, label]) => h('option', { value: v, selected: activityValue(pr.activity) === v }, label)));
  const profile = () => ({ birthday: bday.value || null, heightIn: (+ft.value || 0) * 12 + (+inch.value || 0) || null, weightLb: +wt.value || null, goalWeightLb: +gw.value || null, goal: goalSel.value, pace: paceSel.value, activity: act.value });
  const calc = () => {
    const t = data.calculateTargets(profile());
    if (!t) { toast('Fill in birthday, height and weight first'); return; }
    inputs.cal.value = t.cal; inputs.p.value = t.p; inputs.c.value = t.c; inputs.f.value = t.f;
    save();
    toast(`Targets set: maintenance ≈ ${t.maintain} cal, ${t.adjust > 0 ? '+' : ''}${t.adjust} for your goal.`);
  };
  // Everything here saves by itself as you change it.
  const save = async () => {
    const targets = Object.fromEntries(MACROS.map((m) => [m.key, inputs[m.key].value === '' ? null : Math.max(0, +inputs[m.key].value)]));
    const n = Math.max(1, Math.round(+sessions.value || 4));
    await data.saveSettings({ ...data.settings(), targets, sessionsToAdvance: n, standards: sexSel.value, profile: profile() });
  };
  let timer;
  const soon = () => { clearTimeout(timer); timer = setTimeout(save, 400); };
  for (const el of [wt, gw, goalSel, paceSel]) el.addEventListener('input', drawPace), el.addEventListener('change', drawPace);
  drawPace();
  for (const el of [...Object.values(inputs), sessions, sexSel, bday, ft, inch, wt, gw, goalSel, paceSel, act]) {
    el.addEventListener('input', soon);
    el.addEventListener('change', () => { clearTimeout(timer); save(); });
  }
  const user = session()?.user;
  root.append(
    header('Settings', null, ctx.closeMenu ? h('button', { type: 'button', class: 'icon-btn', 'aria-label': 'Close menu', onClick: ctx.closeMenu }, '✕') : null),
    card(h('h2', { class: 'card-title' }, 'Your details'),
      h('div', { class: 'grid2' }, field('Sex', sexSel), field('Birthday', bday)),
      h('div', { class: 'grid2' }, field('Height (feet)', ft), field('Height (inches)', inch)),
      h('div', { class: 'grid2' }, field('Weight (lb)', wt), field('Goal weight (lb)', gw)),
      h('div', { class: 'grid2' }, field('Goal', goalSel), field('Pace', paceSel)),
      paceBox,
      field('Activity outside the gym', act),
      h('p', { class: 'sub', style: 'margin:0' }, 'Workouts are added on the days you train, so leave them out of activity.'),
      button('Calculate my targets', calc, 'block')),
    card(h('h2', { class: 'card-title' }, 'Daily targets'),
      h('div', { class: 'grid2' }, MACROS.map((m) => field(m.label + (m.unit ? ` (${m.unit})` : ''), inputs[m.key])))),
    supplementsCard(),
    restCard(),
    card(h('h2', { class: 'card-title' }, 'Rep goal'),
      field('Sessions in a row before the rep goal goes up', sessions)),
    backupCard(),
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
    card(h('h2', { class: 'card-title' }, 'Sounds and messages'),
      button('Preview sounds and messages', previewSheet, 'block')),
    avatarCard(),
    themePicker(s.levelTheme),
    h('p', { class: 'sub center version' }, `Version ${APP_VERSION}`),
    // Invisible: tap the space just under the version number to check for updates.
    h('button', { type: 'button', class: 'ghost-tap', 'aria-label': 'Check for updates', onClick: checkForUpdate }));
}
