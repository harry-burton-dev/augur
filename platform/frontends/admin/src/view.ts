import type { RemoteNode } from '@augur/mfe-sdk/sdk3';
import type { AdminApi, AppSettingValue, AuditEntry, CatalogueApp, Department, FeaturePreviews, FloorRule, LeaveRequest, LifecycleInfo, MadeRole, Organisation, Person, Role, RoleDetail, TeamLevels } from './api.js';
import type { Route } from './routes.js';

/** Something Admin read, or why it couldn't; neither while it's on its way. */
export interface Slot<T> {
  value?: T;
  error?: string;
}

/** What Admin reads, each once, when a page first needs it; a change puts its answer back here. */
export interface Reads {
  people: Slot<Person[]>;
  departments: Slot<Department[]>;
  roles: Slot<Role[]>;
  leaving: Slot<LeaveRequest[]>;
  lifecycle: Slot<LifecycleInfo>;
  levels: Slot<TeamLevels>;
  organisation: Slot<Organisation>;
  zones: Slot<string[]>;
  languages: Slot<string[]>;
  apps: Slot<CatalogueApp[]>;
  /** The org's own floor, which every app rule starts from. */
  floor: Slot<{ id: string; name: string }>;
  /** The roles made in AUGUR for the org and each department, which the permissions service keeps. */
  madeRoles: Slot<MadeRole[]>;
  /** One made role, who holds it and what it gives. */
  role(id: string): Slot<RoleDetail>;
  floors(app: string): Slot<FloorRule[]>;
  settings(app: string): Slot<AppSettingValue[]>;
  previews(app: string): Slot<FeaturePreviews>;
}

/** The keys of what's read once for everyone, which a change can put back or read again. */
export type ReadKey = Exclude<keyof Reads, 'floors' | 'settings' | 'previews' | 'role'>;

/** Activity's filters, as its selects hold them. */
export interface Filters {
  kind: string;
  who: string;
  area: string;
  floor: string;
  period: 'today' | 'week' | 'month' | 'all' | 'custom';
  from: string;
  to: string;
}

/** What's on screen besides what was read: what a change said, a secret shown once, a question's state and drafts. */
export interface Ui {
  /** Why a change pressed somewhere didn't work, said where it was pressed. */
  problem?: { where: string; words: string };
  /** What a change that acts at once did, said where it was pressed. */
  done?: { where: string; words: string };
  /** A password or a secret, shown once in a dialog of its own. */
  shown?: { heading: string; summary: string; label: string; value: string };
  /** The open question's state. */
  dialog: { busy?: boolean; error?: string };
  /** What's being chosen on the page before it's saved: a new person's roles, the leaver flow's choices, the languages. */
  draft: {
    roles?: string[];
    heir?: string;
    note?: string;
    lastDay?: string;
    offered?: string[];
    picking?: string;
    /** A made role's page: who it's given to and until when, what it gives and where, and why each. */
    holder?: string;
    until?: string;
    why?: string;
    relation?: string;
    on?: string;
    why2?: string;
  };
  activity: { filters: Filters; entries?: AuditEntry[]; more?: boolean; loading?: boolean; older?: boolean; error?: string; exporting?: boolean; exportError?: string };
}

/** What every page draws from. */
export interface View {
  route: Route;
  /** The signed-in admin's id. */
  me: string;
  /** Whether they hold the deployment-admin role, as People lists them. */
  deploymentAdmin: boolean;
  r: Reads;
  ui: Ui;
  api: AdminApi;
  on: Actions;
}

/** What pages can ask for. */
export interface Actions {
  go(path: string): void;
  /** Redraws, after something on the page changed. */
  draw(): void;
  /** Runs a change pressed on a page: says what it did at `where`, or why it didn't. */
  act(where: string, change: () => Promise<void>): void;
  /** Runs a change from an open question: busy while it works; done, it goes to `back`; turned down, it says why, or asks the password again. */
  answer(back: string | (() => string), change: () => Promise<void>): void;
  /** Puts what a change answered back in place of what was read. */
  put<K extends ReadKey>(key: K, value: NonNullable<Reads[K]['value']>): void;
  /** Reads something again: one of the reads, or a made role (`role:<id>`). */
  again(key: ReadKey | `role:${string}`): void;
  putApp(kind: 'floors' | 'settings' | 'previews', app: string, value: unknown): void;
  /** Activity: reads the first page for the filters, or the next older one. */
  audit(older?: boolean): void;
  /** Activity: saves what the filters show as a CSV file. */
  exportAudit(): void;
  /** Opens Deployment, at an app's page there when one is named. */
  open(app?: string): Promise<void>;
}

export type Page = (v: View) => RemoteNode;

export const words = (e: unknown) => (e instanceof Error ? e.message : String(e));
