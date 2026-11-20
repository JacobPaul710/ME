import { h, fmt, svg } from './dom.js';
import { button, card, header, light, progressRow, sheet, field, numberInput, toast, statusDot, confirmSheet, checkbox } from './components.js';
import { streakWidget } from './streakWidget.js';
import { nice, iso, parse, addDays, short } from '../logic/dates.js';
import { MACROS } from '../logic/nutrition.js';
import * as data from '../data.js';
import { session } from '../core/auth.js';
import { themeBackground } from './levelThemes.js';
import { braziers, startFlames } from './braziers.js';
import { COMBAT_MAX } from '../logic/skills.js';
import { skillUp } from '../celebrations.js';
import { ICONS } from './character.js';

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

// ---- Magic card: morning and night check-offs, timers running right on the card ----
const HAT = '<svg viewBox="0 0 24 24" width="26" height="26" aria-hidden="true"><path d="M12 2 L18 17 H6 Z" fill="#6b3fa0" stroke="#1d140c" stroke-width="1.2" stroke-linejoin="round"/><path d="M3 18 Q12 15 21 18 Q12 21 3 18 Z" fill="#4a2a78" stroke="#1d140c" stroke-width="1.2"/><path d="M10 9 l.6 1.4 1.4.2-1 1 .3 1.4-1.3-.7-1.3.7.3-1.4-1-1 1.4-.2z" fill="#ffd23f"/><circle cx="14" cy="13" r=".9" fill="#ffd23f"/></svg>';
const WAND = '<svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true"><path d="M4 20 L15 9" stroke="#3a2a1a" stroke-width="2.6" stroke-linecap="round"/><path d="M13.5 10.5 L15.5 8.5" stroke="#f3e7cc" stroke-width="2.6" stroke-linecap="round"/><path d="M18 2 l.9 2.2 2.2.9-2.2.9-.9 2.2-.9-2.2-2.2-.9 2.2-.9z" fill="#ffd23f" stroke="#a37a1e" stroke-width=".6"/></svg>';
const opened = { morning: null, night: null }; // a section you tapped open (or closed)
const hms = (ms) => { const t = Math.max(0, Math.floor(ms / 1000)); return `${Math.floor(t / 3600)}:${String(Math.floor(t / 60) % 60).padStart(2, '0')}:${String(t % 60).padStart(2, '0')}`; };

async function magicTick(date, x) {
  const magic = () => data.skillInfo(iso()).list.find((sk) => sk.id === 'herblore');
  const before = magic();
  await data.toggleSupp(date, x.key);
  const after = magic();
  const d = after.xp - before.xp;
  if (d) toast(`${d > 0 ? '+' : '−'}${fmt(Math.abs(d), 0)} Magic XP`);
  if (after.level > before.level) skillUp('Magic', after.level, svg(ICONS.herblore));
}

