// Voice cheers: plays a random clip from audio/cheers/ when a set is completed.
let clips = null;
let last = null;

async function list() {
  if (clips) return clips;
  try {
    const res = await fetch('audio/cheers/list.json', { cache: 'no-cache' });
    clips = (await res.json()).filter((f) => typeof f === 'string' && /^[\w.-]+\.(mp3|m4a|aac|wav|ogg)$/i.test(f));
  } catch {
    clips = [];
  }
  return clips;
}

export async function cheer() {
  const all = await list();
  if (!all.length) return false;
  const pool = all.length > 1 ? all.filter((f) => f !== last) : all; // don't repeat the same clip twice in a row
  last = pool[Math.floor(Math.random() * pool.length)];
  const audio = new Audio(`audio/cheers/${last}`);
  try { await audio.play(); return true; } catch { return false; }
}
