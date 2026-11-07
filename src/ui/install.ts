// "Add to Home Screen": native install prompt on Android/desktop Chrome & Edge,
// step-by-step guide on iOS (Safari has no install prompt). Offered after the first camp.
import { h, modal, toast } from './dom';
import { sfx } from './audio';
import { settings, saveSettings } from '../ai/settings';

interface BeforeInstallPromptEvent extends Event {
  prompt(): Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

let deferred: BeforeInstallPromptEvent | null = null;

window.addEventListener('beforeinstallprompt', (e) => {
  e.preventDefault(); // keep it for a better moment
  deferred = e as BeforeInstallPromptEvent;
});
window.addEventListener('appinstalled', () => {
  deferred = null;
  toast('📲 Hexbound installed! Find it on your home screen.', 'good', 4000);
});

export const isStandalone = () => {
  try {
    return matchMedia('(display-mode: standalone)').matches || (navigator as unknown as { standalone?: boolean }).standalone === true;
  } catch {
    return false;
  }
};

export const isIOS = () => /iphone|ipad|ipod/i.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
export const installAvailable = () => !!deferred;

const RE_OFFER_MS = 3 * 24 * 3600 * 1000;

const SHARE_ICON = `<svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true"><path d="M12 3v12M7 8l5-5 5 5" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/><path d="M5 12v7a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-7" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>`;
const PLUS_ICON = `<svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true"><rect x="3" y="3" width="18" height="18" rx="4" fill="none" stroke="currentColor" stroke-width="2"/><path d="M12 8v8M8 12h8" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>`;

/** Show the install card. `manual` = user asked (Settings); otherwise respects the snooze. */
export function offerInstall(manual = false) {
  if (isStandalone()) {
    if (manual) toast('Hexbound is already installed on this device.', 'good');
    return;
  }
  if (!manual && Date.now() - settings.installDismissedAt < RE_OFFER_MS) return;
  if (!manual && !deferred && !isIOS()) return; // nothing useful to offer automatically
  const m = modal('install');
  const snooze = () => {
    settings.installDismissedAt = Date.now();
    saveSettings();
    m.close();
  };
  m.card.append(
    h('img', { src: './icon-192.png', alt: '', class: 'install-icon', width: 72, height: 72 }),
    h('div', { class: 'eyebrow' }, 'Keep the saga in your pocket'),
    h('h2', null, 'Add Hexbound to your Home Screen'),
    h('ul', { class: 'install-perks' },
      h('li', null, '⚡ One tap from your home screen, perfect for a 5-minute session'),
      h('li', null, '🖥️ Full screen, no browser bars'),
      h('li', null, '📴 Plays offline with the hand-written storyteller'),
    ),
  );
  if (deferred) {
    m.card.append(h('button', { class: 'btn btn-primary', onclick: async () => {
      const d = deferred!;
      sfx.tap();
      await d.prompt();
      const choice = await d.userChoice.catch(() => ({ outcome: 'dismissed' as const }));
      deferred = null;
      if (choice.outcome === 'dismissed') snooze(); else m.close();
    } }, '📲 Install'));
  } else if (isIOS()) {
    m.card.append(h('ol', { class: 'install-steps' },
      h('li', null, h('span', null, 'Tap the '), h('span', { class: 'ios-ico', html: SHARE_ICON }), h('b', null, ' Share'), ' button in the browser toolbar'),
      h('li', null, h('span', null, 'Scroll and choose '), h('span', { class: 'ios-ico', html: PLUS_ICON }), h('b', null, ' Add to Home Screen')),
      h('li', null, 'Tap ', h('b', null, 'Add'), ' — then open Hexbound from your home screen'),
    ), h('div', { class: 'install-arrow', 'aria-hidden': 'true' }, '⬇'));
  } else {
    m.card.append(h('p', { class: 'muted' }, 'Open your browser menu (⋮ or ⋯) and choose ', h('b', null, 'Install app'), ' or ', h('b', null, 'Add to Home screen'), '.'));
  }
  m.card.append(h('button', { class: 'btn', onclick: snooze }, 'Maybe later'));
}
