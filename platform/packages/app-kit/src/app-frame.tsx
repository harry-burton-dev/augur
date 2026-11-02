import { createContext, useContext, useEffect, useRef, useState, type ReactNode } from 'react';
import { cx, Icon, IconButton, type IconName } from '@augur/kit-common';
import { FocusStage, type Depth } from './focus.js';
import { RingProvider, type RingShape } from './radial-menu.js';

/** Where the person's choice to fold the rail or the drawer is kept, on this device. */
const KEPT = { rail: 'augur-app-frame:rail-closed', drawer: 'augur-app-frame:drawer-closed' };

const remembered = (key: string) => {
  try {
    return localStorage.getItem(key) === '1';
  } catch {
    return false;
  }
};
const remember = (key: string, closed: boolean) => {
  try {
    localStorage.setItem(key, closed ? '1' : '0');
  } catch {
    // Private windows and blocked storage: the choice lasts until the page closes.
  }
};

/** Whether the rail is folded, for the parts inside it (RailLink shows only its icon). */
export const RailFolded = createContext(false);

export interface AppFrameProps {
  /** The app's name and icon at the top of the rail. Pressing them opens the app's front page. */
  app: { name: string; icon: IconName };
  /** Open the front page. */
  onFront?: () => void;
  /** The app's sections: RailLinks, and at most one action. */
  rail?: ReactNode;
  /** What the rail is, read aloud ("Libraries"). */
  railLabel?: string;
  /** About what's on screen: its details, who owns it, what's inside it. */
  drawer?: ReactNode;
  drawerLabel?: string;
  /** Beside the main column: line of sight, references. */
  aside?: ReactNode;
  /** How wide the main column may get: `wide` (default), `read`, or `full` for a graph or map. */
  measure?: 'wide' | 'read' | 'full';
  /** Loading or saving: the main column is marked busy and dims a little. */
  busy?: boolean;
  /** Which screen is showing. A new value fades the main column in and turns the drawer with it. */
  screen?: string;
  /** How the app goes out of focus behind a dialog, the radial menu or the palette (PDR-010). `veil` by default. */
  depth?: Depth;
  /** How the radial menu lays out its actions: `auto` (a ring, a list past eight) by default. */
  ringShape?: RingShape;
  children: ReactNode;
}

/**
 * An app's page, in three columns with one job each (docs/app-patterns.md):
 * the rail says where you can go, the main column shows what's here, and the
 * drawer says more about it. The rail and the drawer fold to a strip of icons,
 * and the frame remembers that on this device. The shell's bar stays the only
 * bar, so the frame has no header of its own. Whenever the drawer opens, folds
 * or goes, the frame fires `ui-drawer` on the window with the width it takes,
 * so the shell keeps its floor gauge clear of it.
 *
 * The frame is a focus stage (PDR-010): a dialog, the palette or the radial
 * menu racks it out of focus rather than covering it with a scrim. It holds
 * the app's one radial menu, so anything inside can open it with
 * `useRingTarget`.
 */
