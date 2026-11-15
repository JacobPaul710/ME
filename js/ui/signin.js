import { h } from './dom.js';
import { button, card, field } from './components.js';
import { signIn, signUp } from '../core/auth.js';

// "Show password" switch for one or more password fields.
function showToggle(...inputs) {
  const box = h('input', { type: 'checkbox', class: 'check' });
  box.addEventListener('change', () => { for (const i of inputs) i.type = box.checked ? 'text' : 'password'; });
  return h('label', { class: 'check-row' }, box, h('span', null, 'Show password'));
}

// Three screens: sign in, create account, account created.
export function renderSignIn(root, onDone) {
  const show = (screen) => root.replaceChildren(...screen());
  const head = (title, sub) => h('header', { class: 'page-head' }, h('h1', { class: 'title' }, title), sub ? h('div', { class: 'sub' }, sub) : null);
  const msg = () => h('p', { class: 'sub', role: 'status' });

  const signInScreen = () => {
    const email = h('input', { type: 'email', autocomplete: 'username' });
    const pw = h('input', { type: 'password', autocomplete: 'current-password' });
    const out = msg();
    const go = async () => {
      if (!email.value.trim() || !pw.value) { out.textContent = 'Enter your email and password.'; return; }
      if (!navigator.onLine) { out.textContent = 'Signing in needs internet the first time.'; return; }
      out.textContent = 'Signing in…';
      try { onDone(await signIn(email.value.trim(), pw.value)); } catch (e) { out.textContent = e.message; }
    };
    pw.addEventListener('keydown', (e) => { if (e.key === 'Enter') go(); });
    return [
      head('ME', 'Sign in or create an account.'),
      card(field('Email', email), field('Password', pw), showToggle(pw), button('Sign in', go, 'primary block'), out),
      button('Create account', () => show(createScreen), 'block'),
    ];
  };

  const createScreen = () => {
    const email = h('input', { type: 'email', autocomplete: 'username' });
    const pw = h('input', { type: 'password', autocomplete: 'new-password' });
    const pw2 = h('input', { type: 'password', autocomplete: 'new-password' });
    const out = msg();
    const go = async () => {
      if (!email.value.trim()) { out.textContent = 'Enter your email.'; return; }
      if (pw.value.length < 6) { out.textContent = 'Use a password of at least 6 characters.'; return; }
      if (pw.value !== pw2.value) { out.textContent = "The passwords don't match."; return; }
      if (!navigator.onLine) { out.textContent = 'Creating an account needs internet.'; return; }
      out.textContent = 'Creating account…';
      try {
        const s = await signUp(email.value.trim(), pw.value);
        show(() => createdScreen(s));
      } catch (e) { out.textContent = e.message; }
    };
    return [
      head('Create account'),
      card(field('Email', email), field('Password', pw), field('Confirm password', pw2), showToggle(pw, pw2),
        button('Create account', go, 'primary block'), out),
      button('Back to sign in', () => show(signInScreen), 'ghost block'),
    ];
  };

  const createdScreen = (s) => [
    head('Account created'),
    card(h('p', { style: 'margin:0' }, `You're signed in as ${s.user.email}.`), button('Continue', () => onDone(s), 'primary block')),
  ];

  show(signInScreen);
}

export function renderSetupNeeded(root) {
  root.append(card(h('h2', { class: 'card-title' }, 'One step left'),
    h('p', null, 'Add your Firebase settings to js/config.js, then reload.')));
}
