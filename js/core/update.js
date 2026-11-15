// "Check for updates": compares this app's version with version.json on the site.
import { APP_VERSION } from '../config.js';
import { toast } from '../ui/components.js';

const newer = (a, b) => {
  const pa = a.split('.').map(Number), pb = b.split('.').map(Number);
  for (let i = 0; i < 3; i++) if ((pa[i] || 0) !== (pb[i] || 0)) return (pa[i] || 0) > (pb[i] || 0);
  return false;
};

export const MESSAGES = {
  offline: "You're offline. Connect to check for updates.",
  failed: "Couldn't reach the update server. Try again later.",
  latest: (v) => `You're on the latest version (${v}).`,
  found: (v) => `Update found: version ${v}. Installing…`,
};

export async function checkForUpdate() {
  if (!navigator.onLine) { toast(MESSAGES.offline); return 'offline'; }
  let remote;
  try {
    const res = await fetch(`version.json?t=${Date.now()}`, { cache: 'no-store' });
    remote = (await res.json()).version;
    if (!remote) throw new Error('no version');
  } catch {
    toast(MESSAGES.failed);
    return 'failed';
  }
  if (!newer(remote, APP_VERSION)) { toast(MESSAGES.latest(APP_VERSION)); return 'latest'; }
  toast(MESSAGES.found(remote));
  try {
    const reg = await navigator.serviceWorker?.getRegistration();
    if (reg) await reg.update(); // the new version takes over and the app reloads itself
  } catch { /* fall through */ }
  setTimeout(() => location.reload(), 2500);
  return 'found';
}
