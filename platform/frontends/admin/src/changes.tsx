import { Prose, Status } from '@augur/app-kit';
import type { AppHistoryEntry, AppJob, Change } from './api.js';
import { STEP_WORDS } from './installs.js';
import { Line, Quiet } from './parts.js';

const KIND_WORDS: Record<Change['kind'], string> = { major: 'Breaking', minor: 'New', patch: 'Fix' };

/** A changelog: each change in its own words, what kind it is, and the parts it moved. */
export const ChangeList = ({ changes, shortParts = (p: string) => p.replace(/^@augur\//, '') }: { changes: Change[]; shortParts?: (part: string) => string }) =>
  changes.length ? (
    <div data-changes className="admin-changes">
      {changes.map((c, i) => (
        <div key={c.id ?? i} data-change={c.kind} className="admin-change">
          <span className="admin-change-kind" data-kind={c.kind}>
            {KIND_WORDS[c.kind]}
          </span>
          <Prose value={c.text} />
          <Quiet>{c.parts.map(shortParts).join(', ')}</Quiet>
        </div>
      ))}
    </div>
  ) : (
    <p className="admin-flat admin-muted">No changelog was attached to this release, so its notes are on GitHub.</p>
  );

const when = (iso?: string) => (iso ? new Date(iso).toLocaleString(undefined, { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' }) : '');

const JOB_WORDS: Record<AppHistoryEntry['action'], string> = { install: 'Installed', remove: 'Removed', preview: 'Preview', 'preview-remove': 'Preview removed' };
const JOB_STATE_WORDS: Record<AppHistoryEntry['state'], string> = { requested: 'waiting', running: 'under way', done: 'done', failed: 'failed', cancelled: 'cancelled' };

/** An app's jobs, newest first: what was installed or removed, by whom (or by itself), and how it went. */
export const AppHistory = ({ history }: { history: AppHistoryEntry[] }) => (
  <div data-app-history>
    {history.map((h) => (
      <Line key={h.id} end={when(h.requestedAt)}>
        <span className="admin-two-lines">
          <span>
            {JOB_WORDS[h.action]}
            {h.version ? ` ${h.version}` : ''} · {JOB_STATE_WORDS[h.state]}
          </span>
          <Quiet>{[h.requestedBy === 'automatic' ? 'By itself (Automatic)' : 'Asked by an admin', h.message ?? ''].filter(Boolean).join(' · ')}</Quiet>
        </span>
      </Line>
    ))}
  </div>
);

/** A job's steps as the runner reported them. */
export const JobSteps = ({ job }: { job: AppJob }) => (
  <div data-job-steps>
    {job.steps.map((s, i) => (
      <Line key={i} end={new Date(s.at).toLocaleTimeString()}>
        <Status status={s.state === 'done' ? 'done' : s.state === 'failed' ? 'failed' : 'running'} markOnly /> {STEP_WORDS[s.step]}
        {s.message ? `: ${s.message}` : ''}
      </Line>
    ))}
  </div>
);
