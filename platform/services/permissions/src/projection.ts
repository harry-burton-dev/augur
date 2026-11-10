import { serviceHeaders, withDeadline, type ServiceCredentials } from '@augur/service-kit';
import type { CheckKey, OpenFga } from './openfga.ts';

/**
 * The permissions service's copy of identity (ADR 0085, ADR 0089). Identity is where floors, positions and
 * who holds them are true; OpenFGA needs them as relationships to answer checks. The copy is rebuilt from
 * identity's whole answer (`GET /v1/relationships`) and only what changed is written, so a change it missed,
 * or one written by hand, is put right on the next run.
 */

/** Identity's answer, `GET /v1/relationships`. */
export interface IdentityRelationships {
  org: string;
  teams: { id: string; parent: string }[];
  personal: { id: string; owner: string }[];
  positions: { id: string; team: string; role: 'member' | 'lead'; holder?: string }[];
  /** Everyone whose sign-in is on; absent where identity can't say, and then the org's members are left alone. */
  people?: string[];
  /** Who holds the Keycloak roles today's checks read, among those whose sign-in is on. Comes with `people`. */
  roles?: { admin: string[]; 'deployment-admin': string[]; publisher: string[] };
}

/** This deployment, as the model names it: one store answers for one deployment. */
export const DEPLOYMENT = 'deployment:this';

/**
 * The admin persona each holder of Keycloak's admin or deployment-admin role has, until admins are given
 * personas in Admin (ADR 0086, PR 5). Only personas can be admins in the model, so today's admins are copied as
 * one persona each, which they alone hold.
 */
export const ADMIN_PERSONA = 'admin.';
export const adminPersonaOf = (person: string) => `persona:${ADMIN_PERSONA}${person}`;

/** The relationships identity's answer means. */
export const relationshipsFrom = (r: IdentityRelationships): CheckKey[] => {
  const org = `org:${r.org}`;
  const out: CheckKey[] = [];
  for (const t of r.teams) {
    const above = t.parent === r.org ? org : `floor:${t.parent}`;
    out.push({ user: above, relation: 'parent', object: `floor:${t.id}` });
    out.push({ user: `floor:${t.id}`, relation: 'child', object: above });
  }
  for (const p of r.personal) out.push({ user: `person:${p.owner}`, relation: 'owner', object: `floor:${p.id}` });
  for (const p of r.positions) {
    // A position is on its floor whether or not anyone holds it, so its next holder is there at once.
    out.push({ user: `persona:${p.id}#holder`, relation: p.role, object: `floor:${p.team}` });
    if (p.holder) out.push({ user: `person:${p.holder}`, relation: 'holder', object: `persona:${p.id}` });
  }
  for (const person of r.people ?? []) out.push({ user: `person:${person}`, relation: 'member', object: org });
  out.push({ user: org, relation: 'org', object: DEPLOYMENT });
  const roles = r.roles;
  if (roles) {
    const admins = new Set([...roles.admin, ...roles['deployment-admin']]);
    for (const person of admins) out.push({ user: `person:${person}`, relation: 'holder', object: adminPersonaOf(person) });
    for (const person of roles.admin) out.push({ user: adminPersonaOf(person), relation: 'admin', object: org });
    for (const person of roles['deployment-admin']) out.push({ user: adminPersonaOf(person), relation: 'admin', object: DEPLOYMENT });
    for (const person of roles.publisher) out.push({ user: `person:${person}`, relation: 'publisher', object: org });
  }
  return out;
};

/**
 * Whether a relationship is one this copy keeps, so a run may take it away. Everything else in the store
 * (roles, what apps give, a floor's settler) is written by someone else and never touched here.
 */
