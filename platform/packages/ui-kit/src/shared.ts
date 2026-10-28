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
  /* loops stop, as they do under the page's own setting through the motion tokens (base.css) */
  @media (prefers-reduced-motion: reduce) {
    *, *::before, *::after { animation-duration: 0s !important; }
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

/**
 * The parts every field shares with TextField: the label row with its Required
 * or Optional flag, the hint, and the message line under the control. States
 * colour them through the host's `state` attribute.
 */
export const fieldParts = css`
  .head { display: flex; align-items: baseline; justify-content: space-between; gap: var(--space-3); font-size: var(--type-meta); line-height: var(--leading-meta); }
  .head label, .head .name { color: var(--ink); font-weight: 500; }
  .flag {
    display: inline-flex;
    align-items: center;
    gap: var(--space-2);
    font-size: var(--type-label);
    line-height: var(--leading-label);
    letter-spacing: var(--tracking-label);
    text-transform: uppercase;
    color: var(--ink-muted);
    white-space: nowrap;
  }
  .dot { position: relative; width: 6px; height: 6px; border-radius: 50%; border: 1px solid currentColor; }
  .hint { margin: 0; font-size: var(--type-small); line-height: var(--leading-small); color: var(--ink-muted); }
  .msg { display: flex; align-items: center; gap: var(--space-2); margin: 0; min-height: var(--leading-small); font-size: var(--type-small); line-height: var(--leading-small); color: var(--ink-muted); }
  :host([state='attention']) .flag, :host([state='attention']) .msg { color: var(--green); }
  :host([state='attention']) .dot { background: var(--green); border-color: var(--green); }
  :host([state='attention']) .dot::after {
    content: '';
    position: absolute;
    inset: -2px;
    border-radius: 50%;
    border: 1px solid var(--green);
    animation: ui-ping var(--motion-ping) var(--ease-ping) infinite;
  }
  :host([state='error']) .msg { color: var(--danger); }
  :host([state='warning']) .msg { color: var(--warning); }
`;
