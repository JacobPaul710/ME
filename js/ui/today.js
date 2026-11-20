import { h, fmt, svg } from './dom.js';
import { button, card, header, light, progressRow, sheet, field, numberInput, toast, statusDot, confirmSheet } from './components.js';
import { streakWidget } from './streakWidget.js';
import { nice, iso, parse, addDays, short } from '../logic/dates.js';
import { MACROS } from '../logic/nutrition.js';
import * as data from '../data.js';
import { session } from '../core/auth.js';
import { themeBackground } from './levelThemes.js';
import { braziers, startFlames } from './braziers.js';
import { COMBAT_MAX } from '../logic/skills.js';

// Pick a workout type for a day, then open the logger for that day.
// A workout only counts once at least one set is logged as done.
export function pickDayType(date, go) {
  const s = sheet('Which workout?', h('div', { class: 'stack' },
    data.DAY_TYPES.map((d) => button(d.later ? `${d.id} (coming later)` : d.id, async () => {
      await data.setCheckin(date, 'exercise', d.id);
      s.close();
      go(date === iso() ? '#train' : `#train/${date}`);
    }, d.later ? 'block' : 'primary block', { disabled: d.later }))));
}

// Change what a day was (from the calendar or week row).
export function editDaySheet(date, go) {
  const st = data.dayStatus(date, iso());
  const now = st.kind === 'workout' ? `${st.dayType} workout` : { rest: 'Rest day', off: 'Off day', missed: 'Not checked in', today: 'Not checked in yet' }[st.kind];
  const s = sheet(nice(date), h('div', { class: 'stack' },
    h('p', { class: 'sub', style: 'margin:0' }, `Now: ${now}`),
    button('Food for this day', () => { s.close(); go(`#food/${date}`); }, 'block'),
    button(st.kind === 'workout' ? 'Open this workout' : 'Log a workout', () => {
      s.close();
      if (st.kind === 'workout') go(date === iso() ? '#train' : `#train/${date}`);
      else pickDayType(date, go);
    }, 'primary block'),
    h('p', { class: 'sub', style: 'margin:0' }, 'A workout counts once you log at least one set as done.'),
    button('Rest', async () => { await data.setCheckin(date, 'rest'); s.close(); }, 'block'),
    button('Off', async () => { await data.setCheckin(date, 'off'); s.close(); }, 'block'),
    data.checkin(date) || data.daySets(date).length ? button('Clear this day', () => {
      s.close();
      confirmSheet(`Clear ${nice(date)}?`, 'Removes the check-in and every set logged that day. Food and weigh-ins stay.', 'Clear this day', () => data.clearDay(date));
    }, 'danger block') : null));
}

function checkinCard(today, go) {
  const c = data.checkin(today);
  if (!c) {
    return card(
      h('div', { class: 'row' }, statusDot(false), h('h2', { class: 'card-title grow' }, 'What are we doing today?')),
      h('div', { class: 'grid3' },
        button('Exercise', () => pickDayType(today, go), 'primary'),
        button('Rest', () => data.setCheckin(today, 'rest')),
        button('Off', () => data.setCheckin(today, 'off'))));
  }
  if (c.type === 'exercise') {
    const done = data.setsOn(today).filter((s) => s.done).length;
    return card(
      h('div', { class: 'row' }, statusDot(done > 0),
        h('div', { class: 'grow' },
          h('h2', { class: 'card-title' }, `${c.dayType} day`),
          h('div', { class: 'sub' }, done ? `${done} set${done === 1 ? '' : 's'} done` : 'Finish a set to count today'))),
      h('div', { class: 'grid2' },
        button('Open workout', () => go('#train'), 'primary'),
        button('Change', () => changeCheckin(today, go))));
  }
  return card(
    h('div', { class: 'row' }, statusDot(true),
      h('div', { class: 'grow' }, h('h2', { class: 'card-title' }, c.type === 'rest' ? 'Rest day' : 'Off day'), h('div', { class: 'sub' }, 'Checked in'))),
    button('Change', () => changeCheckin(today, go), 'block'));
}

