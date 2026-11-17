/** augur-database: a login `app_<id>` owning database `app_<id>` with schema `<id>` in it, its search_path set to it, its connections capped (spec 4.6, 7.3). */
import { envValue } from '../env-file.ts';
import type { Provisioner } from './types.ts';

/** The most connections one app's login holds at once, without APP_DATABASE_CONNECTIONS (spec 7.3). */
export const DEFAULT_APP_CONNECTIONS = 30;
export const appConnections = (env: string) => {
  const n = Number(envValue(env, 'APP_DATABASE_CONNECTIONS') || DEFAULT_APP_CONNECTIONS);
  // The storage container takes no fewer than 2 (one for the app, one for its migrations).
  return Number.isInteger(n) && n >= 2 ? n : DEFAULT_APP_CONNECTIONS;
};
export const roleFor = (id: string) => `app_${id.replace(/-/g, '_')}`;
export const schemaFor = (id: string) => id.replace(/-/g, '_');

export const database: Provisioner = {
  type: 'augur-database',
  uri: 'template://augur/database',
  params: ['connections'],
  check: ({ connections }) =>
    connections === undefined || (Number.isInteger(connections) && (connections as number) >= 1 && (connections as number) <= 100) ? [] : ['connections is a whole number from 1 to 100.'],
  // The storage container makes the login and schema, and changes nothing when they're there.
  needs: ['storage'],
  outputs: ({ storageId, env, secrets, params }) => ({
    // The app's own database on AUGUR's Postgres (PER-456), reached through db-relay: on an app's network it
    // answers as postgres, and lets only the app's own login on (compose.yml). The login connects to no other.
    host: { value: 'postgres' },
    port: { value: '5432' },
    name: { value: roleFor(storageId) },
    user: { value: roleFor(storageId) },
    schema: { value: schemaFor(storageId) },
    password: { value: secrets.database, secret: true },
    connections: { value: String(params.connections ?? appConnections(env)) },
  }),
  compose: () => ({}),
};
