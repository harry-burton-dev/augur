import { LitElement, html, nothing } from 'lit';
import type { DialogSubmit, TableColumn, TableRow, UiDialog } from '@augur/ui-kit';
import { departmentPath, fullName, levelOf, type AdminApi, type Department, type Person, type TeamLevels } from './api.js';
import { page } from './parts.js';

const TOP = '';

/**
 * Departments: add one (at the top or inside another), rename it, and choose
 * who is in it. A person's department reaches apps as the `departments` claim
 * when they next sign in. Each level has a name, Department at the top and
 * Team inside it unless renamed here, which people see on their floors.
 */
export class AdminDepartments extends LitElement {
  static override properties = {
    api: { attribute: false },
    adding: { type: Boolean },
    departments: { state: true },
    people: { state: true },
    loading: { state: true },
    error: { state: true },
    open: { state: true },
    working: { state: true },
    levels: { state: true },
    naming: { state: true },
  };

  declare api: AdminApi;
  /** Open the New dialog straight away (the menu's "New department"). */
  declare adding: boolean;
  declare departments: Department[];
  declare people: Person[];
  declare loading: boolean;
  declare error: string;
  /** The department whose details are open. */
  declare open: string | undefined;
  /** A member being added or removed. */
  declare working: boolean;
  /** What each level is called; until it loads, the defaults. */
  declare levels: TeamLevels;
  /** The Level names dialog is open. */
  declare naming: boolean;

