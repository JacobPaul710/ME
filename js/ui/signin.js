import { h } from './dom.js';
import { button, card, field } from './components.js';
import { signIn, signUp } from '../core/auth.js';

export function renderSignIn(root, onDone) {
  const email = h('input', { type: 'email', autocomplete: 'username', 'aria-label': 'Email' });
  const pw = h('input', { type: 'password', autocomplete: 'current-password', 'aria-label': 'Password' });
  const msg = h('p', { class: 'sub', role: 'status' });
  const go = async (fn, label) => {
    if (!email.value || pw.value.length < 6) { msg.textContent = 'Enter your email and a password of at least 6 characters.'; return; }
    if (!navigator.onLine) { msg.textContent = 'Signing in needs internet the first time.'; return; }
    msg.textContent = `${label}…`;
    try {
      const s = await fn(email.value.trim(), pw.value);
      onDone(s);
    } catch (e) {
      msg.textContent = e.message;
    }
  };
  root.append(
    h('header', { class: 'page-head' }, h('h1', { class: 'title' }, 'ME'), h('div', { class: 'sub' }, 'Sign in once on each device.')),
    card(field('Email', email), field('Password', pw),
      button('Sign in', () => go(signIn, 'Signing in'), 'primary block'),
      button('Create account', () => go(signUp, 'Creating account'), 'block'),
      msg));
}

export function renderSetupNeeded(root) {
  root.append(card(h('h2', { class: 'card-title' }, 'One step left'),
    h('p', null, 'Add your Firebase settings to js/config.js, then reload.')));
}
