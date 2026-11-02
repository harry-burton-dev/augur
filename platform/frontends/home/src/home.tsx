import { useEffect, useRef, useState } from 'react';
import type { MountContext } from '@augur/mfe-sdk';
import { Button, Cards, Heading, Icon, List, State, Surface, type IconName, type ListItem } from '@augur/app-kit';

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

/** How long ago, as the stream says it: "now", "4 min", "3 h", "2 d". */
export const ago = (time: string | number, now = Date.now()) => {
  const s = Math.max(0, (now - (typeof time === 'number' ? time : Date.parse(time))) / 1000);
  if (s < 60) return 'now';
  if (s < 3600) return `${Math.floor(s / 60)} min`;
  if (s < 86400) return `${Math.floor(s / 3600)} h`;
  return `${Math.floor(s / 86400)} d`;
};

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

/** One app's glance card: the shell mounts the app's own surface into it, and says when it can't. */
function CardTile({ card, ctx }: { card: HomeCard; ctx: MountContext }) {
  const tile = useRef<HTMLDivElement>(null);
  const [failed, setFailed] = useState(false);
  useEffect(() => {
    const el = tile.current!;
    let live = true;
    ctx.bus.emit(HOME_CHANNEL.mountCard, { el, app: card.app, done: (shown: boolean) => live && setFailed(!shown) });
    return () => {
      live = false;
      ctx.bus.emit(HOME_CHANNEL.unmountCard, { el });
    };
  }, [card.app, ctx.bus]);
  return (
    <Surface kind="pane" pad className="flex flex-col gap-3">
      <div className="flex items-center gap-2 text-meta text-ink-muted">
        <Icon name={(card.icon ?? 'apps') as IconName} size={16} />
        <span>{card.name}</span>
      </div>
      {failed ? <State kind="error" size="line" heading={`${card.name} couldn’t show this right now.`} /> : null}
      <div ref={tile} data-card={card.app} hidden={failed} />
    </Surface>
  );
}

export function Home({ ctx }: { ctx: MountContext }) {
  const first = ctx.user.name.split(' ')[0];
  // The floor's name over the greeting, except on the person's own. A shell older than SDK 1.1 sends no floor.
  const floor = ctx.workspace?.kind === 'personal' ? '' : (ctx.workspace?.name ?? '');
  const [state, setState] = useState<HomeState | null>(null);

  useEffect(() => {
    const off = ctx.bus.on<HomeState>(HOME_CHANNEL.state, setState);
    // A shell that doesn't answer (an older one) leaves Home a greeting.
    const patience = setTimeout(() => setState((s) => s ?? { needs: [], cards: [] }), PATIENCE_MS);
    ctx.bus.emit(HOME_CHANNEL.ready, {});
    return () => {
      off();
      clearTimeout(patience);
    };
  }, [ctx.bus]);

  const needs = state?.needs ?? [];
  const cards = state?.cards ?? [];
  const nothing = state && !needs.length && !cards.length;
  return (
    <div className="mx-auto flex max-w-wide flex-col gap-6 px-edge py-7">
      <Heading eyebrow={floor || undefined} heading={`${greeting(new Date().getHours())}, ${first}`} summary={state && !nothing ? needsWords(needs.length) : undefined} level={1} size="l" />
      {nothing ? (
        <State heading="Nothing needs you right now." />
      ) : (
        <>
          {needs.length || !state ? (
            <Surface kind="pane">
              <List
                label="What needs you"
                noun={['thing', 'things']}
                items={needs.map((n) => toItem(n, Date.now()))}
                loading={!state}
                empty="Nothing needs you right now."
                onOpen={(item) => ctx.bus.emit(HOME_CHANNEL.open, { id: item.id })}
                onAction={(item, action) => ctx.bus.emit(HOME_CHANNEL.act, { id: item.id, index: Number(action.id) })}
              />
            </Surface>
          ) : null}
          {cards.length ? (
            <Cards>
              {cards.map((c) => (
                <CardTile key={c.app} card={c} ctx={ctx} />
              ))}
            </Cards>
          ) : null}
        </>
      )}
      <div>
        <Button kind="tertiary" onPress={() => ctx.notify({ title: 'This is a test notification', body: 'Sent from Home', needsYou: true })}>
          Send a test notification
        </Button>
      </div>
    </div>
  );
}
