import { withDeadline } from '@augur/service-kit';

/** Keycloak's admin calls get longer than a service call's few seconds: some write or list a lot. */
const KEYCLOAK_TIMEOUT_MS = 15_000;

/** How many items each page of a Keycloak list asks for. */
const PAGE_SIZE = 500;

/**
 * The directory of people and departments. Keycloak holds them (departments
 * are its groups, roles its realm roles); admins change them through identity,
 * never in Keycloak's own console and never from the browser.
 */

export interface Person {
  id: string;
  username: string;
  firstName: string;
  lastName: string;
  email?: string;
  /** False when an admin has turned their sign-in off. */
  enabled: boolean;
  /** Still has to choose their own password: they haven't signed in since they were added or reset. */
  invited: boolean;
  /** Role names, e.g. ["admin", "editor"]. */
  roles: string[];
  /** Department ids. */
  departments: string[];
  /** ISO time they were added, when the directory knows it. */
  createdAt?: string;
}

export interface NewPerson {
  username: string;
  firstName: string;
  lastName: string;
  email: string;
  roles: string[];
  departments: string[];
}

export type PersonChanges = Partial<Pick<Person, 'firstName' | 'lastName' | 'email' | 'enabled' | 'roles' | 'departments'>>;

/**
 * A department: a Keycloak group. Departments can sit inside another (subgroups),
 * so the tree that teams and workspaces may need later is already there.
 */
export interface Department {
  id: string;
  name: string;
  /** The department it sits inside; absent at the top. */
  parentId?: string;
  /** Person ids of its own members (not those of the departments inside it). */
  members: string[];
}

export interface Role {
  name: string;
  description?: string;
}

/**
 * Lets a team lead publish beyond their team: to the whole org, or to teams
 * outside their own. Folio checks it when someone publishes.
 */
export const PUBLISHER_ROLE: Role = { name: 'publisher', description: 'Publishes to the whole org and to any team' };

/**
 * Runs the deployment itself: its settings, secrets, updates and backups (Admin → Deployment). Only
 * someone who holds it may give it or take it away, or change a holder's sign-in, and a holder signs
 * in with a one-time code as well as a password.
 */
export const DEPLOYMENT_ADMIN_ROLE: Role = { name: 'deployment-admin', description: 'Runs the deployment: settings, secrets, updates and backups' };

/** The roles the platform itself relies on, made by the realm job when they're missing (Keycloak reads its realm file only when it first starts). */
export const PLATFORM_ROLES: readonly Role[] = [PUBLISHER_ROLE, DEPLOYMENT_ADMIN_ROLE];

/** The realm's sign-in flow: Keycloak's browser flow plus the admin roles' second step (realm.ts). */
export const SIGN_IN_FLOW = 'augur browser';

/** A refusal the admin can act on (404, 409), or the directory being out of reach (503). */
export class DirectoryError extends Error {
  readonly status: 400 | 404 | 409 | 503;

  constructor(message: string, status: 400 | 404 | 409 | 503) {
    super(message);
    this.status = status;
  }
}

export interface Directory {
  people(): Promise<Person[]>;
  person(id: string): Promise<Person>;
  /**
   * Adds someone. With `temporaryPassword` they sign in with it and choose their own; without one they have no
   * password until they follow an invite (`sendInvite`), which has them confirm their email and choose one.
   */
  createPerson(person: NewPerson, temporaryPassword?: string): Promise<Person>;
  /** Whether the sign-in service can send email: the realm has a relay (ADR 0035). */
  canEmail(): Promise<boolean>;
  /** Emails someone a link to confirm their email and choose a password, working for `lifespanSeconds`. */
  sendInvite(id: string, lifespanSeconds: number): Promise<void>;
  updatePerson(id: string, changes: PersonChanges): Promise<Person>;
  /** Gives someone a new one-time password; they choose their own at next sign-in. */
  resetPassword(id: string, temporaryPassword: string): Promise<void>;
  /**
   * Signs someone out everywhere at once (ADR 0040): every session, and every offline token an app
   * holds for them, so turning them off takes effect now rather than when a token runs out.
   */
  endSessions(id: string): Promise<void>;
  /** Whether wrong passwords have locked them out for now, and how many in a row (Keycloak's brute-force detection). */
  lockout(id: string): Promise<Lockout>;
  /** Lifts a lockout, so they can sign in again at once. */
  unlock(id: string): Promise<void>;
  departments(): Promise<Department[]>;
  createDepartment(name: string, parentId?: string): Promise<Department>;
  renameDepartment(id: string, name: string): Promise<Department>;
  addMember(department: string, person: string): Promise<void>;
  removeMember(department: string, person: string): Promise<void>;
  /** The roles an admin can give people. */
  roles(): Promise<Role[]>;
}