  constructor() {
    super();
    this.adding = false;
    this.departments = [];
    this.people = [];
    this.loading = true;
    this.error = '';
    this.working = false;
    this.levels = { levels: ['Department', 'Team'], max: 5 };
    this.naming = false;
  }

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
      [this.departments, this.people] = await Promise.all([this.api.departments(), this.api.people()]);
      // the names are shown beside each department; without them the defaults stand and say so
      this.levels = await this.api.levels().catch(() => this.levels);
    } catch (err) {
      this.error = (err as Error).message;
    } finally {
      this.loading = false;
    }
  }

  private readonly columns: TableColumn[] = [
    { key: 'name', label: 'Department', sortable: true },
    { key: 'level', label: 'Level', sortable: true },
    { key: 'members', label: 'Members', kind: 'number', sortable: true, sortFirst: 'desc' },
    { key: 'within', label: 'Inside', sortable: true },
  ];

  private parentOptions(except?: string) {
    return [
      { value: TOP, label: 'Nowhere: a top-level department' },
      ...this.departments
        .filter((d) => d.id !== except)
        .map((d) => ({ value: d.id, label: departmentPath(d.id, this.departments) }))
        .sort((a, b) => a.label.localeCompare(b.label)),
    ];
  }

  private nameCheck = (except?: string, parentId?: string) => (value: string) => {
    if (value.includes('/')) return { state: 'error' as const, message: 'A department’s name can’t have a / in it.' };
    const clash = this.departments.find((d) => d.id !== except && (d.parentId ?? TOP) === (parentId ?? TOP) && d.name.toLowerCase() === value.trim().toLowerCase());
    return clash ? { state: 'error' as const, message: `There is already a department called “${clash.name}” there.` } : null;
  };

  private submitNew: DialogSubmit = async (values) => {
    const created = await this.api.addDepartment(values.name.trim(), values.parent || undefined);
    this.departments = [...this.departments, created];
  };

  private submitRename: DialogSubmit = async (values) => {
    const renamed = await this.api.renameDepartment(this.open!, values.name.trim());
    this.departments = this.departments.map((d) => (d.id === renamed.id ? { ...d, name: renamed.name } : d));
  };

  private submitLevels: DialogSubmit = async (values) => {
    const names = Array.from({ length: this.levels.max }, (_, i) => (values[`level${i + 1}`] ?? '').trim());
    const last = names.reduce((n, name, i) => (name ? i + 1 : n), 0);
    if (names.slice(0, last).some((n) => !n)) throw new Error('Name every level down to the last one you name: a level can’t be left without a name in between.');
    this.levels = await this.api.setLevels(names.slice(0, last));
  };

  private levelNames() {
    if (!this.naming) return nothing;
    const { levels, max } = this.levels;
    return html`<ui-dialog
      open
      eyebrow="Departments"
      heading="Level names"
      summary=${`What each level of department is called, from the top. People see the name on their floor, and a level deeper than the last name takes that one. Up to ${max} levels.`}
      action-label="Save"
      busy-label="Saving…"
      .submit=${this.submitLevels}
      @ui-close=${() => (this.naming = false)}
    >
      ${Array.from(
        { length: max },
        (_, i) => html`<ui-text-field
          slot="fields"
          name=${`level${i + 1}`}
          label=${i === 0 ? 'At the top' : `Level ${i + 1}`}
          ?required=${i === 0}
          ?optional=${i > 0}
          .value=${levels[i] ?? ''}
          .hint=${i >= levels.length ? `Without a name, it’s called ${levels[levels.length - 1]}` : ''}
        ></ui-text-field>`,
      )}
    </ui-dialog>`;
  }

  private async membership(department: Department, person: string, add: boolean) {
    const dialog = this.querySelector<UiDialog>('ui-dialog');
    this.working = true;
    try {
      await (add ? this.api.addMember(department.id, person) : this.api.removeMember(department.id, person));
      const members = add ? [...department.members, person] : department.members.filter((m) => m !== person);
      this.departments = this.departments.map((d) => (d.id === department.id ? { ...d, members } : d));
      this.people = this.people.map((p) =>
        p.id === person ? { ...p, departments: add ? [...p.departments, department.id] : p.departments.filter((d) => d !== department.id) } : p,
      );
      dialog?.setError('');
    } catch (err) {
      dialog?.setError((err as Error).message);
    } finally {
      this.working = false;
    }
  }

  private details() {
    const department = this.departments.find((d) => d.id === this.open);
    if (!department) return nothing;
    const members = this.people.filter((p) => department.members.includes(p.id)).sort((a, b) => fullName(a).localeCompare(fullName(b)));
    const others = this.people
      .filter((p) => !department.members.includes(p.id))
      .map((p) => ({ value: p.id, label: fullName(p), ...(p.enabled ? {} : { detail: 'Sign-in off' }) }))
      .sort((a, b) => a.label.localeCompare(b.label));
    const parent = department.parentId ? departmentPath(department.parentId, this.departments) : '';
    return html`<ui-dialog
      open
      size="glance"
      eyebrow=${parent ? `Inside ${parent}` : 'Department'}
      heading=${department.name}
      summary=${`${members.length} ${members.length === 1 ? 'member' : 'members'}. Changes to members happen straight away; a new name waits for Save.`}
      action-label="Save name"
      busy-label="Saving…"
      .submit=${this.submitRename}
      @ui-close=${() => (this.open = undefined)}
    >
      <div data-members style="display:flex;flex-direction:column;gap:var(--space-2)">
        ${members.length
          ? members.map(
              (p) => html`<div style="display:flex;align-items:center;justify-content:space-between;gap:var(--space-4);min-height:40px;border-bottom:1px solid var(--hairline)">
                <span style="color:var(--ink)">${fullName(p)}<span style="color:var(--ink-muted);font-size:var(--type-small)"> ${p.email ?? ''}</span></span>
                <ui-button kind="tertiary" size="sm" ?busy=${this.working} @click=${() => this.membership(department, p.id, false)}>Remove</ui-button>
              </div>`,
            )
          : html`<p>No one is in ${department.name} yet.</p>`}
      </div>
      <ui-select
        label="Add someone"
        placeholder="Choose a person"
        .options=${others}
        ?busy=${this.working}
        .value=${''}
        @ui-change=${(e: CustomEvent<{ value: string }>) => {
          const select = e.target as HTMLElement & { value: string };
          void this.membership(department, e.detail.value, true).then(() => (select.value = ''));
        }}
      ></ui-select>
      <ui-text-field slot="fields" name="name" label="Name" required .value=${department.name} .validate=${this.nameCheck(department.id, department.parentId)}></ui-text-field>
    </ui-dialog>`;
  }

  override render() {
    const rows: TableRow[] = this.departments.map((d) => ({
      id: d.id,
      name: departmentPath(d.id, this.departments),
      level: levelOf(d.id, this.departments, this.levels.levels),
      members: d.members.length,
      within: d.parentId ? departmentPath(d.parentId, this.departments) : '',
    }));
    rows.sort((a, b) => String(a.name).localeCompare(String(b.name)));
    return page(
      'Admin',
      'Departments',
      `Who belongs where. A department can sit inside another: ${this.levels.levels.join(', then ')}.`,
      html`<ui-table
          noun="departments"
          filterable
          .columns=${this.columns}
          .rows=${rows}
          ?loading=${this.loading}
          .error=${this.error}
          empty="No departments yet."
          @ui-open=${(e: CustomEvent<{ row: TableRow }>) => (this.open = e.detail.row.id)}
          @ui-retry=${() => this.load()}
        >
          <ui-button slot="actions" kind="tertiary" size="sm" ?disabled=${this.loading || Boolean(this.error)} reason=${this.error ? 'Departments couldn’t be loaded. Try again first.' : 'Wait for the departments to load.'} @click=${() => (this.naming = true)}>Level names</ui-button>
          <ui-button slot="actions" kind="secondary" size="sm" ?disabled=${this.loading || Boolean(this.error)} reason=${this.error ? 'Departments couldn’t be loaded. Try again first.' : 'Wait for the departments to load.'} @click=${() => (this.adding = true)}>New department</ui-button>
        </ui-table>
        ${this.adding && !this.loading && !this.error
          ? html`<ui-dialog
              open
              eyebrow="Departments"
              heading="New department"
              action-label="Add"
              busy-label="Adding…"
              .submit=${this.submitNew}
              @ui-close=${() => (this.adding = false)}
            >
              <ui-text-field slot="fields" name="name" label="Name" required .validate=${this.nameCheck()}></ui-text-field>
              <ui-select slot="fields" name="parent" label="Inside" optional .options=${this.parentOptions()} .value=${TOP}></ui-select>
            </ui-dialog>`
          : nothing}
        ${this.details()}${this.levelNames()}`,
    );
  }
}

if (!customElements.get('admin-departments')) customElements.define('admin-departments', AdminDepartments);
