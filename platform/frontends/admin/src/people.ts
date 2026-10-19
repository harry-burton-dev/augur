import { LitElement, html, nothing } from 'lit';
import type { DialogSubmit, TableColumn, TableRow, UiDialog } from '@platform/ui-kit';
import { departmentPath, fullName, type AdminApi, type Department, type Person, type Role } from './api.js';
import { page, passwordNote, statusOf } from './parts.js';

const NO_DEPARTMENT = '';

/**
 * Everyone who can sign in: add someone, change their name, department and
 * roles, turn their sign-in off or on, and give them a new one-time password.
 */
export class AdminPeople extends LitElement {
  static override properties = {
    api: { attribute: false },
    me: { type: String },
    adding: { type: Boolean },
    people: { state: true },
    departments: { state: true },
    roles: { state: true },
    loading: { state: true },
    error: { state: true },
    editing: { state: true },
    password: { state: true },
  };

  declare api: AdminApi;
  /** The signed-in admin's id: they can't lock themselves out. */
  declare me: string;
  /** Open the Add dialog straight away (the menu's "Add a person"). */
  declare adding: boolean;
  declare people: Person[];
  declare departments: Department[];
  declare roles: Role[];
  declare loading: boolean;
  declare error: string;
  declare editing: Person | undefined;
  declare password: { name: string; value: string; reset: boolean } | undefined;

  constructor() {
    super();
    this.me = '';
    this.adding = false;
    this.people = [];
    this.departments = [];
    this.roles = [];
    this.loading = true;
    this.error = '';
  }

  // Light DOM: the kit's elements carry their own styles, and the page's tokens reach them.
  override createRenderRoot() {
    return this;
  }

  override willUpdate(changed: Map<string, unknown>) {
    if (changed.has('api') && this.api) void this.load();
  }

  async load() {
    this.loading = true;
    this.error = '';
    try {
      [this.people, this.departments, this.roles] = await Promise.all([this.api.people(), this.api.departments(), this.api.roles()]);
    } catch (err) {
      this.error = (err as Error).message;
    } finally {
      this.loading = false;
    }
  }

  private replace(person: Person) {
    this.people = this.people.map((p) => (p.id === person.id ? person : p));
    if (this.editing?.id === person.id) this.editing = person;
  }

  private readonly columns: TableColumn[] = [
    { key: 'name', label: 'Name', sortable: true },
    { key: 'email', label: 'Email', sortable: true },
    { key: 'department', label: 'Department', sortable: true },
    { key: 'roles', label: 'Roles' },
    { key: 'signIn', label: 'Sign-in', sortable: true, format: (v, row) => html`<ui-status status=${String(row.signInStatus)} label=${String(v)}></ui-status>` },
  ];

  private departmentOptions() {
    return [
      { value: NO_DEPARTMENT, label: 'No department' },
      ...this.departments
        .map((d) => ({ value: d.id, label: departmentPath(d.id, this.departments), detail: `${d.members.length} ${d.members.length === 1 ? 'person' : 'people'}` }))
        .sort((a, b) => a.label.localeCompare(b.label)),
    ];
  }

  private roleOptions() {
    return this.roles.map((r) => ({ value: r.name, label: r.name, ...(r.description ? { detail: r.description } : {}) }));
  }

  private submitNew: DialogSubmit = async (values, dialog) => {
    const roles = dialog.querySelector('ui-checkbox-group')?.values ?? [];
    const { person, temporaryPassword } = await this.api.addPerson({
      firstName: values.firstName,
      lastName: values.lastName,
      email: values.email,
      ...(values.username ? { username: values.username.trim().toLowerCase() } : {}),
      roles,
      departments: values.department ? [values.department] : [],
    });
    this.people = [...this.people, person];
    this.departments = this.departments.map((d) => (person.departments.includes(d.id) ? { ...d, members: [...d.members, person.id] } : d));
    this.password = { name: fullName(person), value: temporaryPassword, reset: false };
  };

  private submitEdit: DialogSubmit = async (values, dialog) => {
    const person = this.editing!;
    const roles = dialog.querySelector('ui-checkbox-group')?.values ?? person.roles;
    // The select manages the first department; any others are left as they are.
    const [, ...others] = person.departments;
    const departments = values.department ? [values.department, ...others.filter((d) => d !== values.department)] : others;
    const updated = await this.api.updatePerson(person.id, {
      firstName: values.firstName,
      lastName: values.lastName,
      email: values.email,
      roles,
      departments,
    });
    this.replace(updated);
    // Membership counts changed somewhere; read them again rather than guess.
    this.departments = await this.api.departments().catch(() => this.departments);
  };

