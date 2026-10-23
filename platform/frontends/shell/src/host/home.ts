import type { AppManifestEntry, ManifestSurface, MicroFrontend, MountContext, Surface, Workspace } from '@augur/mfe-sdk';
import type { ShellNotification } from '@augur/ui-kit';
import { incompatibility } from './manifest.js';
import type { ImportEntry } from './mount.js';
import { importEntry } from './mount.js';

/**
 * Home is an app like any other, so it hears from the shell only on the bus.
 * These are the shell's own events for it; `frontends/home` keeps the same
 * names. No other app should rely on them: they can change in any release.
 */
export const HOME_CHANNEL = {
  /** Home → shell: Home is mounted and wants the state. */
  ready: 'shell.home.ready',
  /** Shell → Home: what needs you and the cards, whenever either changes. */
  state: 'shell.home.state',
  /** Home → shell: `{ id }`, open a notification as the stream would. */
  open: 'shell.home.open',
  /** Home → shell: `{ id, index }`, press one of a notification's actions. */
  act: 'shell.home.act',
  /** Home → shell: `{ el, app }`, mount that app's card into `el`. */
  mountCard: 'shell.home.card.mount',
  /** Home → shell: `{ el }`, unmount the card in `el`. */
  unmountCard: 'shell.home.card.unmount',
} as const;

/** One row on Home: an unread notification that needs you, from an app that isn't muted. */
export interface HomeNeed {
  id: string;
  app: string;
  appName: string;
  title: string;
  detail?: string;
  time: string | number;
  /** The floor's name, for one from a floor other than the one Home is on. */
  floorName?: string;
  /** The labels of its actions; pressing one sends `act` with its index. */
  actions: string[];
}

/** An app's glance card, for Home to make room for. */
export interface HomeCard {
  app: string;
  name: string;
  icon?: string;
}

export interface HomeState {
  needs: HomeNeed[];
  cards: HomeCard[];
}

/** How many cards Home shows at most. */
export const MAX_CARDS = 6;

const toTime = (t: ShellNotification['time']) => (t instanceof Date ? t.getTime() : typeof t === 'number' ? t : Date.parse(t));

/** Everything unread that needs you, newest first, leaving out what the person muted. */
export function needsFor(notifications: ShellNotification[], { muted, apps, floors, here }: { muted: string[]; apps: AppManifestEntry[]; floors: Workspace[]; here: string }): HomeNeed[] {
  return notifications
    .filter((n) => n.level === 'needs' && !muted.includes(n.app))
    .sort((a, b) => toTime(b.time) - toTime(a.time))
    .map((n) => {
      const floor = n.floor && n.floor !== here ? floors.find((f) => f.id === n.floor) : undefined;
      return {
        id: n.id,
        app: n.app,
        appName: apps.find((a) => a.id === n.app)?.name ?? n.app,
        title: n.title,
        ...(n.detail ? { detail: n.detail } : {}),
        time: n.time instanceof Date ? n.time.getTime() : n.time,
        ...(floor ? { floorName: floor.kind === 'personal' ? 'your own floor' : floor.name } : {}),
        actions: (n.actions ?? []).map((a) => a.label),
      };
    });
}

/**
 * The card an app shows on this floor, if any. When several fit, one for the
 * person's role there wins over one for everyone, then the first in the manifest.
 */
export function cardOf(app: AppManifestEntry, floor: Pick<Workspace, 'kind' | 'role'>): ManifestSurface | undefined {
  const fits = (app.surfaces ?? []).filter((s) => s.slot === 'card' && s.floor === floor.kind && (!s.role || s.role === floor.role));
  return fits.find((s) => s.role) ?? fits[0];
}

/** The cards for Home on this floor: apps the person opened most recently first, then the catalogue's order, at most six. */
export function cardsFor(manifest: AppManifestEntry[], floor: Pick<Workspace, 'kind' | 'role'>, recent: string[]): HomeCard[] {
  const order = (a: AppManifestEntry) => {
    const at = recent.indexOf(a.id);
    return at < 0 ? recent.length + manifest.indexOf(a) : at;
  };
  return manifest
    .filter((a) => !incompatibility(a) && cardOf(a, floor))
    .sort((a, b) => order(a) - order(b))
    .slice(0, MAX_CARDS)
    .map((a) => ({ app: a.id, name: a.name, ...(a.icon ? { icon: a.icon } : {}) }));
}

const isSurface = (x: unknown): x is Surface => !!x && typeof x === 'object' && typeof (x as Surface).mount === 'function';

/**
 * Mounts apps' cards into the tiles Home makes for them. Each card is loaded
 * from its app's entry, once per entry, and a card that fails is put away
 * quietly: a broken card never takes Home down with it.
 */
export class SurfaceMounter {
  private readonly loads = new Map<string, Promise<MicroFrontend | undefined>>();
  private readonly mounted = new Map<HTMLElement, Surface>();

  constructor(private readonly load: ImportEntry = importEntry) {}

  private entryOf(app: AppManifestEntry) {
    let pending = this.loads.get(app.entry);
    if (!pending) {
      pending = this.load(app.entry).then(
        (mod) => mod.default as MicroFrontend | undefined,
        () => undefined,
      );
      pending.then((mfe) => mfe ?? this.loads.delete(app.entry));
      this.loads.set(app.entry, pending);
    }
    return pending;
  }

  /** Mounts `app`'s card for the floor into `el`. False when there is none, or it failed; Home then says so in the tile. */
  async mount(el: HTMLElement, app: AppManifestEntry, floor: Pick<Workspace, 'kind' | 'role'>, ctx: MountContext): Promise<boolean> {
    const card = cardOf(app, floor);
    if (!card || incompatibility(app)) return false;
    const surface = (await this.entryOf(app))?.surfaces?.[card.module];
    if (!isSurface(surface) || !el.isConnected) return false;
    await this.unmount(el);
    this.mounted.set(el, surface);
    try {
      await surface.mount(el, ctx);
      return true;
    } catch {
      await this.unmount(el);
      return false;
    }
  }

  async unmount(el: HTMLElement) {
    const surface = this.mounted.get(el);
    if (!surface) return;
    this.mounted.delete(el);
    try {
      await surface.unmount?.(el);
    } catch {
      // A card that fails to tidy up is still gone from Home.
    }
    el.replaceChildren();
  }

  async unmountAll() {
    await Promise.all([...this.mounted.keys()].map((el) => this.unmount(el)));
  }
}
