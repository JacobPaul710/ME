// Pushes local changes to Supabase and pulls changes made on other devices.
import * as store from './store.js';
import { rest, session } from './auth.js';

export const status = { state: 'idle', error: null };
const listeners = new Set();
let running = false, again = false, timer = null;

function setState(state, error = null) {
  status.state = state;
  status.error = error;
  for (const f of listeners) f(status);
}
export function onStatus(f) { listeners.add(f); }

export function schedule(ms = 1500) {
  clearTimeout(timer);
  if (navigator.onLine && status.state !== 'syncing') setState('pending');
  timer = setTimeout(syncNow, ms);
}

function minus10s(ts) { return new Date(Date.parse(ts) - 10000).toISOString(); }

export async function syncNow() {
  if (running) { again = true; return; }
  if (!navigator.onLine) { setState('offline'); return; }
  const s = session();
  if (!s) return;
  running = true;
  setState('syncing');
  try {
    const dirty = store.dirtyRecords();
    for (let i = 0; i < dirty.length; i += 500) {
      const chunk = dirty.slice(i, i + 500);
      await rest('records?on_conflict=user_id,id', {
        method: 'POST',
        headers: { Prefer: 'resolution=merge-duplicates,return=minimal' },
        body: JSON.stringify(chunk.map((r) => ({
          id: r.id, user_id: s.user.id, kind: r.kind, data: r.data, deleted: r.deleted, updated_at: r.updated_at,
        }))),
      });
      await store.markClean(chunk);
    }

    const last = await store.getMeta('lastServerAt');
    let since = last ? minus10s(last) : '1970-01-01T00:00:00Z';
    for (;;) {
      const rows = await rest(
        `records?select=id,kind,data,deleted,updated_at,server_at&server_at=gt.${encodeURIComponent(since)}&order=server_at.asc&limit=1000`,
      );
      if (!rows || !rows.length) break;
      await store.applyRemote(rows);
      since = rows[rows.length - 1].server_at;
      if (!last || Date.parse(since) > Date.parse(last)) await store.setMeta('lastServerAt', since);
      if (rows.length < 1000) break;
    }
    setState('ok');
  } catch (e) {
    setState(navigator.onLine ? 'error' : 'offline', e.message);
  } finally {
    running = false;
    if (again) { again = false; schedule(300); }
  }
}
