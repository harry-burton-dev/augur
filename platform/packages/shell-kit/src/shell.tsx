import { useEffect, useLayoutEffect, useRef, useSyncExternalStore, type CSSProperties, type KeyboardEvent as ReactKeyboardEvent, type ReactNode, type RefObject } from 'react';
import { Icon, IconButton, Menu } from '@augur/kit-common';
import { floorIconOf, floorKindOf, floorLevel, floorMeaning, floorStack, floorTone } from './floors.js';
import { Water } from './water.js';
import { agentUrgency, ago, streamWords, type AgentStatus, type ShellFindResult, type ShellModel, type ShellNotification } from './shell-model.js';

export interface ShellProps {
  /** What the Shell knows and does; the host keeps it and listens on it. */
  model: ShellModel;
  /** The stage: the app that's open, or Title or Orbit. */
  children?: ReactNode;
}

/** The root element, carrying its model, so a test or a tool can reach it as the Lit element's own fields. */
export type ShellElement = HTMLDivElement & { shell?: ShellModel };

const isTyping = (e: Event) => {
  const el = e.composedPath()[0] as HTMLElement | undefined;
  return !!el && (el.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(el.tagName));
};

const agentWords: Record<AgentStatus, string> = { needs: 'Needs you', failed: 'Failed', running: 'Running', waiting: 'Waiting', done: 'Done', idle: 'Idle' };

/**
 * The frame every app runs inside (Aerie, ADR 0015). It holds who you are,
 * the floor you're on, system status, the apps and the notification stream,
 * and nothing about any app's domain. Apps go in its children (the stage).
 *
 * Summoned with ` or Ctrl/⌘ K, the handle or the status, it is like looking
 * up: the app tips away below and the functions sit on a shallow arc with
 * the stream at its top. Esc goes back a step, then closes. It draws a
 * `ShellModel`; the host sets what it knows on the model and listens to it.
 */
