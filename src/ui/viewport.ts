// iOS home-screen apps with the translucent status bar sometimes get a page that
// is shorter than the screen: `position: fixed; inset: 0` stops above the home
// indicator, and iOS paints only the page background in the strip below (content
// can't be drawn there). We measure the shortfall as --vp-gap and set .vp-short:
// the dock drops the home-indicator padding (the strip already clears it) and the
// bottom of the page fades into the strip's colour (see style.css).

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
    document.documentElement.classList.toggle('vp-short', g > 0);
  };
  update();
  addEventListener('resize', update);
  addEventListener('orientationchange', () => setTimeout(update, 300));
  document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible') update(); });
}
