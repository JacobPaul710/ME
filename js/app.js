import { h, svg } from './ui/dom.js';
import { closeAllSheets } from './ui/components.js';
import { configured, session, signOut } from './core/auth.js';
import * as store from './core/store.js';
import * as sync from './core/sync.js';
import { iso } from './logic/dates.js';
import { milestoneFor } from './logic/streak.js';
import * as data from './data.js';
import { celebrate, levelUp, tierUnlocked, evolved } from './celebrations.js';
import { unlockAudio } from './core/sfx.js';
import { themeBackground } from './ui/levelThemes.js';
import { renderSignIn, renderSetupNeeded } from './ui/signin.js';
import { renderToday } from './ui/today.js';
import { renderTrain } from './ui/train.js';
import { renderFood } from './ui/food.js';
import { renderHistory } from './ui/history.js';
import { renderSettings } from './ui/settings.js';
import { renderCharacter } from './ui/character.js';
import { FORMS, formIndex, monsterById } from './ui/monster.js';

const app = document.getElementById('app');
const tabs = document.getElementById('tabs');

const ICONS = {
  today: '<svg viewBox="0 0 24 24" width="24" height="24" aria-hidden="true"><path d="M4 11l8-7 8 7v9h-5v-6H9v6H4z" fill="none" stroke="currentColor" stroke-width="2" stroke-linejoin="round"/></svg>',
  train: '<svg viewBox="0 0 24 24" width="24" height="24" aria-hidden="true"><path d="M3 9v6M6 7v10M18 7v10M21 9v6M6 12h12" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>',
  food: '<svg viewBox="0 0 24 24" width="24" height="24" aria-hidden="true"><path d="M7 3v8M5 3v5a2 2 0 0 0 4 0V3M7 11v10M17 21V3c-2 1-3 4-3 8h3" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>',
  history: '<svg viewBox="0 0 24 24" width="24" height="24" aria-hidden="true"><path d="M4 20V10M10 20V4M16 20v-7M22 20H2" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>',
  character: '<svg viewBox="0 0 24 24" width="24" height="24" aria-hidden="true"><circle cx="12" cy="7.5" r="4" fill="none" stroke="currentColor" stroke-width="2"/><path d="M4 21c0-4.5 3.6-8 8-8s8 3.5 8 8" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>',
};
const SCREENS = {
  today: ['Today', renderToday],
  train: ['Workout', renderTrain],
  food: ['Food', renderFood],
  character: ['Character', renderCharacter],
  history: ['History', renderHistory],
};

