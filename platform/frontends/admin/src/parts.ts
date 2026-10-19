import { html, type TemplateResult } from 'lit';
import type { StatusName } from '@platform/ui-kit';
import type { Person } from './api.js';

/** One admin screen: a heading over a pane at the wide measure. */
export const page = (eyebrow: string, heading: string, summary: string, content: TemplateResult) =>
  html`<div style="max-width:var(--measure-wide);margin:0 auto;padding:var(--space-7) var(--edge);display:flex;flex-direction:column;gap:var(--space-6)">
    <ui-heading eyebrow=${eyebrow} heading=${heading} summary=${summary}></ui-heading>
    <ui-surface>${content}</ui-surface>
  </div>`;

/** Where someone's sign-in stands, as a status mark and its word. */
export const statusOf = (p: Pick<Person, 'enabled' | 'invited'>): { status: StatusName; label: string } =>
  !p.enabled ? { status: 'paused', label: 'Off' } : p.invited ? { status: 'queued', label: 'Invited' } : { status: 'done', label: 'Active' };

/** Shown once, straight after the password is made: it isn't kept anywhere the admin can see it again. */
export const passwordNote = ({ name, value, reset }: { name: string; value: string; reset: boolean }, close: () => void) =>
  html`<ui-dialog
    open
    size="glance"
    eyebrow=${reset ? 'New password' : 'Added'}
    heading=${`Give ${name} this password`}
    summary="It works once. They choose their own when they sign in with it."
    cancel-label="Done"
    @ui-close=${close}
  >
    <p
      data-password
      style="margin:0;padding:var(--space-4);border-radius:var(--radius-inset);background:color-mix(in srgb, var(--ink) 6%, transparent);font-family:var(--font-mono, monospace);font-size:var(--type-title, 24px);letter-spacing:0.08em;color:var(--ink);text-align:center;white-space:nowrap;user-select:all"
>${value}</p>
    <p>It won’t be shown again. If it’s lost, give them a new one from their details.</p>
    <div>
      <ui-button kind="secondary" size="sm" @click=${() => navigator.clipboard?.writeText(value).catch(() => undefined)}>Copy it</ui-button>
    </div>
  </ui-dialog>`;
