// Shared building blocks so every screen, button and popup looks the same.
import { h, fmt } from './dom.js';

export function button(label, onClick, kind = '', extra = {}) {
  return h('button', { type: 'button', class: `btn ${kind}`.trim(), onClick, ...extra }, label);
}

export function header(title, sub, right) {
  return h('header', { class: 'row page-head' },
    h('div', { class: 'grow' }, sub ? h('div', { class: 'sub' }, sub) : null, h('h1', { class: 'title' }, title)),
    right || null);
}

export function card(...kids) { return h('section', { class: 'card' }, ...kids); }

export function light(on, onClick, label) {
  return h('button', { type: 'button', class: `light${on ? ' on' : ''}`, 'aria-pressed': on ? 'true' : 'false', 'aria-label': label, onClick });
}

// Set check box (left of each set).
export function checkbox(on, onClick, label) {
  return h('button', { type: 'button', class: `setcheck${on ? ' on' : ''}`, 'aria-pressed': on ? 'true' : 'false', 'aria-label': label, onClick }, on ? '✓' : '');
}

export function statusDot(on) { return h('span', { class: `dot${on ? ' on' : ''}`, 'aria-hidden': 'true' }); }

export function segmented(options, value, onChange) {
  return h('div', { class: 'seg', role: 'group' },
    options.map(([id, label]) => h('button', { type: 'button', 'aria-pressed': id === value ? 'true' : 'false', onClick: () => onChange(id) }, label)));
}

export function field(label, input) {
  return h('label', { class: 'field' }, h('span', null, label), input);
}

export function numberInput(value, attrs = {}) {
  return h('input', { type: 'number', inputmode: 'decimal', step: 'any', min: '0', value: value ?? '', ...attrs });
}

export function progressRow(label, value, target, unit = '') {
  const pct = target ? Math.min(100, (value / target) * 100) : 0;
  const over = target && value > target;
  return h('div', { class: 'prog' },
    h('div', { class: 'row prog-top' },
      h('span', { class: 'grow' }, label),
      h('span', { class: 'num' }, `${fmt(value, 1)}${unit}`, h('span', { class: 'sub' }, target ? ` / ${fmt(target)}${unit}` : ' / no target'))),
    h('div', { class: `bar${over ? ' over' : ''}` }, h('i', { style: `width:${pct}%` })));
}

export function empty(text) { return h('p', { class: 'empty' }, text); }

// ---- popups: one bottom-sheet style used everywhere ----
let openSheets = [];
export function sheet(title, body, actions = [], { onClose } = {}) {
  const close = () => {
    if (!wrap.isConnected) return;
    wrap.remove();
    if (onClose) onClose();
    openSheets = openSheets.filter((s) => s !== close);
    document.removeEventListener('keydown', onKey);
  };
  const onKey = (e) => { if (e.key === 'Escape' && openSheets[openSheets.length - 1] === close) close(); };
  const panel = h('div', { class: 'sheet', role: 'dialog', 'aria-modal': 'true', 'aria-label': title },
    h('div', { class: 'row' }, h('h2', { class: 'grow' }, title), h('button', { type: 'button', class: 'btn ghost', onClick: () => close() }, 'Close')),
    body,
    actions.length ? h('div', { class: 'stack' }, actions) : null);
  const wrap = h('div', { class: 'sheet-wrap', onClick: (e) => { if (e.target === wrap) close(); } }, panel);
  document.body.append(wrap);
  document.addEventListener('keydown', onKey);
  openSheets.push(close);
  const first = panel.querySelector('input, select');
  if (first) first.focus({ preventScroll: true }); // same tap, so the phone keyboard opens
  return { close, panel };
}
export function closeAllSheets() { [...openSheets].forEach((c) => c()); }

export function confirmSheet(title, text, yesLabel, onYes) {
  const s = sheet(title, h('p', { class: 'sub' }, text), [
    button(yesLabel, async () => { s.close(); await onYes(); }, 'danger-fill block'),
  ]);
}

let toastTimer = null;
export function toast(msg) {
  document.querySelector('.toast')?.remove();
  const t = h('div', { class: 'toast', role: 'status' }, msg);
  document.body.append(t);
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => t.remove(), 2200);
}
