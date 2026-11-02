import type { ReactNode } from 'react';
import { cx, Icon, type IconName } from '@augur/kit-common';
import { useRingTarget, type RingSubject } from './radial-menu.js';

/**
 * What a tile is. Each kind has its own physical shape, so you can tell a
 * thing's kind before you read it: a collection is a solid block, a folder
 * has a tab, a series is a stack, a document is a page.
 */
export type TileKind = 'collection' | 'folder' | 'series' | 'document' | 'library';

export interface KindTileProps {
  kind: TileKind;
  name: string;
  /** The kind's name as the org calls it ("Folder", "Subcollection"), shown small at the top. */
  eyebrow: string;
  /** How many things are inside (a container), or the version (a document, "v2"). */
  count?: string;
  /** Where it is in its life ("In review"), on a document. */
  state?: string;
  /** It needs the person: a ribbon on its top edge. Say why in `needsLabel`. */
  needs?: boolean;
  needsLabel?: string;
  /** Who it belongs to, for a library from somewhere else ("Department 1"). */
  owner?: string;
  /** Locked to the person: it stays, looks locked and says why. Opening it shows the reason. */
  locked?: string;
  /** One more line under the name ("Department only", "On Org"). */
  note?: string;
  onOpen: () => void;
  /** The radial menu on the tile. */
  ring?: () => RingSubject | undefined;
}

const ICONS: Record<TileKind, IconName> = { collection: 'library', folder: 'folder', series: 'series', document: 'document', library: 'library' };

/**
 * One thing in a place, as a tile you can walk into. Hover lifts it as a real
 * object would lift; pressing it presses it down. Right-click, the
 * context-menu key or a long press opens its radial menu.
 */
export function KindTile({ kind, name, eyebrow, count, state, needs, needsLabel, owner, locked, note, onOpen, ring }: KindTileProps) {
  const menu = useRingTarget(() => ring?.());
  const described = [eyebrow, count, state, owner ? `from ${owner}` : '', needs ? (needsLabel ?? 'Needs you') : '', note, locked].filter(Boolean).join(', ');
  return (
    <button type="button" className="quill-tile" data-kind={kind} data-locked={locked ? '' : undefined} aria-description={described} title={locked} onClick={onOpen} {...menu}>
      {needs ? <span className="quill-tile-ribbon" aria-hidden="true" /> : null}
      <span className="quill-tile-top" aria-hidden="true">
        <span className="quill-tile-eyebrow">
          {locked ? <Icon name="lock" size={12} /> : <Icon name={ICONS[kind]} size={12} />}
          {eyebrow}
        </span>
        {count ? <span className="quill-tile-count">{count}</span> : null}
      </span>
      <span className="quill-tile-name">{name}</span>
      {owner || note || state || locked ? (
        <span className="quill-tile-foot">
          {state ? <span className="quill-tile-state">{state}</span> : null}
          {owner ? <span className="quill-tile-owner">{owner}</span> : null}
          {note ? <span className="quill-tile-note">{note}</span> : null}
          {locked ? <span className="quill-tile-why">{locked}</span> : null}
        </span>
      ) : null}
    </button>
  );
}

export interface AddTileProps {
  /** What it adds ("Add here", "New collection"). */
  label: string;
  /** Can't add here: the tile stays, says why and does nothing. */
  reason?: string;
  onPress: () => void;
}

/** The last tile in a place: pressing it adds something there (it opens the place's own radial menu, or a dialog). */
export function AddTile({ label, reason, onPress }: AddTileProps) {
  return (
    <button type="button" className="quill-tile" data-kind="add" aria-disabled={reason ? true : undefined} aria-description={reason} title={reason} onClick={reason ? undefined : onPress}>
      <Icon name="plus" size={24} />
      <span className="quill-tile-eyebrow">{label}</span>
      {reason ? <span className="quill-tile-why">{reason}</span> : null}
    </button>
  );
}

export interface TilesProps {
  /** What's here, read aloud ("In Policy & Guidance"). */
  label: string;
  children: ReactNode;
  /** The radial menu on the space between the tiles: what can be added or done here. */
  ring?: () => RingSubject | undefined;
  className?: string;
}

/**
 * The tiles of one place, in a grid. Right-clicking the space between them
 * opens the place's own radial menu (add, paste, sort), so a screen shows
 * things, not buttons.
 */
export function Tiles({ label, children, ring, className }: TilesProps) {
  const menu = useRingTarget(() => ring?.());
  return (
    <div
      className={cx('quill-tiles', className)}
      role="group"
      aria-label={label}
      onContextMenu={(e) => {
        // Only the space between: a tile opens its own.
        if (e.target === e.currentTarget) menu.onContextMenu(e);
      }}
    >
      {children}
    </div>
  );
}
