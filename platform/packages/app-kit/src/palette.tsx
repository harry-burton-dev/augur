import { useEffect, useId, useRef, useState, type KeyboardEvent } from 'react';
import { Dialog as AriaDialog, Modal, ModalOverlay } from 'react-aria-components';
import { Icon, type IconName } from '@augur/kit-common';
import { useRack } from './focus.js';

/** One thing the palette can go to or do. */
export interface PaletteItem {
  id: string;
  label: string;
  /** Where it is ("Your collections › Policy & Guidance"), or what it does ("Go to"). */
  detail?: string;
  /** Its kind or state, at the end of the row ("In review", "Folder"). */
  meta?: string;
  icon?: IconName;
  /** The heading of the group it starts ("Recent", "Found"). */
  group?: string;
  /** Can't be opened: it stays, marked, with why. */
  locked?: string;
}

export interface PaletteProps {
  open: boolean;
  onClose: () => void;
  /** What it searches, as the field's placeholder ("Find a document, folder or library"). */
  placeholder: string;
  query: string;
  onQuery: (query: string) => void;
  items: PaletteItem[];
  onPick: (item: PaletteItem) => void;
  /** What it says when nothing matches. */
  none?: string;
}

/**
 * Find and go, from anywhere in an app: press `/` (the app wires the key) and
 * type. Focus racks to the palette (PDR-010): the app stays where it is,
 * out of focus, behind it. ↑ ↓ move, Enter goes, Esc closes and gives focus
 * back. The field keeps focus throughout and points at the chosen row, so a
 * screen reader hears each one.
 */
export function Palette({ open, onClose, placeholder, query, onQuery, items, onPick, none = 'Nothing matches. Try fewer words.' }: PaletteProps) {
  const [at, setAt] = useState(0);
  const id = useId();
  const field = useRef<HTMLInputElement>(null);
  // Whatever had focus when it opened gets it back, once the app is in focus again.
  const [opener, setOpener] = useState<HTMLElement | undefined>();
  useEffect(() => {
    if (open) setOpener(document.activeElement instanceof HTMLElement ? document.activeElement : undefined);
  }, [open]);
  useRack(open, undefined, opener);
  useEffect(() => setAt(0), [query, open]);
  const chosen = items[Math.min(at, items.length - 1)];

  const onKey = (e: KeyboardEvent) => {
    if (e.key === 'ArrowDown') setAt((at + 1) % Math.max(items.length, 1));
    else if (e.key === 'ArrowUp') setAt((at - 1 + items.length) % Math.max(items.length, 1));
    else if (e.key === 'Enter') {
      if (chosen && !chosen.locked) onPick(chosen);
    } else return;
    e.preventDefault();
  };

  return (
    <ModalOverlay isOpen={open} onOpenChange={(next) => !next && onClose()} isDismissable className="quill-palette-veil">
      <Modal className="quill-palette">
        <AriaDialog aria-label={placeholder} className="outline-none">
          <div className="quill-palette-field">
            <Icon name="find" size={18} />
            <input
              ref={field}
              autoFocus
              type="search"
              role="combobox"
              aria-expanded
              aria-controls={`${id}-list`}
              aria-activedescendant={chosen ? `${id}-${chosen.id}` : undefined}
              aria-autocomplete="list"
              placeholder={placeholder}
              value={query}
              onChange={(e) => onQuery(e.target.value)}
              onKeyDown={onKey}
            />
          </div>
          <ul id={`${id}-list`} role="listbox" aria-label={placeholder} className="quill-palette-list">
            {items.map((item, i) => (
              <li key={item.id} role="presentation">
                {item.group ? <p className="quill-palette-group" aria-hidden="true">{item.group}</p> : null}
                <div
                  id={`${id}-${item.id}`}
                  role="option"
                  aria-selected={i === at}
                  aria-disabled={item.locked ? true : undefined}
                  className="quill-palette-item"
                  onPointerMove={() => setAt(i)}
                  onClick={() => !item.locked && onPick(item)}
                >
                  <Icon name={item.locked ? 'lock' : (item.icon ?? 'document')} size={16} />
                  <span className="quill-palette-text">
                    <span className="quill-palette-label">{item.label}</span>
                    {item.detail || item.locked ? <span className="quill-palette-detail">{item.locked ?? item.detail}</span> : null}
                  </span>
                  {item.meta ? <span className="quill-palette-meta">{item.meta}</span> : null}
                </div>
              </li>
            ))}
          </ul>
          {items.length === 0 && query.trim() ? <p className="quill-empty quill-palette-none">{none}</p> : null}
        </AriaDialog>
      </Modal>
    </ModalOverlay>
  );
}
