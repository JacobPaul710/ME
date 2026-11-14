// Supabase sign-in and data calls over plain fetch (no library, so it also runs
// unchanged inside a Capacitor app later).
import { SUPABASE_URL, SUPABASE_KEY } from '../config.js';

const BASE = SUPABASE_URL.replace(/\/$/, '');
const KEY = 'tracker-session';

export function configured() {
  return !BASE.includes('YOUR-PROJECT') && !SUPABASE_KEY.startsWith('YOUR-');
}

export function session() {
  try { return JSON.parse(localStorage.getItem(KEY)); } catch { return null; }
}
function save(s) { localStorage.setItem(KEY, JSON.stringify(s)); }

async function authCall(path, body) {
  const res = await fetch(`${BASE}/auth/v1/${path}`, {
    method: 'POST',
    headers: { apikey: SUPABASE_KEY, 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  const j = await res.json().catch(() => ({}));
  if (!res.ok) {
    const err = new Error(j.msg || j.error_description || j.message || `Request failed (${res.status})`);
    err.status = res.status;
    throw err;
  }
  return j;
}

function fromToken(j) {
  return {
    access_token: j.access_token,
    refresh_token: j.refresh_token,
    expires_at: j.expires_at || Math.floor(Date.now() / 1000) + (j.expires_in || 3600),
    user: { id: j.user.id, email: j.user.email },
  };
}

export async function signIn(email, password) {
  const s = fromToken(await authCall('token?grant_type=password', { email, password }));
  save(s);
  return s;
}

// Returns a session, or null when Supabase wants the email confirmed first.
export async function signUp(email, password) {
  const j = await authCall('signup', { email, password });
  if (!j.access_token) return null;
  const s = fromToken(j);
  save(s);
  return s;
}

export function signOut() {
  const s = session();
  localStorage.removeItem(KEY);
  if (s && navigator.onLine) {
    fetch(`${BASE}/auth/v1/logout`, {
      method: 'POST', headers: { apikey: SUPABASE_KEY, Authorization: `Bearer ${s.access_token}` },
    }).catch(() => {});
  }
}

let refreshing = null;
export async function token() {
  const s = session();
  if (!s) throw new Error('Signed out');
  if (s.expires_at - Date.now() / 1000 > 60) return s.access_token;
  if (!refreshing) {
    refreshing = authCall('token?grant_type=refresh_token', { refresh_token: s.refresh_token })
      .then((j) => { const n = fromToken(j); save(n); return n; })
      .catch((e) => {
        if (e.status >= 400 && e.status < 500) {
          localStorage.removeItem(KEY);
          window.dispatchEvent(new Event('tracker-signed-out'));
        }
        throw e;
      })
      .finally(() => { refreshing = null; });
  }
  return (await refreshing).access_token;
}

export async function rest(path, opts = {}) {
  const t = await token();
  const res = await fetch(`${BASE}/rest/v1/${path}`, {
    ...opts,
    headers: { apikey: SUPABASE_KEY, Authorization: `Bearer ${t}`, 'Content-Type': 'application/json', ...(opts.headers || {}) },
  });
  if (!res.ok) throw new Error(`Sync failed (${res.status}): ${(await res.text()).slice(0, 160)}`);
  const type = res.headers.get('content-type') || '';
  return res.status !== 204 && type.includes('json') ? res.json() : null;
}