export interface Lockout {
  locked: boolean;
  failures: number;
  lastFailureAt?: string;
}

/** For tests, and for running identity locally without Keycloak. */
export class MemoryDirectory implements Directory {
  private nextId = 1;
  private readonly folks = new Map<string, Person>();
  private readonly depts = new Map<string, { id: string; name: string; parentId?: string }>();
  private readonly roleList: Role[];

  constructor(
    roles: Role[] = [
      { name: 'admin', description: 'Runs AUGUR; sees the Admin app' },
      { name: 'editor', description: 'Can publish to libraries' },
      PUBLISHER_ROLE,
      DEPLOYMENT_ADMIN_ROLE,
    ],
  ) {
    this.roleList = roles;
  }

  private id(prefix: string) {
    return `${prefix}-${this.nextId++}`;
  }

  private known(id: string) {
    const p = this.folks.get(id);
    if (!p) throw new DirectoryError('That person isn’t in the directory.', 404);
    return p;
  }

  private checkRoles(roles: string[]) {
    const unknown = roles.find((r) => !this.roleList.some((x) => x.name === r));
    if (unknown) throw new DirectoryError(`There is no role called “${unknown}”.`, 400);
  }

  private checkDepartments(ids: string[]) {
    const unknown = ids.find((d) => !this.depts.has(d));
    if (unknown) throw new DirectoryError('One of those departments no longer exists.', 400);
  }

  async people() {
    return [...this.folks.values()].map((p) => structuredClone(p));
  }

  async person(id: string) {
    return structuredClone(this.known(id));
  }

  /** Whether this directory can send email, and who it has sent invites to, for tests. */
  emailWorks = false;
  readonly invitesSent: { id: string; lifespanSeconds: number }[] = [];

  async canEmail() {
    return this.emailWorks;
  }

  async sendInvite(id: string, lifespanSeconds: number) {
    this.known(id);
    if (!this.emailWorks) throw new DirectoryError('The sign-in service has no email relay, so it can’t send an invite.', 503);
    this.invitesSent.push({ id, lifespanSeconds });
  }

  async createPerson(person: NewPerson, _temporaryPassword?: string) {
    if ([...this.folks.values()].some((p) => p.username === person.username)) {
      throw new DirectoryError(`Someone already has the username “${person.username}”.`, 409);
    }
    if ([...this.folks.values()].some((p) => p.email === person.email)) throw new DirectoryError(`Someone already has the email ${person.email}.`, 409);
    this.checkRoles(person.roles);
    this.checkDepartments(person.departments);
    const created: Person = { id: this.id('person'), ...person, enabled: true, invited: true, createdAt: new Date().toISOString() };
    this.folks.set(created.id, created);
    return structuredClone(created);
  }

  async updatePerson(id: string, changes: PersonChanges) {
    const p = this.known(id);
    if (changes.roles) this.checkRoles(changes.roles);
    if (changes.departments) this.checkDepartments(changes.departments);
    Object.assign(p, structuredClone(changes));
    return structuredClone(p);
  }

  /** Who has been signed out everywhere, in order, for tests. */
  readonly signedOut: string[] = [];

  async endSessions(id: string) {
    this.known(id);
    this.signedOut.push(id);
  }

  async resetPassword(id: string) {
    this.known(id).invited = true;
  }

  /** Who is locked out now, for tests. */
  readonly lockedOut = new Set<string>();

  async lockout(id: string) {
    this.known(id);
    return this.lockedOut.has(id) ? { locked: true, failures: 10 } : { locked: false, failures: 0 };
  }

  async unlock(id: string) {
    this.known(id);
    this.lockedOut.delete(id);
  }

  async departments() {
    return [...this.depts.values()].map((d) => ({ ...d, members: [...this.folks.values()].filter((p) => p.departments.includes(d.id)).map((p) => p.id) }));
  }

