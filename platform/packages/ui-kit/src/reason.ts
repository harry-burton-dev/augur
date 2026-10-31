import { css } from 'lit';

/**
 * Nothing is obtuse: a control that can't be used now stays where it is and
 * says why in one sentence (who can, what it's waiting for, or what would turn
 * it on). Controls with a `reason` stay in the tab order as `aria-disabled`, so
 * the reason can be reached, shown and read aloud.
 */

/** Whether the kit should tell developers about a disabled control that doesn't say why: on localhost, or with `data-kit-dev` on <html> ("false" turns it off). */
export const kitDev = () =>
  typeof document !== 'undefined' &&
  (document.documentElement.dataset.kitDev === 'true' ||
    (document.documentElement.dataset.kitDev !== 'false' &&
      typeof location !== 'undefined' &&
      ['localhost', '127.0.0.1'].includes(location.hostname)));

const told = new WeakSet<Element>();

/** Warn once per element, in development, when it's disabled without a reason. */
export const warnNoReason = (el: Element, disabled: boolean, reason: string, name: string) => {
  if (!disabled || reason || told.has(el) || !kitDev()) return;
  told.add(el);
  console.warn(`AUGUR kit: ${el.localName} "${name.trim()}" is disabled without a reason. Say why in one sentence with reason="…" (Nothing is obtuse).`, el);
};

/** The caption a reason shows in, under its control. Hidden until its host shows it. */
export const reasonBox = css`
  .reason {
    position: absolute;
    top: calc(100% + var(--space-1));
    left: 0;
    z-index: 1;
    width: max-content;
    max-width: 34ch;
    padding: var(--space-2) var(--space-3);
    border-radius: var(--radius-key);
    background: var(--surface-overlay);
    -webkit-backdrop-filter: blur(var(--surface-blur));
    backdrop-filter: blur(var(--surface-blur));
    border: 1px solid var(--hairline);
    box-shadow: var(--shadow-raised);
    font-size: var(--type-small);
    line-height: var(--leading-small);
    letter-spacing: normal;
    text-transform: none;
    font-weight: 400;
    color: var(--ink);
    white-space: normal;
    text-align: left;
    opacity: 0;
    transform: translateY(-2px);
    pointer-events: none;
    transition: opacity var(--motion-quick) var(--ease-out), transform var(--motion-quick) var(--ease-out);
  }
`;

/** The caption, shown on hover and focus of the whole control. */
export const reasonStyles = css`
  ${reasonBox}
  :host(:hover) .reason,
  :host(:focus-within) .reason { opacity: 1; transform: none; }
`;
