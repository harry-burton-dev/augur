import { callerCheckFromEnv, commonSettings, loadConfigOrExit, serviceVerifierFromEnv, startupLog } from '@augur/service-kit';
import { buildApp } from './app.ts';
import { loadModel, OpenFga } from './openfga.ts';

const log = startupLog('permissions');

// Every setting the permissions service reads, checked before it starts.
loadConfigOrExit('permissions', [
  commonSettings.issuer,
  commonSettings.issuerInside,
  commonSettings.gateway,
  { name: 'OPENFGA_URL', about: 'where OpenFGA’s HTTP API is reached, which holds the relationships (ADR 0085).', required: true },
  { name: 'OPENFGA_TOKEN', about: 'OpenFGA’s preshared key.', secret: true },
  { name: 'PERMISSIONS_STORE', about: 'the name of the OpenFGA store this deployment’s permissions are kept in (default augur).' },
]);

const port = Number(process.env.PORT ?? 8087);
const engine = new OpenFga({ url: process.env.OPENFGA_URL!, token: process.env.OPENFGA_TOKEN || undefined });

// The store and the model are made or found on every start: a release with a new model writes it, and an
// earlier release finds its own again (OpenFGA keeps every model it was given).
const model = loadModel();
const store = await engine.ensureStore(process.env.PERMISSIONS_STORE || 'augur');
const modelId = await engine.ensureModel(store, model);
log.info(`answering from model ${modelId}`);

const app = await buildApp({ engine, store, modelId, model, verifyService: serviceVerifierFromEnv(), callers: callerCheckFromEnv('permissions') });
await app.listen({ port, host: '0.0.0.0' });
