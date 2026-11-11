import type { SelectOption } from '@augur/app-kit';
import type { FeaturePreviewMode, FeaturePreviews } from './api.js';

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

/** Names as a person says them: "A", "A and B", "A, B and C". */
export const listWords = (names: string[]) => (names.length < 2 ? (names[0] ?? '') : `${names.slice(0, -1).join(', ')} and ${names.at(-1)}`);