  private nameFree(name: string, parentId: string | undefined, except?: string) {
    if ([...this.depts.values()].some((d) => d.id !== except && d.parentId === parentId && d.name.toLowerCase() === name.toLowerCase())) {
      throw new DirectoryError(`There is already a department called “${name}”.`, 409);
    }
  }

  async createDepartment(name: string, parentId?: string) {
    if (parentId) this.checkDepartments([parentId]);
    this.nameFree(name, parentId);
    const d = { id: this.id('dept'), name, ...(parentId ? { parentId } : {}) };
    this.depts.set(d.id, d);
    return { ...d, members: [] };
  }

  async renameDepartment(id: string, name: string) {
    const d = this.depts.get(id);
    if (!d) throw new DirectoryError('That department no longer exists.', 404);
    this.nameFree(name, d.parentId, id);
    d.name = name;
    return (await this.departments()).find((x) => x.id === id)!;
  }

  async addMember(department: string, person: string) {
    this.checkDepartments([department]);
    const p = this.known(person);
    if (!p.departments.includes(department)) p.departments.push(department);
  }

  async removeMember(department: string, person: string) {
    this.checkDepartments([department]);
    const p = this.known(person);
    p.departments = p.departments.filter((d) => d !== department);
  }

  async roles() {
    return structuredClone(this.roleList);
  }
}

/** What an invited person does from the link: confirm their email and choose a password (ADR 0040). */
export const INVITE_ACTIONS = ['VERIFY_EMAIL', 'UPDATE_PASSWORD'];

export interface KeycloakConfig {
  /** Keycloak's internal address with its path, e.g. http://keycloak:8080/sso. */
  url: string;
  /** The realm people sign in to. */
  realm: string;
  /**
   * How identity signs in to Keycloak's admin API: as its own client (`platform-identity`), whose
   * service account has only the rights in `IDENTITY_RIGHTS` (realm.ts), or as an admin of Keycloak's
   * master realm, which only the realm job (realm-job.ts) and a local stack without secrets use.
   */
  signIn: { client: { id: string; secret: string } } | { admin: { user: string; password: string } };
  /** Where an invite's link leads once they've set up: the shell's client and address, so they land in AUGUR. */
  invite?: { clientId: string; redirectUri: string };
  fetchImpl?: typeof fetch;
}

/**
 * Held through the admin roles (a composite the realm job sets up), never given by hand: everyone
 * who has it signs in with a code app or a passkey as well as their password (ADR 0038).
 */
export const TWO_STEP_ROLE: Role = { name: 'two-step-sign-in', description: 'Signs in with a code app or a passkey as well as a password. Comes with the admin roles; not given by hand.' };

/** Roles every Keycloak realm has, and the one the admin roles carry; they aren't the platform's to hand out. */
const builtInRole = (name: string, realm: string) => name === `default-roles-${realm}` || name === 'offline_access' || name === 'uma_authorization' || name === TWO_STEP_ROLE.name;

interface KcUser {
  id: string;
  username: string;
  firstName?: string;
  lastName?: string;
  email?: string;
  enabled: boolean;
  createdTimestamp?: number;
  requiredActions?: string[];
}
interface KcGroup {
  id: string;
  name: string;
  parentId?: string;
  subGroupCount?: number;
}
interface KcRole {
  id: string;
  name: string;
  description?: string;
}

/** Keycloak's admin REST API, called by identity alone. */
export class KeycloakDirectory implements Directory {
  private token?: { value: string; expires: number };
  private readonly fetchImpl: typeof fetch;
  private readonly config: KeycloakConfig;

  constructor(config: KeycloakConfig) {
    this.config = config;
    // Keycloak's admin API, with a deadline: a hung sign-in service answers 503 here, not never (PER-213).
    this.fetchImpl = withDeadline(config.fetchImpl ?? fetch, KEYCLOAK_TIMEOUT_MS);
  }

  private get base() {
    return `${this.config.url.replace(/\/$/, '')}/admin/realms/${encodeURIComponent(this.config.realm)}`;
  }

