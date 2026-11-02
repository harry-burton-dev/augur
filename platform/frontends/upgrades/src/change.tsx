import { Button, Choice, Dialog, TextField } from '@augur/app-kit';
import { useState } from 'react';
import { ApiError, type UpgradesApi } from './api.js';
import { Muted, Section, When } from './look.js';
import { endingOf, flowSteps, keepEntered, returnTo, signInAgainUrl, type Resume } from './model/flow.js';
import type { AppJob, InstalledApp, PlatformUpdates, Upgrade } from './model/types.js';

/** Where the person is now, for the address to come back to after entering the password. */
const here = () => window.location.pathname;

/** Goes to enter the password again, coming back to ask once more. Keeps the dialog open meanwhile. */
export const stepUp = (r: Resume): false => {
  window.location.assign(signInAgainUrl(returnTo(here(), r)));
  return false;
};

/** Says, while the window choice can't be made yet, why "In the next window" is greyed out. */
const NEXT_WINDOW_LATER = 'Waiting for a window is coming with the updater’s scheduling. Until then, Automatic takes releases in its window when the settings allow it.';

const When_ = ({ name }: { name: string }) => (
  <Choice
    label="When"
    name={name}
    value="now"
    options={[
      { value: 'now', label: 'Upgrade now', detail: 'Everyone is cut off for a minute or two while the parts restart.' },
      { value: 'window', label: 'In the next window', disabled: true, reason: NEXT_WINDOW_LATER },
    ]}
  />
);

/**
 * "Upgrade to AUGUR …?": what needs doing first, a field for each new setting only a person can
 * give, and when. Asking may send the person to enter their password again, then back here.
 */
export const UpgradeDialog = (p: { updates: PlatformUpdates; api: UpgradesApi; entered: Record<string, string>; took: (u: PlatformUpdates) => void; onClose: () => void }) => {
  const version = p.updates.next!;
  const fields = p.updates.needsYou.filter((n) => n.kind === 'setting' && n.key && !n.madeUp);
  const [entered, setEntered] = useState(p.entered);
  const notes = p.updates.available?.version === version ? p.updates.available.notesUrl : p.updates.newer.find((r) => r.version === version)?.notesUrl;
  return (
    <Dialog
      open
      eyebrow="AUGUR"
      heading={`Upgrade to AUGUR ${version}?`}
      summary={`It backs up first and checks the backup restores, then restarts each part on ${version} and watches it for 10 minutes. If anything fails, it goes back to ${p.updates.running.version} by itself.`}
      actionLabel="Upgrade"
      busyLabel="Asking"
      cancelLabel="Not now"
      onClose={p.onClose}
      onSubmit={async () => {
        const settings = Object.fromEntries(Object.entries(entered).map(([k, v]) => [k, v.trim()]).filter(([, v]) => v));
        try {
          p.took(await p.api.upgrade(version, settings));
        } catch (e) {
          if (e instanceof ApiError && e.code === 'sign_in_again') {
            keepEntered(settings);
            return stepUp({ kind: 'upgrade', version });
          }
          throw e;
        }
      }}
      fields={
        fields.length ? (
          <>
            {fields.map((n) => (
              <TextField
                key={n.key}
                label={n.key!}
                hint={n.required ? 'Needed. Leave it empty if it’s already in .env.' : 'Optional.'}
                value={entered[n.key!] ?? ''}
                onChange={(v) => setEntered((e) => ({ ...e, [n.key!]: v }))}
              />
            ))}
          </>
        ) : undefined
      }
    >
      <div className="flex flex-col gap-4">
        {p.updates.needsYou.length ? (
          <div>
            <p className="m-0">Before you go ahead:</p>
            <ul className="m-0 pl-5">
              {p.updates.needsYou.map((n) => (
                <li key={`${n.kind}-${n.key ?? n.message}`}>{n.message}</li>
              ))}
            </ul>
          </div>
        ) : (
          <p className="m-0">Nothing needs doing first.</p>
        )}
        {notes && (
          <p className="m-0">
            <a href={notes} target="_blank" rel="noopener" className="text-ink underline">
              Read the release notes
            </a>
          </p>
        )}
        <When_ name="when-upgrade" />
        <Muted>You may be asked for your password again.</Muted>
      </div>
    </Dialog>
  );
};

/** "Go back to AUGUR …?": the code goes back, the data stays. */
export const GoBackDialog = (p: { updates: PlatformUpdates; version: string; api: UpgradesApi; took: (u: PlatformUpdates) => void; onClose: () => void }) => (
  <Dialog
    open
    eyebrow="AUGUR"
    heading={`Go back to AUGUR ${p.version}?`}
    summary="Everyone is cut off for a minute or two while the parts restart. It backs up first, as an upgrade does."
    actionLabel="Go back"
    busyLabel="Asking"
    cancelLabel="Not now"
    onClose={p.onClose}
    onSubmit={async () => {
      try {
        p.took(await p.api.goBack(p.version));
      } catch (e) {
        if (e instanceof ApiError && e.code === 'sign_in_again') return stepUp({ kind: 'go-back', version: p.version });
        throw e;
      }
    }}
  >
    <div className="flex flex-col gap-3">
      <p className="m-0">
        The code goes back to {p.version}. The data stays as {p.updates.running.version} left it: no release between is breaking, so {p.version} works on it.
      </p>
      <Muted>You may be asked for your password again.</Muted>
    </div>
  </Dialog>
);

