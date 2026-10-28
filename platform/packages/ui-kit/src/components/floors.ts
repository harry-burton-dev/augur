/**
 * Floors: where the person is standing. Their own floor at the bottom, their
 * teams above it, the org at the top. The shell draws them as a gauge at the
 * edge, a breadcrumb at the top left and a list in Account, and moves the
 * water up or down between them.
 */

export type FloorKind = 'personal' | 'team' | 'org';

export interface ShellFloorRef {
  id: string;
  kind: FloorKind;
  name: string;
}

export interface ShellFloor extends ShellFloorRef {
  /** From the org down to this floor, itself included; your own floor is alone on its path. */
  path: ShellFloorRef[];
}

/** The icon for each kind of floor: a person, a group, a building. */
export const floorIcon: Record<FloorKind, string> = { personal: 'account', team: 'people', org: 'org' };

/** Where the water sits on each kind of floor: your own high and close, the org low. */
export const floorLevel: Record<FloorKind, number> = { personal: -0.06, team: 0, org: 0.1 };

/**
 * The floors a gauge shows, bottom first: yours, then the team you're on (or
 * were last on) and the teams above it, then the org.
 *
 * `lastTeam` is the team last stood on; the shell keeps it.
 */
export function floorStack(floors: ShellFloor[], current: string, lastTeam?: string): ShellFloor[] {
  const byId = new Map(floors.map((f) => [f.id, f]));
  const own = floors.find((f) => f.kind === 'personal');
  const org = floors.find((f) => f.kind === 'org');
  const here = byId.get(current);
  const teams = floors.filter((f) => f.kind === 'team');
  // The deepest team you're on stands in when you haven't been on one yet.
  const last = lastTeam ? byId.get(lastTeam) : undefined;
  // On a team above the last one you stood on, the gauge still reaches down to it, so down retraces your way.
  const team =
    (last && here && last.path.some((p) => p.id === here.id) ? last : undefined) ??
    (here?.kind === 'team' ? here : undefined) ??
    last ??
    [...teams].sort((a, b) => b.path.length - a.path.length)[0];
  const chain = team ? team.path.filter((p) => p.kind === 'team').map((p) => byId.get(p.id)).filter((f): f is ShellFloor => !!f).reverse() : [];
  return [own, ...chain, org].filter((f): f is ShellFloor => !!f);
}

/** The floor above or below the current one on the gauge, if there is one. */
export function floorBeside(floors: ShellFloor[], current: string, direction: 'up' | 'down', lastTeam?: string): ShellFloor | undefined {
  const stack = floorStack(floors, current, lastTeam);
  const i = stack.findIndex((f) => f.id === current);
  if (i < 0) return undefined;
  return stack[direction === 'up' ? i + 1 : i - 1];
}

/** What each kind of floor is called, as an area title card's kicker says it. */
export const floorKindName: Record<FloorKind, string> = { personal: 'Your own floor', team: 'Team', org: 'Organisation' };

export type FloorDirection = 'up' | 'down' | 'across';

/** Which way a move goes: up towards the org, down towards you, or across between teams on the same level. */
export function floorDirection(from: ShellFloor | undefined, to: ShellFloor): FloorDirection {
  if (!from) return 'across';
  const height = (f: ShellFloor) => (f.kind === 'personal' ? 0 : f.kind === 'org' ? 100 : 100 - f.path.length);
  const a = height(from);
  const b = height(to);
  return b > a ? 'up' : b < a ? 'down' : 'across';
}

/** What a floor is, in a line: who sees what’s kept on it. */
export function floorMeaning(f: ShellFloor): string {
  if (f.kind === 'personal') return 'Just you. No one else sees what’s here unless you share it.';
  if (f.kind === 'org') return `Everyone in ${f.name} sees what’s here.`;
  return `${f.name} and the teams under it see what’s here.`;
}
