import { css, html, nothing } from 'lit';
import { fieldParts } from '../shared.js';

/**
 * What writing fields add to the shared field parts: the hairline box that
 * turns blue while you type, the line under it, and the small quiet choices
 * ("End of week", "Clear") that sit beside a field.
 */
export const fieldChrome = [
  fieldParts,
  css`
    :host { display: flex; flex-direction: column; gap: var(--space-2); min-width: 0; }
    :host([disabled]) { opacity: 0.4; pointer-events: none; }
    .box { position: relative; display: flex; align-items: center; gap: var(--space-3); min-height: 44px; border-bottom: 1px solid var(--hairline-strong);
      transition: border-color var(--motion-base) var(--ease-standard), box-shadow var(--motion-base) var(--ease-standard); }
    .box:hover { border-bottom-color: color-mix(in srgb, var(--ink) 50%, transparent); }
    .input { flex: 1; min-width: 0; border: 0; outline: 0; background: none; color: var(--ink); font: inherit; font-size: var(--type-body); line-height: var(--leading-body); padding: var(--space-3) 0; resize: none; }
    .input::placeholder { color: color-mix(in srgb, var(--ink-muted) 75%, transparent); }
    .foot { display: flex; justify-content: space-between; gap: var(--space-3); }
    .count { font-size: var(--type-small); line-height: var(--leading-small); color: var(--ink-muted); font-variant-numeric: tabular-nums; white-space: nowrap; }
    :host([state='attention']) .box { border-bottom-color: var(--green); box-shadow: 0 1px 0 var(--green); }
    :host([state='error']) .box { border-bottom-color: var(--danger); box-shadow: 0 1px 0 var(--danger); }
    .box:focus-within { border-bottom-color: var(--focus) !important; box-shadow: 0 1px 0 var(--focus) !important; }
    .quiet { all: unset; cursor: pointer; display: inline-flex; align-items: center; padding: 2px var(--space-3); border: 1px solid var(--hairline); border-radius: var(--radius-pill);
      font-size: var(--type-small); line-height: var(--leading-small); color: var(--ink-muted); }
    .quiet:hover { color: var(--ink); border-color: var(--hairline-strong); }
    .quiet:focus-visible { outline: 1.5px solid var(--focus); outline-offset: 2px; }
    .sr { position: absolute; width: 1px; height: 1px; overflow: hidden; clip-path: inset(50%); white-space: nowrap; }
  `,
];

/** The label row: the label, then Required (a dot that asks in green) or Optional. */
export const fieldHead = (label: string, forId: string, required: boolean, optional: boolean) =>
  html`<div class="head">
    <label for=${forId}>${label}</label>
    ${required ? html`<span class="flag"><i class="dot" aria-hidden="true"></i>Required</span>` : optional ? html`<span class="flag">Optional</span>` : nothing}
  </div>`;