export function Shell({ model, children }: ShellProps) {
  useSyncExternalStore(model.subscribe, model.getRevision, model.getRevision);
  const root = useRef<ShellElement>(null);
  const ground = useRef<HTMLDivElement>(null);
  const stage = useRef<HTMLDivElement>(null);
  const place = useRef<HTMLElement>(null);
  const water = useRef<Water | null>(null);

  const here = model.currentFloor;
  const background = model.background;

  // The water: on unless the screen asks for the still ground, in its floor's colours and height.
  useLayoutEffect(() => {
    const host = ground.current;
    if (!host || !background || background === 'none') {
      water.current?.destroy();
      water.current = null;
      host?.replaceChildren();
      return;
    }
    water.current ??= new Water(host);
    let colors: { navy: string; green: string } | undefined;
    if (here && here.kind !== 'personal' && root.current) {
      const cs = getComputedStyle(root.current);
      const tone = floorTone(here);
      const navy = cs.getPropertyValue(`--floor-${tone}-low`).trim();
      const green = cs.getPropertyValue(`--floor-${tone}-high`).trim();
      colors = navy && green ? { navy, green } : undefined;
    }
    water.current.set({ preset: background, colors, level: here ? floorLevel[here.kind] : 0 });
  }, [background, here]);

  useEffect(() => () => water.current?.destroy(), []);

  // Every draw hands the model what it moves and focuses.
  useLayoutEffect(() => {
    if (root.current) root.current.shell = model;
    model.drawn({ root: root.current, stage: stage.current, place: place.current, water: water.current });
  });

  useEffect(() => {
    const onWindowKey = (e: KeyboardEvent) => {
      const summon = (e.key === '`' && !e.ctrlKey && !e.metaKey && !e.altKey && !isTyping(e)) || ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k');
      if (summon) {
        e.preventDefault();
        model.toggle();
        return;
      }
      // Page Up and Page Down scroll the app first; at its top or bottom they go up or down a floor. With Alt they always do.
      if ((e.key === 'PageUp' || e.key === 'PageDown') && model.floors.length && !model.isOpen && !e.defaultPrevented && !isTyping(e)) {
        const up = e.key === 'PageUp';
        const box = stage.current;
        const atEnd = !box || (up ? box.scrollTop <= 0 : box.scrollTop + box.clientHeight >= box.scrollHeight - 1);
        if ((e.altKey || atEnd) && model.moveFloor(up ? 'up' : 'down')) e.preventDefault();
      }
    };
    // An app's drawer took (or gave back) the right edge: the floor gauge moves to stay just left of it.
    const onDrawer = (e: Event) => (model.drawerInset = Math.max(0, (e as CustomEvent<{ inset?: number }>).detail?.inset ?? 0));
    const ends = ['keydown', 'pointerdown', 'wheel'] as const;
    window.addEventListener('keydown', onWindowKey);
    window.addEventListener('ui-drawer', onDrawer);
    for (const type of ends) window.addEventListener(type, model.endCard, { capture: true, passive: true });
    const clock = setInterval(() => {
      model.now = Date.now();
      model.requestUpdate();
    }, 30_000);
    return () => {
      window.removeEventListener('keydown', onWindowKey);
      window.removeEventListener('ui-drawer', onDrawer);
      for (const type of ends) window.removeEventListener(type, model.endCard, { capture: true });
      clearInterval(clock);
      model.stop();
    };
  }, [model]);

  const mood = model.mood;
  const cap = model.caption();
  const capMood = !model.view || model.view === 'stream' ? mood : 'quiet';
  const tab = model.isOpen ? -1 : 0;

  const onSkyKey = (e: ReactKeyboardEvent<HTMLDivElement>) => {
    if (e.key === 'Escape') {
      e.preventDefault();
      if (model.view === 'find' && model.query) {
        model.query = '';
        model.requestUpdate();
      } else if (model.view) model.closeView();
      else model.close();
      return;
    }
    if (e.key === 'Tab') {
      const items = [...e.currentTarget.querySelectorAll<HTMLElement>('button:not([disabled]), input, [tabindex="0"]')].filter((el) => !el.closest('[inert]'));
      if (!items.length) return;
      const at = items.indexOf(document.activeElement as HTMLElement);
      const next = e.shiftKey ? (at <= 0 ? items.length - 1 : at - 1) : at === items.length - 1 ? 0 : at + 1;
      if (at === -1 || (e.shiftKey && at === 0) || (!e.shiftKey && at === items.length - 1)) {
        e.preventDefault();
        items[next]!.focus();
      }
      return;
    }
    if (model.view) return;
    if (e.key === 'ArrowRight' || e.key === 'ArrowLeft') {
      e.preventDefault();
      model.focusDome(model.focusIndex + (e.key === 'ArrowRight' ? 1 : -1));
    }
  };

  return (
    <div
      ref={root}
      className="aerie-shell"
      data-shell=""
      data-open={model.isOpen ? '' : undefined}
      data-arriving={model.arriving ? '' : undefined}
      data-floor-kind={here?.kind}
      data-floor-tone={here ? floorTone(here) : undefined}
      data-background={background}
      data-view={model.view}
      style={{ '--app-drawer-inset': `${model.drawerInset}px` } as CSSProperties}
    >
      <div className="aerie-ground">
        <div ref={ground} className="aerie-water" />
      </div>
      <Band model={model} tab={tab} mood={mood} place={place} />
      <Gauge model={model} tab={tab} />
      {model.card ? (
        <div className={`aerie-card aerie-${model.card.kind}`} aria-hidden="true">
          {model.card.kick ? <span className="aerie-kick">{model.card.kick}</span> : null}
          <p className="aerie-name">{model.card.name}</p>
          {model.card.line ? <span className="aerie-line">{model.card.line}</span> : null}
        </div>
      ) : null}
      <div ref={stage} className="aerie-stage">
        {children}
      </div>
      <div
        className={`aerie-sky aerie-${mood}`}
        role="dialog"
        aria-modal="true"
        aria-label="Shell"
        aria-hidden={model.isOpen ? 'false' : 'true'}
        inert={!model.isOpen}
        onKeyDown={onSkyKey}
        onClick={(e) => (e.target as HTMLElement).classList?.contains('aerie-fade') && (model.view ? model.closeView() : model.close())}
      >
        <div className="aerie-fade" />
        <div className="aerie-stars" />
        <Dome model={model} mood={mood} />
        {model.view && model.view !== 'stream' ? (
          <p className="aerie-caption">
            <b>{cap.title}</b>
          </p>
        ) : (
          <p className={`aerie-caption aerie-${capMood}`}>
            <b>{cap.title}</b>
            {cap.line ? <span>{cap.line}</span> : null}
          </p>
        )}
        {model.view ? (
          <section className="aerie-view" aria-label={cap.title}>
            <View model={model} />
          </section>
        ) : null}
        {model.undo ? (
          <div className="aerie-undo" role="status">
            {model.undo.label}
            <button className="aerie-link" onClick={() => model.restore()}>
              Undo
            </button>
          </div>
        ) : null}
        <button className="aerie-esc" tabIndex={-1} onClick={() => (model.view ? model.closeView() : model.close())}>
          <kbd>Esc</kbd>
          {model.view ? 'Back' : 'Close'}
        </button>
      </div>
      <div className="aerie-live" aria-live="polite">
        {model.isOpen ? `${cap.title}. ${cap.line}` : model.said}
      </div>
    </div>
  );
}

