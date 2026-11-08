/**
 * Apps on the app contract (contract 3, ADR 0075): the catalogue sends each one's manifest in force,
 * filled in with `maxUpload`, `previewsOn` and its contract major (spec 9.6). The shell reads it into
 * the entry its app bar, rail, Find and intents already take, and keeps what only the worker host
 * needs beside it. Nothing here comes from the app's code: the shell draws it all before that runs.
 */
import type { AppManifestEntry, AppMenuCategory, WorkspaceKind } from '@augur/mfe-sdk';
import type { FrameAction } from '@augur/mfe-sdk/sdk3';

/** The parts of manifest 3 the shell reads. The registry has checked the rest (appendix B). */
export interface Place3 {
  id: string;
  label: string;
  icon?: string;
  detail?: string;
  path?: string;
  role?: 'member' | 'lead';
  floors?: WorkspaceKind[];
  fills?: boolean;
}
export interface Command3 {
  id: string;
  label: string;
  icon?: string;
  keywords?: string;
  when?: 'always' | 'selection' | 'screen';
}
export interface Contributes3 {
  places?: Place3[];
  commands?: Command3[];
  radial?: { command: string; on: string; order?: number }[];
  about?: { id: string; label: string; icon?: string }[];
  intents?: { handles?: string[] };
  notifications?: AppManifestEntry['notifications'];
  inbox?: AppManifestEntry['inbox'];
  search?: boolean;
  card?: boolean;
  canvas?: boolean;
}
export interface Catalogue3 {
  contract: 3;
  id: string;
  name: string;
  version: string;
  description?: string;
  icon?: string;
  requiredRole?: string;
  floors?: WorkspaceKind[];
  /** Absent for an app with no UI. `url` is the stand-in shell's (`pnpm dev:app`): where it serves the entry from source. */
  frontend?: { entry: string; url?: string };
  maxUpload?: number;
  contributes?: Contributes3;
  previews?: AppManifestEntry['previews'];
  previewsOn?: string[];
  category?: AppManifestEntry['category'];
}

/** An app the shell runs in a worker: the entry the rest of the shell takes, and the manifest beside it. */
export type WorkerApp = AppManifestEntry & { contract: 3; manifest: Catalogue3 };

export const isWorkerApp = (app: AppManifestEntry): app is WorkerApp => (app as Partial<WorkerApp>).contract === 3;

/** Whether a catalogue row is a contract 3 app. */
export const isCatalogue3 = (row: unknown): row is Catalogue3 =>
  !!row && typeof row === 'object' && (row as Catalogue3).contract === 3 && typeof (row as Catalogue3).id === 'string' && typeof (row as Catalogue3).name === 'string' && typeof (row as Catalogue3).version === 'string';

/** Where a place opens, below `/<id>` (spec 6.3): its `path`, else `/<place id>`. */
export const placePath = (p: Place3) => p.path ?? `/${p.id}`;

/**
 * Where an app's frontend comes from: the shell's own origin, under `/apps/<id>/<version>/` (spec 3.3).
 * The entry is a path inside the bundle, never an address (the registry refuses one; this checks again).
 */
export function entryUrl(m: Catalogue3): string | undefined {
  if (!m.frontend) return undefined;
  if (m.frontend.url) return m.frontend.url;
  const entry = m.frontend.entry;
  if (!/^(?!\/)(?!.*\.\.)[A-Za-z0-9_./-]+\.js$/.test(entry)) return undefined;
  return `/apps/${encodeURIComponent(m.id)}/${encodeURIComponent(m.version)}/${entry}`;
}

/** The app's places as the rail's pages: the shell's existing menu, one group. */
const menuOf = (m: Catalogue3): AppMenuCategory[] => {
  const places = m.contributes?.places ?? [];
  return places.length ? [{ label: m.name, items: places.map((p) => ({ id: p.id, label: p.label, icon: p.icon, detail: p.detail, path: placePath(p) })) }] : [];
};

/** A contract 3 catalogue row as the shell's entry. */
export function fromCatalogue3(m: Catalogue3): WorkerApp {
  const c = m.contributes ?? {};
  return {
    contract: 3,
    manifest: m,
    id: m.id,
    name: m.name,
    route: `/${m.id}`,
    entry: entryUrl(m) ?? '',
    version: m.version,
    // Contract 3 apps don't name an SDK range: the contract major is the promise (spec 11).
    sdk: '*',
    description: m.description,
    icon: m.icon,
    requiredRole: m.requiredRole,
    floors: m.floors,
    menu: menuOf(m),
    handles: c.intents?.handles,
    search: c.search,
    maxUpload: m.maxUpload,
    previews: m.previews,
    previewsOn: m.previewsOn,
    inbox: c.inbox,
    notifications: c.notifications,
    category: m.category,
    // The worker hears every move inside the app, so a move never starts it again.
    followsAddress: true,
  };
}

/** The pane's actions as the page heading takes them: each names a declared command; one the app doesn't handle yet says so. */
export function actionsOf(app: WorkerApp, actions: FrameAction[] | undefined, handled: ReadonlySet<string>) {
  const commands = app.manifest.contributes?.commands ?? [];
  return (actions ?? []).flatMap((a) => {
    const command = commands.find((c) => c.id === a.command);
    if (!command) return [];
    const reason = a.unavailable ?? (handled.has(command.id) ? undefined : `${app.name} hasn’t loaded this yet.`);
    return [{ id: command.id, label: a.label ?? command.label, ...(reason ? { disabled: true, reason } : {}) }];
  });
}
