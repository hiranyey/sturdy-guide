import { h, wait, vibrate } from './dom';
import { sfx } from './audio';
import { mountD20, die3dOf } from './die3d';
import { fmtMod, rollD20, successChance, type D20Roll } from '../core/rules';
import { settings } from '../ai/settings';
import { announce, reducedMotion } from './prefs';
import type { DmgRoll } from '../core/combat';

export function d20Svg(value: number | string, cls = ''): string {
  return `<svg viewBox="0 0 100 100" class="d20 ${cls}">
  <defs>
    <linearGradient id="d20a" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="var(--die-hi)"/><stop offset="1" stop-color="var(--die-lo)"/></linearGradient>
  </defs>
  <polygon points="50,3 91,26.5 91,73.5 50,97 9,73.5 9,26.5" fill="var(--die-lo)" stroke="var(--die-edge)" stroke-width="2.5" stroke-linejoin="round"/>
  <polygon points="50,3 91,26.5 50,21" fill="var(--die-hi)" opacity="0.55"/>
  <polygon points="50,3 9,26.5 50,21" fill="var(--die-hi)" opacity="0.8"/>
  <polygon points="9,26.5 50,21 23,67" fill="var(--die-mid)" opacity="0.9"/>
  <polygon points="9,26.5 9,73.5 23,67" fill="var(--die-lo)" opacity="0.9"/>
  <polygon points="91,26.5 50,21 77,67" fill="var(--die-mid)" opacity="0.6"/>
  <polygon points="91,26.5 91,73.5 77,67" fill="var(--die-lo)" opacity="0.7"/>
  <polygon points="23,67 77,67 50,97" fill="var(--die-lo)" opacity="0.85"/>
  <polygon points="9,73.5 23,67 50,97" fill="var(--die-lo)" opacity="0.6"/>
  <polygon points="91,73.5 77,67 50,97" fill="var(--die-lo)" opacity="0.5"/>
  <polygon points="50,21 77,67 23,67" fill="url(#d20a)" stroke="var(--die-edge)" stroke-width="1.5" stroke-linejoin="round"/>
  <g stroke="var(--die-edge)" stroke-width="1.2" opacity="0.7" fill="none">
    <path d="M50,3 L50,21 M9,26.5 L50,21 L91,26.5 M9,26.5 L23,67 L9,73.5 M91,26.5 L77,67 L91,73.5 M23,67 L50,97 L77,67"/>
  </g>
  <text x="50" y="54" text-anchor="middle" dominant-baseline="middle" class="d20-num">${value}</text>
</svg>`;
}

const POLY: Record<number, string> = {
  4: '50,8 94,88 6,88',
  6: '12,12 88,12 88,88 12,88',
  8: '50,4 94,50 50,96 6,50',
  10: '50,4 92,42 50,96 8,42',
  12: '50,4 95,36 78,92 22,92 5,36',
};

export function smallDieSvg(sides: number, value: number | string, cls = ''): string {
  const pts = POLY[sides] ?? POLY[6];
  const ty = sides === 4 ? 66 : 54;
  return `<svg viewBox="0 0 100 100" class="sdie ${cls}"><polygon points="${pts}" rx="8" fill="var(--die-mid)" stroke="var(--die-edge)" stroke-width="5" stroke-linejoin="round"/><text x="50" y="${ty}" text-anchor="middle" dominant-baseline="middle" class="sdie-num">${value}</text></svg>`;
}

function burst(host: HTMLElement, color: string, n = 22) {
  for (let i = 0; i < n; i++) {
    const a = (Math.PI * 2 * i) / n + Math.random() * 0.3;
    const dist = 70 + Math.random() * 70;
    const p = h('span', { class: 'spark', style: `--dx:${Math.cos(a) * dist}px;--dy:${Math.sin(a) * dist}px;background:${color};animation-delay:${Math.random() * 80}ms` });
    host.appendChild(p);
    setTimeout(() => p.remove(), 1100);
  }
}