function Band({ model, tab, mood, place }: { model: ShellModel; tab: number; mood: string; place: RefObject<HTMLElement | null> }) {
  const words = model.statusLabel || (model.online ? streamWords(model.heard) : 'Offline');
  const time = new Date(model.now).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  const here = model.currentFloor;
  const app = model.openNow;
  return (
    <header className="aerie-band" inert={model.isOpen}>
      <div className="aerie-left">
        {here ? (
          <p
            className="aerie-where"
            aria-label={`You’re on ${here.kind === 'personal' ? 'your own floor' : here.kind === 'team' ? `${here.name}, a ${floorKindOf(here).toLowerCase()}` : here.name}`}
          >
            <Icon name={floorIconOf(here)} size={16} />
            <b aria-hidden="true">{here.name}</b>
          </p>
        ) : (
          <div className="aerie-mark">
            <b>{model.product}</b>
            {model.workspace ? <span>{model.workspace}</span> : null}
          </div>
        )}
        {model.navs.length ? (
          <nav className="aerie-navs" aria-label="Go to">
            {model.navs.map((n) => (
              <button
                key={n.id}
                className="aerie-nav"
                tabIndex={tab}
                aria-label={n.unavailable ? `${n.label}. ${n.unavailable}` : n.current ? `${n.label}, you’re here` : n.label}
                title={n.unavailable ?? n.label}
                aria-current={n.current ? 'page' : undefined}
                aria-disabled={n.unavailable ? 'true' : undefined}
                onClick={() => !n.unavailable && !n.current && model.emit('ui-nav', { id: n.id })}
              >
                <Icon name={n.icon} size={16} />
              </button>
            ))}
          </nav>
        ) : null}
        {model.backTo ? (
          <button className="aerie-back" tabIndex={tab} aria-label={`Back to ${model.backTo}`} onClick={() => model.emit('ui-back', {})}>
            <Icon name="back" size={16} />
            <span>Back</span>
          </button>
        ) : null}
      </div>
      <button className="aerie-handle" aria-label="Open the shell" tabIndex={tab} onClick={() => model.open()}>
        <i />
      </button>
      {app ? (
        <p className="aerie-place">
          <b ref={place}>{app.name}</b>
          {model.area ? <span>{model.area}</span> : null}
        </p>
      ) : null}
      <div className="aerie-right">
        <button className={`aerie-status aerie-${mood}`} tabIndex={tab} aria-label={`${words}. Open notifications.`} onClick={() => model.openView('stream')}>
          <i className="aerie-point" />
          {words}
        </button>
        <span className="aerie-clock">{time}</span>
      </div>
    </header>
  );
}

/**
 * The edge gauge: one notch per floor from yours to the org, the one you're
 * on lit in its colour, with a dot where something waits and the open app
 * pinned beside it. Pointing at it or tabbing into it opens it out: each
 * floor's name and who sees what's on it, and which floor the app is showing.
 */
