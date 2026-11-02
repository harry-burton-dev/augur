import { createContext, useContext, useEffect, useId, useMemo, useRef, useState, type CSSProperties, type ReactNode } from 'react';
import { cx } from '@augur/kit-common';

/**
 * Depth and focus (PDR-010). An app doesn't fight for flat screen space: it
 * keeps its layout where it is and moves the camera's focus instead.
 *
 * - **Rack focus.** When focus moves to an active surface (a dialog, the
 *   radial menu, the palette), the rest of the app stays in place and goes
 *   out of focus: fine detail and colour are stripped from it and it shrinks a
 *   touch, as a lens does when it refocuses on something closer. No black
 *   scrim, so you never lose your bearings.
 * - **Focus pull.** Ambient things sit softly out of focus while something
 *   that needs action pulls focus to itself (`FocusField`, `FocusItem`).
 */

/** How the out-of-focus plane is drawn. */
export type Depth =
  /** Harry's: a veil over the plane blurs and desaturates what's behind it (`backdrop-filter`). Can leave a hole for a subject. */
  | 'veil'
  /** The plane itself is blurred and desaturated (`filter`). No overlay, but no hole either. */
  | 'lens'
  /** The old way, kept to compare: a dark scrim, no blur. */
  | 'scrim';

/** A box on screen, in viewport pixels, that stays sharp while the rest racks out: the thing a radial menu was opened on. */
export interface Hole {
  x: number;
  y: number;
  width: number;
  height: number;
}

interface Racking {
  id: string;
  hole?: Hole;
}

interface Stage {
  depth: Depth;
  rack: (id: string, hole?: Hole) => void;
  /** Ends a rack; `returnTo` takes focus back once the plane is in focus (and focusable) again. */
  release: (id: string, returnTo?: HTMLElement) => void;
}

const StageContext = createContext<Stage | null>(null);

export interface FocusStageProps {
  /** How the out-of-focus plane is drawn. `veil` unless the person or the app chose otherwise. */
  depth?: Depth;
  children: ReactNode;
  className?: string;
}

/**
 * The app's focal planes. Put it round the whole app (AppFrame does). While
 * anything inside asks for focus with `useRack`, or a Common dialog is open
 * over it, everything else in the stage goes out of focus. The layout never
 * moves, so you keep your place.
 */
export function FocusStage({ depth = 'veil', children, className }: FocusStageProps) {
  const [racks, setRacks] = useState<Racking[]>([]);
  const returnTo = useRef<HTMLElement | undefined>(undefined);
  const stage = useMemo<Stage>(
    () => ({
      depth,
      rack: (id, hole) => setRacks((now) => [...now.filter((r) => r.id !== id), { id, ...(hole ? { hole } : {}) }]),
      release: (id, to) => {
        if (to) returnTo.current = to;
        setRacks((now) => now.filter((r) => r.id !== id));
      },
    }),
    [depth],
  );
  const top = racks.at(-1);
  // The plane is inert while racked, so focus can only go back once it isn't.
  useEffect(() => {
    if (top || !returnTo.current) return;
    if (returnTo.current.isConnected) returnTo.current.focus({ preventScroll: true });
    returnTo.current = undefined;
  }, [top]);
  // A hole needs the veil: the lens blurs the plane itself, so nothing in it could stay sharp.
  const drawn: Depth = top?.hole && depth === 'lens' ? 'veil' : depth;
  const hole: CSSProperties | undefined = top?.hole
    ? ({ '--hole-x': `${top.hole.x}px`, '--hole-y': `${top.hole.y}px`, '--hole-w': `${top.hole.width}px`, '--hole-h': `${top.hole.height}px` } as CSSProperties)
    : undefined;
  return (
    <StageContext.Provider value={stage}>
      <div className={cx('quill-stage', className)} data-depth={drawn} data-racked={top ? '' : undefined}>
        <div className="quill-plane" inert={top ? true : undefined}>
          {children}
        </div>
        <div className="quill-rack" aria-hidden="true" data-hole={top?.hole ? '' : undefined} style={hole} />
      </div>
    </StageContext.Provider>
  );
}

/** How the nearest stage draws depth, for parts that render their own surface. */
export const useDepth = (): Depth => useContext(StageContext)?.depth ?? 'veil';

/**
 * Takes the stage out of focus while `active`, leaving `hole` sharp. The part
 * that calls it draws its own surface outside the plane (in a portal), above
 * the rack. `returnTo` gets focus back when it ends. Outside a stage it does nothing.
 */
export function useRack(active: boolean, hole?: Hole, returnTo?: HTMLElement) {
  const stage = useContext(StageContext);
  const id = useId();
  const key = hole ? `${hole.x},${hole.y},${hole.width},${hole.height}` : '';
  const back = useRef(returnTo);
  back.current = returnTo;
  useEffect(() => {
    if (!stage || !active) return;
    stage.rack(id, hole);
    return () => stage.release(id, back.current);
    // The hole is compared by value, so a new object for the same box doesn't re-rack.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [stage, active, id, key]);
}

/** How ambient things look while something else has focus. */
export type Ambience =
  /** Harry's: softly out of focus (under a pixel of blur), with less colour and light. */
  | 'soft'
  /** Less colour and light only, no blur: for screens where people read the ambient things. */
  | 'quiet';

export interface FocusFieldProps {
  /** Something inside needs action and has pulled focus: everything else in the field becomes ambient. */
  pulled?: boolean;
  ambience?: Ambience;
  children: ReactNode;
  className?: string;
  /** The element to draw: a `div` unless it's a list. */
  as?: 'div' | 'ul' | 'ol' | 'section';
}

/**
 * Focus pull (PDR-010): a group of things where one can pull focus. While
 * `pulled`, every `FocusItem` that isn't `pulled` sits ambient; hovering or
 * focusing one brings it back into focus at once, so nothing is out of reach.
 */
export function FocusField({ pulled, ambience = 'soft', children, className, as: Tag = 'div' }: FocusFieldProps) {
  return (
    <Tag className={cx('quill-field', className)} data-pulling={pulled ? '' : undefined} data-ambience={ambience}>
      {children}
    </Tag>
  );
}

export interface FocusItemProps {
  /** This one needs action: it stays sharp, raised a little, and the rest of the field steps back. */
  pulled?: boolean;
  /** Always ambient, whatever else is pulled: read-only things, minor notices. */
  ambient?: boolean;
  children: ReactNode;
  className?: string;
  as?: 'div' | 'li';
}

export function FocusItem({ pulled, ambient, children, className, as: Tag = 'div' }: FocusItemProps) {
  return (
    <Tag className={cx('quill-focus-item', className)} data-focus={pulled ? 'pulled' : ambient ? 'ambient' : undefined}>
      {children}
    </Tag>
  );
}
