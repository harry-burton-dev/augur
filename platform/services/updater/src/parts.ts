/**
 * The parts the updater restarts, and how it tells each came back. The platform's own are named here;
 * the apps that ship with AUGUR (pillar apps) come from release/shipped-apps.json, which this release's
 * updater image carries (infra/service.Dockerfile), so the updater knows no app by name.
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
 * buckets, then stops), then the services others call. The apps that ship with AUGUR follow, and the
 * front door comes last. A platform service added to infra/deploy/compose.yml belongs here too
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
];
const PLATFORM_LAST: Row[] = [
  ['gateway', 'service', 'http://gateway:8080/healthz'],
  // nginx has no /healthz; the shell's page answering is the check.
  ['web', 'service', 'http://web:8080/'],
];

/** An app that ships with AUGUR, as release/shipped-apps.json has it. */
export interface ShippedApp {
  id: string;
  /** The port its service answers on inside the Compose network. */
  port: number;
  /** Its images beside its service's, which work in the background and answer nothing. */
  workers: string[];
}

const ID = /^[a-z][a-z0-9-]{1,39}$/;

/**
 * release/shipped-apps.json, as this release ships it: each app with its port and workers. Throws, saying
 * what's wrong, on one it can't read: an app the updater half knows would be restarted without being checked.
 */
export const shippedAppsFrom = (json: unknown): ShippedApp[] => {
  const apps = (json as { apps?: unknown } | null)?.apps;
  if (!apps || typeof apps !== 'object') throw new Error('release/shipped-apps.json has no "apps".');
  return Object.entries(apps as Record<string, { port?: unknown; workers?: unknown }>).map(([id, pin]) => {
    if (!ID.test(id)) throw new Error(`"${id}" in release/shipped-apps.json isn’t an app id.`);
    const port = pin?.port;
    if (typeof port !== 'number' || !Number.isInteger(port) || port < 1 || port > 65535) throw new Error(`${id} in release/shipped-apps.json has no "port" its service answers on.`);
    const workers = pin.workers ?? [];
    if (!Array.isArray(workers) || !workers.every((w) => typeof w === 'string' && ID.test(w))) throw new Error(`${id}’s "workers" in release/shipped-apps.json must be image names.`);
    return { id, port, workers: workers as string[] };
  });
};

/** The parts, in order, with the apps that ship with AUGUR between the platform's services and its front door. */
export const partsFor = (shipped: ShippedApp[] = []): Parts => {
  const rows: Row[] = [
    ...PLATFORM_FIRST,
    ...shipped.flatMap((app): Row[] => [[app.id, 'service', `http://${app.id}:${app.port}/healthz`], ...app.workers.map((w): Row => [w, 'worker'])]),
    ...PLATFORM_LAST,
  ];
  const seen = new Set<string>();
  for (const [name] of rows) {
    if (seen.has(name)) throw new Error(`"${name}" is named twice among the parts the updater restarts: an app that ships with AUGUR can’t take a platform part’s name.`);
    seen.add(name);
  }
  return {
    order: rows.map(([name]) => name),
    roles: Object.fromEntries(rows.map(([name, role]) => [name, role])),
    health: Object.fromEntries(rows.filter((row) => row[2]).map(([name, , url]) => [name, url as string])),
    readyMs: Object.fromEntries(rows.filter((row) => row[3]).map(([name, , , ms]) => [name, ms as number])),
    // Releases before AUGUR's own Keycloak image run Keycloak's: going back to one keeps Keycloak running.
    kept: ['keycloak'],
  };
};
