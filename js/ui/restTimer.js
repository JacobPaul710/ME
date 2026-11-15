// Rest timer between sets: a bar above the tabs that counts down after each set.
import { h } from './dom.js';
import { sfx } from '../core/sfx.js';

let timer = null, bar = null, endAt = 0;

const fmt = (s) => `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;

export function stopRest() {
  clearInterval(timer);
  timer = null;
  bar?.remove();
  bar = null;
  document.body.classList.remove('resting');
}

export function startRest(seconds) {
  stopRest();
  endAt = Date.now() + seconds * 1000;
  const time = h('span', { class: 'rest-time' }, fmt(seconds));
  const label = h('span', { class: 'grow' }, 'Rest');
  bar = h('div', { class: 'rest-bar', role: 'timer', 'aria-live': 'off' },
    label, time, h('button', { type: 'button', class: 'btn ghost', onClick: stopRest }, 'Skip'));
  document.body.append(bar);
  document.body.classList.add('resting'); // makes room so the bar never covers the last buttons
  timer = setInterval(() => {
    const left = Math.max(0, Math.ceil((endAt - Date.now()) / 1000));
    time.textContent = fmt(left);
    if (left > 0) return;
    clearInterval(timer);
    timer = null;
    sfx.restDone();
    if (navigator.vibrate) navigator.vibrate([200, 100, 200]);
    bar.classList.add('over');
    label.textContent = 'Rest over: next set!';
    time.textContent = '';
    const b = bar;
    setTimeout(() => { if (bar === b) stopRest(); }, 5000);
  }, 250);
}

export const REST_CHOICES = [[60, '1:00'], [90, '1:30'], [120, '2:00'], [150, '2:30'], [180, '3:00']];