export const isCopied = (key: CheckKey, withPeople: boolean): boolean => {
  const [type] = key.object.split(':');
  const fromRoles = key.user.startsWith(`persona:${ADMIN_PERSONA}`);
  if (type === 'persona') return key.relation === 'holder' && (withPeople || !key.object.startsWith(`persona:${ADMIN_PERSONA}`));
  if (type === 'floor') {
    if (['parent', 'child', 'owner'].includes(key.relation)) return true;
    return (key.relation === 'lead' || key.relation === 'member') && /^persona:[^#]+#holder$/.test(key.user);
  }
  if (type === 'org') {
    if (key.relation === 'child') return true;
    if (!withPeople) return false;
    // Until the roles API (PR 5) gives publishers and admins, every one is a copy of a Keycloak role.
    return (key.user.startsWith('person:') && (key.relation === 'member' || key.relation === 'publisher')) || (key.relation === 'admin' && fromRoles);
  }
  if (key.object === DEPLOYMENT) return key.relation === 'org' || (withPeople && key.relation === 'admin' && fromRoles);
  return false;
};

const keyOf = (k: CheckKey) => `${k.object}#${k.relation}@${k.user}`;

export interface ProjectionRun {
  at: string;
  added: number;
  removed: number;
  /** Removals held back: more than a run may take at once, which is more likely a fault than a real change. */
  heldBack?: number;
  error?: string;
}

export interface ProjectOptions {
  engine: Pick<OpenFga, 'readAll' | 'write'>;
  store: string;
  modelId: string;
  relationships: () => Promise<IdentityRelationships>;
  /**
   * A run takes away at most this share of what the copy holds (once it holds more than `guardFrom`). More
   * than that is held back and reported, so a fault in identity's answer can't empty the store.
   */
  maxRemovalShare?: number;
  guardFrom?: number;
  now?: () => Date;
}

/** One run: what identity says, against what the store holds; writes the difference. */
export const project = async ({ engine, store, modelId, relationships, maxRemovalShare = 0.5, guardFrom = 20, now = () => new Date() }: ProjectOptions): Promise<ProjectionRun> => {
  const answer = await relationships();
  const wanted = new Map(relationshipsFrom(answer).map((k) => [keyOf(k), k]));
  const held = (await engine.readAll(store)).filter((k) => isCopied(k, answer.people !== undefined));
  const holding = new Map(held.map((k) => [keyOf(k), k]));
  const adds = [...wanted].filter(([id]) => !holding.has(id)).map(([, k]) => k);
  let removes = [...holding].filter(([id]) => !wanted.has(id)).map(([, k]) => k);
  let heldBack: number | undefined;
  if (holding.size > guardFrom && removes.length > holding.size * maxRemovalShare) {
    heldBack = removes.length;
    removes = [];
  }
  await engine.write(store, modelId, adds, removes);
  return { at: now().toISOString(), added: adds.length, removed: removes.length, ...(heldBack ? { heldBack } : {}) };
};

/** Asks identity for its relationships, as this service. */
export const identityRelationships =
  ({ identityUrl, credentials, fetchImpl = fetch }: { identityUrl: string; credentials: ServiceCredentials; fetchImpl?: typeof fetch }) =>
  async (): Promise<IdentityRelationships> => {
    const res = await withDeadline(fetchImpl)(`${identityUrl.replace(/\/$/, '')}/v1/relationships`, { headers: await serviceHeaders(credentials) });
    if (!res.ok) throw new Error(`Identity answered ${res.status} when asked for its relationships.`);
    return (await res.json()) as IdentityRelationships;
  };

/**
 * Runs `once` now, again soon after each `request()` (an identity change heard as an event; several close
 * together make one run), and every `everyMs` in any case, to put right anything an event missed. One run
 * at a time; a request during a run makes one more after it. The last result is kept for Status, and a run
 * that fails is kept as the error it gave.
 */
export const keepProjecting = (once: () => Promise<ProjectionRun>, everyMs: number, onRun: (run: ProjectionRun) => void = () => {}, settleMs = 500) => {
  let last: ProjectionRun | undefined;
  let running = false;
  let again = false;
  let stopped = false;
  let timer: ReturnType<typeof setTimeout> | undefined;
  let settle: ReturnType<typeof setTimeout> | undefined;
  const run = async (): Promise<void> => {
    if (running) {
      again = true;
      return;
    }
    running = true;
    clearTimeout(timer);
    try {
      last = await once();
    } catch (err) {
      last = { at: new Date().toISOString(), added: 0, removed: 0, error: (err as Error).message };
    }
    onRun(last);
    running = false;
    if (stopped) return;
    if (again) {
      again = false;
      return run();
    }
    timer = setTimeout(() => void run(), everyMs);
  };
  void run();
  return {
    last: () => last,
    /** Copy again soon: something changed in identity. */
    request: () => {
      if (stopped) return;
      clearTimeout(settle);
      settle = setTimeout(() => void run(), settleMs);
    },
    stop: () => {
      stopped = true;
      clearTimeout(timer);
      clearTimeout(settle);
    },
  };
};

/** The events that mean identity's floors, positions or people changed (docs/domain-events.md). */
export const COPY_TOPICS = ['platform.position.*', 'platform.team.*', 'platform.person.*'];