  private async accessToken(): Promise<string> {
    if (this.token && this.token.expires > Date.now() + 10_000) return this.token.value;
    const root = this.config.url.replace(/\/$/, '');
    const { signIn } = this.config;
    let res: Response;
    try {
      res =
        'client' in signIn
          ? await this.fetchImpl(`${root}/realms/${encodeURIComponent(this.config.realm)}/protocol/openid-connect/token`, {
              method: 'POST',
              headers: { 'content-type': 'application/x-www-form-urlencoded' },
              body: new URLSearchParams({ grant_type: 'client_credentials', client_id: signIn.client.id, client_secret: signIn.client.secret }),
            })
          : await this.fetchImpl(`${root}/realms/master/protocol/openid-connect/token`, {
              method: 'POST',
              headers: { 'content-type': 'application/x-www-form-urlencoded' },
              body: new URLSearchParams({ grant_type: 'password', client_id: 'admin-cli', username: signIn.admin.user, password: signIn.admin.password }),
            });
    } catch {
      throw new DirectoryError('The sign-in service can’t be reached right now. Nothing was changed.', 503);
    }
    if (!res.ok) throw new DirectoryError('Identity couldn’t sign in to the sign-in service to manage people. Check its admin settings.', 503);
    const body = (await res.json()) as { access_token: string; expires_in: number };
    this.token = { value: body.access_token, expires: Date.now() + body.expires_in * 1000 };
    return this.token.value;
  }

  /**
   * Whether this sign-in holds each of `rights` (realm-management roles), read from its own token.
   * False when Keycloak refuses the sign-in (no such client yet, or a wrong secret); throws only
   * when Keycloak can't be reached, so the caller can try again.
   */
  async hasRights(rights: readonly string[]): Promise<boolean> {
    this.token = undefined;
    let token: string;
    try {
      token = await this.accessToken();
    } catch (err) {
      if (err instanceof DirectoryError && err.message.startsWith('The sign-in service can’t be reached')) throw err;
      return false;
    }
    const part = token.split('.')[1];
    if (!part) return false;
    const claims = JSON.parse(Buffer.from(part, 'base64url').toString('utf8')) as { resource_access?: Record<string, { roles?: string[] }> };
    const held = new Set(claims.resource_access?.['realm-management']?.roles ?? []);
    return rights.every((r) => held.has(r));
  }

  /**
   * Gives `role` to `username` when nobody holds it yet, so a server set up before the role existed
   * has someone who can use it. Returns whether it gave it.
   */
  async ensureRoleHolder(role: string, username: string): Promise<boolean> {
    const holders = (await this.call<unknown[]>('GET', `/roles/${encodeURIComponent(role)}/users?first=0&max=1`)).data;
    if (holders.length) return false;
    const user = (await this.call<KcUser[]>('GET', `/users?username=${encodeURIComponent(username)}&exact=true`)).data[0];
    if (!user) throw new DirectoryError(`There is no ${username} to give the ${role} role to.`, 404);
    const { data: rep } = await this.call<KcRole>('GET', `/roles/${encodeURIComponent(role)}`);
    await this.call('POST', `/users/${user.id}/role-mappings/realm`, [rep]);
    return true;
  }

  /** One admin API call. `notFound` names what a 404 means. Also used for apps' clients (clients.ts). */
  async call<T = unknown>(method: string, path: string, body?: unknown, notFound = 'That isn’t in the directory any more.'): Promise<{ data: T; location?: string }> {
    return this.request<T>(method, `${this.base}${path}`, body, notFound);
  }

  /** Reads Keycloak's server-wide admin API (`/admin/<path>`), such as `/serverinfo`: what this Keycloak has. */
  async server<T = unknown>(path: string): Promise<T> {
    return (await this.request<T>('GET', `${this.config.url.replace(/\/$/, '')}/admin${path}`)).data;
  }

  private async request<T>(method: string, url: string, body?: unknown, notFound = 'That isn’t in the directory any more.'): Promise<{ data: T; location?: string }> {
    const token = await this.accessToken();
    let res: Response;
    try {
      res = await this.fetchImpl(url, {
        method,
        headers: { authorization: `Bearer ${token}`, accept: 'application/json', ...(body === undefined ? {} : { 'content-type': 'application/json' }) },
        body: body === undefined ? undefined : JSON.stringify(body),
      });
    } catch {
      throw new DirectoryError('The sign-in service can’t be reached right now. Nothing was changed.', 503);
    }
    if (res.status === 401) this.token = undefined;
    const text = await res.text();
    const data = text ? (JSON.parse(text) as T) : (undefined as T);
    if (res.ok) return { data, location: res.headers.get('location') ?? undefined };
    if (res.status === 404) throw new DirectoryError(notFound, 404);
    const message = (data as { errorMessage?: string; error?: string } | undefined)?.errorMessage ?? (data as { error?: string } | undefined)?.error;
    if (res.status === 409) throw new DirectoryError(message ?? 'That clashes with something already in the directory.', 409);
    if (res.status === 400) throw new DirectoryError(message ?? 'The sign-in service refused that.', 400);
    throw new DirectoryError(`The sign-in service answered ${res.status}. Nothing was changed.`, 503);
  }

