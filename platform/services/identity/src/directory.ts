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

/** The roles the platform itself relies on, made in Keycloak at start when they're missing (its realm file is read only when it first starts). */
export const PLATFORM_ROLES: readonly Role[] = [PUBLISHER_ROLE, DEPLOYMENT_ADMIN_ROLE];

/** The realm's sign-in flow once a role must use one-time codes: Keycloak's browser flow plus that rule. */
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
  /** Adds someone who must choose their own password when they first sign in with `temporaryPassword`. */
  createPerson(person: NewPerson, temporaryPassword: string): Promise<Person>;
  updatePerson(id: string, changes: PersonChanges): Promise<Person>;
  /** Gives someone a new one-time password; they choose their own at next sign-in. */
  resetPassword(id: string, temporaryPassword: string): Promise<void>;
  departments(): Promise<Department[]>;
  createDepartment(name: string, parentId?: string): Promise<Department>;
  renameDepartment(id: string, name: string): Promise<Department>;
  addMember(department: string, person: string): Promise<void>;
  removeMember(department: string, person: string): Promise<void>;
  /** The roles an admin can give people. */
  roles(): Promise<Role[]>;
}

/** For tests, and for running identity locally without Keycloak. */
export class MemoryDirectory implements Directory {
  private nextId = 1;
  private readonly folks = new Map<string, Person>();
  private readonly depts = new Map<string, { id: string; name: string; parentId?: string }>();
  private readonly roleList: Role[];

