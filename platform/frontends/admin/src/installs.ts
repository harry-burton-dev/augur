import { html, nothing } from 'lit';
import type { SelectOption } from '@augur/ui-kit';
import type { AppInstalls, AppJob, AppJobStepState, AppPolicy, AvailableApp, InstalledApp } from './api.js';
import { line } from './parts.js';

/** How often Apps asks again while the app runner has a job waiting or under way. */
export const JOB_REFRESH_MS = 4_000;

export const jobOpen = (job?: AppJob) => job?.state === 'requested' || job?.state === 'running';

export const STEP_WORDS: Record<AppJobStepState['step'], string> = {
  verify: 'Check its signature',
  storage: 'Make its database and bucket',
  'sign-in': 'Give it a sign-in',
  start: 'Start the new version beside the old',
  health: 'Wait for it to answer',
  switch: 'Switch people over to it',
  retire: 'Stop the old version a little later',
  remove: 'Stop and remove its containers',
};

/** Which releases an app follows: production (stable) only, or preview (beta) too, which a production server never takes. */
export const channelChoices = (ring: AppInstalls['ring'] = 'preview'): SelectOption[] => [
  { value: 'stable', label: 'Production releases' },
  ring === 'production'
    ? { value: 'beta', label: 'Preview releases too', detail: 'Not on a production server', disabled: true }
    : { value: 'beta', label: 'Preview releases too' },
];

export const POLICY_CHOICES: SelectOption[] = [
  { value: 'automatic', label: 'Automatic', detail: 'Installs fixes and features that ask for nothing new' },
  { value: 'ask', label: 'Ask first', detail: 'Every new version waits for you' },
  { value: 'hold', label: 'Hold', detail: 'Stays on its version; nothing is offered' },
];

/** What a release asks to be allowed, in words. */
export const asksWords = (asks: AvailableApp['asks'], scopeWords: (s: string[]) => string) =>
  [
    `May: ${scopeWords(asks.scopes)}`,
    asks.storage.database || asks.storage.bucket ? `Keeps ${[asks.storage.database ? 'a database' : '', asks.storage.bucket ? 'files' : ''].filter(Boolean).join(' and ')} on the server` : 'Keeps nothing on the server',
    `Uploads up to ${asks.maxUpload} MB`,
  ];

/** Where a job stands, in a few words. */
export const jobWords = (job: AppJob): string => {
  const what = job.action === 'install' ? `Installing ${job.release?.version ?? ''}`.trim() : 'Removing';
  if (job.state === 'requested') return `${what}: waiting for the app runner`;
  if (job.state === 'running') {
    const at = job.steps.at(-1);
    return `${what}: ${at ? STEP_WORDS[at.step].toLowerCase() : 'starting'}`;
  }
  if (job.state === 'failed') return `${job.action === 'install' ? `${job.release?.version ?? 'The install'} didn’t install` : 'Not removed'}: ${job.message ?? 'see its steps'}`;
  if (job.state === 'cancelled') return `${what} was cancelled`;
  return job.message ?? (job.action === 'install' ? `Installed ${job.release?.version ?? ''}`.trim() : 'Removed');
};

/** A job's steps as the runner reported them. */
export const jobSteps = (job: AppJob) =>
  html`<div data-job-steps>
    ${job.steps.map((s) =>
      line(
        html`<ui-status status=${s.state === 'done' ? 'done' : s.state === 'failed' ? 'failed' : 'running'} mark-only></ui-status> ${STEP_WORDS[s.step]}${s.message ? html`: ${s.message}` : nothing}`,
        new Date(s.at).toLocaleTimeString(),
      ),
    )}
  </div>`;

/** Why an installed app's newer version is waiting for an admin; empty when it isn't. */
export const waitingWhy = (app: InstalledApp): string[] => {
  if (!app.update || jobOpen(app.job) || app.policy === 'hold') return [];
  if (app.update.needs.length) return app.update.needs;
  if (app.job?.state === 'failed' && app.job.release?.version === app.update.version) return [`It didn’t install last time: ${app.job.message ?? 'see its steps'}`];
  return app.policy === 'ask' ? ['It’s set to ask first.'] : [];
};

export const policyHint = (policy: AppPolicy) => POLICY_CHOICES.find((c) => c.value === policy)?.detail ?? '';