  /**
   * Every item of one of Keycloak's lists, a page at a time: its lists stop at `max`, so a realm with more
   * people, groups or holders than one page used to lose the rest without a word (PER-213).
   */
  async all<T>(path: string, size = PAGE_SIZE): Promise<T[]> {
    const items: T[] = [];
    for (let first = 0; ; first += size) {
      const { data } = await this.call<T[]>('GET', `${path}${path.includes('?') ? '&' : '?'}first=${first}&max=${size}`);
      items.push(...(data ?? []));
      if (!data || data.length < size) return items;
    }
  }

  private async realmRoles(): Promise<KcRole[]> {
    const { data } = await this.call<KcRole[]>('GET', '/roles?briefRepresentation=false');
    return data.filter((r) => !builtInRole(r.name, this.config.realm));
  }

  /** Every group, top-level and nested, each with the id of the group it sits in. */
  private async groups(): Promise<KcGroup[]> {
    const top = await this.all<KcGroup>('/groups?briefRepresentation=true');
    const all: KcGroup[] = [];
    const walk = async (groups: KcGroup[], parentId?: string) => {
      for (const g of groups) {
        all.push({ id: g.id, name: g.name, ...(parentId ? { parentId } : {}) });
        if (g.subGroupCount) await walk(await this.all<KcGroup>(`/groups/${g.id}/children?briefRepresentation=true`), g.id);
      }
    };
    await walk(top);
    return all;
  }

  private async memberIds(group: string): Promise<string[]> {
    return (await this.all<KcUser>(`/groups/${group}/members?briefRepresentation=true`)).map((u) => u.id);
  }

  /** Makes any of these realm roles that don't exist yet; returns the ones it made. */
  async ensureRoles(roles: readonly Role[]): Promise<string[]> {
    const have = new Set((await this.call<KcRole[]>('GET', '/roles?briefRepresentation=true')).data.map((r) => r.name));
    const made: string[] = [];
    for (const role of roles.filter((r) => !have.has(r.name))) {
      await this.call('POST', '/roles', { name: role.name, ...(role.description ? { description: role.description } : {}) });
      made.push(role.name);
    }
    return made;
  }

  async roles(): Promise<Role[]> {
    return (await this.realmRoles()).map((r) => ({ name: r.name, ...(r.description ? { description: r.description } : {}) })).sort((a, b) => a.name.localeCompare(b.name));
  }

  async departments(): Promise<Department[]> {
    const groups = await this.groups();
    return Promise.all(groups.map(async (g) => ({ ...g, members: await this.memberIds(g.id) })));
  }

  private toPerson(u: KcUser, roles: string[], departments: string[]): Person {
    return {
      id: u.id,
      username: u.username,
      firstName: u.firstName ?? '',
      lastName: u.lastName ?? '',
      ...(u.email ? { email: u.email } : {}),
      enabled: u.enabled,
      invited: (u.requiredActions ?? []).includes('UPDATE_PASSWORD'),
      roles,
      departments,
      ...(u.createdTimestamp ? { createdAt: new Date(u.createdTimestamp).toISOString() } : {}),
    };
  }

  /** Everyone, with roles and departments read per role and per department rather than per person. */
  async people(): Promise<Person[]> {
    const [users, roles, departments] = await Promise.all([
      this.all<KcUser>('/users?briefRepresentation=false'),
      this.realmRoles(),
      this.departments(),
    ]);
    const holders = await Promise.all(
      roles.map(async (r) => ({ role: r.name, ids: new Set((await this.all<KcUser>(`/roles/${encodeURIComponent(r.name)}/users`)).map((u) => u.id)) })),
    );
    return users.map((u) =>
      this.toPerson(
        u,
        holders.filter((h) => h.ids.has(u.id)).map((h) => h.role),
        departments.filter((d) => d.members.includes(u.id)).map((d) => d.id),
      ),
    );
  }