  constructor(
    roles: Role[] = [
      { name: 'admin', description: 'Runs the platform; sees the Admin app' },
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

  async createPerson(person: NewPerson) {
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

  async resetPassword(id: string) {
    this.known(id).invited = true;
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

export interface KeycloakConfig {
  /** Keycloak's internal address with its path, e.g. http://keycloak:8080/sso. */
  url: string;
  /** The realm people sign in to. */
  realm: string;
  /**
   * How identity signs in to Keycloak's admin API: as its own client (`platform-identity`), whose
   * service account manages this realm alone, or as an admin of Keycloak's master realm, which
   * identity uses only at start, to give its own client those rights (`grantRealmAdmin`).
   */
  signIn: { client: { id: string; secret: string } } | { admin: { user: string; password: string } };
  fetchImpl?: typeof fetch;
}

/**
 * What identity's own client may do in the realm (Keycloak's realm-management roles): people,
 * departments, roles and the realm's sign-in policy, and the sign-ins of services and apps. Nothing
 * in any other realm, Keycloak's master realm included.
 */
export const REALM_ADMIN_ROLES = ['view-realm', 'manage-realm', 'view-users', 'query-users', 'manage-users', 'query-groups', 'view-clients', 'query-clients', 'manage-clients'] as const;

/** How the realm treats wrong passwords: a growing wait after 10 in a row, up to 15 minutes, never a permanent lock. */
export const BRUTE_FORCE_POLICY = {
  bruteForceProtected: true,
  permanentLockout: false,
  failureFactor: 10,
  waitIncrementSeconds: 60,
  maxFailureWaitSeconds: 900,
  maxDeltaTimeSeconds: 43200,
  quickLoginCheckMilliSeconds: 1000,
  minimumQuickLoginWaitSeconds: 60,
} as const;

/** Roles every Keycloak realm has; they aren't the platform's to hand out. */
const builtInRole = (name: string, realm: string) => name === `default-roles-${realm}` || name === 'offline_access' || name === 'uma_authorization';

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
interface KcClient {
  id: string;
  clientId: string;
}
interface KcExecution {
  id: string;
  level: number;
  index: number;
  requirement: string;
  displayName: string;
  providerId?: string;
  authenticationFlow?: boolean;
  flowId?: string;
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
    this.fetchImpl = config.fetchImpl ?? fetch;
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

  /** Signs in again on the next call, for rights given since the last sign-in. */
  forgetSignIn() {
    this.token = undefined;
  }

  /**
   * Gives a client's service account the realm-management roles in `REALM_ADMIN_ROLES` that it lacks,
   * and says which it gave. Needs a sign-in that may grant them (Keycloak's master admin).
   */
  async grantRealmAdmin(clientId: string): Promise<string[]> {
    const client = (await this.call<KcClient[]>('GET', `/clients?clientId=${encodeURIComponent(clientId)}`)).data[0];
    if (!client) throw new DirectoryError(`There is no ${clientId} client to give the realm's admin rights to.`, 404);
    const { data: account } = await this.call<{ id: string }>('GET', `/clients/${client.id}/service-account-user`);
    const management = (await this.call<KcClient[]>('GET', '/clients?clientId=realm-management')).data[0];
    if (!management) throw new DirectoryError('The realm has no realm-management client.', 404);
    const mappings = `/users/${account.id}/role-mappings/clients/${management.id}`;
    const have = new Set((await this.call<KcRole[]>('GET', mappings)).data.map((r) => r.name));
    const roles = (await this.call<KcRole[]>('GET', `/clients/${management.id}/roles`)).data.filter((r) => (REALM_ADMIN_ROLES as readonly string[]).includes(r.name) && !have.has(r.name));
    if (roles.length) await this.call('POST', mappings, roles);
    return roles.map((r) => r.name);
  }

  /** Makes sure the realm slows down repeated wrong passwords (`BRUTE_FORCE_POLICY`); true when it changed it. */
  async ensureSignInPolicy(): Promise<boolean> {
    const { data: realm } = await this.call<Record<string, unknown>>('GET', '');
    if (realm.bruteForceProtected) return false;
    await this.call('PUT', '', { ...BRUTE_FORCE_POLICY });
    return true;
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

  /**
   * Makes everyone with `role` sign in with a one-time code as well as their password, setting one up
   * the first time if they have none. Keycloak's browser flow already asks for a code from anyone who
   * has one; this copies it as `SIGN_IN_FLOW`, asks holders of `role` for theirs in a step of its own,
   * leaves them out of the usual step (so they're asked once), and makes the copy the realm's sign-in.
   * Returns whether it changed the realm.
   */
  async ensureOtpFor(role: string): Promise<boolean> {
    const flows = (await this.call<{ alias: string }[]>('GET', '/authentication/flows')).data;
    if (!flows.some((f) => f.alias === SIGN_IN_FLOW)) {
      await this.call('POST', '/authentication/flows/browser/copy', { newName: SIGN_IN_FLOW });
    }
    const executionsOf = async (alias: string) => (await this.call<KcExecution[]>('GET', `/authentication/flows/${encodeURIComponent(alias)}/executions`)).data;
    const flowAlias = async (id: string) => (await this.call<{ alias: string }>('GET', `/authentication/flows/${id}`)).data.alias;
    const setRequirement = (exec: KcExecution, requirement: string) =>
      this.call('PUT', `/authentication/flows/${encodeURIComponent(SIGN_IN_FLOW)}/executions`, { ...exec, requirement });
    const addCondition = async (alias: string, config: Record<string, string>, name: string) => {
      const { location } = await this.call('POST', `/authentication/flows/${encodeURIComponent(alias)}/executions/execution`, { provider: 'conditional-user-role' });
      const id = location?.split('/').pop();
      const exec = (await executionsOf(SIGN_IN_FLOW)).find((e) => e.id === id);
      if (!exec) throw new DirectoryError('The sign-in service didn’t add the one-time code rule.', 503);
      await setRequirement(exec, 'REQUIRED');
      await this.call('POST', `/authentication/executions/${exec.id}/config`, { alias: name, config });
    };
    const roleRule = `${role} code`;
    let all = await executionsOf(SIGN_IN_FLOW);
    if (all.some((e) => e.displayName === roleRule)) return false;

    // The usual code step (a conditional sub-flow holding the OTP form) and the forms step around it.
    const otpAt = all.findIndex((e) => e.providerId === 'auth-otp-form');
    const usual = all.slice(0, otpAt).reverse().find((e) => e.authenticationFlow && e.level === all[otpAt]!.level - 1);
    const forms = all.slice(0, otpAt).reverse().find((e) => e.authenticationFlow && e.level === all[otpAt]!.level - 2);
    if (!usual?.flowId || !forms?.flowId) throw new DirectoryError('The sign-in flow isn’t shaped as expected, so one-time codes weren’t set up.', 503);
    const formsAlias = await flowAlias(forms.flowId);
    await addCondition(await flowAlias(usual.flowId), { condUserRole: role, negate: 'true' }, `not ${role}`);

    await this.call('POST', `/authentication/flows/${encodeURIComponent(formsAlias)}/executions/flow`, {
      alias: roleRule,
      type: 'basic-flow',
      provider: 'registration-page-form',
      description: `Everyone with the ${role} role signs in with a one-time code.`,
    });
    all = await executionsOf(SIGN_IN_FLOW);
    const step = all.find((e) => e.displayName === roleRule)!;
    await setRequirement(step, 'CONDITIONAL');
    await addCondition(roleRule, { condUserRole: role, negate: 'false' }, `has ${role}`);
    const { location } = await this.call('POST', `/authentication/flows/${encodeURIComponent(roleRule)}/executions/execution`, { provider: 'auth-otp-form' });
    const otp = (await executionsOf(SIGN_IN_FLOW)).find((e) => e.id === location?.split('/').pop())!;
    await setRequirement(otp, 'REQUIRED');

    await this.call('PUT', '', { browserFlow: SIGN_IN_FLOW });
    return true;
  }

  /** One admin API call. `notFound` names what a 404 means. Also used for apps' clients (clients.ts). */
  async call<T = unknown>(method: string, path: string, body?: unknown, notFound = 'That isn’t in the directory any more.'): Promise<{ data: T; location?: string }> {
    const token = await this.accessToken();
    let res: Response;
    try {
      res = await this.fetchImpl(`${this.base}${path}`, {
        method,
        headers: { authorization: `Bearer ${token}`, ...(body === undefined ? {} : { 'content-type': 'application/json' }) },
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

  private async realmRoles(): Promise<KcRole[]> {
    const { data } = await this.call<KcRole[]>('GET', '/roles?briefRepresentation=false');
    return data.filter((r) => !builtInRole(r.name, this.config.realm));
  }

  /** Every group, top-level and nested, each with the id of the group it sits in. */
  private async groups(): Promise<KcGroup[]> {
    const { data: top } = await this.call<KcGroup[]>('GET', '/groups?max=1000&briefRepresentation=true');
    const all: KcGroup[] = [];
    const walk = async (groups: KcGroup[], parentId?: string) => {
      for (const g of groups) {
        all.push({ id: g.id, name: g.name, ...(parentId ? { parentId } : {}) });
        if (g.subGroupCount) await walk((await this.call<KcGroup[]>('GET', `/groups/${g.id}/children?max=1000&briefRepresentation=true`)).data, g.id);
      }
    };
    await walk(top);
    return all;
  }

  private async memberIds(group: string): Promise<string[]> {
    const { data } = await this.call<KcUser[]>('GET', `/groups/${group}/members?briefRepresentation=true&max=10000`);
    return data.map((u) => u.id);
  }

  /** Makes any of these realm roles that don't exist yet; returns the ones it made. */
  async ensureRoles(roles: readonly Role[]): Promise<string[]> {
    const have = new Set((await this.realmRoles()).map((r) => r.name));
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
    const [{ data: users }, roles, departments] = await Promise.all([
      this.call<KcUser[]>('GET', '/users?briefRepresentation=false&max=10000'),
      this.realmRoles(),
      this.departments(),
    ]);
    const holders = await Promise.all(
      roles.map(async (r) => ({ role: r.name, ids: new Set((await this.call<KcUser[]>('GET', `/roles/${encodeURIComponent(r.name)}/users?max=10000`)).data.map((u) => u.id)) })),
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

  async createPerson(person: NewPerson, temporaryPassword: string): Promise<Person> {
    const { location } = await this.call('POST', '/users', {
      username: person.username,
      firstName: person.firstName,
      lastName: person.lastName,
      email: person.email,
      emailVerified: true,
      enabled: true,
      credentials: [{ type: 'password', value: temporaryPassword, temporary: true }],
      requiredActions: ['UPDATE_PASSWORD'],
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