  private async resetPassword(person: Person) {
    const { temporaryPassword } = await this.api.resetPassword(person.id);
    this.replace({ ...person, invited: true });
    this.editing = undefined;
    this.password = { name: fullName(person), value: temporaryPassword, reset: true };
  }

  private fields(person?: Person) {
    return html`
      <ui-text-field slot="fields" name="firstName" label="First name" required .value=${person?.firstName ?? ''}></ui-text-field>
      <ui-text-field slot="fields" name="lastName" label="Last name" required .value=${person?.lastName ?? ''}></ui-text-field>
      <ui-text-field
        slot="fields"
        name="email"
        type="email"
        label="Email"
        required
        .value=${person?.email ?? ''}
        .validate=${(v: string) => (/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v.trim()) ? null : { state: 'error' as const, message: 'That email is missing something, like @example.org' })}
      ></ui-text-field>
      ${person
        ? nothing
        : html`<ui-text-field slot="fields" name="username" label="Username" optional hint="What they sign in with. Leave it empty to use the part of their email before the @."></ui-text-field>`}
      <ui-select slot="fields" name="department" label="Department" placeholder="No department" .options=${this.departmentOptions()} .value=${person?.departments[0] ?? NO_DEPARTMENT}></ui-select>
      <ui-checkbox-group slot="fields" name="roles" label="Roles" optional .options=${this.roleOptions()} .values=${person?.roles ?? []}></ui-checkbox-group>
    `;
  }

  private editDialog() {
    const person = this.editing;
    if (!person) return nothing;
    const self = person.id === this.me;
    return html`<ui-dialog
      open
      size="glance"
      eyebrow=${person.username}
      heading=${fullName(person)}
      summary=${person.invited ? 'Hasn’t chosen their own password yet.' : ''}
      action-label="Save"
      busy-label="Saving…"
      .submit=${this.submitEdit}
      @ui-close=${() => (this.editing = undefined)}
    >
      <ui-toggle
        label="Can sign in"
        hint=${self ? 'You can’t turn off your own sign-in.' : 'Turned off, they can’t sign in; nothing of theirs is removed.'}
        ?checked=${person.enabled}
        ?disabled=${self}
        .change=${async (enabled: boolean) => this.replace(await this.api.updatePerson(person.id, { enabled }))}
      ></ui-toggle>
      <div>
        <ui-button kind="tertiary" size="sm" @click=${() => this.resetPassword(person).catch((err: Error) => this.querySelector<UiDialog>('ui-dialog')?.setError(err.message))}>
          Give them a new one-time password
        </ui-button>
      </div>
      ${this.fields(person)}
    </ui-dialog>`;
  }

  override render() {
    const rows: TableRow[] = this.people
      .map((p) => ({
        id: p.id,
        name: fullName(p),
        email: p.email ?? '',
        department: p.departments.map((d) => departmentPath(d, this.departments)).join(', '),
        roles: p.roles.join(', '),
        signIn: statusOf(p).label,
        signInStatus: statusOf(p).status,
      }))
      .sort((a, b) => a.name.localeCompare(b.name));
    return page(
      'Admin',
      'People',
      'Everyone who can sign in, their department and roles.',
      html`<ui-table
          noun="people"
          filterable
          .columns=${this.columns}
          .rows=${rows}
          ?loading=${this.loading}
          .error=${this.error}
          empty="No one here yet."
          @ui-open=${(e: CustomEvent<{ row: TableRow }>) => (this.editing = this.people.find((p) => p.id === e.detail.row.id))}
          @ui-retry=${() => this.load()}
        >
          <ui-button slot="actions" kind="secondary" size="sm" ?disabled=${this.loading || Boolean(this.error)} @click=${() => (this.adding = true)}>Add a person</ui-button>
        </ui-table>
        ${this.adding && !this.loading && !this.error
          ? html`<ui-dialog
              open
              size="glance"
              eyebrow="People"
              heading="Add a person"
              summary="They get a one-time password to sign in with, then choose their own."
              action-label="Add"
              busy-label="Adding…"
              .submit=${this.submitNew}
              @ui-close=${() => (this.adding = false)}
            >
              ${this.fields()}
            </ui-dialog>`
          : nothing}
        ${this.editDialog()} ${this.password ? passwordNote(this.password, () => (this.password = undefined)) : nothing}`,
    );
  }
}

if (!customElements.get('admin-people')) customElements.define('admin-people', AdminPeople);