  async person(id: string): Promise<Person> {
    const notFound = 'That person isn’t in the directory.';
    const [{ data: user }, { data: roles }, { data: groups }] = await Promise.all([
      this.call<KcUser>('GET', `/users/${encodeURIComponent(id)}`, undefined, notFound),
      this.call<KcRole[]>('GET', `/users/${encodeURIComponent(id)}/role-mappings/realm`, undefined, notFound),
      this.call<KcGroup[]>('GET', `/users/${encodeURIComponent(id)}/groups`, undefined, notFound),
    ]);
    return this.toPerson(
      user,
      roles.filter((r) => !builtInRole(r.name, this.config.realm)).map((r) => r.name),
      groups.map((g) => g.id),
    );
  }

  private async setRoles(id: string, want: string[], have: string[]) {
    const all = await this.realmRoles();
    const unknown = want.find((r) => !all.some((x) => x.name === r));
    if (unknown) throw new DirectoryError(`There is no role called “${unknown}”.`, 400);
    const add = all.filter((r) => want.includes(r.name) && !have.includes(r.name));
    const remove = all.filter((r) => have.includes(r.name) && !want.includes(r.name));
    const reps = (rs: KcRole[]) => rs.map(({ id, name }) => ({ id, name }));
    if (add.length) await this.call('POST', `/users/${id}/role-mappings/realm`, reps(add));
    if (remove.length) await this.call('DELETE', `/users/${id}/role-mappings/realm`, reps(remove));
  }

  private async setDepartments(id: string, want: string[], have: string[]) {
    const known = new Set((await this.groups()).map((g) => g.id));
    if (want.some((d) => !known.has(d))) throw new DirectoryError('One of those departments no longer exists.', 400);
    for (const d of want.filter((d) => !have.includes(d))) await this.addMember(d, id);
    for (const d of have.filter((d) => !want.includes(d))) await this.removeMember(d, id);
  }

  async createPerson(person: NewPerson, temporaryPassword?: string): Promise<Person> {
    const { location } = await this.call('POST', '/users', {
      username: person.username,
      firstName: person.firstName,
      lastName: person.lastName,
      email: person.email,
      enabled: true,
      // A one-time password read out by an admin vouches for the address; an invite has them confirm it.
      ...(temporaryPassword
        ? { emailVerified: true, credentials: [{ type: 'password', value: temporaryPassword, temporary: true }], requiredActions: ['UPDATE_PASSWORD'] }
        : { emailVerified: false, requiredActions: INVITE_ACTIONS }),
    }).catch((err: unknown) => {
      if (!(err instanceof DirectoryError) || err.status !== 409) throw err;
      throw new DirectoryError(
        /email/i.test(err.message) ? `Someone already has the email ${person.email}.` : `Someone already has the username “${person.username}”.`,
        409,
      );
    });
    const id = location?.split('/').pop();
    if (!id) throw new DirectoryError('The sign-in service added them but didn’t say who they are. Refresh to see them.', 503);
    await this.setRoles(id, person.roles, []);
    await this.setDepartments(id, person.departments, []);
    return this.person(id);
  }

  async updatePerson(id: string, changes: PersonChanges): Promise<Person> {
    const current = await this.person(id);
    const fields = (['firstName', 'lastName', 'email', 'enabled'] as const).filter((k) => changes[k] !== undefined);
    if (fields.length) {
      const { data: user } = await this.call<KcUser>('GET', `/users/${id}`);
      await this.call('PUT', `/users/${id}`, { ...user, ...Object.fromEntries(fields.map((k) => [k, changes[k]])) });
    }
    if (changes.roles) await this.setRoles(id, changes.roles, current.roles);
    if (changes.departments) await this.setDepartments(id, changes.departments, current.departments);
    return this.person(id);
  }

  async canEmail() {
    const { data: realm } = await this.call<{ smtpServer?: { host?: string } }>('GET', '');
    return Boolean(realm.smtpServer?.host);
  }