function Gauge({ model, tab }: { model: ShellModel; tab: number }) {
  if (!model.currentFloor) return null;
  const stack = floorStack(model.floors, model.floor, model.lastTeam).reverse();
  const waiting = model.waitingByFloor();
  const app = model.openNow;
  const rest = model.floorsRest;
  return (
    <nav className={`aerie-gauge${rest ? ' aerie-rest' : ''}`} aria-label="Floors" inert={model.isOpen}>
      {rest ? (
        <p className="aerie-why" id="floors-rest">
          <span>{rest}, so moving floors wouldn’t change it.</span>
        </p>
      ) : null}
      <ol>
        {stack.map((f) => {
          const count = waiting.get(f.id) ?? 0;
          const name = f.kind === 'personal' ? 'Your own floor' : f.name;
          const here = f.id === model.floor;
          return (
            <li key={f.id}>
              <button
                tabIndex={tab}
                aria-label={[name, here ? 'you’re here' : '', count ? `${count} waiting` : ''].filter(Boolean).join(', ')}
                aria-describedby={rest ? `floors-rest floor-${f.id}` : `floor-${f.id}`}
                aria-current={here ? 'location' : undefined}
                aria-disabled={rest && !here ? 'true' : undefined}
                data-waiting={count > 0 ? '' : undefined}
                onClick={() => !rest && model.goToFloor(f.id)}
              >
                <span className="aerie-label" id={`floor-${f.id}`}>
                  <span>
                    <b>
                      {name} {here ? <em>You’re here</em> : count ? <em className="aerie-waiting">{count} waiting</em> : null}
                    </b>
                    <span>
                      {f.kind === 'team' ? `${floorKindOf(f)}. ` : ''}
                      {floorMeaning(f)}
                    </span>
                    {here && app && !rest ? (
                      <span className="aerie-bound">
                        <Icon name={app.icon ?? 'apps'} size={14} />
                        {app.name} is showing this floor
                      </span>
                    ) : null}
                  </span>
                </span>
                {here && app ? (
                  <span className="aerie-pinned" aria-hidden="true">
                    <Icon name={app.icon ?? 'apps'} size={12} />
                  </span>
                ) : null}
                <span className="aerie-notch">
                  <Icon name={floorIconOf(f)} size={14} />
                  {count ? <span className="aerie-dot" /> : null}
                </span>
              </button>
            </li>
          );
        })}
      </ol>
    </nav>
  );
}

function Dome({ model, mood }: { model: ShellModel; mood: string }) {
  return (
    <div className="aerie-dome">
      {model.order.map((id, i) => {
        const slot = model.arcSlot(i);
        const style = { '--x': `calc(${slot} * min(112px, 15vw))`, '--y': `${Math.round(slot * slot * 10)}px`, '--i': Math.abs(i - model.streamSlot) } as CSSProperties;
        const lit = model.view === id;
        const tabIndex = i === model.focusIndex ? 0 : -1;
        const onFocus = () => (model.focusIndex = i);
        if (id === 'stream') {
          return (
            <button
              key={id}
              className={`aerie-stream${lit ? ' aerie-lit' : ''}`}
              style={style}
              tabIndex={tabIndex}
              aria-label={`Notifications: ${model.online ? streamWords(model.heard) : 'offline'}`}
              onFocus={onFocus}
              onClick={() => model.openView('stream')}
            >
              <span className="aerie-thread" />
              <span className={`aerie-orb aerie-${mood}`}>
                <i />
              </span>
            </button>
          );
        }
        const fn = model.functions.find((f) => f.id === id);
        if (!fn) return null;
        return (
          <button key={id} className={`aerie-fn${lit ? ' aerie-lit' : ''}`} style={style} tabIndex={tabIndex} aria-label={fn.label} onFocus={onFocus} onClick={() => model.openView(fn.id)}>
            <Icon name={fn.icon} />
          </button>
        );
      })}
    </div>
  );
}

function View({ model }: { model: ShellModel }) {
  switch (model.view) {
    case 'stream':
      return <Stream model={model} />;
    case 'apps':
      return <Apps model={model} />;
    case 'find':
      return <Find model={model} />;
    case 'agents':
      return <Agents model={model} />;
    case 'account':
      return <Account model={model} />;
    case 'settings':
      return <Settings model={model} />;
    default:
      return null;
  }
}

