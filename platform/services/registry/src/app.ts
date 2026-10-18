import Fastify from 'fastify';
import { callerFromHeaders } from '@platform/service-kit';
import { loadAppManifests, platformApps, type AppEntry } from './seed.ts';

export const buildApp = async (apps: AppEntry[] = [...platformApps, ...loadAppManifests()]) => {
  const app = Fastify({ logger: process.env.NODE_ENV !== 'test' });
  app.get('/healthz', async () => ({ status: 'ok', service: 'registry' }));

  // The gateway verified who is calling and passed it on; each person sees only the apps their roles allow.
  app.get('/manifest', async (req) => {
    const roles = callerFromHeaders(req.headers)?.roles ?? [];
    return apps.filter((a) => !a.requiredRole || roles.includes(a.requiredRole));
  });

  return app;
};
