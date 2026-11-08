/** The types of `release.mjs` (contract 2's release file, `augur.app-release/v1`), for TypeScript callers. */

export const APP_RELEASE_SCHEMA: 'augur.app-release/v1';
export const FRONTEND_MEDIA_TYPE: 'application/vnd.augur.frontend.v1.tar+gzip';
export const DEV_BUILDS_KEPT: number;

export type Channel = 'stable' | 'beta' | 'dev' | 'preview';

/** The tag an app's release gets: `app/<id>@<version>`. */
export function appTag(id: string, version: string): string;
export function channelOf(version: string): Channel;
export function devVersion(version: string, run: number | string): string;
export function devAppOf(tag: string): string | undefined;
export function oldDevBuilds(tags: string[], app: string, keep?: string[], kept?: number): string[];
export function previewVersion(version: string, pr: number | string, run: number | string): string;
export function previewPrOf(tag: string): number | undefined;

/** A contract-2 manifest, as far as the release steps read it. */
export interface AppManifest1 {
  id: string;
  name: string;
  version: string;
  sdk: string;
  scopes?: string[];
  storage?: Record<string, unknown>;
  floors?: string[];
  maxUpload?: number;
  settings?: { id: string; [key: string]: unknown }[];
  [key: string]: unknown;
}

export interface Asks1 {
  scopes: string[];
  storage: Record<string, unknown>;
  floors: string[];
  maxUpload: number;
  settings: string[];
}
export function asksOf(manifest: AppManifest1): Asks1;

export interface Signer {
  repository: string;
  workflow: string;
}

export interface Bundle1 {
  /** The service image, by digest, or null. */
  service?: string | null;
  frontend?: { artifact: string; digest: string } | null;
  channel?: Channel;
}

export interface Preview {
  pr: number;
  title?: string;
  url?: string;
}

/** An `app-release.json` on contract 2. */
export interface AppRelease1 {
  schema: typeof APP_RELEASE_SCHEMA;
  id: string;
  version: string;
  channel: Channel;
  releasedAt: string;
  sdk: string;
  manifest: AppManifest1;
  service: { image: string } | null;
  frontend: { artifact: string; digest: string; mediaType: string } | null;
  signer: Signer;
  asks: Asks1;
  notes: string;
  preview?: Preview;
}

export function appRelease(input: { app: { id: string; manifest: AppManifest1 }; bundle: Bundle1; signer: Signer; notes?: string; releasedAt?: string; preview?: Preview }): AppRelease1;
export function changelogSection(text: string, version: string): string;
export function releaseNotes(release: Pick<AppRelease1, 'manifest' | 'version' | 'channel'> & { notes?: string; preview?: Preview }, options?: { target?: string }): string;
export function signerOf(env?: NodeJS.ProcessEnv): Signer;
