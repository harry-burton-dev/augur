import { html } from 'lit';
import type { AppHistoryEntry, Change, UpdateHistoryEntry } from './api.js';
import { line } from './parts.js';

const KIND_WORDS: Record<Change['kind'], string> = { major: 'Breaking', minor: 'New', patch: 'Fix' };
const RANK: Record<Change['kind'], number> = { major: 0, minor: 1, patch: 2 };

/** Several releases' changes as one list: a change once, however many releases or parts carry it, breaking ones first. */
export const gatherChanges = (lists: (Change[] | undefined)[]): Change[] => {
  const seen = new Map<string, Change>();
  for (const c of lists.flatMap((l) => l ?? [])) {
    const key = c.id ?? c.text;
    const had = seen.get(key);
    if (!had) seen.set(key, { ...c, parts: [...c.parts] });
    else had.parts = [...new Set([...had.parts, ...c.parts])];
  }
  return [...seen.values()].sort((a, b) => RANK[a.kind] - RANK[b.kind]);
};

/** A changelog: each change in its own words, what kind it is, and the parts it moved. */
export const changeList = (changes: Change[], shortParts = (p: string) => p.replace(/^@augur\//, '')) =>
  changes.length
    ? html`<div data-changes style="display:flex;flex-direction:column">
        ${changes.map(
          (c) => html`<div data-change=${c.kind} style="display:flex;flex-direction:column;gap:var(--space-1);padding:var(--space-3) 0;border-bottom:1px solid var(--hairline)">
            <div style="display:flex;gap:var(--space-3);align-items:baseline">
              <span style="font-size:var(--type-small);font-weight:600;color:${c.kind === 'major' ? 'var(--danger)' : 'var(--ink-muted)'};min-width:5em">${KIND_WORDS[c.kind]}</span>
              <ui-prose .value=${c.text}></ui-prose>
            </div>
            <span style="padding-left:calc(5em + var(--space-3));color:var(--ink-muted);font-size:var(--type-small)">${c.parts.map(shortParts).join(', ')}</span>
          </div>`,
        )}
      </div>`
    : html`<p style="margin:0;color:var(--ink-muted)">No changelog was attached to this release, so its notes are on GitHub.</p>`;

const day = (iso?: string) => (iso ? new Date(iso).toLocaleString(undefined, { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' }) : '');
const minutes = (from: string, to?: string) => (to ? Math.max(1, Math.round((Date.parse(to) - Date.parse(from)) / 60_000)) : undefined);

const OUTCOME_WORDS: Record<UpdateHistoryEntry['state'], string> = {
  requested: 'Waiting for the updater',
  running: 'Under way',
  done: 'Done',
  'rolled-back': 'Went back by itself',
  failed: 'Stopped partway',
  cancelled: 'Cancelled',
};

/** Every upgrade asked for, newest first: from and to, who asked, how it ended, how long it took and the backup it took. */
export const historyList = (history: UpdateHistoryEntry[]) =>
  history.length
    ? html`<div data-history>
        ${history.map((h) => {
          const took = minutes(h.requestedAt, h.finishedAt);
          return line(
            html`<span style="display:flex;flex-direction:column;padding:var(--space-2) 0">
              <span>${h.from} → ${h.version} · ${OUTCOME_WORDS[h.state]}</span>
              <span style="color:var(--ink-muted);font-size:var(--type-small)"
                >${[h.requestedByName ? `Asked by ${h.requestedByName}` : 'Asked by an admin', took ? `took ${took} min` : '', h.backup ? `backup ${h.backup}` : '', h.message ?? ''].filter(Boolean).join(' · ')}</span
              >
            </span>`,
            day(h.requestedAt),
          );
        })}
      </div>`
    : html`<p style="margin:0;color:var(--ink-muted)">No upgrade has been asked for from this page yet.</p>`;

const JOB_WORDS: Record<AppHistoryEntry['action'], string> = { install: 'Installed', remove: 'Removed', preview: 'Preview', 'preview-remove': 'Preview removed' };
const JOB_STATE_WORDS: Record<AppHistoryEntry['state'], string> = { requested: 'waiting', running: 'under way', done: 'done', failed: 'failed', cancelled: 'cancelled' };

/** An app's jobs, newest first: what was installed or removed, by whom (or by itself), and how it went. */
export const appHistoryList = (history: AppHistoryEntry[]) =>
  html`<div data-app-history>
    ${history.map((h) =>
      line(
        html`<span style="display:flex;flex-direction:column;padding:var(--space-2) 0">
          <span>${JOB_WORDS[h.action]}${h.version ? ` ${h.version}` : ''} · ${JOB_STATE_WORDS[h.state]}</span>
          <span style="color:var(--ink-muted);font-size:var(--type-small)">${[h.requestedBy === 'automatic' ? 'By itself (Automatic)' : 'Asked by an admin', h.message ?? ''].filter(Boolean).join(' · ')}</span>
        </span>`,
        day(h.requestedAt),
      ),
    )}
  </div>`;