/** "Install … ?" for an app's newer release: what it waits on, and that the server does the work. */
export const InstallDialog = (p: { app: InstalledApp; version: string; api: UpgradesApi; done: (job: AppJob) => void; onClose: () => void }) => (
  <Dialog
    open
    eyebrow={p.app.name}
    heading={`Install ${p.app.name} ${p.version}?`}
    summary={`The server fetches ${p.version}, checks its signature and starts it in place of ${p.app.version}. People using ${p.app.name} may be cut off for a moment.`}
    actionLabel="Install"
    busyLabel="Asking"
    cancelLabel="Not now"
    onClose={p.onClose}
    onSubmit={async () => {
      try {
        p.done(await p.api.install(p.app.app, p.version));
      } catch (e) {
        if (e instanceof ApiError && e.code === 'sign_in_again') return stepUp({ kind: 'install', app: p.app.app, version: p.version });
        throw e;
      }
    }}
  >
    <div className="flex flex-col gap-3">
      {p.app.update?.needs.length ? (
        <div>
          <p className="m-0">It waited for an admin because:</p>
          <ul className="m-0 pl-5">
            {p.app.update.needs.map((n) => (
              <li key={n}>{n}</li>
            ))}
          </ul>
        </div>
      ) : null}
      <Muted>You may be asked for your password again.</Muted>
    </div>
  </Dialog>
);

const MARK: Record<'done' | 'now' | 'next' | 'failed', string> = { done: '✓', now: '•', next: '○', failed: '✕' };

/**
 * An upgrade as the updater reports it, step by step, followed live (the page reads every 2 s
 * while it runs), and how it ended. One that hasn't started can be cancelled.
 */
export const Following = (p: { upgrade: Upgrade; running: string; updaterSeenAt?: string; zone: string; now: Date; canCancel: boolean; cancelReason?: string; onCancel: () => Promise<void> }) => {
  const up = p.upgrade;
  const steps = flowSteps(up);
  const ending = endingOf(up, p.running);
  const [error, setError] = useState<string>();
  return (
    <Section title={`Upgrade to ${up.version}`} id="following">
      <p className="m-0 text-ink-muted text-small">
        Asked for by {up.requestedByName ?? up.requestedBy} <When at={up.requestedAt} zone={p.zone} now={p.now} />
        {up.backup ? ` · backup ${up.backup}` : ''}
      </p>
      {up.state === 'requested' && !up.steps.length ? (
        <p className="m-0" data-waiting>
          {p.updaterSeenAt ? 'The updater will pick it up within a minute.' : 'No updater has asked for work yet. Without one, cancel this and upgrade by hand (docs/upgrade.md).'}
        </p>
      ) : null}
      <ol className="m-0 p-0 list-none flex flex-col gap-2" aria-label="Steps">
        {steps.map((s) => (
          <li key={s.step} data-step={s.step} data-state={s.state} aria-current={s.state === 'now' ? 'step' : undefined} className={s.state === 'next' ? 'text-ink-muted' : s.state === 'failed' ? 'text-danger' : ''}>
            <span aria-hidden="true">{MARK[s.state]} </span>
            {s.label}
            {s.state === 'done' ? <span className="sr-only"> (done)</span> : s.state === 'failed' ? <span className="sr-only"> (failed)</span> : null}
            {s.step === 'watch' && s.state === 'now' && up.watch ? (
              <span className="text-ink-muted">
                {' '}
                until <When at={up.watch.until} zone={p.zone} now={p.now} />
              </span>
            ) : null}
            {s.message ? <span className="text-ink-muted">: {s.message}</span> : null}
          </li>
        ))}
      </ol>
      {up.watch?.checks.length ? (
        <ul className="m-0 pl-5 text-small" aria-label="What the watch checks">
          {up.watch.checks.map((c) => (
            <li key={c.name} className={c.ok ? '' : 'text-danger'}>
              {c.name}: {String(c.value)} (limit {String(c.threshold)}){c.ok ? '' : ', over the limit'}
            </li>
          ))}
        </ul>
      ) : null}
      {ending && (
        <p role="status" data-ending={ending.kind} className={`m-0 ${ending.kind === 'failed' ? 'text-danger' : ''}`}>
          {ending.words}
        </p>
      )}
      {up.state === 'requested' && (
        <div>
          <Button
            kind="tertiary"
            size="sm"
            disabled={!p.canCancel}
            reason={p.canCancel ? undefined : p.cancelReason}
            onPress={async () => {
              setError(undefined);
              await p.onCancel().catch((e: unknown) => setError(e instanceof Error ? e.message : String(e)));
            }}
          >
            Cancel the upgrade
          </Button>
        </div>
      )}
      {up.state === 'running' && <Muted>It can’t be stopped halfway: it finishes, or goes back by itself.</Muted>}
      {error && (
        <p role="alert" className="m-0 text-danger">
          {error}
        </p>
      )}
    </Section>
  );
};

/** An app's install job, as the app runner reports it, in one line. */
const jobWords = (job: AppJob): string => {
  const what = job.action === 'remove' ? 'Removing it' : `Installing ${job.release?.version ?? 'it'}`;
  switch (job.state) {
    case 'requested':
      return `${what}: waiting for the server to pick it up.`;
    case 'running':
      return `${what} now.`;
    case 'done':
      return job.action === 'remove' ? 'Removed.' : `Installed ${job.release?.version ?? ''}.`;
    case 'failed':
      return `${what} didn’t work${job.message ? `: ${job.message}` : '.'}`;
    default:
      return `${what} was cancelled.`;
  }
};

export const AppJobLine = (p: { job: AppJob; zone: string; now: Date }) => (
  <p className={`m-0 ${p.job.state === 'failed' ? 'text-danger' : ''}`} role="status" data-job={p.job.state}>
    {jobWords(p.job)}
    {p.job.finishedAt ? (
      <span className="text-ink-muted">
        {' '}
        <When at={p.job.finishedAt} zone={p.zone} now={p.now} />
      </span>
    ) : null}
  </p>
);
