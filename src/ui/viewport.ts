// iOS home-screen apps with the translucent status bar sometimes get a page that
// is shorter than the screen: `position: fixed; inset: 0` stops above the home
// indicator and the strip below shows bare page background. We measure the
// shortfall and publish it as --vp-gap; the full-screen layers stretch down by
// that much (see style.css), so the map and dock run to the very bottom edge.

/** True only for an installed iOS web app (navigator.standalone is iOS-only). */
const iosStandalone = () => (navigator as Navigator & { standalone?: boolean }).standalone === true;

/** How far the page falls short of the physical screen, in CSS px, or -1 when there is no such strip. */
export function viewportGap(innerW: number, innerH: number, screenW: number, screenH: number): number {
  const portrait = innerH >= innerW;
  const full = portrait ? Math.max(screenW, screenH) : Math.min(screenW, screenH);
  const gap = Math.round(full - innerH);
  // A real gap is about one status bar tall. Anything bigger is the on-screen
  // keyboard or a split-screen window, not this bug.
  return gap >= 8 && gap <= 120 ? gap : -1;
}

export function fitViewport() {
  if (!iosStandalone()) return;
  const root = document.documentElement.style;
  let last = 0;
  const update = () => {
    const gap = viewportGap(innerWidth, innerHeight, screen.width, screen.height);
    if (gap < 0) {
      // keyboard up or an unusual window: keep what we had if it's just the keyboard
      const typing = document.activeElement instanceof HTMLInputElement || document.activeElement instanceof HTMLTextAreaElement;
      if (typing) return;
    }
    const g = Math.max(0, gap);
    if (g === last) return;
    last = g;
    root.setProperty('--vp-gap', `${g}px`);
    // With the page cut short, iOS may report no bottom inset even though the
    // stretched layers now reach the home indicator; keep controls clear of it.
    root.setProperty('--vp-safe-b', g > 0 && Math.max(screen.width, screen.height) >= 812 ? '34px' : '0px');
  };
  update();
  addEventListener('resize', update);
  addEventListener('orientationchange', () => setTimeout(update, 300));
  document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible') update(); });
}
