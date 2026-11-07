// Keeping the installed app (iOS home-screen PWA especially) on the latest release.
// iOS rarely relaunches a home-screen app — it resumes it — so we check for a new
// build whenever the app comes back to the foreground, and offer a one-tap update.
import { h } from './dom';

let reg: ServiceWorkerRegistration | null = null;
let offered = false;
let beforeReload: () => void = () => {};

/** Register the service worker and start watching for new releases (production only). */
export function initUpdates(onBeforeReload: () => void) {
  beforeReload = onBeforeReload;
  if (!import.meta.env.PROD || !('serviceWorker' in navigator)) return;
  navigator.serviceWorker
    .register('./sw.js', { updateViaCache: 'none' })
    .then((r) => { reg = r; })
    .catch(() => {});
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') void checkForUpdate();
  });
  window.addEventListener('online', () => void checkForUpdate());
  setInterval(() => { if (document.visibilityState === 'visible') void checkForUpdate(); }, 20 * 60 * 1000);
  setTimeout(() => void checkForUpdate(), 4000);
}

export type UpdateCheck = 'latest' | 'update' | 'offline';

/** Ask the server which build is live; offer the update if it isn't this one. */
export async function checkForUpdate(): Promise<UpdateCheck> {
  reg?.update().catch(() => {});
  try {
    const r = await fetch(`./version.json?t=${Date.now()}`, { cache: 'no-store' });
    if (!r.ok) return 'offline';
    const live = (await r.json()) as { version?: string; build?: string };
    if (live.build && live.build !== __APP_BUILD__) {
      offerUpdate(live.version);
      return 'update';
    }
    return 'latest';
  } catch {
    return 'offline';
  }
}

/** A small banner: "Hexbound v0.4.0 is ready — Update". */
function offerUpdate(version?: string) {
  if (offered) return;
  offered = true;
  const el = h('div', { class: 'update-banner', role: 'status' },
    h('span', { class: 'ub-text' }, `✨ Hexbound ${version ? `v${version}` : 'update'} is ready`),
    h('button', { class: 'btn btn-primary ub-go', onclick: () => applyUpdate() }, 'Update'),
    h('button', { class: 'ub-later', 'aria-label': 'Later', onclick: () => { el.remove(); offered = false; } }, '✕'));
  document.body.appendChild(el);
}

/** Save, let the new service worker take over, and reload into the new release. */
export function applyUpdate() {
  try { beforeReload(); } catch { /* saving is best effort */ }
  reg?.waiting?.postMessage('skip-waiting');
  const reload = () => location.reload();
  if (navigator.serviceWorker?.controller) {
    navigator.serviceWorker.addEventListener('controllerchange', reload, { once: true });
    setTimeout(reload, 1200); // the new worker may already be in charge
  } else reload();
}
