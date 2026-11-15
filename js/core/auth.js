// Firebase sign-in and database calls over plain fetch (no library, so it also
// runs unchanged inside a Capacitor app later).
import { FIREBASE, ENDPOINTS } from '../config.js';

const KEY = 'tracker-session';
const DOCS = `projects/${FIREBASE.projectId}/databases/(default)/documents`;

export function configured() {
  return !!FIREBASE.apiKey && !FIREBASE.apiKey.startsWith('YOUR');
}

export function session() {
  try { return JSON.parse(localStorage.getItem(KEY)); } catch { return null; }
}
function save(s) { localStorage.setItem(KEY, JSON.stringify(s)); }

const FRIENDLY = {
  EMAIL_EXISTS: 'That email already has an account. Tap Sign in.',
  INVALID_LOGIN_CREDENTIALS: 'Wrong email or password.',
  INVALID_PASSWORD: 'Wrong email or password.',
  EMAIL_NOT_FOUND: 'Wrong email or password.',
  INVALID_EMAIL: 'That email address looks wrong.',
  USER_DISABLED: 'This account is turned off.',
  OPERATION_NOT_ALLOWED: 'Email sign-in or new accounts are turned off in Firebase.',
  ADMIN_ONLY_OPERATION: 'New accounts are turned off in Firebase.',
  TOO_MANY_ATTEMPTS_TRY_LATER: 'Too many tries. Wait a few minutes.',
};

async function post(url, body, form = false) {
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': form ? 'application/x-www-form-urlencoded' : 'application/json' },
    body: form ? new URLSearchParams(body).toString() : JSON.stringify(body),
  });
  const j = await res.json().catch(() => ({}));
  if (!res.ok) {
    const code = (j.error && j.error.message) || '';
    const err = new Error(FRIENDLY[code.split(' ')[0]] || (code.startsWith('WEAK_PASSWORD') ? 'Use at least 6 characters.' : `Sign-in failed (${res.status})`));
    err.status = res.status;
    throw err;
  }
  return j;
}

function fromAuth(j, prev = {}) {
  return {
    token: j.idToken || j.id_token,
    refresh: j.refreshToken || j.refresh_token,
    expires_at: Math.floor(Date.now() / 1000) + Number(j.expiresIn || j.expires_in || 3600),
    user: { id: j.localId || j.user_id || prev.user?.id, email: j.email || prev.user?.email },
  };
}

export async function signIn(email, password) {
  const s = fromAuth(await post(`${ENDPOINTS.auth}/accounts:signInWithPassword?key=${FIREBASE.apiKey}`, { email, password, returnSecureToken: true }));
  save(s);
  return s;
}

export async function signUp(email, password) {
  const s = fromAuth(await post(`${ENDPOINTS.auth}/accounts:signUp?key=${FIREBASE.apiKey}`, { email, password, returnSecureToken: true }));
  save(s);
  return s;
}

export function signOut() { localStorage.removeItem(KEY); }

let refreshing = null;
export async function token() {
  const s = session();
  if (!s) throw new Error('Signed out');
  if (s.expires_at - Date.now() / 1000 > 120) return s.token;
  if (!refreshing) {
    refreshing = post(`${ENDPOINTS.token}/token?key=${FIREBASE.apiKey}`, { grant_type: 'refresh_token', refresh_token: s.refresh }, true)
      .then((j) => { const n = fromAuth(j, s); save(n); return n; })
      .catch((e) => {
        if (e.status >= 400 && e.status < 500) {
          localStorage.removeItem(KEY);
          window.dispatchEvent(new Event('tracker-signed-out'));
        }
        throw e;
      })
      .finally(() => { refreshing = null; });
  }
  return (await refreshing).token;
}

// POST to Firestore. path is appended to ".../documents" (e.g. ":commit").
export async function firestore(path, body) {
  const t = await token();
  const res = await fetch(`${ENDPOINTS.firestore}/${DOCS}${path}`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${t}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error(`Sync failed (${res.status}): ${(await res.text()).slice(0, 160)}`);
  return res.json();
}

export const docName = (uid, id) => `${DOCS}/users/${uid}/records/${id}`;
