import type { MemberRole, Membership, Workspace } from './workspaces.ts';

/**
 * Someone's map of the org, for Auspex: every floor they can stand on with
 * who is there and why they can come in, and every other team as a closed
 * door that says only its name, where it sits and who can let them in.
 * Nothing is hidden for being out of reach, but nothing inside a closed team
 * (its people, how many, what it uses) is ever shown.
 */

export interface MapPerson {
  id: string;
  name: string;
}

/** Why someone can stand on a floor, in the order it's checked. */
export type FloorReason =
  | { kind: 'own' }
  | { kind: 'org' }
  | { kind: 'member'; role: MemberRole }
  /** On it because they're on a team inside it: `via` is that team. */
  | { kind: 'inside'; via: MapPerson }
  /** A lead sees into the teams inside the one they lead, without standing on them. */
  | { kind: 'leads-above'; team: MapPerson }
  /** Admins see into every team, but stand only where they're members. */
  | { kind: 'admin' };

export interface MapFloor {
  id: string;
  kind: Workspace['kind'];
  name: string;
  slug: string;
  /** The team or org above; absent for the org and your own floor. */
  parentId?: string;
  /** 0 for the org and your own floor, 1 for a team right below the org, and so on. */
  depth: number;
  /** False only for a team an admin, or a lead above it, can see into without standing on it. */
  open: boolean;
  why: FloorReason;
  /** Everyone who can stand on it: its members and those of the teams inside it. */
  people: number;
  leads: MapPerson[];
  /** Who is on it directly, leads first. Absent for the org, where it's everyone. */
  members?: (MapPerson & { role: MemberRole })[];
}

/** A team the person can't go into: its name and place, and who can add them. */
export interface ClosedTeam {
  id: string;
  name: string;
  parentId?: string;
  depth: number;
  leads: MapPerson[];
}

export interface PersonMap {
  floors: MapFloor[];
  closed: ClosedTeam[];
  /** What the person stands for, as apps match it: person:, team:, tree:, org. */
  principals: string[];
}

export interface MapInput {
  person: { id: string; name: string; roles: string[] };
  own: Workspace;
  org: Workspace;
  /** Live teams, parents before children. */
  teams: Workspace[];
  memberships: Membership[];
  /** Everyone signed in can be, by id. */
  people: string[];
  names: Map<string, string>;
  principals: string[];
}

/** Depth first, each team's teams under it, siblings by name: the order a reader walks the tree in. */
const treeOrder = (teams: Workspace[]) => {
  const kids = new Map<string | undefined, Workspace[]>();
  const ids = new Set(teams.map((t) => t.id));
  for (const t of teams) {
    const parent = t.parentId && ids.has(t.parentId) ? t.parentId : undefined;
    kids.set(parent, [...(kids.get(parent) ?? []), t]);
  }
  const out: Workspace[] = [];
  const walk = (parent: string | undefined) => {
    for (const t of (kids.get(parent) ?? []).sort((a, b) => a.name.localeCompare(b.name))) {
      out.push(t);
      walk(t.id);
    }
  };
  walk(undefined);
  return out;
};

export const mapFor = ({ person, own, org, teams: live, memberships, people, names, principals }: MapInput): PersonMap => {
  const teams = treeOrder(live);
  const who = (id: string): MapPerson => ({ id, name: names.get(id) ?? id });
  const byId = new Map(teams.map((t) => [t.id, t]));
  const mine = new Map(memberships.filter((m) => m.person === person.id).map((m) => [m.workspace, m.role]));
  const admin = person.roles.includes('admin');

  // Where they can stand: the teams they're on and every team above those.
  const standing = new Map<string, Workspace>();
  for (const id of mine.keys()) for (const p of byId.get(id)?.path ?? []) if (byId.has(p)) standing.set(p, byId.get(p)!);
  // Leads see into the teams inside the ones they lead.
  const led = [...mine].filter(([, r]) => r === 'lead').map(([id]) => id);
  const seeInto = (t: Workspace) => admin || led.some((l) => t.id !== l && t.path.includes(l));

  const direct = (team: string) => memberships.filter((m) => m.workspace === team);
  const leadsOf = (team: string) => direct(team).filter((m) => m.role === 'lead').map((m) => who(m.person)).sort((a, b) => a.name.localeCompare(b.name));
  const reach = (team: Workspace) => new Set(memberships.filter((m) => byId.get(m.workspace)?.path.includes(team.id)).map((m) => m.person)).size;
  const depthOf = (t: Workspace) => t.path.length - 1;
  // The team on their own path just below `t`, the one that lets them stand on it.
  const via = (t: Workspace) => {
    const child = [...mine.keys()].map((id) => byId.get(id)).find((m) => m && m.path.includes(t.id));
    const step = child ? child.path[child.path.indexOf(t.id) + 1] : undefined;
    return step && byId.get(step) ? who(step) : undefined;
  };
  const named = (p: MapPerson) => ({ ...p, name: byId.get(p.id)?.name ?? p.name });

  const teamFloor = (t: Workspace, open: boolean): MapFloor => {
    const role = mine.get(t.id);
    const through = via(t);
    const above = led.find((l) => t.id !== l && t.path.includes(l));
    const why: FloorReason = role
      ? { kind: 'member', role }
      : open && through
        ? { kind: 'inside', via: named(through) }
        : above
          ? { kind: 'leads-above', team: named(who(above)) }
          : { kind: 'admin' };
    return {
      id: t.id, kind: t.kind, name: t.name, slug: t.slug, parentId: t.parentId, depth: depthOf(t), open, why,
      people: reach(t), leads: leadsOf(t.id),
      members: direct(t.id)
        .map((m) => ({ ...who(m.person), role: m.role }))
        .sort((a, b) => (a.role === b.role ? a.name.localeCompare(b.name) : a.role === 'lead' ? -1 : 1)),
    };
  };

  const floors: MapFloor[] = [
    { id: org.id, kind: 'org', name: org.name, slug: org.slug, depth: 0, open: true, why: { kind: 'org' }, people: people.length, leads: leadsOf(org.id) },
    ...teams.filter((t) => standing.has(t.id) || seeInto(t)).map((t) => teamFloor(t, standing.has(t.id))),
    { id: own.id, kind: 'personal', name: 'You', slug: own.slug, depth: 0, open: true, why: { kind: 'own' }, people: 1, leads: [who(person.id)] },
  ];
  const shown = new Set(floors.map((f) => f.id));
  const closed: ClosedTeam[] = teams
    .filter((t) => !shown.has(t.id))
    .map((t) => ({ id: t.id, name: t.name, parentId: t.parentId, depth: depthOf(t), leads: leadsOf(t.id) }));
  return { floors, closed, principals };
};
