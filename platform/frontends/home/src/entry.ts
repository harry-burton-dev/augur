import { defineMicroFrontend, type MountContext } from '@platform/mfe-sdk';
import { html, render } from 'lit';
import { repeat } from 'lit/directives/repeat.js';
import { ago, type ListItem } from '@platform/ui-kit';
import '@platform/ui-kit';

const greeting = (hour: number) => (hour < 12 ? 'Good morning' : hour < 18 ? 'Good afternoon' : 'Good evening');

/**
 * What Home hears from the shell on the bus, and asks of it. The shell keeps
 * the same names in `frontends/shell/src/host/home.ts`; they are the shell's
 * own, not part of the app contract.
 */
export const HOME_CHANNEL = {
  ready: 'shell.home.ready',
  state: 'shell.home.state',
  open: 'shell.home.open',
  act: 'shell.home.act',
  mountCard: 'shell.home.card.mount',
  unmountCard: 'shell.home.card.unmount',
} as const;

export interface HomeNeed {
  id: string;
  app: string;
  appName: string;
  title: string;
  detail?: string;
  time: string | number;
  floorName?: string;
  actions: string[];
}

export interface HomeCard {
  app: string;
  name: string;
  icon?: string;
}

export interface HomeState {
  needs: HomeNeed[];
  cards: HomeCard[];
}

/** "3 things need you", "1 thing needs you", or nothing. */
export const needsWords = (count: number) => (count ? `${count} thing${count === 1 ? ' needs' : 's need'} you` : 'Nothing needs you right now.');

const toItem = (n: HomeNeed, now: number): ListItem => ({
  id: n.id,
  title: n.title,
  detail: [n.appName, n.floorName && `On ${n.floorName}`, n.detail].filter(Boolean).join(' · '),
  meta: ago(n.time, now),
  status: 'needs',
  actions: n.actions.map((label, i) => ({ id: String(i), label })),
});

/** How long Home waits to hear from the shell before saying nothing needs you. */
const PATIENCE_MS = 1000;

const views = new WeakMap<HTMLElement, () => void>();

/**
 * Home: the first place to look. The greeting, then every unread notification
 * that needs you, with its actions, then the glance cards apps contribute for
 * this floor. The shell owns all of it (notifications, mutes, the catalogue,
 * mounting each app's card); Home lays it out and passes on what's pressed.
 */
export default defineMicroFrontend({
  mount(el: HTMLElement, ctx: MountContext) {
    const first = ctx.user.name.split(' ')[0];
    // The floor's name over the greeting, except on the person's own. A shell older than SDK 1.1 sends no floor.
    const floor = ctx.workspace?.kind === 'personal' ? '' : (ctx.workspace?.name ?? '');
    let state: HomeState | null = null;
    const tiles = new Map<string, HTMLElement>();
    const failed = new Set<string>();

    const mountTiles = () => {
      if (!state) return;
      const wanted = new Set(state.cards.map((c) => c.app));
      for (const [app, tile] of tiles) {
        if (wanted.has(app) && tile.isConnected) continue;
        ctx.bus.emit(HOME_CHANNEL.unmountCard, { el: tile });
        tiles.delete(app);
      }
      for (const tile of el.querySelectorAll<HTMLElement>('[data-card]')) {
        const app = tile.dataset.card!;
        if (tiles.get(app) === tile) continue;
        tiles.set(app, tile);
        failed.delete(app);
        ctx.bus.emit(HOME_CHANNEL.mountCard, {
          el: tile,
          app,
          done: (shown: boolean) => {
            if (shown) return;
            failed.add(app);
            draw();
          },
        });
      }
    };

    const draw = () => {
      const needs = state?.needs ?? [];
      const cards = state?.cards ?? [];
      const nothing = state && !needs.length && !cards.length;
      render(
        html`<div style="max-width:var(--measure-wide);margin:0 auto;padding:var(--space-7) var(--edge);display:flex;flex-direction:column;gap:var(--space-6)">
          <ui-heading eyebrow=${floor} heading=${`${greeting(new Date().getHours())}, ${first}`} summary=${state && !nothing ? needsWords(needs.length) : ''}></ui-heading>
          ${nothing
            ? html`<ui-state kind="empty" heading="Nothing needs you right now."></ui-state>`
            : html`${needs.length || !state
                ? html`<ui-surface kind="pane">
                    <ui-list label="What needs you" .noun=${['thing', 'things']} .items=${needs.map((n) => toItem(n, Date.now()))} ?loading=${!state}
                      empty="Nothing needs you right now."
                      @ui-open=${(e: CustomEvent<{ item: ListItem }>) => ctx.bus.emit(HOME_CHANNEL.open, { id: e.detail.item.id })}
                      @ui-action=${(e: CustomEvent<{ item: ListItem; action: { id: string } }>) =>
                        ctx.bus.emit(HOME_CHANNEL.act, { id: e.detail.item.id, index: Number(e.detail.action.id) })}></ui-list>
                  </ui-surface>`
                : ''}
              ${cards.length
                ? html`<div class="cards" style="display:grid;grid-template-columns:repeat(auto-fill,minmax(280px,1fr));gap:var(--space-4)">
                    ${repeat(
                      cards,
                      (c) => c.app,
                      (c) => html`<ui-surface kind="pane" pad style="min-height:200px;display:flex;flex-direction:column;gap:var(--space-3)">
                        <div style="display:flex;align-items:center;gap:var(--space-2);color:var(--ink-muted);font-size:var(--type-meta)">
                          <ui-icon name=${c.icon ?? 'apps'} size="16"></ui-icon><span>${c.name}</span>
                        </div>
                        ${failed.has(c.app) ? html`<ui-state kind="error" size="line" heading=${`${c.name} couldn’t show this right now.`}></ui-state>` : ''}
                        <div data-card=${c.app} ?hidden=${failed.has(c.app)}></div>
                      </ui-surface>`,
                    )}
                  </div>`
                : ''}`}
          <div>
            <ui-button kind="tertiary" @click=${() => ctx.notify({ title: 'This is a test notification', body: 'Sent from Home', needsYou: true })}>Send a test notification</ui-button>
          </div>
        </div>`,
        el,
      );
      mountTiles();
    };

    const offState = ctx.bus.on<HomeState>(HOME_CHANNEL.state, (next) => {
      state = next;
      draw();
    });
    // A shell that doesn't answer (an older one) leaves Home a greeting.
    const patience = setTimeout(() => {
      if (state) return;
      state = { needs: [], cards: [] };
      draw();
    }, PATIENCE_MS);
    views.set(el, () => {
      offState();
      clearTimeout(patience);
      for (const tile of tiles.values()) ctx.bus.emit(HOME_CHANNEL.unmountCard, { el: tile });
      tiles.clear();
    });
    draw();
    ctx.bus.emit(HOME_CHANNEL.ready, {});
  },
  unmount(el: HTMLElement) {
    views.get(el)?.();
    views.delete(el);
    render(html``, el);
  },
});
