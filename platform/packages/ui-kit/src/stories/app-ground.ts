import { html, type TemplateResult } from 'lit';

/** Apps stand on the one still slate ground (shell principles), so the App group's stories do too. */
export const onGround = (content: TemplateResult, width = 'var(--measure-wide)') =>
  html`<div style="background:var(--slate);padding:var(--space-5);border-radius:var(--radius-inset);max-width:${width}">${content}</div>`;