function Stream({ model }: { model: ShellModel }) {
  if (model.streamLoading) {
    return (
      <>
        <p className="aerie-note" aria-busy="true">
          Catching up…
        </p>
        <span className="aerie-skel" />
        <span className="aerie-skel" />
      </>
    );
  }
  if (model.streamError) {
    return (
      <>
        <p className="aerie-note aerie-error" role="alert">
          {model.streamError}
        </p>
        <button className="aerie-retry" data-first="" onClick={() => model.emit('ui-retry', { what: 'stream' })}>
          Try again
        </button>
      </>
    );
  }
  const list = model.notifications;
  if (!list.length) {
    return (
      <p className="aerie-note" tabIndex={0} data-first="">
        All quiet. Nothing needs you.
      </p>
    );
  }
  const groups = model.streamGroups();
  // The first thing that needs you pings; the rest are a still green. Muted apps never ping.
  const pinging = groups.find((g) => !g.muted && g.needs)?.list.find((n) => n.level === 'needs')?.id;
  const firstId = groups[0]?.list[0]?.id;
  return (
    <>
      {list.some((n) => n.level !== 'needs') ? (
        <div className="aerie-tools">
          <button className="aerie-link" onClick={() => model.clear()}>
            Clear the quiet ones
          </button>
        </div>
      ) : null}
      {groups.map(({ app, list: g, muted, needs }) => {
        const name = model.appName(app);
        return (
          <div key={app}>
            <div className={`aerie-group aerie-label${needs && !muted ? ' aerie-needs' : ''}`}>
              <span className="aerie-name">
                {name} <b>{g.length}</b>
                {muted ? <span className="aerie-quiet">Muted</span> : null}
              </span>
              <Menu
                label="App notifications"
                placement="bottom end"
                items={[muted ? { id: 'unmute', label: `Unmute ${name}`, icon: 'bell' } : { id: 'mute', label: `Mute ${name}`, icon: 'mute' }]}
                onAction={(id) => model.setMuted(app, id === 'mute')}
              >
                <IconButton icon="more" label={`${name}: more`} size="sm" />
              </Menu>
            </div>
            <ul aria-label={name}>
              {g.map((n) => (
                <Row key={n.id} model={model} n={n} muted={muted} first={n.id === firstId} pinging={n.id === pinging} />
              ))}
            </ul>
          </div>
        );
      })}
    </>
  );
}

function Row({ model, n, muted, first, pinging }: { model: ShellModel; n: ShellNotification; muted: boolean; first: boolean; pinging: boolean }) {
  const actions = (n.actions ?? []).slice(0, 2);
  return (
    <li className={`aerie-item${muted ? ' aerie-muted' : ''}`}>
      <button
        className={`aerie-row aerie-${n.level}${pinging ? ' aerie-first' : ''}`}
        data-first={first ? '' : undefined}
        onClick={() => model.openNotification(n)}
        onKeyDown={(e) => {
          if (e.key.toLowerCase() !== 'x') return;
          e.preventDefault();
          model.dismiss(n.id);
        }}
      >
        <span className="aerie-lead" />
        <span className="aerie-text">
          <b>{n.title}</b>
          <span>{[model.floorTag(n), n.detail].filter(Boolean).join(' · ')}</span>
        </span>
        <span className="aerie-meta">{ago(n.time, model.now)}</span>
      </button>
      {actions.map((a, i) => (
        <button key={a.label} className={`aerie-act${i === 0 && n.level === 'needs' ? ' aerie-main' : ''}`} onClick={() => model.actOn(n, i)}>
          {a.label}
        </button>
      ))}
      <button className="aerie-x" aria-label={`Dismiss ${n.title}`} onClick={() => model.dismiss(n.id)}>
        <Icon name="close" size={16} />
      </button>
    </li>
  );
}

function Apps({ model }: { model: ShellModel }) {
  const byId = new Map(model.apps.map((a) => [a.id, a]));
  const current = model.current;
  const ordered = [
    ...(current && byId.has(current) ? [current] : []),
    ...model.recent.filter((id) => id !== current && byId.has(id)),
    ...model.apps.map((a) => a.id).filter((id) => id !== current && !model.recent.includes(id)),
  ].map((id) => byId.get(id)!);
  if (!ordered.length) return <p className="aerie-note">No apps yet.</p>;
  const moveInGrid = (e: ReactKeyboardEvent<HTMLButtonElement>) => {
    const step = e.key === 'ArrowRight' ? 1 : e.key === 'ArrowLeft' ? -1 : 0;
    if (!step) return;
    e.preventDefault();
    e.stopPropagation();
    const items = [...(e.currentTarget.parentElement?.querySelectorAll<HTMLElement>('.aerie-app') ?? [])];
    const at = items.indexOf(e.currentTarget);
    items[(at + step + items.length) % items.length]?.focus();
  };
  return (
    <div className="aerie-apps" role="list">
      {ordered.map((a, i) => (
        <button key={a.id} className="aerie-app" role="listitem" data-first={i === 0 ? '' : undefined} onClick={() => model.openApp(a.id)} onKeyDown={moveInGrid}>
          {a.ai ? (
            <span className="aerie-bubble">
              <Icon name={a.icon ?? 'apps'} size={28} />
            </span>
          ) : (
            <Icon name={a.icon ?? 'apps'} size={32} />
          )}
          <b>{a.name}</b>
          {a.id === current ? <em>Open now</em> : a.line ? <span>{a.line}</span> : null}
        </button>
      ))}
    </div>
  );
}

