import { DirectoryError, type Department, type Directory, type NewPerson, type Person, type PersonChanges } from './directory.ts';
import type { WorkspaceStore } from './workspaces.ts';

/** The one-time copy of Keycloak's groups into identity's teams. */
export const KEYCLOAK_GROUPS = 'keycloak-groups';

/**
 * Admin's departments are teams now: identity's own tables hold them and who
 * is on them, and Keycloak only signs people in. People still come from the
 * sign-in directory; their `departments` are the teams they're on. The admin
 * API and screens are unchanged.
 *
 * The first time teams are needed, the departments the sign-in directory held
 * (Keycloak groups) are copied in once, with their members. Until the shell
 * reads floors, sign-in tokens still carry the old groups in `departments`.
 */
export class TeamDirectory implements Directory {
  private importing?: Promise<void>;

  constructor(
    private readonly signIn: Directory,
    private readonly store: WorkspaceStore,
    private readonly log: (message: string) => void = console.warn,
  ) {}

  /**
   * Copies the sign-in directory's departments in, once. If it can't be read
   * yet, teams start empty for now and the copy is tried again next time.
   */
  ready(): Promise<void> {
    this.importing ??= this.store
      .importOnce(KEYCLOAK_GROUPS, async () =>
        (await this.signIn.departments()).map((d) => ({ key: d.id, name: d.name, ...(d.parentId ? { parentKey: d.parentId } : {}), members: d.members })),
      )
      .then(
        () => undefined,
        (err: Error) => {
          this.importing = undefined;
          this.log(`Departments weren’t copied in from the sign-in service yet: ${err.message}`);
        },
      );
    return this.importing;
  }

  private async snapshot() {
    await this.ready();
    const [org, teams, members] = await Promise.all([this.store.org(), this.store.teams(), this.store.memberships()]);
    return { org, teams, members };
  }

  private async withTeams<P extends Person>(people: P[]): Promise<P[]> {
    const { teams, members } = await this.snapshot();
    const live = new Set(teams.map((t) => t.id));
    return people.map((p) => ({ ...p, departments: members.filter((m) => m.person === p.id && live.has(m.workspace)).map((m) => m.workspace) }));
  }

  private async checkTeams(ids: string[]) {
    const { teams } = await this.snapshot();
    if (ids.some((id) => !teams.some((t) => t.id === id))) throw new DirectoryError('One of those departments no longer exists.', 400);
  }

  private async moveTo(person: string, want: string[], have: string[]) {
    for (const t of want.filter((t) => !have.includes(t))) await this.store.setMember(t, person, 'member');
    for (const t of have.filter((t) => !want.includes(t))) await this.store.setMember(t, person, null);
  }

  async people() {
    return this.withTeams(await this.signIn.people());
  }

  async person(id: string) {
    return (await this.withTeams([await this.signIn.person(id)]))[0];
  }

  canEmail() {
    return this.signIn.canEmail();
  }

  sendInvite(id: string, lifespanSeconds: number) {
    return this.signIn.sendInvite(id, lifespanSeconds);
  }

  async createPerson(person: NewPerson, temporaryPassword?: string) {
    await this.checkTeams(person.departments);
    const created = await this.signIn.createPerson({ ...person, departments: [] }, temporaryPassword);
    await this.moveTo(created.id, person.departments, []);
    return this.person(created.id);
  }

  async updatePerson(id: string, { departments, ...changes }: PersonChanges) {
    if (departments) await this.checkTeams(departments);
    const before = await this.person(id);
    if (Object.keys(changes).length) await this.signIn.updatePerson(id, changes);
    if (departments) await this.moveTo(id, departments, before.departments);
    return this.person(id);
  }

  resetPassword(id: string, temporaryPassword: string) {
    return this.signIn.resetPassword(id, temporaryPassword);
  }

  endSessions(id: string) {
    return this.signIn.endSessions(id);
  }

  roles() {
    return this.signIn.roles();
  }

  async departments(): Promise<Department[]> {
    const { org, teams, members } = await this.snapshot();
    return teams.map((t) => ({
      id: t.id,
      name: t.name,
      ...(t.parentId && t.parentId !== org.id ? { parentId: t.parentId } : {}),
      members: members.filter((m) => m.workspace === t.id).map((m) => m.person),
    }));
  }

  private async department(id: string) {
    const d = (await this.departments()).find((x) => x.id === id);
    if (!d) throw new DirectoryError('That department no longer exists.', 404);
    return d;
  }

  async createDepartment(name: string, parentId?: string) {
    await this.ready();
    const team = await this.store.createTeam(name, parentId);
    return this.department(team.id);
  }

  async renameDepartment(id: string, name: string) {
    await this.ready();
    await this.store.renameTeam(id, name);
    return this.department(id);
  }

  async addMember(department: string, person: string) {
    await this.ready();
    await this.signIn.person(person);
    const role = (await this.store.memberships({ workspace: department, person }))[0]?.role;
    await this.store.setMember(department, person, role ?? 'member');
  }

  async removeMember(department: string, person: string) {
    await this.ready();
    await this.store.setMember(department, person, null);
  }
}
