/** The types of `release2.mjs`, for the registry and other TypeScript callers. */
import type { AppManifest3, ScorePart } from './validate.js';

export const APP_RELEASE_2_SCHEMA: 'augur.app-release/v2';

/** What an admin agrees to, written out so a runner compares two versions without reading the Score files. */
export interface Asks2 {
  scopes: string[];
  resources: { part: string; type: string; params?: Record<string, unknown> }[];
  /** By part name. */
  limits: Record<string, { memory: string; cpu: string }>;
  floors: ('personal' | 'team' | 'org')[];
  maxUpload: number;
  settings: string[];
  canvas: boolean;
}

export interface FrontendBundle {
  /** The OCI artifact, by digest. */
  artifact: string;
  digest: string;
}

/** What the release workflow pushed: the frontend (absent for an app with no UI) and each part's image by digest, by part name. */
export interface Bundle2 {
  frontend?: FrontendBundle;
  images?: Record<string, string>;
  channel?: 'stable' | 'beta' | 'dev' | 'preview';
}

export interface Signer {
  repository: string;
  workflow: string;
}

/** An `app-release.json` on contract 3. */
export interface AppRelease2 {
  schema: typeof APP_RELEASE_2_SCHEMA;
  id: string;
  version: string;
  channel: 'stable' | 'beta' | 'dev' | 'preview';
  releasedAt: string;
  manifest: AppManifest3;
  frontend: (FrontendBundle & { mediaType: string }) | null;
  /** One workload per part, in the order jobs run, every image by digest. */
  parts: ScorePart[];
  signer: Signer;
  asks: Asks2;
  notes?: string;
  preview?: { pr: number; title?: string; url?: string };
}

export function asksOf2(manifest: AppManifest3, parts: ScorePart[]): Asks2;
export function pinImages(parts: ScorePart[], images?: Record<string, string>): ScorePart[];
export function appRelease2(input: {
  manifest: AppManifest3;
  parts: ScorePart[];
  bundle?: Bundle2;
  signer: Signer;
  notes?: string;
  releasedAt?: string;
  preview?: AppRelease2['preview'];
}): AppRelease2;
export function isRelease2(release: unknown): release is AppRelease2;
