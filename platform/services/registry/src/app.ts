import Fastify from 'fastify';
import { loadAppManifests, platformApps, type AppEntry } from './seed.ts';

export const buildApp = async (apps: AppEntry[] = [...platformApps, ...loadAppManifests()]) => {
  const app = Fastify({ logger: process.env.NODE_ENV !== 'test' });
  app.get('/healthz', async () => ({ status: 'ok', service: 'registry' }));

  // The gateway forwards the caller's roles; until Identity exists they come as a header.
  app.get('/manifest', async (req) => {
    const roles = String(req.headers['x-user-roles'] ?? '')
      .split(',')
      .map((r) => r.trim())
      .filter(Boolean);
    return apps.filter((a) => !a.requiredRole || roles.includes(a.requiredRole));
  });

  return app;
};