async function tumble(dieHost: HTMLElement, final: number, ms: number, sides = 20) {
  if (reducedMotion()) ms = Math.min(ms, 250);
  dieHost.classList.remove('landed', 'crit', 'fumble');
  dieHost.classList.add('rolling');
  const d3 = sides === 20 ? die3dOf(dieHost) : undefined;
  if (d3) {
    // The 3D die: a short rattle as it leaves the hand, then a knock on every bounce.
    sfx.roll(Math.min(0.35, ms / 3000));
    vibrate(10);
    let hit = 1;
    await d3.roll(final, ms * 1.15, () => { sfx.clack(hit); vibrate(Math.round(14 * hit)); hit *= 0.6; });
    dieHost.classList.remove('rolling');
    dieHost.classList.add('landed');
    return;
  }
  sfx.roll(ms / 1000);
  vibrate([10, 30, 10, 30, 10]);
  const num = () => dieHost.querySelector('.d20-num, .sdie-num') as SVGTextElement | null;
  const start = performance.now();
  let next = 0;
  await new Promise<void>((resolve) => {
    const tick = (t: number) => {
      const el = t - start;
      if (el >= ms) return resolve();
      if (el >= next) {
        const n = num();
        if (n) n.textContent = String(1 + Math.floor(Math.random() * sides));
        next = el + 40 + (el / ms) ** 2 * 140;
      }
      requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
  });
  const n = num();
  if (n) n.textContent = String(final);
  dieHost.classList.remove('rolling');
  dieHost.classList.add('landed');
}

export interface CheckOptions {
  title: string;
  subtitle?: string;
  dc: number;
  bonus: number;
  parts: { label: string; value: number }[];
  adv?: -1 | 0 | 1;
  canInspire?: boolean;
  /** pre-computed roll (combat) — otherwise rolled on tap */
  roll?: D20Roll;
  /** fired the instant the die is thrown, before the animation */
  onRoll?: (roll: D20Roll, usedInspiration: boolean) => void;
  /** fired when the die lands (after the animation) */
  onLanded?: (roll: D20Roll) => void;
  /** reroll natural 1s (the Lucky talent) */
  lucky?: boolean;
  /** optional extra control shown with the result (e.g. share a natural 20) */
  extra?: (roll: D20Roll) => HTMLElement | null;
}

/** Full-screen check: shows DC & odds, player taps the die, it tumbles, lands. */
export function rollCheck(opts: CheckOptions): Promise<{ roll: D20Roll; usedInspiration: boolean }> {
  return new Promise((resolve) => {
    let adv: -1 | 0 | 1 = opts.adv ?? 0;
    let usedInspiration = false;
    const chanceEl = h('div', { class: 'odds' });
    const updateOdds = () => {
      const pct = Math.round(successChance(opts.bonus, opts.dc, adv) * 100);
      chanceEl.className = `odds ${pct >= 65 ? 'easy' : pct >= 40 ? 'fair' : 'hard'}`;
      chanceEl.textContent = `${pct}% chance${adv === 1 ? ' · advantage' : adv === -1 ? ' · disadvantage' : ''}`;
    };
    updateOdds();

    const dieA = h('div', { class: 'die-host big', role: 'button', tabindex: '0', 'aria-label': `Roll d20 for ${opts.title}, DC ${opts.dc}` });
    const dieB = h('div', { class: 'die-host big ghost', 'aria-hidden': 'true' });
    mountD20(dieA, 20);
    mountD20(dieB, 20);
    const diceRow = h('div', { class: 'dice-row' }, dieA);
    const result = h('div', { class: 'roll-result' });
    const hint = h('div', { class: 'tap-hint' }, 'Tap — or flick the die upward — to roll');

    const inspireBtn = opts.canInspire && adv !== 1
      ? h('button', {
          class: 'btn btn-inspire',
          onclick: (e: Event) => {
            e.stopPropagation();
            usedInspiration = !usedInspiration;
            adv = usedInspiration ? 1 : (opts.adv ?? 0);
            (e.currentTarget as HTMLElement).classList.toggle('on', usedInspiration);
            if (usedInspiration) diceRow.appendChild(dieB); else dieB.remove();
            updateOdds();
            sfx.tap();
          },
        }, '✨ Use Inspiration (advantage)')
      : null;
    if (adv !== 0) diceRow.appendChild(dieB);

    const partsText = opts.parts.filter((p) => p.value !== 0).map((p) => `${fmtMod(p.value)} ${p.label}`).join(' ');
    const overlay = h('div', { class: 'dice-overlay' },
      h('div', { class: 'dice-card' },
        h('div', { class: 'dice-title' }, opts.title),
        opts.subtitle ? h('div', { class: 'dice-sub' }, opts.subtitle) : null,
        h('div', { class: 'dc-row' },
          h('span', { class: 'dc-badge' }, h('small', null, 'DC'), String(opts.dc)),
          h('span', { class: 'mod-badge' }, `d20 ${partsText || '+0'}`),
        ),
        chanceEl,
        diceRow,
        hint,
        result,
        inspireBtn,
      ),
    );
    document.getElementById('overlay')!.appendChild(overlay);
    requestAnimationFrame(() => overlay.classList.add('open'));

    let rolled = false;
    const doRoll = async (power = 1) => {
      if (rolled) return;
      rolled = true;
      hint.textContent = '';
      inspireBtn?.remove();
      const roll = opts.roll ?? rollD20(opts.bonus, opts.dc, adv, opts.parts, { lucky: opts.lucky });
      opts.onRoll?.(roll, usedInspiration);
      // A harder flick tumbles longer; reduced motion keeps it brief.
      const ms = reducedMotion() ? 300 : Math.round(1100 * Math.max(0.85, Math.min(1.6, power)));
      if (power > 1 && !reducedMotion()) {
        diceRow.classList.add('thrown');
        diceRow.style.setProperty('--throw', `${Math.min(220, 80 * power)}px`);
      }
      const tumbles = [tumble(dieA, roll.dice[0], ms)];
      if (roll.dice.length > 1) tumbles.push(tumble(dieB.parentElement ? dieB : dieA, roll.dice[1], ms + 150));
      await Promise.all(tumbles);
      if (roll.dice.length > 1) {
        const keepA = roll.dice[0] === roll.kept;
        (keepA ? dieB : dieA).classList.add('discard');
      }
      const keptHost = roll.dice.length > 1 && roll.dice[0] !== roll.kept ? dieB : dieA;
      if (roll.crit) {
        keptHost.classList.add('crit');
        burst(keptHost, '#ffd76a', 28);
        sfx.crit();
        vibrate([40, 40, 120]);
      } else if (roll.fumble) {
        keptHost.classList.add('fumble');
        sfx.fumble();
        vibrate(200);
      } else if (roll.success) sfx.success();
      else sfx.fail();

      const verdict = roll.crit ? 'CRITICAL SUCCESS!' : roll.fumble ? 'CRITICAL FAIL!' : roll.success ? 'SUCCESS' : 'FAILURE';
      announce(`Rolled ${roll.kept}, total ${roll.total} against DC ${roll.dc}. ${verdict}`);
      opts.onLanded?.(roll);
      result.className = `roll-result show ${roll.crit ? 'crit' : roll.fumble ? 'fumble' : roll.success ? 'ok' : 'bad'}`;
      result.innerHTML = '';
      result.append(
        h('div', { class: 'math' }, `${roll.kept} ${roll.bonus ? fmtMod(roll.bonus) : ''} = `, h('b', null, String(roll.total)), ` vs ${roll.dc}`),
        h('div', { class: 'verdict' }, verdict),
        ...(roll.lucky ? [h('div', { class: 'lucky-note' }, '🍀 Lucky! A natural 1 was rerolled.')] : []),
      );
      const close = () => {
        overlay.classList.remove('open');
        setTimeout(() => overlay.remove(), 250);
        resolve({ roll, usedInspiration });
      };
      await wait(350);
      const extra = opts.extra?.(roll);
      if (extra) result.appendChild(extra);
      const cont = h('button', { class: 'btn btn-primary', onclick: close }, 'Continue');
      result.appendChild(cont);
      cont.focus({ preventScroll: true });
    };
    // Flick-to-throw: an upward swipe on the die rolls it, harder flicks tumble longer.
    let fy = 0, ft = 0;
    for (const die of [dieA, dieB]) {
      die.addEventListener('pointerdown', (e) => { fy = e.clientY; ft = performance.now(); });
      die.addEventListener('pointerup', (e) => {
        const dy = fy - e.clientY;
        const v = dy / Math.max(1, performance.now() - ft);
        if (dy > 30) doRoll(1 + Math.min(1, v));
      });
      die.addEventListener('keydown', (e) => { if ((e as KeyboardEvent).key === 'Enter' || (e as KeyboardEvent).key === ' ') doRoll(); });
      die.addEventListener('click', () => doRoll());
    }
    if (!settings.tapToRoll) setTimeout(() => doRoll(), 450);
    else overlay.querySelector('.dice-card')!.addEventListener('click', (e) => {
      if ((e.target as HTMLElement).closest('button')) return;
      doRoll();
    });
  });
}

/** Inline tray used in combat for fast, readable rolls. */
export class DiceTray {
  el = h('div', { class: 'dice-tray' });

  async showD20(roll: D20Roll, label: string, fast = false) {
    this.el.innerHTML = '';
    const hosts = roll.dice.map(() => { const el = h('div', { class: 'die-host tray' }); mountD20(el, 20, { idle: false }); return el; });
    const info = h('div', { class: 'tray-info' }, h('div', { class: 'tray-label' }, label), h('div', { class: 'tray-math' }));
    this.el.append(...hosts, info);
    const ms = fast ? 450 : 650;
    await Promise.all(hosts.map((host, i) => tumble(host, roll.dice[i], ms + i * 80)));
    if (roll.dice.length > 1) hosts[roll.dice[0] === roll.kept ? 1 : 0].classList.add('discard');
    const kept = hosts[roll.dice.length > 1 && roll.dice[0] !== roll.kept ? 1 : 0];
    if (roll.crit) { kept.classList.add('crit'); burst(kept, '#ffd76a', 14); sfx.crit(); }
    else if (roll.fumble) { kept.classList.add('fumble'); sfx.fumble(); }
    (info.querySelector('.tray-math') as HTMLElement).innerHTML = `${roll.kept}${roll.bonus ? ' ' + fmtMod(roll.bonus) : ''} = <b>${roll.total}</b> vs ${roll.dc} <span class="${roll.success ? 'ok' : 'bad'}">${roll.success ? '✓' : '✗'}</span>`;
  }

  async showDamage(dr: DmgRoll, label: string) {
    const hosts = dr.dice.map(() => h('div', { class: 'die-host tray small', html: smallDieSvg(dr.sides, dr.sides) }));
    const wrap = h('div', { class: 'tray-dmg' }, ...hosts, h('span', { class: 'tray-dmg-total' }));
    this.el.appendChild(wrap);
    await Promise.all(hosts.map((host, i) => tumble(host, dr.dice[i], 380 + i * 60, dr.sides)));
    (wrap.querySelector('.tray-dmg-total') as HTMLElement).innerHTML = `${dr.bonus ? fmtMod(dr.bonus) + ' ' : ''}= <b>${dr.total}</b> ${label}`;
  }

  clear() {
    this.el.innerHTML = '';
  }
}
