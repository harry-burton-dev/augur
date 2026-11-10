import type { AppAsks, AppReview, AvailableApp } from './types.js';

/** What each scope lets an app's service do, in words (the same words Admin shows on an app). */
export const SCOPE_WORDS: Record<string, string> = {
  'notifications:send': 'Notify people',
  'audit:write': 'Write to the activity log',
  'models:use': 'Use AI models',
  'events:publish': 'Tell other services what happened',
  'events:subscribe': 'Hear what other services did',
  'people:read': 'Look up people and teams',
  'inbox:write': 'Put work in people’s inboxes',
  'knowledge:read': 'Read the knowledge graph',
  'knowledge:act': 'Change what the knowledge graph holds',
  'knowledge:extract': 'Add what documents say to the knowledge graph',
};

/** What an app may do on AUGUR, in words. */
export const scopeWords = (scopes: string[] | undefined) => (scopes?.length ? scopes.map((s) => SCOPE_WORDS[s] ?? s).join(', ') : 'Nothing beyond registering itself');

/** Names as a person says them: "A", "A and B", "A, B and C". */
export const listWords = (names: string[]) => (names.length < 2 ? (names[0] ?? '') : `${names.slice(0, -1).join(', ')} and ${names.at(-1)}`);

/** One resource a part asks for, in words (spec 4.6, 9.4). */
const resourceWords = ({ type, params = {} }: AppAsks['resources'][number]): string => {
  const list = (v: unknown) => (Array.isArray(v) ? listWords(v.map(String)) : '');
  switch (type) {
    case 'augur-gateway':
      return params.inbound ? 'answers people’s calls through the gateway' : 'calls AUGUR through the gateway';
    case 'augur-database':
      return typeof params.connections === 'number' ? `keeps a database, with up to ${params.connections} connections` : 'keeps a database';
    case 'augur-bucket':
      return 'keeps files on the server';
    case 'augur-floor-graphs':
      return `reads the floors’ graphs${params.classes ? ` of ${list(params.classes)}` : ''}${params.actions ? `, and takes ${list(params.actions)}` : ''}`;
    case 'augur-telemetry':
      return 'sends its telemetry to the deployment’s collector';
    case 'augur-scratch':
      return `has a private folder of ${String(params.size ?? '')}`.trim();
    case 'augur-files':
      return `reads a folder you fill: ${String(params.label ?? '')}`.trim();
    case 'augur-outbound':
      return `internet access${params.hosts ? ` to ${list(params.hosts)}` : ''}${params.why ? `, because: ${String(params.why)}` : ''}`;
    case 'augur-settings':
      return params.ids ? `reads the settings ${list(params.ids)}` : 'reads its settings';
    default:
      return type;
  }
};

/** What a release asks to be allowed, in words: one line for its scopes, one per part, then the rest (spec 9.4). */
export const asksWords = (asks: AppAsks, review?: AppReview, signer?: AvailableApp['signer']) => {
  const parts = Object.keys(asks.limits);
  return [
    `May: ${scopeWords(asks.scopes)}`,
    ...(parts.length
      ? parts.map((part) => {
          const { memory, cpu } = asks.limits[part]!;
          const uses = asks.resources.filter((r) => r.part === part).map(resourceWords);
          const kind = review?.kinds[part];
          return `Its ${part} part (${kind ? `${KIND_WORDS[kind] ?? kind}; ` : ''}${memory} of memory, ${cpu} CPU) ${uses.length ? listWords(uses) : 'asks for nothing'}`;
        })
      : ['Runs nothing on the server']),
    ...(review?.settings.length
      ? [`Offers ${review.settings.length === 1 ? 'a setting' : `${review.settings.length} settings`}: ${listWords(review.settings.map(settingWords))}`]
      : asks.settings.length
        ? [`Offers ${asks.settings.length === 1 ? 'a setting' : `${asks.settings.length} settings`}: ${listWords(asks.settings)}`]
        : []),
    ...folderWords(asks),
    `Works on ${listWords(asks.floors.map((f) => (f === 'personal' ? 'personal floors' : f === 'team' ? 'team floors' : 'the organisation’s floor')))}`,
    `Uploads up to ${asks.maxUpload} MB`,
    ...(asks.canvas ? ['Draws in a canvas frame'] : []),
    ...(signer?.repository ? [`Signed by ${signer.repository}’s ${signer.workflow}`] : []),
  ];
};

/** A part's kind, as the review says it (spec 4.2). */
const KIND_WORDS: Record<string, string> = { service: 'a service', worker: 'a worker', job: 'a job run before each version starts' };

/** One setting in the review: its label, type, and whether it's secret or must be filled in (spec 5.6). */
const settingWords = (s: AppReview['settings'][number]) => {
  const notes = [s.type === 'secret' ? 'secret' : s.type === 'enum' ? 'a choice' : s.type, ...(s.required ? ['required'] : [])];
  return `${s.label} (${notes.join(', ')})`;
};

/** The folders the admin fills (augur-files), each by its label (spec 5.6). */
const folderWords = (asks: AppAsks) => {
  const folders = asks.resources.filter((r) => r.type === 'augur-files').map((r) => String(r.params?.label ?? r.part));
  return folders.length ? [`Asks you to fill ${folders.length === 1 ? 'a folder' : `${folders.length} folders`}: ${listWords(folders)}`] : [];
};