// Settings live in a menu that slides in when you swipe in from the left edge of the screen.
let menuOpen = false;
function openMenu() {
  menuOpen = true;
  closeAllSheets();
  render();
  document.querySelector('.drawer')?.focus();
}
function closeMenu() {
  if (!menuOpen) return;
  const wrap = document.querySelector('.drawer-wrap');
  menuOpen = false;
  if (!wrap) return;
  wrap.classList.add('closing');
  setTimeout(() => wrap.remove(), 180);
  document.querySelector('.menu-btn')?.setAttribute('aria-expanded', 'false');
}
function drawMenu() {
  const old = document.querySelector('.drawer-wrap');
  if (!menuOpen) { old?.remove(); return; }
  const body = h('div', { class: 'stack' });
  renderSettings(body, { ...ctxBase, today: iso(), closeMenu });
  const drawer = h('aside', { class: 'drawer', role: 'dialog', 'aria-modal': 'true', 'aria-label': 'Settings', tabindex: '-1' }, body);
  let x0 = null;
  drawer.addEventListener('touchstart', (e) => { x0 = e.touches[0].clientX; }, { passive: true });
  drawer.addEventListener('touchend', (e) => { if (x0 != null && e.changedTouches[0].clientX - x0 < -70) closeMenu(); x0 = null; });
  const wrap = h('div', { class: 'drawer-wrap', onClick: (e) => { if (e.target === wrap) closeMenu(); } }, drawer);
  if (old) { drawer.scrollTop = old.querySelector('.drawer').scrollTop; old.replaceWith(wrap); wrap.classList.add('still'); }
  else document.body.append(wrap);
}
function route() {
  if (location.hash.startsWith('#settings')) { // old links: open the menu over Today
    history.replaceState(null, '', '#today');
    menuOpen = true;
  }
  const [screen, sub] = location.hash.replace(/^#/, '').split('/');
  return { screen: SCREENS[screen] ? screen : 'today', sub };
}

function syncBadge() {
  const st = sync.status.state;
  const text = { offline: 'Offline · saved on phone', syncing: 'Syncing…', pending: 'Syncing…', error: 'Sync problem · will retry', ok: 'Synced', idle: '' }[st];
  return h('span', { class: `sync sync-${st}`, role: 'status', title: sync.status.error || '' }, text);
}

const ctxBase = {
  go: (hash) => { if (location.hash === hash) render(); else location.hash = hash; },
  rerender: () => render(),
  syncBadge,
  signOut: () => doSignOut(),
};

// The whole app follows the level card theme picked in Settings.
const THEME_COLOR = { parchment: '#e6d6b3', stone: '#16181b', wood: '#1a1008' };
let appliedTheme = null;
function applyTheme() {
  const theme = data.settings().levelTheme;
  if (theme === appliedTheme) return;
  appliedTheme = theme;
  document.documentElement.dataset.theme = theme;
  document.querySelector('meta[name="theme-color"]')?.setAttribute('content', THEME_COLOR[theme] || '#111315');
  const bg = themeBackground(theme);
  bg.classList.add('app-bg');
  const old = document.querySelector('.app-bg');
  if (old) old.replaceWith(bg); else document.body.prepend(bg);
}

let pending = false;
function render() {
  applyTheme();
  const view = document.getElementById('view');
  const busy = document.activeElement?.matches?.('input, select, textarea') &&
    (view?.contains(document.activeElement) || document.querySelector('.drawer')?.contains(document.activeElement));
  if (busy) {
    pending = true; // don't redraw under the user's fingers
    return;
  }
  pending = false;
  const { screen, sub } = route();
  const y = window.scrollY;
  const sameScreen = view && view.dataset.screen === screen;
  const root = h('div', { id: 'view', 'data-screen': screen, class: 'stack' });
  SCREENS[screen][1](root, { ...ctxBase, today: iso(), sub });
  if (view) view.replaceWith(root); else app.replaceChildren(root);
  drawMenu();
  window.scrollTo(0, sameScreen ? y : 0);
  for (const a of tabs.querySelectorAll('a')) a.setAttribute('aria-current', a.dataset.screen === screen ? 'page' : 'false');
}

function drawTabs() {
  tabs.replaceChildren(...Object.entries(SCREENS).map(([id, [label]]) =>
    h('a', { href: `#${id}`, 'data-screen': id }, svg(ICONS[id]), h('span', null, label))));
  tabs.hidden = false;
  tabs.onclick = () => closeMenu();
}

// One pop-up at a time (each with its own sound/voice): streak milestone, then
// level-up, then gear tier. The others wait for your next action.
function checkMilestone() {
  if (document.querySelector('.celebrate')) return;
  const today = iso();
  const st = data.streakInfo(today);
  const m = milestoneFor(st.current);
  if (m && st.start && !data.milestoneShown(st.start, m)) {
    data.markMilestone(st.start, m);
    celebrate(m);
    return;
  }
  const L = data.skillInfo(today).combat;
  const seen = data.combatSeen();
  if (L > seen) {
    data.setCombatSeen(L);
    if (seen > 0) {
      // a monster that reaches a new form gets an evolution pop-up instead
      const ch = data.activeChar();
      if (ch.kind !== 'knight' && formIndex(L) > formIndex(seen)) { evolved(ch.name || monsterById(ch.monster).name, FORMS[formIndex(L)].name, L); return; }
      levelUp(L); return;
    } // first run: just remember the level
  }
  const g = data.gearInfo(today);
  const tier = g.unlocked.find((t) => !data.tierShown(t.id));
  if (tier) {
    data.markTier(tier.id);
    tierUnlocked(tier);
  }
}

let renderQueued = false, localChange = false;
function onData(source) {
  if (source === 'local') { localChange = true; sync.schedule(); }
  if (renderQueued) return;
  renderQueued = true;
  requestAnimationFrame(() => {
    renderQueued = false;
    render();
    // Celebrate on the device where the check-in happened (and at app start).
    if (localChange) { localChange = false; checkMilestone(); }
  });
}

async function startApp(s) {
  await store.initStore(s.user.id);
  drawTabs();
  render();
  store.subscribe(onData);
  sync.onStatus(() => { const b = document.querySelector('.sync'); if (b) b.replaceWith(syncBadge()); });
  window.addEventListener('online', () => sync.syncNow());
  window.addEventListener('offline', () => sync.syncNow());
  document.addEventListener('visibilitychange', () => { if (!document.hidden) { render(); sync.syncNow(); } });
  setInterval(() => sync.syncNow(), 60000);
  await sync.syncNow();
  if (await data.ensureRoutine()) sync.schedule(500); // your routine, loaded once
  checkMilestone();
}

function showSignIn() {
  tabs.hidden = true;
  const root = h('div', { id: 'view', class: 'stack' });
  renderSignIn(root, () => location.reload());
  app.replaceChildren(root);
}

function doSignOut() {
  signOut();
  store.closeStore();
  location.hash = '';
  location.reload();
}

window.addEventListener('hashchange', () => { closeAllSheets(); if (!location.hash.startsWith('#settings')) closeMenu(); render(); });
document.addEventListener('keydown', (e) => { if (e.key === 'Escape') closeMenu(); });
// Swipe in from the left edge opens Settings.
let edge = null;
document.addEventListener('touchstart', (e) => {
  const t = e.touches[0];
  edge = !menuOpen && e.touches.length === 1 && t.clientX < 28 && !document.querySelector('.sheet-wrap, .celebrate') ? { x: t.clientX, y: t.clientY } : null;
}, { passive: true });
document.addEventListener('touchmove', (e) => {
  if (!edge) return;
  const t = e.touches[0];
  if (t.clientX - edge.x > 60 && Math.abs(t.clientY - edge.y) < 50) { edge = null; if (session()) openMenu(); }
}, { passive: true });
document.addEventListener('touchend', () => { edge = null; }, { passive: true });
// With a mouse: rest the cursor on the left edge of the window for a moment to open Settings.
let hoverTimer = null;
document.addEventListener('mousemove', (e) => {
  if (!matchMedia('(hover: hover)').matches) return;
  const atEdge = e.clientX <= 8 && !menuOpen && !document.querySelector('.sheet-wrap, .celebrate');
  if (atEdge && !hoverTimer) hoverTimer = setTimeout(() => { hoverTimer = null; if (session()) openMenu(); }, 250);
  else if (!atEdge && hoverTimer) { clearTimeout(hoverTimer); hoverTimer = null; }
});
document.addEventListener('focusout', () => setTimeout(() => { if (pending) render(); }, 0));
window.addEventListener('tracker-signed-out', () => location.reload());
window.addEventListener('tracker-popup-closed', () => setTimeout(checkMilestone, 300));

unlockAudio();

if ('serviceWorker' in navigator) {
  navigator.serviceWorker.register('sw.js').catch(() => {});
  let reloaded = false;
  const hadController = !!navigator.serviceWorker.controller; // first install: no reload needed
  navigator.serviceWorker.addEventListener('controllerchange', () => {
    if (reloaded || !hadController) return;
    reloaded = true;
    location.reload();
  });
}

if (!configured()) {
  const root = h('div', { id: 'view', class: 'stack' });
  renderSetupNeeded(root);
  app.replaceChildren(root);
} else if (session()) {
  startApp(session());
} else {
  showSignIn();
}
