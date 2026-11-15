// Pulls changes made on other devices, then pushes local changes, to Firestore.
// Each record is one document at users/{uid}/records/{id}.
import * as store from './store.js';
import { firestore, session, docName } from './auth.js';

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

const minus10s = (ts) => new Date(Date.parse(ts) - 10000).toISOString();

function toRow(doc) {
  const f = doc.fields || {};
  let data = {};
  try { data = JSON.parse(f.json?.stringValue || '{}'); } catch { /* keep empty */ }
  return {
    id: doc.name.split('/').pop(),
    kind: f.kind?.stringValue,
    data,
    deleted: !!f.deleted?.booleanValue,
    updated_at: f.updatedAt?.stringValue,
    server_at: f.serverAt?.timestampValue,
  };
}

async function pull(uid) {
  const last = await store.getMeta('lastServerAt');
  let since = last ? minus10s(last) : '1970-01-01T00:00:00Z';
  for (;;) {
    const res = await firestore(`/users/${uid}:runQuery`, {
      structuredQuery: {
        from: [{ collectionId: 'records' }],
        where: { fieldFilter: { field: { fieldPath: 'serverAt' }, op: 'GREATER_THAN', value: { timestampValue: since } } },
        orderBy: [{ field: { fieldPath: 'serverAt' }, direction: 'ASCENDING' }],
        limit: 1000,
      },
    });
    const rows = (res || []).filter((x) => x.document).map((x) => toRow(x.document)).filter((r) => r.kind && r.updated_at);
    if (!rows.length) break;
    await store.applyRemote(rows);
    since = rows[rows.length - 1].server_at;
    const saved = await store.getMeta('lastServerAt');
    if (!saved || Date.parse(since) > Date.parse(saved)) await store.setMeta('lastServerAt', since);
    if (rows.length < 1000) break;
  }
}

async function push(uid) {
  const dirty = store.dirtyRecords();
  for (let i = 0; i < dirty.length; i += 400) {
    const chunk = dirty.slice(i, i + 400);
    await firestore(':commit', {
      writes: chunk.map((r) => ({
        update: {
          name: docName(uid, r.id),
          fields: {
            kind: { stringValue: r.kind },
            json: { stringValue: JSON.stringify(r.data) },
            deleted: { booleanValue: !!r.deleted },
            updatedAt: { stringValue: r.updated_at },
          },
        },
        updateTransforms: [{ fieldPath: 'serverAt', setToServerValue: 'REQUEST_TIME' }],
      })),
    });
    await store.markClean(chunk);
  }
}

export async function syncNow() {
  if (running) { again = true; return; }
  if (!navigator.onLine) { setState('offline'); return; }
  const s = session();
  if (!s) return;
  running = true;
  setState('syncing');
  try {
    await pull(s.user.id); // newer edits from other devices win over older local ones
    await push(s.user.id);
    setState('ok');
  } catch (e) {
    setState(navigator.onLine ? 'error' : 'offline', e.message);
  } finally {
    running = false;
    if (again) { again = false; schedule(300); }
  }
}