const findSaid = { looking: 'Still looking…', late: 'Didn’t answer in time.', failed: 'Couldn’t search right now.' } as const;

function Find({ model }: { model: ShellModel }) {
  const q = model.query;
  const loose = q ? [...model.findLocal(q), ...model.findResults.filter((r) => !r.group)] : [];
  const grouped = q ? model.findGroups : [];
  const inGroup = (name: string) => model.findResults.filter((r) => r.group === name);
  const results = [...loose, ...grouped.flatMap((g) => inGroup(g.name))];
  const waiting = grouped.some((g) => g.state === 'looking');
  const row = (r: ShellFindResult) => (
    <li key={`${r.kind}:${r.id}`}>
      <button className="aerie-row" onClick={() => model.pick(r)}>
        <span className="aerie-text">
          <b>{r.title}</b>
          <span>{r.detail ?? r.kind}</span>
        </span>
      </button>
    </li>
  );
  return (
    <>
      <div className="aerie-search">
        <Icon name="find" size={20} />
        <input
          type="search"
          aria-label="Find across apps, notifications and agents"
          placeholder="Find apps, notifications, agents…"
          value={q}
          onChange={(e) => model.setQuery(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && results[0] && model.pick(results[0])}
        />
      </div>
      {q && !results.length && !waiting ? <p className="aerie-note">Nothing matches "{q}".</p> : null}
      <ul>{loose.map(row)}</ul>
      {grouped.map((g) => {
        const found = inGroup(g.name);
        if (!found.length && g.state === 'done') return null;
        return (
          <div key={g.name}>
            <div className="aerie-group aerie-label">
              {g.name}
              {found.length ? (
                <>
                  {' '}
                  <b>{found.length}</b>
                </>
              ) : null}
            </div>
            {found.length ? (
              <ul aria-label={g.name}>{found.map(row)}</ul>
            ) : (
              <p className={`aerie-note aerie-small aerie-${g.state}`} aria-busy={g.state === 'looking' ? 'true' : undefined}>
                {findSaid[g.state as keyof typeof findSaid]}
              </p>
            )}
          </div>
        );
      })}
      <div className="aerie-live" aria-live="polite">
        {q && !waiting ? `${results.length} found` : ''}
      </div>
    </>
  );
}

function Agents({ model }: { model: ShellModel }) {
  if (model.agentsLoading) {
    return (
      <>
        <p className="aerie-note" aria-busy="true">
          Catching up…
        </p>
        <span className="aerie-skel" />
      </>
    );
  }
  if (model.agentsError) {
    return (
      <>
        <p className="aerie-note aerie-error" role="alert">
          {model.agentsError}
        </p>
        <button className="aerie-retry" onClick={() => model.emit('ui-retry', { what: 'agents' })}>
          Try again
        </button>
      </>
    );
  }
  if (!model.agents.length) {
    return (
      <p className="aerie-note" tabIndex={0}>
        No agents are running.
      </p>
    );
  }
  const sorted = [...model.agents].sort((a, b) => agentUrgency.indexOf(a.status) - agentUrgency.indexOf(b.status));
  const firstNeeds = sorted.findIndex((a) => a.status === 'needs');
  return (
    <ul>
      {sorted.map((a, i) => (
        <li key={a.id}>
          <button className="aerie-row" onClick={() => (a.app ? model.openApp(a.app) : model.emit('ui-function', { id: `agent:${a.id}` }))}>
            <span className="aerie-text">
              <b>{a.name}</b>
              {a.detail ? <span>{a.detail}</span> : null}
            </span>
            <span className="aerie-agent" data-status={a.status} data-next={i === firstNeeds ? '' : undefined}>
              <i aria-hidden="true">{a.status === 'done' ? <Icon name="check" size={14} /> : a.status === 'failed' ? <Icon name="error" size={14} /> : null}</i>
              {agentWords[a.status] ?? a.status}
            </span>
          </button>
        </li>
      ))}
    </ul>
  );
}

function Switch({ id, on, onToggle }: { id: string; on: boolean; onToggle: () => void }) {
  return <button className="aerie-switch" role="switch" aria-labelledby={id} aria-checked={on ? 'true' : 'false'} onClick={onToggle} />;
}

function Account({ model }: { model: ShellModel }) {
  const here = model.currentFloor;
  const waiting = model.waitingByFloor();
  return (
    <>
      <div className="aerie-who">
        <b>{model.user?.name ?? 'Signed in'}</b>
        {model.user?.email ? <span>{model.user.email}</span> : null}
      </div>
      {here ? (
        <>
          <div className="aerie-group aerie-label">Floors</div>
          <ul className="aerie-floors">
            {model.floors.map((f) => (
              <li key={f.id}>
                <button
                  className="aerie-row"
                  aria-current={f.id === model.floor ? 'location' : undefined}
                  onClick={() => {
                    model.goToFloor(f.id);
                    model.close();
                  }}
                >
                  <Icon name={floorIconOf(f)} />
                  <span className="aerie-text">
                    <b>
                      {f.kind === 'personal' ? 'Your own floor' : f.name}
                      {f.path.length > 1 ? (
                        <i>
                          {' '}
                          in{' '}
                          {f.path
                            .slice(0, -1)
                            .map((p) => p.name)
                            .join(' / ')}
                        </i>
                      ) : null}
                    </b>
                    <span>
                      {f.kind === 'team' ? `${floorKindOf(f)}. ` : ''}
                      {floorMeaning(f)}
                    </span>
                  </span>
                  {f.id === model.floor ? <span className="aerie-meta">You’re here</span> : waiting.get(f.id) ? <span className="aerie-meta">{waiting.get(f.id)} waiting</span> : null}
                </button>
              </li>
            ))}
          </ul>
        </>
      ) : (
        <div className="aerie-pair">
          <span>Workspace</span>
          <b>{model.workspace || '—'}</b>
        </div>
      )}
      <div className="aerie-pair">
        <span id="aerie-away">Show me as away</span>
        <Switch id="aerie-away" on={model.away} onToggle={() => model.setAway(!model.away)} />
      </div>
      <div className="aerie-pair">
        {model.canSwitchWorkspace && !here ? (
          <button className="aerie-link" onClick={() => model.emit('ui-function', { id: 'switch-workspace' })}>
            Switch workspace
          </button>
        ) : (
          <span />
        )}
        <button className="aerie-link" onClick={() => model.emit('ui-function', { id: 'sign-out' })}>
          Sign out
        </button>
      </div>
    </>
  );
}

function Settings({ model }: { model: ShellModel }) {
  const s = model.settings;
  return (
    <>
      <div className="aerie-pair">
        <span id="aerie-rm">Reduce motion</span>
        <Switch id="aerie-rm" on={!!s.reduceMotion} onToggle={() => model.setSetting('reduceMotion', !s.reduceMotion)} />
      </div>
      <div className="aerie-pair">
        <span id="aerie-at">Area titles</span>
        <Switch id="aerie-at" on={s.areaTitles !== false} onToggle={() => model.setSetting('areaTitles', s.areaTitles === false)} />
      </div>
      <div className="aerie-pair">
        <span id="aerie-ts">Toasts for new notifications</span>
        <Switch id="aerie-ts" on={!!s.toasts} onToggle={() => model.setSetting('toasts', !s.toasts)} />
      </div>
      <div className="aerie-pair">
        <span>Density</span>
        <div className="aerie-seg" role="group" aria-label="Density">
          {(['comfortable', 'compact'] as const).map((d) => (
            <button key={d} aria-pressed={(s.density ?? 'comfortable') === d ? 'true' : 'false'} onClick={() => model.setSetting('density', d)}>
              {d[0]!.toUpperCase() + d.slice(1)}
            </button>
          ))}
        </div>
      </div>
      {model.version ? (
        <div className="aerie-pair aerie-version">
          <span>Version</span>
          <b>{model.version}</b>
        </div>
      ) : null}
      <div className="aerie-group aerie-label">Keys</div>
      <div className="aerie-keys">
        <kbd>`</kbd>
        <span>Open or close the shell (also Ctrl or ⌘ K)</span>
        <kbd>← →</kbd>
        <span>Move along the arc</span>
        <kbd>Enter</kbd>
        <span>Open</span>
        <kbd>x</kbd>
        <span>Dismiss a notification</span>
        <kbd>Esc</kbd>
        <span>Back, then close</span>
        {model.floors.length ? (
          <>
            <kbd>PgUp PgDn</kbd>
            <span>Up or down a floor, once the page is at its top or bottom (with Alt, at once)</span>
          </>
        ) : null}
      </div>
    </>
  );
}
