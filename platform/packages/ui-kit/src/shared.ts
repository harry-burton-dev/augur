import { css } from 'lit';

/**
 * Whether to hold still: the system asks for reduced motion, or the page does
 * with `data-motion="reduce"` on <html> (a person's own setting, which a host
 * applies). Read it each time; either can change while the page is open.
 */
export const reducedMotion = () =>
  (typeof document !== 'undefined' && document.documentElement.dataset.motion === 'reduce') ||
  (typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches);

/** Keyframes and resets every component's shadow root needs; keyframes don't cross shadow boundaries. */
export const base = css`
  :host {
    font-family: var(--font-sans);
    color: var(--ink);
    box-sizing: border-box;
  }
  *, *::before, *::after { box-sizing: inherit; }
  @keyframes ui-ping {
    0% { transform: scale(1); opacity: 0.8; }
    100% { transform: scale(var(--ping-scale, 1.9)); opacity: 0; }
  }
  @keyframes ui-spin { to { transform: rotate(360deg); } }
  @keyframes ui-run {
    0% { left: 0; width: 0; }
    50% { width: 30%; }
    100% { left: 100%; width: 0; }
  }
  @media (prefers-reduced-motion: reduce) {
    *, *::before, *::after { animation-duration: var(--motion-still) !important; }
  }
`;

/** Tracked small capitals: eyebrows, table headers, field flags. */
export const label = css`
  .label {
    font-size: var(--type-label);
    line-height: var(--leading-label);
    letter-spacing: var(--tracking-label);
    text-transform: uppercase;
    color: var(--ink-muted);
  }
`;

let counter = 0;
/** Unique ids for aria wiring inside a shadow root. */
export const uid = (prefix: string) => `${prefix}-${++counter}`;