function changeCheckin(today, go) {
  const s = sheet('Change today', h('div', { class: 'stack' },
    button('Exercise', () => { s.close(); pickDayType(today, go); }, 'primary block'),
    button('Rest', async () => { await data.setCheckin(today, 'rest'); s.close(); }, 'block'),
    button('Off', async () => { await data.setCheckin(today, 'off'); s.close(); }, 'block'),
    button('Clear check-in', async () => { await data.clearCheckin(today); s.close(); }, 'danger block')));
}

export function weighSheet(today) {
  const cur = data.weighin(today);
  const input = numberInput(cur?.lb, { 'aria-label': 'Weight in pounds', placeholder: 'e.g. 182.4' });
  const save = async () => {
    const lb = parseFloat(input.value);
    if (!(lb > 0)) { toast('Enter your weight'); return; }
    await data.setWeighin(today, Math.round(lb * 10) / 10);
    s.close();
    toast('Weigh-in saved');
  };
  input.addEventListener('keydown', (e) => { if (e.key === 'Enter') save(); });
  const s = sheet('Weigh-in', field('Weight (lb)', input), [button('Save', save, 'primary block')]);
}

// The whole card is the button: tap anywhere on it to log or edit today's weight.
function weighCard(today) {
  const w = data.weighin(today);
  return h('button', { type: 'button', class: 'card weigh-card', 'aria-label': w ? `Weigh-in: ${w.lb} lb today. Tap to edit` : 'Weigh-in: not logged today. Tap to log', onClick: () => weighSheet(today) },
    h('div', { class: 'row' },
      statusDot(!!w),
      h('div', { class: 'grow' }, h('h2', { class: 'card-title' }, 'Weigh-in'), h('div', { class: 'sub' }, w ? `${w.lb} lb today` : 'Not logged today'))));
}

function foodCard(today, go) {
  const t = data.dayTotals(today);
  const tg = data.settings().targets;
  // Green once protein is at target and calories are within 10% of the goal.
  const met = (+tg.p > 0 || +tg.cal > 0) && (!+tg.p || t.p >= +tg.p) && (!+tg.cal || t.cal >= +tg.cal * 0.9);
  return card(
    h('div', { class: 'row' }, statusDot(met), h('h2', { class: 'card-title grow' }, parse(today).toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })), button('Add food', () => go('#food'), 'ghost')),
    MACROS.map((m) => progressRow(m.label, t[m.key], tg[m.key], m.unit)));
}

const SWORDS = '<svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><polyline points="14.5 17.5 3 6 3 3 6 3 17.5 14.5"/><line x1="13" x2="19" y1="19" y2="13"/><line x1="16" x2="20" y1="16" y2="20"/><line x1="19" x2="21" y1="21" y2="19"/><polyline points="14.5 6.5 18 3 21 3 21 6 17.5 9.5"/><line x1="5" x2="9" y1="14" y2="18"/><line x1="7" x2="4" y1="17" y2="20"/><line x1="3" x2="5" y1="19" y2="21"/></svg>';

// Combat level card. Tap it to see what you've done toward the next level and what's still needed.
export function levelCardView(C, theme, onTap) {
  const pct = Math.max(0, Math.min(100, (C.exact - C.combat) * 100));
  const max = C.combat >= COMBAT_MAX;
  return h(onTap ? 'button' : 'section', { ...(onTap ? { type: 'button', onClick: onTap } : {}), class: `card level theme-${theme}`, 'aria-label': `Combat level ${C.combat}${onTap ? '. Tap to flip and see what\'s needed for the next level' : ''}` },
    themeBackground(theme),
    h('div', { class: 'row level-body' },
      h('div', { class: 'level-badge' }, svg(SWORDS), h('span', { class: 'level-num' }, String(C.combat))),
      h('div', { class: 'grow stack tight' },
        h('div', { class: 'level-title' }, 'Combat level'),
        h('div', { class: 'bar xp' }, h('i', { style: `width:${max ? 100 : pct}%` })),
        h('div', { class: 'row prog-top level-xp' }, h('span', { class: 'grow' }, max ? 'Maxed' : `Next: combat level ${C.combat + 1}`),
          onTap && !max ? h('span', null, 'Tap to flip') : null))));
}

