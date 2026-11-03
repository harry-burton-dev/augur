import Fastify from 'fastify';
import { appServer, packageVersion, readManifest, serviceFastifyOptions, signedInCaller, type AppManifest, type CallerCheck, type Jobs } from '@augur/service-kit';

/** The major version of the API this service serves. Its routes go under /v1, as the platform's do. */
export const API_VERSION = 'v1';
const version = packageVersion(import.meta.url);

export interface Options {
  manifest?: AppManifest;
  /** Checks the caller the gateway signed for this app. In production it is on by default; in dev `x-user-*` headers are believed. */
  callers?: CallerCheck;
  /** Background and scheduled jobs (docs/jobs.md); startAppService passes them in. */
  jobs?: Jobs;
}

export const buildApp = async ({ manifest = readManifest(import.meta.url), callers }: Options = {}) => {
  const app = Fastify(serviceFastifyOptions());
  // Only the gateway's signed word says who is calling; every error is a problem details body; /healthz.
  await appServer(app, { manifest, version, api: API_VERSION, ...(callers ? { callers } : {}) });
  const caller = signedInCaller(manifest);

  await app.register(
    async (app) => {
      // The gateway verified who is calling and signed it; nobody reaches this without signing in.
      app.get('/greeting', async (req) => ({ message: `${manifest.name}'s service knows you as ${caller(req).name}.` }));
    },
    { prefix: `/${API_VERSION}` },
  );
  return app;
};
