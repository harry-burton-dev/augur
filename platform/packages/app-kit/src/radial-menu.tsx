import { createContext, useCallback, useContext, useEffect, useLayoutEffect, useMemo, useRef, useState, type CSSProperties, type KeyboardEvent, type MouseEvent, type PointerEvent, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { cx, Icon, ms, type IconName } from '@augur/kit-common';
import { useRack, type Hole } from './focus.js';

/** One thing that can be done with what the menu was opened on. */
export interface RingAction {
  id: string;
  label: string;
  icon: IconName;
  /** Destroys or removes something: drawn in the danger colour, and placed last. */
  danger?: boolean;
  /** Can't be done now. It stays in the ring, dimmed, and says why: never leave it out. */
  disabled?: boolean;
  /** Why it can't be done now, and who could: one short sentence. */
  reason?: string;
}

/** How the actions are laid out. */
export type RingShape =
  /** Round the subject: a tile gets a ring round its edge, a row a ring beside where it was opened. */
  | 'ring'
  /** A plain list beside the subject, for long lists or people who prefer one. */
  | 'list'
  /** A ring up to `RING_MOST` actions, a list past that (the default). */
  | 'auto';

/** Past this many a ring gets slow to scan and aim at, so `auto` turns it into a list. */
export const RING_MOST = 8;

/** What the menu is opened on. */
export interface RingSubject {
  /** What it is, read aloud and shown in the middle ("Policy & Guidance"). */
  label: string;
  actions: RingAction[];
  onAction: (id: string) => void;
}

interface Opened extends RingSubject {
  target: HTMLElement;
  /** Where the pointer was, when it was opened by a pointer. */
  point?: { x: number; y: number };
}

interface Ring {
  open: (subject: Opened) => void;
  shape: RingShape;
}

const RingContext = createContext<Ring | null>(null);

export interface RingProviderProps {
  shape?: RingShape;
  children: ReactNode;
}

/**
 * One radial menu for the whole app: whatever is opened with `useRingTarget`
 * shows here. AppFrame puts one in; an app can put its own round a part of
 * the page to change its shape.
 */
export function RingProvider({ shape = 'auto', children }: RingProviderProps) {
  const [opened, setOpened] = useState<Opened | null>(null);
  const ring = useMemo<Ring>(() => ({ open: setOpened, shape }), [shape]);
  return (
    <RingContext.Provider value={ring}>
      {children}
      {opened ? <RadialMenu {...opened} shape={shape} onClose={() => setOpened(null)} /> : null}
    </RingContext.Provider>
  );
}

/** How long a finger stays down before the menu opens, as a right-click does with a mouse. */
const LONG_PRESS = 550;

/**
 * Makes anything open the radial menu: right-click, the context-menu key,
 * Shift+F10, or a long press with a finger or pen. Spread what it returns on
 * the element. `subject` is read when the menu opens, so its actions are
 * always current. Outside a RingProvider it does nothing.
 */
export function useRingTarget(subject: () => RingSubject | undefined) {
  const ring = useContext(RingContext);
  const timer = useRef<ReturnType<typeof setTimeout>>(undefined);
  const latest = useRef(subject);
  latest.current = subject;
  const fired = useRef(false);

  const open = useCallback(
    (target: HTMLElement, point?: { x: number; y: number }) => {
      const s = latest.current();
      if (!ring || !s) return false;
      ring.open({ ...s, target, ...(point ? { point } : {}) });
      return true;
    },
    [ring],
  );

  return {
    onContextMenu: (e: MouseEvent<HTMLElement>) => {
      if (fired.current) {
        e.preventDefault();
        return;
      }
      if (open(e.currentTarget, e.clientX || e.clientY ? { x: e.clientX, y: e.clientY } : undefined)) {
        e.preventDefault();
        e.stopPropagation();
      }
    },
    onKeyDown: (e: KeyboardEvent<HTMLElement>) => {
      if (e.key === 'ContextMenu' || (e.key === 'F10' && e.shiftKey)) {
        if (open(e.currentTarget)) {
          e.preventDefault();
          e.stopPropagation();
        }
      }
    },
    onPointerDown: (e: PointerEvent<HTMLElement>) => {
      fired.current = false;
      if (e.pointerType === 'mouse') return;
      const target = e.currentTarget;
      const point = { x: e.clientX, y: e.clientY };
      clearTimeout(timer.current);
      timer.current = setTimeout(() => {
        fired.current = open(target, point);
      }, LONG_PRESS);
    },
    onPointerUp: () => clearTimeout(timer.current),
    onPointerCancel: () => clearTimeout(timer.current),
    onPointerLeave: () => clearTimeout(timer.current),
    /** A long press opened the menu: the click that follows it shouldn't also open the thing. */
    onClickCapture: (e: MouseEvent<HTMLElement>) => {
      if (fired.current) {
        fired.current = false;
        e.preventDefault();
        e.stopPropagation();
      }
    },
  };
}

/** Danger goes last, so a slip of the arrow keys round the ring never lands on it first. */
const ordered = (actions: RingAction[]) => [...actions.filter((a) => !a.danger), ...actions.filter((a) => a.danger)];

export interface RadialMenuProps extends Opened {
  shape?: RingShape;
  onClose: () => void;
}

const px = (n: number) => `${Math.round(n)}px`;
const num = (el: Element, name: string, fallback: number) => parseFloat(getComputedStyle(el).getPropertyValue(name)) || fallback;

/**
 * The actions of one thing, in a ring round it (PDR-010). The rest of the app
 * racks out of focus and the thing itself stays sharp, ringed as selected, so
 * the menu never covers what it's about. The first action sits at the top and
 * the rest go clockwise; danger comes last. Each action's name sits outside
 * the ring, away from the subject. An action that can't be done stays, dimmed,
 * with its reason, and can still be focused so the reason is read out.
 *
 * Keys: arrows (or Tab) go round, Home and End jump, a letter jumps to the next
 * action starting with it, Enter or Space chooses, Esc closes. Focus goes back
 * to the thing when it closes.
 */
export function RadialMenu({ label, actions, onAction, target, point, shape = 'auto', onClose }: RadialMenuProps) {
  const list = useMemo(() => ordered(actions), [actions]);
  const asList = shape === 'list' || (shape === 'auto' && list.length > RING_MOST);
  const [focused, setFocused] = useState(() => Math.max(0, list.findIndex((a) => !a.disabled)));
  const [box, setBox] = useState<Hole>(() => {
    const r = target.getBoundingClientRect();
    return { x: r.left, y: r.top, width: r.width, height: r.height };
  });
  const [leaving, setLeaving] = useState(false);
  const menu = useRef<HTMLDivElement>(null);
  const items = useRef<(HTMLButtonElement | null)[]>([]);
  useRack(true, box, target);

  // Keep up with the subject if the page scrolls or resizes under the menu.
  useLayoutEffect(() => {
    const measure = () => {
      const r = target.getBoundingClientRect();
      setBox((b) => (b.x === r.left && b.y === r.top && b.width === r.width && b.height === r.height ? b : { x: r.left, y: r.top, width: r.width, height: r.height }));
    };
    window.addEventListener('resize', measure);
    window.addEventListener('scroll', measure, true);
    return () => {
      window.removeEventListener('resize', measure);
      window.removeEventListener('scroll', measure, true);
    };
  }, [target]);

  useEffect(() => {
    items.current[focused]?.focus();
  }, [focused]);

  const close = useCallback(
    (chosen?: RingAction) => {
      if (leaving) return;
      setLeaving(true);
      const done = () => {
        onClose();
        // Outside a stage nothing is inert, so focus can go back now; inside one, the stage gives it back.
        if (target.isConnected && !target.closest('[inert]')) target.focus({ preventScroll: true });
        if (chosen) onAction(chosen.id);
      };
      // Reduced motion leaves nothing to wait for.
      const still = typeof window.matchMedia === 'function' && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
      if (still) done();
      else setTimeout(done, ms('motion-quick'));
    },
    [leaving, onAction, onClose, target],
  );

  useEffect(() => {
    const away = (e: Event) => {
      if (menu.current && !menu.current.contains(e.target as Node)) close();
    };
    document.addEventListener('pointerdown', away, true);
    return () => document.removeEventListener('pointerdown', away, true);
  }, [close]);

  const move = (to: number) => setFocused(((to % list.length) + list.length) % list.length);
  const onKey = (e: KeyboardEvent) => {
    const back = asList ? ['ArrowUp'] : ['ArrowLeft', 'ArrowUp'];
    const next = asList ? ['ArrowDown'] : ['ArrowRight', 'ArrowDown'];
    if (e.key === 'Escape') close();
    else if (next.includes(e.key) || (e.key === 'Tab' && !e.shiftKey)) move(focused + 1);
    else if (back.includes(e.key) || (e.key === 'Tab' && e.shiftKey)) move(focused - 1);
    else if (e.key === 'Home') move(0);
    else if (e.key === 'End') move(list.length - 1);
    else if (e.key.length === 1 && /\S/.test(e.key)) {
      const from = list.findIndex((a, i) => i > focused && a.label.toLowerCase().startsWith(e.key.toLowerCase()));
      const hit = from >= 0 ? from : list.findIndex((a) => a.label.toLowerCase().startsWith(e.key.toLowerCase()));
      if (hit < 0) return;
      move(hit);
    } else return;
    e.preventDefault();
    e.stopPropagation();
  };

  const choose = (a: RingAction) => {
    if (a.disabled) return;
    close(a);
  };

  // Where the ring sits. A tile (as tall as a button and more) gets a whole ring round its edge.
  // A row gets an arc beside its end, opening away from it, so the row and its words stay clear.
  const el = menu.current ?? document.documentElement;
  const gap = num(el, '--ring-gap', 20);
  const size = num(el, '--ring-button', 44);
  const vw = window.innerWidth;
  const vh = window.innerHeight;
  const tile = box.height >= size * 2.5 && box.width <= box.height * 2.5;
  const margin = size;
  let cx0: number;
  let cy0: number;
  let rx: number;
  let ry: number;
  /** The angles the actions sit at, the first at the top, clockwise. */
  let angles: number[];
  /** A row's arc: which side it opens to, the space between buttons and how far it bows. */
  let arc: { right: boolean; pitch: number; bow: number } | undefined;
  if (tile) {
    rx = box.width / 2 + gap + size / 2;
    ry = box.height / 2 + gap + size / 2;
    cx0 = Math.min(Math.max(box.x + box.width / 2, rx + margin), vw - rx - margin);
    cy0 = Math.min(Math.max(box.y + box.height / 2, ry + margin), vh - ry - margin);
    angles = list.map((_, i) => -Math.PI / 2 + (i * 2 * Math.PI) / list.length);
  } else {
    // A shallow arc, like a C, of buttons a target apart, opening away from the row: it never
    // covers the row, and its names never run into each other.
    const pitch = size + gap / 2;
    const half = ((list.length - 1) * pitch) / 2;
    const bow = size / 2;
    const wide = box.width > vw / 3 && point;
    const edge = wide ? point.x : box.x + box.width;
    const right = edge + gap + size + margin * 4 < vw;
    rx = bow;
    ry = half;
    cx0 = right ? edge + gap + size / 2 : (wide ? edge : box.x) - gap - size / 2;
    cy0 = Math.min(Math.max(box.y + box.height / 2, half + margin), vh - half - margin);
    // Not angles here: a position along the arc from -1 (top) to 1 (bottom), turned into x and y below.
    angles = list.map((_, i) => (list.length > 1 ? -1 + (2 * i) / (list.length - 1) : 0));
    arc = { right, pitch, bow };
  }

  const listAt: CSSProperties = {
    left: px(Math.min(box.x + box.width + gap, vw - 320 - gap)),
    top: px(Math.min(Math.max(box.y, gap), vh - list.length * size - gap * 2)),
  };

  return createPortal(
    <div
      ref={menu}
      className="quill-ring"
      data-shape={asList ? 'list' : 'ring'}
      data-leaving={leaving ? '' : undefined}
      role="menu"
      aria-label={`Actions for ${label}`}
      aria-orientation={asList ? 'vertical' : undefined}
      onKeyDown={onKey}
      onContextMenu={(e) => {
        e.preventDefault();
        close();
      }}
    >
      <div
        className="quill-ring-subject"
        aria-hidden="true"
        style={{ left: px(box.x), top: px(box.y), width: px(box.width), height: px(box.height) }}
      />
      {asList || !tile ? null : (
        <div className="quill-ring-orbit" aria-hidden="true" style={{ left: px(cx0 - rx), top: px(cy0 - ry), width: px(rx * 2), height: px(ry * 2) }} />
      )}
      <div className={asList ? 'quill-ring-list' : 'quill-ring-items'} style={asList ? listAt : undefined}>
        {list.map((a, i) => {
          const angle = angles[i]!;
          const x = arc ? cx0 + (arc.right ? 1 : -1) * arc.bow * (1 - angle * angle) : cx0 + rx * Math.cos(angle);
          const y = arc ? cy0 + angle * ry : cy0 + ry * Math.sin(angle);
          const side = arc ? (arc.right ? 'right' : 'left') : Math.abs(Math.cos(angle)) < 0.2 ? (Math.sin(angle) < 0 ? 'top' : 'bottom') : Math.cos(angle) > 0 ? 'right' : 'left';
          const style = asList ? undefined : ({ left: px(x), top: px(y), '--ring-delay': `calc(var(--motion-instant) * ${i} / 4)` } as CSSProperties);
          return (
            <button
              key={a.id}
              ref={(b) => void (items.current[i] = b)}
              type="button"
              role="menuitem"
              tabIndex={i === focused ? 0 : -1}
              className={cx('quill-ring-item', a.danger ? 'quill-ring-danger' : undefined)}
              data-side={asList ? undefined : side}
              aria-disabled={a.disabled || undefined}
              aria-describedby={a.disabled && a.reason ? `ring-why-${a.id}` : undefined}
              style={style}
              onFocus={() => setFocused(i)}
              onClick={() => choose(a)}
            >
              <span className="quill-ring-button">
                <Icon name={a.icon} size={18} />
              </span>
              <span className="quill-ring-name">
                <span className="quill-ring-label">{a.label}</span>
                {a.disabled && a.reason ? (
                  <span id={`ring-why-${a.id}`} className="quill-ring-why">
                    {a.reason}
                  </span>
                ) : null}
              </span>
            </button>
          );
        })}
      </div>
    </div>,
    document.body,
  );
}
