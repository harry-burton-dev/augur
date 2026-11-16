// The fleet's machine client (ADR 0100): a program that runs this deployment from its file, signed in as
// `platform-fleet`. It may read what the server runs, set a unit's desired state, upgrade AUGUR and ask the app
// runner to install or remove an app, with no person signed in and so no step-up. In return the registry holds it
// to the server's ring, and records every change under its name.
import { FLEET_CLIENT_ID, isFleetCaller, type Caller } from '@augur/service-kit';
import type { Ring } from './ring.ts';

export { FLEET_CLIENT_ID, isFleetCaller };

/** Who a change is recorded under: the fleet's client by its name, anyone else as the person they are. */
export const actorOf = (caller: Caller) => (isFleetCaller(caller) ? { id: FLEET_CLIENT_ID, kind: 'service' as const } : { id: caller.id, kind: 'user' as const });
/** Who asked, as a job or upgrade keeps it. */
export const requesterOf = (caller: Caller) => (isFleetCaller(caller) ? FLEET_CLIENT_ID : caller.id);

/**
 * Why the fleet's client may not install this release here, or nothing (ADR 0100): a dev or preview server takes any
 * release, and a production server only one promoted to stable that its publisher hasn't halted.
 */
export const fleetRingProblem = (ring: Ring, release: { what: string; version: string; channel?: string; halted?: unknown }): string | undefined => {
  if (ring !== 'production') return undefined;
  if (release.halted) return `${release.what} ${release.version} was halted by its publisher, and a production server never takes a halted release.`;
  if (release.channel !== 'stable') return `${release.what} ${release.version} isn’t promoted to stable, and the fleet’s client installs only stable releases on a production server (ADR 0100).`;
  return undefined;
};
