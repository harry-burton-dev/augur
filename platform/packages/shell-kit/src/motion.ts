/** Reduced motion, from the system or the page's own setting (`data-motion="reduce"` on <html>). */
export const reducedMotion = () =>
  (typeof document !== 'undefined' && document.documentElement.dataset.motion === 'reduce') ||
  (typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches);

/**
 * Moves between screens and floors, shared by the shell and its menus so
 * every move follows one rule: the thing you chose carries you to the next
 * place, and everything else steps aside (docs/shell-principles.md, "The
 * choice carries you"). Moves run on the Web Animations API, so any of them
 * can be jumped to its end: a key or a press during a move never waits.
 */

/** `reduce` when the system asks for reduced motion or the page does (`data-motion="reduce"` on <html>); one check for both. */
export type MotionMode = 'full' | 'reduce';
export const motionMode = (): MotionMode => (reducedMotion() ? 'reduce' : 'full');

const running = new Set<Animation>();

/** Keep a move so `finishMotion` can jump it to its end. */
export function track(animation: Animation): Animation {
  running.add(animation);
  const done = () => running.delete(animation);
  animation.finished.then(done, done);
  return animation;
}

/** Whether any move is under way. */
export const moving = () => running.size > 0;

/** Jump every move under way to its end, as a key or a press during one does. */
export function finishMotion() {
  for (const animation of [...running]) {
    try {
      animation.finish();
    } catch {
      /* an animation with no end (none here) can't be finished */
    }
  }
}

/** A token's length in ms or px, read from the page, so durations and distances only ever come from the token files. */
export function tokenValue(name: string, fallback: number): number {
  if (typeof getComputedStyle !== 'function' || typeof document === 'undefined') return fallback;
  const raw = getComputedStyle(document.documentElement).getPropertyValue(`--${name}`).trim();
  const n = parseFloat(raw);
  if (!Number.isFinite(n)) return fallback;
  return raw.endsWith('ms') ? n : raw.endsWith('s') ? n * 1000 : n;
}

/** A token's easing, read from the page. */
export const tokenEasing = (name: string, fallback = 'ease') =>
  (typeof getComputedStyle === 'function' && typeof document !== 'undefined' && getComputedStyle(document.documentElement).getPropertyValue(`--${name}`).trim()) || fallback;

/** Animate `el` and keep the move, or do nothing where the page can't animate (tests, old browsers). */
export function animate(el: Element, keyframes: Keyframe[], options: KeyframeAnimationOptions): Promise<void> {
  if (typeof (el as HTMLElement).animate !== 'function') return Promise.resolve();
  const animation = track(el.animate(keyframes, options));
  return animation.finished.then(
    () => undefined,
    () => undefined,
  );
}

/**
 * A copy of `from` lifted above everything at its place on screen, to land
 * somewhere else once the next screen has drawn: what you chose, carried
 * across. Under reduced motion nothing is lifted and landing does nothing.
 */
export interface Ghost {
  /** Fly to `to` (or fade where it is, without one), then go. */
  land(to: DOMRect | null | undefined, options?: { duration?: number }): Promise<void>;
  /** Go at once. */
  drop(): void;
}

const noGhost: Ghost = { land: () => Promise.resolve(), drop: () => undefined };

export function liftGhost(from: Element | null | undefined): Ghost {
  if (!from || motionMode() === 'reduce' || typeof document === 'undefined') return noGhost;
  const rect = from.getBoundingClientRect();
  if (!rect.width || !rect.height) return noGhost;
  const copy = from.cloneNode(true) as HTMLElement;
  const style = getComputedStyle(from);
  Object.assign(copy.style, {
    position: 'fixed',
    left: `${rect.left}px`,
    top: `${rect.top}px`,
    width: `${rect.width}px`,
    height: `${rect.height}px`,
    margin: '0',
    color: style.color,
    font: style.font,
    letterSpacing: style.letterSpacing,
    whiteSpace: 'nowrap',
    pointerEvents: 'none',
    zIndex: '2147483647',
    transformOrigin: '0 0',
  });
  copy.setAttribute('aria-hidden', 'true');
  copy.removeAttribute('id');
  document.body.append(copy);
  let gone = false;
  const drop = () => {
    gone = true;
    copy.remove();
  };
  return {
    drop,
    async land(to, options = {}) {
      if (gone) return;
      const duration = options.duration ?? tokenValue('motion-calm', 600);
      const easing = tokenEasing('ease-out');
      const frames: Keyframe[] = to
        ? [
            { transform: 'none', opacity: 1 },
            { transform: `translate(${to.left - rect.left}px, ${to.top - rect.top}px) scale(${to.width / rect.width}, ${to.height / rect.height})`, opacity: 1, offset: 0.85 },
            { transform: `translate(${to.left - rect.left}px, ${to.top - rect.top}px) scale(${to.width / rect.width}, ${to.height / rect.height})`, opacity: 0 },
          ]
        : [{ opacity: 1 }, { opacity: 0 }];
      await animate(copy, frames, { duration, easing, fill: 'forwards' });
      drop();
    },
  };
}
