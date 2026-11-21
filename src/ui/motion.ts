// Small motion helpers, after Apple's "Designing Fluid Interfaces": follow the
// finger 1:1, carry its velocity, project where a flick is heading, resist
// softly at edges, and leave the way you came in.

export const reducedMotion = () =>
  typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;

export const isPhone = () => typeof window !== 'undefined' && window.matchMedia?.('(max-width: 639px)').matches;

/** How far a flick carries (Apple's scroll-deceleration projection). `v` in px/s. */
export const project = (v: number, rate = 0.998) => ((v / 1000) * rate) / (1 - rate);

/** Past an edge, follow less and less the further you pull (instead of a hard stop). */
export const rubberband = (overshoot: number, dimension: number, c = 0.55) =>
  (overshoot * dimension * c) / (dimension + c * Math.abs(overshoot));

/** Remembers the last ~100ms of pointer positions to know the release velocity (px/s). */
export const velocityTracker = () => {
  let samples: { y: number; t: number }[] = [];
  return {
    add(y: number, t = performance.now()) {
      samples.push({ y, t });
      samples = samples.filter((s) => t - s.t <= 100);
    },
    velocity() {
      if (samples.length < 2) return 0;
      const a = samples[0], b = samples[samples.length - 1];
      return b.t === a.t ? 0 : ((b.y - a.y) / (b.t - a.t)) * 1000;
    },
    reset() { samples = []; },
  };
};

export const EASE_OUT = 'cubic-bezier(0.23, 1, 0.32, 1)';
export const EASE_DRAWER = 'cubic-bezier(0.32, 0.72, 0, 1)';

/**
 * Leave the way it came in: a sheet slides back down (on a phone), a card
 * fades and shrinks a touch. Starts from wherever it is now, so a sheet that
 * was being dragged continues from under the finger. Exits are a bit quicker
 * than entrances.
 */
export const animateOut = async (el: HTMLElement, kind: 'sheet' | 'pop', velocity = 0): Promise<void> => {
  if (!el.animate) return;
  const reduce = reducedMotion();
  const backdrop = () => {
    try { el.animate([{ opacity: 0 }], { duration: 200, easing: 'ease', pseudoElement: '::backdrop', fill: 'forwards' }); } catch { /* not supported */ }
  };
  backdrop();
  let a: Animation;
  if (reduce) a = el.animate([{ opacity: 0 }], { duration: 150, easing: 'ease', fill: 'forwards' });
  else if (kind === 'sheet') {
    // A fast flick finishes faster: the sheet keeps the finger's speed.
    const h = el.getBoundingClientRect().height || 400;
    const duration = velocity > 300 ? Math.max(140, Math.min(260, (h / velocity) * 1000)) : 240;
    a = el.animate([{ transform: 'translateY(100%)' }], { duration, easing: velocity > 300 ? 'cubic-bezier(0.2, 0.6, 0.4, 1)' : EASE_DRAWER, fill: 'forwards' });
  } else a = el.animate([{ opacity: 0, transform: 'translateY(4px) scale(0.97)' }], { duration: 160, easing: EASE_OUT, fill: 'forwards' });
  await a.finished.catch(() => {});
};

/** After an exit, clear the finished animations so the next entrance starts clean. */
export const resetAnimations = (el: HTMLElement) => {
  el.getAnimations?.({ subtree: false }).forEach((a) => a.cancel());
  el.style.transform = '';
  el.style.transition = '';
};