  async sendInvite(id: string, lifespanSeconds: number) {
    const q = new URLSearchParams({ lifespan: String(lifespanSeconds), ...(this.config.invite ? { client_id: this.config.invite.clientId, redirect_uri: this.config.invite.redirectUri } : {}) });
    await this.call('PUT', `/users/${encodeURIComponent(id)}/execute-actions-email?${q}`, INVITE_ACTIONS, 'That person isn’t in the directory.').catch((err: unknown) => {
      // Keycloak answers 500 when its relay refuses the mail: say what that means here.
      if (err instanceof DirectoryError && err.status === 503) throw new DirectoryError('The sign-in service couldn’t send the invite email. Check Admin → Status, Email.', 503);
      throw err;
    });
  }

  async endSessions(id: string) {
    const user = `/users/${encodeURIComponent(id)}`;
    // Every browser session, and with it the refresh tokens they hold.
    await this.call('POST', `${user}/logout`, undefined, 'That person isn’t in the directory.');
    // Offline tokens outlive sessions: revoking each app's consent ends them too.
    const { data: consents } = await this.call<{ clientId: string }[]>('GET', `${user}/consents`);
    for (const { clientId } of consents ?? []) await this.call('DELETE', `${user}/consents/${encodeURIComponent(clientId)}`);
  }

  async lockout(id: string): Promise<Lockout> {
    const { data } = await this.call<{ disabled?: boolean; numFailures?: number; lastFailure?: number }>(
      'GET',
      `/attack-detection/brute-force/users/${encodeURIComponent(id)}`,
      undefined,
      'That person isn’t in the directory.',
    );
    return { locked: Boolean(data.disabled), failures: data.numFailures ?? 0, ...(data.lastFailure ? { lastFailureAt: new Date(data.lastFailure).toISOString() } : {}) };
  }

  async unlock(id: string) {
    await this.call('DELETE', `/attack-detection/brute-force/users/${encodeURIComponent(id)}`, undefined, 'That person isn’t in the directory.');
  }

  async resetPassword(id: string, temporaryPassword: string) {
    await this.call('PUT', `/users/${encodeURIComponent(id)}/reset-password`, { type: 'password', value: temporaryPassword, temporary: true }, 'That person isn’t in the directory.');
    const { data: user } = await this.call<KcUser>('GET', `/users/${id}`);
    const requiredActions = [...new Set([...(user.requiredActions ?? []), 'UPDATE_PASSWORD'])];
    await this.call('PUT', `/users/${id}`, { ...user, requiredActions });
  }

  private async sameNameTaken(groups: KcGroup[], name: string, parentId: string | undefined, except?: string) {
    const clash = groups.find((g) => g.id !== except && g.parentId === parentId && g.name.toLowerCase() === name.toLowerCase());
    if (clash) throw new DirectoryError(`There is already a department called “${clash.name}”.`, 409);
  }

  async createDepartment(name: string, parentId?: string): Promise<Department> {
    const groups = await this.groups();
    if (parentId && !groups.some((g) => g.id === parentId)) throw new DirectoryError('The department to put it in no longer exists.', 400);
    await this.sameNameTaken(groups, name, parentId);
    const { location, data } = await this.call<KcGroup | undefined>('POST', parentId ? `/groups/${parentId}/children` : '/groups', { name });
    const id = location?.split('/').pop() ?? data?.id;
    if (!id) throw new DirectoryError('The sign-in service added it but didn’t say which it is. Refresh to see it.', 503);
    return { id, name, ...(parentId ? { parentId } : {}), members: [] };
  }

  async renameDepartment(id: string, name: string): Promise<Department> {
    const notFound = 'That department no longer exists.';
    const { data: group } = await this.call<KcGroup>('GET', `/groups/${encodeURIComponent(id)}`, undefined, notFound);
    const groups = await this.groups();
    const parentId = groups.find((g) => g.id === id)?.parentId;
    await this.sameNameTaken(groups, name, parentId, id);
    await this.call('PUT', `/groups/${id}`, { ...group, name }, notFound);
    return { id, name, ...(parentId ? { parentId } : {}), members: await this.memberIds(id) };
  }

  async addMember(department: string, person: string) {
    await this.call('PUT', `/users/${encodeURIComponent(person)}/groups/${encodeURIComponent(department)}`, undefined, 'That person or department no longer exists.');
  }

  async removeMember(department: string, person: string) {
    await this.call('DELETE', `/users/${encodeURIComponent(person)}/groups/${encodeURIComponent(department)}`, undefined, 'That person or department no longer exists.');
  }
}
