import type { SelectOption } from '@augur/app-kit';
import type { AppJob, AppJobStepState, AvailableApp, FeaturePreviewMode, FeaturePreviews } from './api.js';

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
  watch: 'Watch it for 5 minutes',
  retire: 'Stop the old version a little later',
  remove: 'Stop and remove its containers',
};

const MODE_LABELS: Record<FeaturePreviewMode, string> = { off: 'Off', 'opt-in': 'For those who turn it on', everyone: 'On for everyone', floors: 'On for chosen floors' };

/** Who gets a feature preview: the server's default first, saying what it is, then each choice. */
export const featureModeChoices = (preview: FeaturePreviews['previews'][number], defaultMode: FeaturePreviewMode): SelectOption[] => [
  { value: 'default', label: `As this server does: ${MODE_LABELS[defaultMode].toLowerCase()}` },
  ...(['off', 'opt-in', 'everyone', 'floors'] as const).map((m) =>
    preview.ended && m !== 'off' ? { value: m, label: MODE_LABELS[m], detail: 'It has ended', disabled: true } : { value: m, label: MODE_LABELS[m] },
  ),
];

/** Where one feature preview stands, in a line: how many turned it on, which floors have it, and when it ends or ended. */
export const featureHint = (preview: FeaturePreviews['previews'][number], floorName: (id: string) => string = (id) => id) =>
  [
    preview.detail,
    preview.ended
      ? `It ended on ${preview.until}: it’s off for everyone, and the app should drop it or make it everyone’s.`
      : preview.until
        ? `Runs until ${preview.until}.`
        : undefined,
    preview.mode === 'opt-in' && !preview.ended ? `${preview.optedIn} ${preview.optedIn === 1 ? 'person has' : 'people have'} turned it on.` : undefined,
    preview.mode === 'floors' && !preview.ended && preview.floors?.length
      ? `On for ${listWords(preview.floors.map(floorName))} and the floors beneath, without a release; off everywhere else.`
      : undefined,
  ]
    .filter(Boolean)
    .join(' ');

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

/** Names as a person says them: "A", "A and B", "A, B and C". */
export const listWords = (names: string[]) => (names.length < 2 ? (names[0] ?? '') : `${names.slice(0, -1).join(', ')} and ${names.at(-1)}`);
