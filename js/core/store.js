// Local-first record store. Every piece of data is a record:
// { id, kind, data, deleted, updated_at, dirty }. Records live in IndexedDB on the
// device (so the app works offline) and sync to Firebase when online.
import { openDB, run } from './idb.js';

let db = null;
const recs = new Map();
const subs = new Set();

export async function initStore(userId) {
  db = await openDB('tracker-' + userId);
  recs.clear();
  const rows = await run(db, 'records', 'readonly', (s) => s.getAll());
  for (const r of rows) recs.set(r.id, r);
  emit();
}

export function closeStore() {
  if (db) db.close();
  db = null;
  recs.clear();
}

function emit(source = 'local') { for (const f of subs) f(source); }
export function subscribe(fn) { subs.add(fn); return () => subs.delete(fn); }

function view(r) { return r && !r.deleted ? { id: r.id, ...r.data } : null; }

export function all(kind) {
  const out = [];
  for (const r of recs.values()) if (r.kind === kind && !r.deleted) out.push(view(r));
  return out;
}

export function get(id) { return view(recs.get(id)); }

export function newId(prefix) { return `${prefix}:${crypto.randomUUID()}`; }

function stamp(prev) {
  let t = Date.now();
  if (prev) t = Math.max(t, Date.parse(prev.updated_at) + 1);
  return new Date(t).toISOString();
}

async function write(r) {
  recs.set(r.id, r);
  await run(db, 'records', 'readwrite', (s) => s.put(r));
  emit();
}

export async function put(kind, id, data) {
  const { id: _drop, ...clean } = data;
  const r = { id, kind, data: clean, deleted: false, updated_at: stamp(recs.get(id)), dirty: 1 };
  await write(r);
  return view(r);
}

export async function update(id, patch) {
  const r = recs.get(id);
  if (!r || r.deleted) return null;
  return put(r.kind, id, { ...r.data, ...patch });
}

export async function remove(id) {
  const r = recs.get(id);
  if (!r || r.deleted) return;
  await write({ ...r, deleted: true, updated_at: stamp(r), dirty: 1 });
}

// ---- sync support ----
export function dirtyRecords() {
  return [...recs.values()].filter((r) => r.dirty).map((r) => ({ ...r }));
}

export async function markClean(pushed) {
  const changed = [];
  for (const p of pushed) {
    const cur = recs.get(p.id);
    if (cur && cur.updated_at === p.updated_at && cur.dirty) { cur.dirty = 0; changed.push(cur); }
  }
  if (changed.length) await run(db, 'records', 'readwrite', (s) => { for (const r of changed) s.put(r); });
}

// Last write wins, by updated_at.
export async function applyRemote(rows) {
  const changed = [];
  for (const row of rows) {
    const cur = recs.get(row.id);
    const rt = Date.parse(row.updated_at);
    if (cur) {
      const ct = Date.parse(cur.updated_at);
      if (ct > rt) continue;
      if (ct === rt) { if (cur.dirty) { cur.dirty = 0; changed.push(cur); } continue; }
    }
    const r = { id: row.id, kind: row.kind, data: row.data || {}, deleted: !!row.deleted, updated_at: row.updated_at, dirty: 0 };
    recs.set(r.id, r);
    changed.push(r);
  }
  if (changed.length) {
    await run(db, 'records', 'readwrite', (s) => { for (const r of changed) s.put(r); });
    emit('remote');
  }
}

export function getMeta(key) { return run(db, 'meta', 'readonly', (s) => s.get(key)); }
export function setMeta(key, value) { return run(db, 'meta', 'readwrite', (s) => s.put(value, key)); }
