import { h, svg } from './ui/dom.js';
import { closeAllSheets } from './ui/components.js';
import { configured, session, signOut } from './core/auth.js';
import * as store from './core/store.js';
import * as sync from './core/sync.js';
import { iso } from './logic/dates.js';
import { milestoneFor } from './logic/streak.js';
import * as data from './data.js';
import { celebrate, levelUp, progressNote } from './celebrations.js';
import { themeBackground } from './ui/levelThemes.js';
import { renderSignIn, renderSetupNeeded } from './ui/signin.js';
import { renderToday } from './ui/today.js';
import { renderTrain } from './ui/train.js';
import { renderFood } from './ui/food.js';
import { renderHistory } from './ui/history.js';
import { renderSettings } from './ui/settings.js';

const app = document.getElementById('app');
const tabs = document.getElementById('tabs');

const ICONS = {
  today: '<svg viewBox="0 0 24 24" width="24" height="24" aria-hidden="true"><path d="M4 11l8-7 8 7v9h-5v-6H9v6H4z" fill="none" stroke="currentColor" stroke-width="2" stroke-linejoin="round"/></svg>',
  train: '<svg viewBox="0 0 24 24" width="24" height="24" aria-hidden="true"><path d="M3 9v6M6 7v10M18 7v10M21 9v6M6 12h12" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>',
  food: '<svg viewBox="0 0 24 24" width="24" height="24" aria-hidden="true"><path d="M7 3v8M5 3v5a2 2 0 0 0 4 0V3M7 11v10M17 21V3c-2 1-3 4-3 8h3" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>',
  history: '<svg viewBox="0 0 24 24" width="24" height="24" aria-hidden="true"><path d="M4 20V10M10 20V4M16 20v-7M22 20H2" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>',
  settings: '<svg viewBox="0 0 24 24" width="24" height="24" aria-hidden="true"><circle cx="12" cy="12" r="3" fill="none" stroke="currentColor" stroke-width="2"/><path d="M12 2v3M12 19v3M2 12h3M19 12h3M4.9 4.9l2.1 2.1M17 17l2.1 2.1M4.9 19.1L7 17M17 7l2.1-2.1" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>',
};
const SCREENS = {
  today: ['Today', renderToday],
  train: ['Workout', renderTrain],
  food: ['Food', renderFood],
  history: ['History', renderHistory],
  settings: ['Settings', renderSettings],
};

function route() {
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
  if (view && view.contains(document.activeElement) && document.activeElement.matches('input, select, textarea')) {
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
  window.scrollTo(0, sameScreen ? y : 0);
  for (const a of tabs.querySelectorAll('a')) a.setAttribute('aria-current', a.dataset.screen === screen ? 'page' : 'false');
}

function drawTabs() {
  tabs.replaceChildren(...Object.entries(SCREENS).map(([id, [label]]) =>
    h('a', { href: `#${id}`, 'data-screen': id }, svg(ICONS[id]), h('span', null, label))));
  tabs.hidden = false;
}

// One pop-up at a time: streak milestone, then level-up, then progress note.
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
  const L = data.levelInfo(today).level;
  const seen = data.levelSeen();
  if (L > seen) {
    data.setLevelSeen(L);
    if (seen > 0) { levelUp(L); return; } // first run: just remember the level
  }
  const p = data.progressInfo(today);
  if (p.message && !data.messageShown(p.message.day)) {
    data.markMessage(p.message.day);
    progressNote(p.message);
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

window.addEventListener('hashchange', () => { closeAllSheets(); render(); });
document.addEventListener('focusout', () => setTimeout(() => { if (pending) render(); }, 0));
window.addEventListener('tracker-signed-out', () => location.reload());
window.addEventListener('tracker-popup-closed', () => setTimeout(checkMilestone, 300));

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
