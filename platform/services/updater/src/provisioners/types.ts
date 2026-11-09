/**
 * A provisioner: what one AUGUR resource type (spec 4.6) gives a part. Each keeps the shape of
 * score-compose's template provisioner (uri, type, the params it takes, its outputs, what it adds to
 * the project), so a Kubernetes runner can take the same definitions later (spec 10.2). Everything a
 * provisioner works out is a pure function of the deployment's settings and the app, so provisioning
 * the same release twice gives the same outputs and the same project; the work on the platform's side
 * (`needs`) is idempotent too.
 */
import type { AppManifest3 } from '@augur/app-tools/validate';
import type { Output } from '../score.ts';

export type { Output };

/** An app's secrets, worked out from APP_SECRETS_KEY or named in .env (runner.ts, appSecrets). */
export interface AppSecrets {
  database: string;
  bucket: string;
  signIn: string;
}

export interface ProvisionContext {
  /** The app's id: its sign-in, its gateway route. */
  app: string;
  /** Where its data is kept: the app's id, or `<id>-pr<n>` for a pull request's preview. */
  storageId: string;
  /** The part asking, and its name for the resource. */
  part: string;
  resource: string;
  params: Record<string, unknown>;
  /** The deployment's settings, .env. */
  env: string;
  manifest: AppManifest3;
  /** The app's sign-in, with the storage secrets of `storageId`. */
  secrets: AppSecrets;
  /** The values an admin gave the app's settings, by id, as the registry last said. */
  settings?: Record<string, string>;
}

/** Platform work a resource needs before any part starts, done once per app: its storage, its sign-in. */
export type Need = 'storage' | 'sign-in';

/** A named volume the resource is: `source: ${resources.<name>}` mounts it. */
export interface Volume {
  name: string;
  readOnly: boolean;
  /** What it may hold, in bytes, when the type takes a size. */
  size?: number;
  labels: Record<string, string>;
}

export interface Provisioner {
  type: string;
  /** As score-compose names a template provisioner. */
  uri: string;
  /** The params it takes; any other is refused. */
  params: readonly string[];
  /** What's wrong with the params' values, as plain reasons; empty when nothing is. */
  check(params: Record<string, unknown>, ctx: ProvisionContext): string[];
  needs: readonly Need[];
  outputs(ctx: ProvisionContext): Record<string, Output>;
  /** What it adds to the project: a volume, for the types that are one. */
  compose(ctx: ProvisionContext): { volume?: Volume };
}

/** The gateway inside the deployment, as parts reach it. */
export const GATEWAY_INSIDE = 'http://gateway:8080';
/** The gateway's own route for a part's client-credentials token (P1). */
export const TOKEN_PATH = '/api/identity/v1/token';

export const isPlainObject = (v: unknown): v is Record<string, unknown> => Boolean(v) && typeof v === 'object' && !Array.isArray(v);