export function AppFrame({ app, onFront, rail, railLabel = 'Sections', drawer, drawerLabel = 'Details', aside, measure = 'wide', busy, screen, depth, ringShape, children }: AppFrameProps) {
  const [railClosed, setRailClosed] = useState(() => remembered(KEPT.rail));
  const [drawerClosed, setDrawerClosed] = useState(() => remembered(KEPT.drawer));
  const [turning, setTurning] = useState(false);
  const first = useRef(true);
  const frame = useRef<HTMLDivElement>(null);

  // The first screen just appears; each one after it turns: out at once, then back in on the next frame.
  useEffect(() => {
    if (first.current) {
      first.current = false;
      return;
    }
    setTurning(true);
    const t = setTimeout(() => setTurning(false), 40);
    return () => clearTimeout(t);
  }, [screen]);

  useEffect(() => {
    const el = frame.current;
    const wide = typeof window.matchMedia === 'function' && window.matchMedia('(min-width: 961px)').matches;
    const inset = drawer && el && wide ? parseFloat(getComputedStyle(el).getPropertyValue('--frame-drawer')) || 0 : 0;
    window.dispatchEvent(new CustomEvent('ui-drawer', { detail: { inset } }));
    // Only when the drawer comes, goes or folds.
  }, [Boolean(drawer), drawerClosed]);
  // Gone with the app: the shell has the whole edge back.
  useEffect(() => () => void window.dispatchEvent(new CustomEvent('ui-drawer', { detail: { inset: 0 } })), []);

  const fold = (which: 'rail' | 'drawer') => {
    if (which === 'rail') {
      remember(KEPT.rail, !railClosed);
      setRailClosed(!railClosed);
    } else {
      remember(KEPT.drawer, !drawerClosed);
      setDrawerClosed(!drawerClosed);
    }
  };

  return (
    <FocusStage depth={depth}>
      <RingProvider shape={ringShape}>
        <div
          ref={frame}
          className="quill-frame"
          data-rail={rail ? (railClosed ? 'closed' : 'open') : undefined}
          data-drawer={drawer ? (drawerClosed ? 'closed' : 'open') : undefined}
          data-measure={measure}
          data-turning={turning || undefined}
        >
          {rail ? (
            <nav className="quill-rail" aria-label={railLabel}>
              <div className="quill-rail-head">
                <button type="button" className="quill-app" onClick={onFront} aria-label={railClosed ? `${app.name}, front page` : undefined}>
                  <Icon name={app.icon} size={20} />
                  {railClosed ? null : <span>{app.name}</span>}
                </button>
                <IconButton size="sm" icon={railClosed ? 'rail-open' : 'rail-close'} label={railClosed ? `Show ${railLabel}` : `Hide ${railLabel}`} onPress={() => fold('rail')} aria-expanded={!railClosed} />
              </div>
              <RailFolded.Provider value={railClosed}>
                <div className="quill-rail-body">{rail}</div>
              </RailFolded.Provider>
            </nav>
          ) : null}
          <main className="quill-main" aria-busy={busy || undefined}>
            <div className={cx('quill-page', aside ? 'quill-page-aside' : undefined)} data-busy={busy || undefined}>
              <div className="quill-column">{children}</div>
              {aside ? <aside className="quill-column quill-aside">{aside}</aside> : null}
            </div>
          </main>
          {drawer ? (
            <div className="quill-drawer" role="complementary" aria-label={drawerLabel}>
              <div className="quill-drawer-head">
                <IconButton size="sm" icon={drawerClosed ? 'drawer-open' : 'drawer-close'} label={drawerClosed ? `Show ${drawerLabel}` : `Hide ${drawerLabel}`} onPress={() => fold('drawer')} aria-expanded={!drawerClosed} />
              </div>
              <div className="quill-drawer-inner" inert={drawerClosed || undefined}>
                {drawer}
              </div>
            </div>
          ) : null}
        </div>
      </RingProvider>
    </FocusStage>
  );
}

export interface RailLinkProps {
  icon: IconName;
  label: string;
  /** The screen showing now. */
  current?: boolean;
  /** How many need you there. */
  count?: number;
  onPress: () => void;
}

/** One of the app's sections in its rail. Folded, it shows only its icon, with its name on hover and focus. */
export function RailLink({ icon, label, current, count, onPress }: RailLinkProps) {
  const folded = useContext(RailFolded);
  return (
    <button type="button" className="quill-rail-link" aria-current={current ? 'page' : undefined} aria-label={folded ? label : undefined} title={folded ? label : undefined} onClick={onPress}>
      <Icon name={icon} size={18} />
      {folded ? null : <span className="quill-rail-label">{label}</span>}
      {count ? <span className="quill-rail-count">{count}</span> : null}
    </button>
  );
}
