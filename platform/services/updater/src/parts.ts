/**
 * The parts the updater restarts, and how it tells each came back: the platform's own, named here. No app
 * ships with AUGUR (ADR 0075); the app runner restarts the apps it installed.
 */

/**
 * How the updater tells a part came back: a service once its /healthz answers with the version the release
 * gives it, a job once it has stopped without an error, a worker once it's running and stays up.
 */
export type Role = 'service' | 'job' | 'worker';

export interface Parts {
  /** Every part the updater restarts, in order. */
  order: string[];
  /** What each part is. */
  roles: Record<string, Role>;
  /** Where each service answers inside the Compose network. */
  health: Record<string, string>;
  /** How long a part may take to answer, in ms, where it's longer than the updater's usual wait. */
  readyMs: Record<string, number>;
  /** Parts every release runs, though not always from AUGUR's image: never stopped as one a release doesn't have. */
  kept: string[];
}

/**
 * The platform's own parts, in order: storage's set-up first (it gives apps their database logins and
 * buckets, then stops), then the services others call, and the front door last. A platform service added to infra/deploy/compose.yml belongs here too
 * (parts.test.ts fails until it is).
 */
type Row = [name: string, role: Role, health?: string, readyMs?: number];

const PLATFORM_FIRST: Row[] = [
  // AUGUR's Keycloak image (ADR 0041) first, since the services sign in through it. Ready once its
  // management port says so; its first start on a new Keycloak minor migrates its database, which can take
  // as long as its healthcheck allows (start_period in infra/deploy/compose.yml).
  ['keycloak', 'service', 'http://keycloak:9000/sso/health/ready', 300_000],
  ['storage', 'job'],
  ['identity', 'service', 'http://identity:8081/healthz'],
  ['registry', 'service', 'http://registry:8082/healthz'],
  ['events', 'service', 'http://events:8084/healthz'],
  ['models', 'service', 'http://models:8085/healthz'],
  // The knowledge graph's schema first, as Postgres's admin login, then the service, which signs in as kg_app.
  ['knowledge-migrate', 'job'],
  ['knowledge', 'service', 'http://knowledge:8086/healthz'],
  // OpenFGA, after storage has made its login: it brings its tables up to date, then serves. Its /healthz
  // says nothing of AUGUR's version, so it is back once it stays running. Then the service that asks it.
  ['openfga', 'worker'],
  ['permissions', 'service', 'http://permissions:8087/healthz'],
];
const PLATFORM_LAST: Row[] = [
  ['gateway', 'service', 'http://gateway:8080/healthz'],
  // nginx has no /healthz; the shell's page answering is the check.
  ['web', 'service', 'http://web:8080/'],
];

/** The parts, in order. */
export const partsFor = (): Parts => {
  const rows: Row[] = [...PLATFORM_FIRST, ...PLATFORM_LAST];
  return {
    order: rows.map(([name]) => name),
    roles: Object.fromEntries(rows.map(([name, role]) => [name, role])),
    health: Object.fromEntries(rows.filter((row) => row[2]).map(([name, , url]) => [name, url as string])),
    readyMs: Object.fromEntries(rows.filter((row) => row[3]).map(([name, , , ms]) => [name, ms as number])),
    // Releases before AUGUR's own Keycloak image run Keycloak's: going back to one keeps Keycloak running.
    kept: ['keycloak'],
  };
};
