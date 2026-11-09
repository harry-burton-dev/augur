/**
 * Apps on the app contract (contract 3) in the catalogue. The runner registers an installed release's
 * manifest (spec 3.3); the registry keeps it as it came, beside the few contract 2 fields the rest of the
 * catalogue still reads (route, scopes, floors, maxUpload, previews, kinds), and serves the shell the
 * manifest in force (spec 9.6). Nothing about a contract 3 app is taken from anywhere but its release.
 */
import Type from 'typebox';
import { contractValidators, type AppManifest3 } from '@augur/app-tools/validate';
import type { AppEntry } from './manifest.ts';
import { stable } from './release-check.ts';
import type { AppJob } from './store.ts';

/** A catalogue entry as the registry keeps it: for a contract 3 app, with its manifest beside. */
export type KeptEntry = AppEntry & { manifest3?: AppManifest3 };

/** The manifest of a contract 3 app, or undefined for one on contract 2. */
export const manifest3Of = (entry: AppEntry): AppManifest3 | undefined => (entry as KeptEntry).manifest3;

/** Whether a registration is a contract 3 manifest: only those carry `contract`. */
export const isManifest3 = (body: unknown): body is AppManifest3 => typeof body === 'object' && body !== null && 'contract' in body;

/** How many of a manifest's schema problems a refusal lists (spec 9.1). */
const REASONS = 3;

/** Why a contract 3 manifest fails its schema, its first few problems with their paths; empty when it doesn't. */
export const manifest3Problems = (manifest: unknown): string[] => contractValidators().manifest(manifest).slice(0, REASONS);

/**
 * The install a manifest belongs to, of `jobs` (the app's install jobs under way or finished, newest first):
 * the one under way, or the newest that finished, which is what the runner goes back to. Never an older
 * version an admin has since replaced. Undefined when it is none of those.
 */
export const handedOver = (jobs: AppJob[], manifest: AppManifest3): AppJob | undefined => {
  const mine = jobs.filter((j) => j.app === manifest.id && j.action === 'install' && j.pr === undefined && j.release);
  const lastDone = mine.find((j) => j.state === 'done');
  return [...mine.filter((j) => j.state === 'running'), ...(lastDone ? [lastDone] : [])].find((j) => stable(j.release!.manifest) === stable(manifest));
};

/**
 * The job of `jobs` (the app's, newest first) whose release names the frontend bundle `digest` as `version`'s: an
 * install under way or finished, or a preview. The shell loads that build from /apps/<id>/<version>/ (spec 3.3),
 * so the registry keeps it at the version's own folder, not one named by the build. Undefined for any other upload,
 * which is a contract 2 build: those get a folder of their own.
 */
export const frontendHandedOver = (jobs: AppJob[], app: string, version: string, digest: string): AppJob | undefined =>
  jobs.find((j) => j.app === app && (j.action === 'install' || j.action === 'preview') && (j.state === 'running' || j.state === 'done') && j.release?.version === version && j.release.frontend?.digest === digest);

/** Why a contract 2 registration can't replace an app installed on contract 3. */
export const staysOn3 = (name: string) => `${name} is installed on the app contract: it registers only as the release the app runner installs, never as a contract 2 manifest.`;

/** Why the registry won't take a contract 3 manifest it didn't hand the runner. */
export const notHandedOver = (m: AppManifest3) => `${m.name} ${m.version} is installed from the app feed, through Admin → Apps: only a release the app runner was given can register it.`;

/** The contract 2 fields the catalogue reads, made from a contract 3 manifest, with the manifest kept beside them. */
export const entryOf3 = (m: AppManifest3): KeptEntry => {
  const c = (m.contributes ?? {}) as Record<string, unknown> & { intents?: { handles?: string[] } };
  const pick = <K extends keyof AppEntry>(key: K, value: unknown) => (value === undefined ? {} : ({ [key]: value } as Pick<AppEntry, K>));
  return {
    id: m.id,
    name: m.name,
    // Its address in the shell and at the gateway is its id (spec 6.3): /<id>, /api/<id>.
    route: `/${m.id}`,
    // Where the shell loads it from, which it works out itself (spec 3.3); kept so the catalogue's checks read one.
    entry: `/apps/${m.id}/${m.version}/${m.frontend?.entry ?? ''}`,
    version: m.version,
    // Contract 3 apps name no SDK range: the contract major is the promise (spec 11). The Upgrade Centre skips them.
    sdk: '*',
    ...pick('description', m.description),
    ...pick('icon', m.icon),
    ...pick('requiredRole', m.requiredRole),
    ...pick('floors', m.floors),
    ...pick('scopes', m.scopes),
    ...pick('maxUpload', m.maxUpload),
    ...pick('previews', m.previews),
    ...pick('links', m.links),
    ...pick('bindings', m.bindings),
    ...pick('handles', c.intents?.handles),
    ...pick('search', c.search),
    ...pick('inbox', c.inbox),
    ...pick('notifications', c.notifications),
    manifest3: m,
  };
};

/** What the shell is sent for a contract 3 app (spec 9.6): its manifest, with the limit in force, the previews on for the caller and its contract. */
export const served3 = (m: AppManifest3, filled: { maxUpload: number; previewsOn?: string[] }): AppManifest3 & { maxUpload: number; requiredRole?: string } => {
  const { $schema: _schema, ...manifest } = m as AppManifest3 & { $schema?: string };
  return { ...manifest, contract: m.contract, maxUpload: filled.maxUpload, ...(filled.previewsOn?.length ? { previewsOn: filled.previewsOn } : {}) };
};

/** A contract 3 manifest as a registration takes it; @augur/app-tools' manifest-3.schema.json checks the rest. */
export const AppManifest3Body = Type.Object(
  {
    contract: Type.Integer({ minimum: 3, description: 'The app contract major it is on' }),
    id: Type.String(),
    name: Type.String(),
    version: Type.String(),
  },
  { additionalProperties: true, description: 'An app on contract 3: its manifest (manifest-3.schema.json in @augur/app-tools), registered by the app runner from the release it installed' },
);

/** A contract 3 app as the shell's catalogue serves it: its manifest in force (spec 9.6). */
export const Served3 = Type.Object(
  {
    contract: Type.Integer({ minimum: 3 }),
    id: Type.String(),
    name: Type.String(),
    version: Type.String(),
    maxUpload: Type.Integer({ description: 'What the gateway lets through to the app in one request, in MB: what it asks, or less where an admin lowered it' }),
    previewsOn: Type.Optional(Type.Array(Type.String(), { description: "The ids of the app's previews on for the caller" })),
  },
  { additionalProperties: true, description: 'An app on contract 3: its manifest in force, filled in with maxUpload, previewsOn and its contract major' },
);
