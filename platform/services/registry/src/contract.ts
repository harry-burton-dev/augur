/**
 * What contracts/registry.openapi.yaml says about the API as a whole. The paths and shapes come from the
 * routes and the schema files (schemas.ts, update-schemas.ts, app-runner-schemas.ts); `pnpm contracts`
 * writes the file and CI checks it is in step (ADR 0055). Bump `version` as docs/versioning.md says when
 * the API changes.
 */
import swagger from '@fastify/swagger';
import type { FastifyInstance } from 'fastify';
import { AppInstalls, AppJob, AppJobStep, AppRelease, Preview } from './app-runner-schemas.ts';
import {
  AllowedOrigin,
  AppArea,
  AppManifestEntry,
  AppMenuCategory,
  AppMenuItem,
  AppSetting,
  AppSettings,
  CatalogueEntry,
  FeaturePreview,
  FeaturePreviewMode,
  FeaturePreviewsAdmin,
  FloorKind,
  FloorRule,
  Refusal,
  Scope,
  ServerRing,
  StoredFrontend,
  Surface,
} from './schemas.ts';
import {
  Change,
  DesiredState,
  DesiredStateInput,
  FeedTrust,
  Halt,
  Overview,
  PipelineBranch,
  PipelineLine,
  PipelinePull,
  PlatformUpdates,
  ReleaseChannel,
  ReleaseSummary,
  Reporting,
  SignedReport,
  UnitResult,
  Upgrade,
  UpgradeHistoryEntry,
  UpgradeStep,
  UpgradeWindow,
} from './update-schemas.ts';

export const info = {
  title: 'Registry',
  version: '1.36.0',
  description: 'Catalogue of apps and micro frontends; serves the shell manifest.',
};

/** Every named schema, in the order the contract lists them. */
export const SCHEMAS = [
  Refusal,
  AppInstalls,
  AppRelease,
  Preview,
  AppJob,
  AppJobStep,
  StoredFrontend,
  AppSetting,
  AppSettings,
  Upgrade,
  UpgradeStep,
  PipelineBranch,
  PipelinePull,
  PipelineLine,
  PlatformUpdates,
  ReleaseChannel,
  ServerRing,
  ReleaseSummary,
  Halt,
  UpgradeWindow,
  DesiredStateInput,
  DesiredState,
  Reporting,
  SignedReport,
  Overview,
  UnitResult,
  FeedTrust,
  Change,
  UpgradeHistoryEntry,
  CatalogueEntry,
  FloorRule,
  AllowedOrigin,
  FeaturePreview,
  FeaturePreviewMode,
  FeaturePreviewsAdmin,
  AppManifestEntry,
  FloorKind,
  Surface,
  Scope,
  AppMenuCategory,
  AppArea,
  AppMenuItem,
];

/**
 * Collects the routes for the contract and adds the named schemas. Responses are sent as plain JSON,
 * as before: the response schemas document the API, they don't filter what is sent.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any -- any server type: this only reads the routes.
export const describeApi = async (app: FastifyInstance<any, any, any, any, any>, prefix: string) => {
  await app.register(swagger, {
    openapi: { openapi: '3.1.0', info, servers: [{ url: prefix }] },
    refResolver: { buildLocalReference: (json, _base, _fragment, i) => String(json.$id ?? `def-${i}`) },
  });
  for (const schema of SCHEMAS) app.addSchema(schema);
  app.setSerializerCompiler(() => (data) => JSON.stringify(data));
};
