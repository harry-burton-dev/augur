// What the fleet's machine client (ADR 0100, `platform-fleet`) may call through the gateway: the registry's
// routes that read and change what this server runs, and nothing else. No other route, service or app part.
// The registry decides what each call may change: it holds the fleet to the server's ring.
import { FLEET_SERVICE } from '@augur/service-kit';

/** The registry's routes, by method, as the registry has them under /api/registry. Reads let the fleet follow what it asked for. */
const FLEET_CALLS: [string, RegExp][] = [
  ['GET', /^\/v1\/platform\/overview$/],
  ['GET', /^\/v1\/app-runner\/apps$/],
  ['GET', /^\/v1\/app-runner\/jobs$/],
  ['PUT', /^\/v1\/platform\/upgrade$/],
  ['PUT', /^\/v1\/platform\/units\/[a-z][a-z0-9-]{1,39}\/desired-state$/],
  ['POST', /^\/v1\/app-runner\/jobs$/],
];

const PREFIX = '/api/registry';
/** The gateway's route for the registry (its proxy), which a fleet call must have matched. */
export const FLEET_ROUTE = `${PREFIX}/*`;

/**
 * Whether the fleet's client may make this call. Judged on the raw path, which the registry routes as it is: one
 * with an escape (%), a dot segment or an empty segment is refused rather than read the way the registry might.
 */
export const fleetMayCall = (method: string, url: string): boolean => {
  const path = url.split('?')[0]!;
  if (!path.startsWith(`${PREFIX}/`) || /%|\/\.\.?(\/|$)|\/\//.test(path)) return false;
  const rest = path.slice(PREFIX.length);
  return FLEET_CALLS.some(([m, route]) => m === method && route.test(rest));
};

export const isFleet = (service: string) => service === FLEET_SERVICE;

export const FLEET_REFUSED = 'The fleet’s client may only read and change what this server runs, through the registry (ADR 0100).';