// Back of the combat card: what's still needed for the next level (any one of these).
function combatBack(C, theme) {
  const max = C.combat >= COMBAT_MAX;
  return h('div', { class: `card level level-back theme-${theme}` }, themeBackground(theme),
    h('div', { class: 'stack tight level-body' },
      h('div', { class: 'level-title' }, max ? `Combat level ${C.combat}: maxed` : `Still needed for combat level ${C.combat + 1}`),
      max ? null : C.needs.map((n) => h('div', { class: 'back-line' }, `${n.levels} more ${n.names} level${n.levels === 1 ? '' : 's'}`)),
      h('div', { class: 'back-hint' }, 'Any one of these · tap to flip back')));
}

// Weekly recap: shown on Today every Monday for the week that just ended, and kept in History.
export function recapView(r, title) {
  const tg = r.targets || {};
  const line = (label, value) => h('div', { class: 'recap-line' }, h('span', { class: 'grow' }, label), h('span', { class: 'num' }, value));
  const sign = (n, d = 1) => `${n > 0 ? '+' : ''}${fmt(n, d)}`;
  return h('section', { class: 'card recap', 'aria-label': title },
    h('div', { class: 'row' }, h('h2', { class: 'card-title grow' }, title), h('span', { class: 'sub' }, `${short(r.start)} – ${short(r.end)}`)),
    line('Workouts', `${r.workouts} of 5`),
    line('Sets done', fmt(r.sets)),
    line('Weight lifted', `${fmt(r.lifted)} lb`),
    line('Combat level', r.combatTo > r.combatFrom ? `${r.combatFrom} → ${r.combatTo}` : String(r.combatTo)),
    line('Skill levels gained', r.gained.length ? r.gained.map((g) => `${g.name} +${g.n}`).join(', ') : 'None'),
    line('Days on your streak', `${r.streakDays} of 7`),
    r.foodDays ? line('Average calories', `${fmt(r.avgCal)}${tg.cal ? ` / ${fmt(tg.cal)}` : ''}`) : line('Food', 'Nothing logged'),
    r.foodDays ? line('Average protein', `${fmt(r.avgProtein)} g${tg.p ? ` / ${fmt(tg.p)} g` : ''}`) : null,
    line('Weight change', r.weightChange == null ? 'Needs 2 weigh-ins' : `${sign(r.weightChange)} lb`));
}

function recapCard(today) {
  if (parse(today).getDay() !== 1) return null; // Mondays only
  const r = data.weekRecap(addDays(today, -7), today);
  if (!r.sets && !r.foodDays && r.weightChange == null) return null;
  return recapView(r, 'Last week');
}

export function combatSheet(today) {
  const C = data.combatInfo(today);
  const lvl = (id) => C.levels[id];
  sheet(`Combat level ${C.combat}`, h('div', { class: 'stack' },
    C.combat >= COMBAT_MAX ? h('p', null, 'Maxed out. Nothing left to earn here.') : [
      h('h3', { class: 'list-head' }, `Done toward combat level ${C.combat + 1}`),
      C.done.length
        ? h('div', { class: 'list' }, C.done.map((d) => h('div', { class: 'item combat-done' }, h('span', { class: 'tick', 'aria-hidden': 'true' }, '✓'),
          h('span', { class: 'item-main' }, h('span', { class: 'item-name' }, `${d.name} +${d.gained} level${d.gained === 1 ? '' : 's'}`)))))
        : h('p', { class: 'sub', style: 'margin:0' }, 'Nothing yet since your last combat level.'),
      h('h3', { class: 'list-head' }, 'Still needed (any one of these)'),
      h('div', { class: 'list' }, C.needs.map((n) => h('div', { class: 'item' }, h('span', { class: 'item-main' },
        h('span', { class: 'item-name' }, `${n.levels} more ${n.names} level${n.levels === 1 ? '' : 's'}`),
        h('span', { class: 'sub' }, n.ids.map((id) => `${C.list.find((s) => s.id === id).name} ${lvl(id)}`).join(' · ')))))),
      h('p', { class: 'sub', style: 'margin:0' }, 'Mixing works too: every Attack or Strength level is worth a bit more than a Defence or Hitpoints level, and Discipline counts half.'),
    ]));
}

