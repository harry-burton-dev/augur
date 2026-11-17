// Makes the deployment's secrets on first start, then hands each service only its own (ADR 0107). For each secret
// the schema marks x-generate, a value set in the environment wins (an existing server's .env, or a platform
// host's settings), then the one made before, then a new one. They are kept in /secrets/made (the secrets volume,
// which backups carry), and each service's files from infra/deploy/made-secrets.json are written into its own
// folder under /secrets/for, which only that service mounts. Runs to the end and stops, on every `up`.
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { startupLog } from '@augur/service-kit';
import { fill, madeNames, readFolder, secretValues, servicesOf, specProblems, writeFolder, type SecretsSpec } from './made-secrets.ts';

const log = startupLog('make-secrets');
const env = process.env;
// Where compose.yml mounts them.
const schemaFile = '/etc/augur/settings.schema.json';
const specFile = '/etc/augur/made-secrets.json';
const madeDir = '/secrets/made';
const forDir = '/secrets/for';

const made = madeNames(JSON.parse(readFileSync(schemaFile, 'utf8')));
const spec = JSON.parse(readFileSync(specFile, 'utf8')) as SecretsSpec;
const problems = specProblems(spec, made, env);
if (problems.length) {
  for (const problem of problems) log.error(`${specFile}: ${problem}`);
  process.exit(1);
}

const { values, fresh } = secretValues(made, env, readFolder(madeDir));
// Only this job and the backup read the whole set.
writeFolder(madeDir, values, 0o400);
const services = servicesOf(spec);
for (const [service, files] of services) {
  // Readable by the service's own user, whoever that is: only that service mounts its folder.
  writeFolder(join(forDir, service), Object.fromEntries(Object.entries(files).map(([name, template]) => [name, fill(template, values, env)])), 0o444);
}
log.info(fresh.length ? `Made ${fresh.length} new secret${fresh.length === 1 ? '' : 's'} (${fresh.join(', ')}); ${made.length - fresh.length} kept.` : `All ${made.length} secrets kept; none made.`);
log.info(`Handed ${services.length} services their own: ${services.map(([service]) => service).join(', ')}.`);
// Every AUGUR service reads .env (config.env, then .env; ADR 0107), so a secret still set there is in each one's environment.
const inEnv = made.filter((name) => env[name]);
if (inEnv.length) log.warn(`${inEnv.join(', ')} ${inEnv.length === 1 ? 'is' : 'are'} still set in .env, where every AUGUR service can see ${inEnv.length === 1 ? 'it' : 'them'}. AUGUR keeps ${inEnv.length === 1 ? 'it' : 'them'} now: once the backup's off-server copy has run, take ${inEnv.length === 1 ? 'it' : 'them'} out of .env.`);
