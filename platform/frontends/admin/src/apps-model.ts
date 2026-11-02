import type { SelectOption, StatusName } from '@augur/app-kit';
import { SDK_VERSION } from '@augur/mfe-sdk';
import semver from 'semver';
import type { AppVersion, CatalogueApp, Department, FloorRule } from './api.js';

/** A change to how an app takes releases, kept in this tab while its admin enters their password again. */
export const FOLLOW_KEY = 'augur.app-follow';

/** Where an app stands: off, on, or on but unable to open in this platform. */
export const appStatus = (app: CatalogueApp, sdkVersion = SDK_VERSION): { status: StatusName; label: string; why?: string } => {
  if (!app.enabled) return { status: 'paused', label: 'Off', why: 'Nobody is offered it until it’s turned on.' };
  if (app.blocked) return { status: 'warning', label: 'Blocked', why: app.blocked };
  const range = semver.validRange(app.sdk);
  if (!range || !semver.satisfies(sdkVersion, range, { includePrerelease: true })) {
    return { status: 'warning', label: 'Won’t open', why: `It works with platform SDK ${app.sdk}; this platform has ${sdkVersion}.` };
  }
  return { status: 'done', label: 'On' };
};

/** "Follow new versions" in the version picker. */
export const NEWEST = '';

/** Why rolling back might not be all it seems: the manifest changes, the code at the entry address may not. */
export const rollbackNote = (current: CatalogueApp, target?: AppVersion): string =>
  target && target.version !== current.version && target.entry.entry === current.entry
    ? `Version ${target.version} loads from the same address as ${current.version}, so the shell gets that version’s menu and settings but runs whatever code is there now. Redeploy that version’s service to run its code too.`
    : '';

/** What each scope lets an app's service do, in words. */
export const SCOPE_WORDS: Record<string, string> = {
  'notifications:send': 'Notify people',
  'audit:write': 'Write to the activity log',
  'models:use': 'Use AI models',
  'events:publish': 'Tell other services what happened',
  'events:subscribe': 'Hear what other services did',
  'people:read': 'Look up people and teams',
};

/** What an app may do on the platform, as a fact's value. */
export const scopeWords = (scopes: string[] | undefined) =>
  scopes?.length ? scopes.map((s) => SCOPE_WORDS[s] ?? s).join(', ') : 'Nothing beyond registering itself';

/** A floor an app can be set on, in tree order: the org first, then each team below the one it sits in. */
export interface AppFloor {
  id: string;
  name: string;
  /** Ids from the org down to this floor, itself included. */
  path: string[];
}

/** The org and its teams as floors, parents before children. */
export const floorTree = (org: { id: string; name: string }, departments: Department[]): AppFloor[] => {
  const out: AppFloor[] = [{ id: org.id, name: org.name, path: [org.id] }];
  const walk = (parent: string | undefined, path: string[]) => {
    for (const d of departments.filter((x) => x.parentId === parent).sort((a, b) => a.name.localeCompare(b.name))) {
      out.push({ id: d.id, name: d.name, path: [...path, d.id] });
      walk(d.id, [...path, d.id]);
    }
  };
  walk(undefined, [org.id]);
  return out;
};

/**
 * Whether an app is on for a floor, in words, the way the registry decides
 * it: off everywhere while it's turned off, a block on the floor or above
 * wins, then the nearest rule from the floor upwards that carries on, and on
 * with no rule at all.
 */
export const floorStatus = (app: CatalogueApp, floor: AppFloor, rules: FloorRule[], names: Map<string, string>): { on: boolean; words: string } => {
  if (!app.enabled) return { on: false, words: 'Off: the app is turned off' };
  const kind = floor.path.length === 1 ? 'org' : 'team';
  if (app.floors && !app.floors.includes(kind)) return { on: false, words: `Off: it doesn’t work on ${kind === 'org' ? 'the org' : 'teams'}` };
  const block = rules.find((r) => r.state === 'blocked' && floor.path.includes(r.workspace));
  if (block) return { on: false, words: block.workspace === floor.id ? 'Blocked here and below' : `Off: blocked by ${names.get(block.workspace) ?? 'a floor above'}` };
  for (let i = floor.path.length - 1; i >= 0; i--) {
    const here = i === floor.path.length - 1;
    const rule = rules.find((r) => r.workspace === floor.path[i] && r.state !== 'blocked' && (here || r.carriesOn));
    if (rule) return { on: rule.state === 'on', words: `${rule.state === 'on' ? 'On' : 'Off'}${here ? '' : `, as ${names.get(rule.workspace) ?? 'the floor above'}`}` };
  }
  return { on: true, words: 'On' };
};

/** What an admin can lower an app's upload limit to: what it asks, or any of these below that. */
const UPLOAD_STEPS = [500, 200, 100, 50, 25, 10, 5, 1];
const DEFAULT_UPLOAD_MB = 10;

/** The choices for an app's upload limit, its own first. */
export const uploadChoices = (app: Pick<CatalogueApp, 'maxUpload' | 'uploadLimit' | 'uploadLimitLowered'>): SelectOption[] => {
  const asked = app.maxUpload ?? DEFAULT_UPLOAD_MB;
  // A limit set another way than this list still shows as chosen.
  const steps = new Set(UPLOAD_STEPS.filter((mb) => mb < asked));
  if (app.uploadLimitLowered && app.uploadLimit) steps.add(app.uploadLimit);
  return [{ value: 'asked', label: `${asked} MB, as it asks` }, ...[...steps].sort((a, b) => b - a).map((mb) => ({ value: String(mb), label: `${mb} MB` }))];
};

export const FLOOR_CHOICES: SelectOption[] = [
  { value: 'inherit', label: 'As the floor above' },
  { value: 'on', label: 'On here and below' },
  { value: 'off', label: 'Off here and below' },
  { value: 'blocked', label: 'Blocked here and below', detail: 'No team below can turn it on' },
];