let combatFlipped = false; // stays flipped across redraws until you tap again
export function levelCard(today) {
  const theme = data.settings().levelTheme;
  const box = h('button', { type: 'button', class: 'flip-box', 'aria-pressed': combatFlipped ? 'true' : 'false' });
  const draw = () => {
    const C = combatFlipped ? data.combatInfo(today) : data.skillInfo(today);
    const face = combatFlipped ? combatBack(C, theme) : levelCardView(C, theme, null);
    box.setAttribute('aria-label', combatFlipped ? `Combat level ${C.combat} details. Tap to flip back` : `Combat level ${C.combat}. Tap to flip and see what's needed for the next level`);
    box.setAttribute('aria-pressed', combatFlipped ? 'true' : 'false');
    box.replaceChildren(face);
  };
  box.addEventListener('click', () => {
    box.classList.add('flip-out');
    setTimeout(() => { combatFlipped = !combatFlipped; draw(); box.classList.remove('flip-out'); box.classList.add('flip-in'); }, 170);
    setTimeout(() => box.classList.remove('flip-in'), 360);
  });
  draw();
  return box;
}

// Gear tiers: real-life changes unlocked by consistent training.
function gearCard(today) {
  const g = data.gearInfo(today);
  if (!g.start) return null;
  const pct = Math.round(g.pct * 100);
  return card(
    h('div', { class: 'row' }, h('h2', { class: 'card-title grow' }, 'Gear'), h('span', { class: 'sub' }, g.current ? `${g.current.name} tier` : 'No tier yet')),
    h('div', { class: 'row prog-top' }, h('span', { class: 'grow' }, 'Workouts done since you started'),
      h('span', { class: 'num' }, `${pct}% `, h('span', { class: 'sub' }, '/ 75% needed'))),
    h('div', { class: `bar${g.on ? ' good' : ''}` }, h('i', { style: `width:${Math.min(100, (g.pct / 0.75) * 100)}%` })),
    h('p', { class: 'sub', style: 'margin:0' }, `${g.done} of ${g.planned} planned workouts (5 a week; Push, Pull, Legs and Back count).`),
    g.current ? h('div', { class: 'msg' }, h('div', { class: 'msg-title' }, g.current.title), h('p', null, g.current.text)) : null,
    g.next ? h('p', { class: 'sub', style: 'margin:0' }, g.on
      ? `Next: ${g.next.name} tier in ${g.next.day - g.daysIn} day${g.next.day - g.daysIn === 1 ? '' : 's'}.`
      : `Get back to 75% to unlock tiers. Next: ${g.next.name} at day ${g.next.day}.`) : null);
}

export function renderToday(root, ctx) {
  const { today, go } = ctx;
  root.append(...[
    (() => { const [l, r] = braziers(); startFlames(); return h('header', { class: 'hero' }, l,
      h('div', { class: 'hero-title' }, h('div', { class: 'sub' }, nice(today)), h('h1', { class: 'title' }, 'Today')), r); })(),
    levelCard(today),
    recapCard(today),
    streakWidget(data.streakInfo(today), today, (d) => editDaySheet(d, go)),
    checkinCard(today, go),
    weighCard(today, go),
    foodCard(today, go)].filter(Boolean));
}