function magicCard(today) {
  const doses = data.suppDoses();
  if (!doses.length) return null;
  const taken = new Set(data.suppTaken(today));
  const times = data.suppTimes(today);
  const at = data.suppAt(today);
  const req = doses.filter((x) => !x.optional);
  const done = req.filter((x) => taken.has(x.key)).length;
  // timers: from today's ticks, and from yesterday's (a late dose can run past midnight)
  const timers = [];
  for (const [day, takenAt] of [[today, at], [addDays(today, -1), data.suppAt(addDays(today, -1))]]) {
    for (const x of doses) if (x.timerHours && takenAt[x.key]) {
      const end = new Date(takenAt[x.key]).getTime() + x.timerHours * 3600e3;
      if (end > Date.now() && !timers.some((t) => t.x.key === x.key)) timers.push({ x, end, total: x.timerHours * 3600e3, day }); // today's tick wins
    }
  }
  const timerEls = timers.map((t) => {
    const left = h('b', null, hms(t.end - Date.now()));
    const fill = h('i', { style: `width:${Math.min(100, (1 - (t.end - Date.now()) / t.total) * 100)}%` });
    const el = h('div', { class: 'magic-timer', 'data-end': String(t.end), 'data-total': String(t.total) },
      h('div', { class: 'magic-timer-row' }, svg(WAND), h('span', null, `${t.x.sup.name}${t.x.sup.dose ? ` ${t.x.sup.dose}` : ''}`), left),
      h('div', { class: 'magic-bar' }, fill));
    return el;
  });
  const section = (when, label, icon) => {
    const list = doses.filter((x) => x.when === when);
    if (!list.length) return null;
    const need = list.filter((x) => !x.optional);
    const complete = need.length > 0 && need.every((x) => taken.has(x.key));
    const morningDone = doses.filter((x) => x.when === 'morning' && !x.optional).every((x) => taken.has(x.key));
    // Morning is open until it's done; then it folds and Night opens. Tap a folded one to open it.
    const auto = when === 'morning' ? !complete : morningDone && !complete;
    const open = opened[when] ?? auto;
    const lastAt = list.filter((x) => taken.has(x.key)).map((x) => times[x.key]).filter(Boolean).pop();
    const n = need.filter((x) => taken.has(x.key)).length;
    if (!open) {
      return h('button', { type: 'button', class: `magic-fold${complete ? ' done' : ''}`, onClick: () => { opened[when] = true; document.dispatchEvent(new CustomEvent('me:rerender')); } },
        complete ? '✓ ' : `${icon} `, h('b', null, label), complete ? ` · ${n} of ${need.length}` : ` · ${need.length - n} to go`,
        h('span', { class: 't' }, complete ? lastAt || '' : when === 'night' ? 'opens after Morning' : 'tap to open'));
    }
    return h('div', { class: 'magic-sec' },
      h('button', { type: 'button', class: 'magic-sec-h', onClick: () => { opened[when] = false; document.dispatchEvent(new CustomEvent('me:rerender')); } },
        `${icon} ${label}`, h('span', null, `${n} of ${need.length}`)),
      list.map((x) => {
        const on = taken.has(x.key);
        return h('div', { class: 'magic-row' },
          checkbox(on, () => magicTick(today, x), `${x.sup.name}${x.sup.dose ? ` ${x.sup.dose}` : ''} ${on ? 'taken. Tap to undo' : 'not taken'}`),
          svg(WAND),
          h('button', { type: 'button', class: 'magic-name', onClick: () => magicTick(today, x) },
            `${x.sup.name}${x.sup.dose ? ` ${x.sup.dose}` : ''}`,
            x.optional ? h('span', { class: 'opt' }, ` optional${x.timerHours ? ` · ${x.timerHours} h timer` : ''}`) : x.timerHours ? h('span', { class: 'opt' }, ` ${x.timerHours} h timer`) : null),
          h('span', { class: 't' }, on && times[x.key] ? times[x.key] : ''));
      }));
  };
  const card = h('section', { class: 'card magic', 'aria-label': 'Magic' },
    h('div', { class: 'row' }, svg(HAT), h('h2', { class: 'card-title grow' }, 'Magic'), h('span', { class: 'magic-count' }, done >= req.length && req.length ? `${done} of ${req.length} ✓` : `${done} of ${req.length}`)),
    timerEls, section('morning', 'Morning', '☀️'), section('night', 'Night', '🌙'));
  // keep the timers ticking while the card is on screen
  if (timerEls.length) {
    const tick = setInterval(() => {
      if (!card.isConnected) { clearInterval(tick); return; }
      for (const el of card.querySelectorAll('.magic-timer')) {
        const left = +el.dataset.end - Date.now();
        if (left <= 0) { clearInterval(tick); toast('A Magic timer just finished'); document.dispatchEvent(new CustomEvent('me:rerender')); return; }
        el.querySelector('b').textContent = hms(left);
        el.querySelector('.magic-bar i').style.width = `${Math.min(100, (1 - left / +el.dataset.total) * 100)}%`;
      }
    }, 1000);
  }
  return card;
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
    streakWidget(data.streakInfo(today), today, (d) => editDaySheet(d, go)),
    magicCard(today),
    weighCard(today, go),
    checkinCard(today, go),
    foodCard(today, go),
    recapCard(today)].filter(Boolean));
}
