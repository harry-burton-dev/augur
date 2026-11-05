import { readManifest, startAppService } from '@augur/service-kit';
import { buildApp } from './app.ts';

// Builds the service, listens on PORT, runs its jobs, gives the registry its frontend and puts it in
// the platform's catalogue (signed in as itself with SERVICE_CLIENT_SECRET). See docs/build-an-app.md.
const manifest = readManifest(import.meta.url);
await startAppService({ manifest, buildApp: ({ jobs }) => buildApp({ manifest, jobs }) });
