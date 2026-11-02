import { useState, type ReactNode } from 'react';
import { Menu as AriaMenu, MenuItem, MenuTrigger, Popover, Separator, type Key } from 'react-aria-components';
import { Icon, type IconName } from './icon.js';

/** One action in a menu, or '-' for the line before the next group (danger goes last, behind one). */
export interface MenuAction {
  id: string;
  label: string;
  icon?: IconName;
  /** Shown at the end; pressing it while the menu is open picks the item. */
  key?: string;
  danger?: boolean;
  /** Can't be used now: dimmed and skipped by the arrows, with its `reason` under its name. Don't leave it out. */
  disabled?: boolean;
  /** Why it can't be used now, in one sentence. */
  reason?: string;
}

export type MenuEntry = MenuAction | '-';

export interface MenuProps {
  /** What the menu is for, read aloud ("Collection actions"). */
  label: string;
  items: MenuEntry[];
  /** An item was picked; the menu has closed. */
  onAction: (id: string) => void;
  /** The button that opens it: a Button or an IconButton. */
  children: ReactNode;
  placement?: 'bottom start' | 'bottom end' | 'top start' | 'top end';
}

const isAction = (e: MenuEntry): e is MenuAction => e !== '-';

/**
 * A short list of actions that opens from a button: a row's ⋯, or a tool in a
 * bar. The main action goes first, danger last, and never more than about
 * eight: past that it's a page, not a menu. It opens under its button (above
 * it near the bottom of the screen) over everything, so nothing clips it.
 * Arrows, Home and End, typing to jump, Enter, Esc and focus going back to the
 * button come from React Aria; an item's own key picks it.
 */
export function Menu({ label, items, onAction, children, placement = 'bottom start' }: MenuProps) {
  const [open, setOpen] = useState(false);
  const actions = items.filter(isAction);
  const pick = (id: Key) => {
    setOpen(false);
    onAction(String(id));
  };
  // Separators have no id of their own in the list, so number them.
  const entries = items.map((e, i) => (isAction(e) ? e : { sep: `sep-${i}` }));

  return (
    <MenuTrigger isOpen={open} onOpenChange={setOpen}>
      {children}
      <Popover className="augur-popover augur-menu" placement={placement} offset={6}>
        <div
          onKeyDownCapture={(e) => {
            if (e.metaKey || e.ctrlKey || e.altKey) return;
            const hit = actions.find((a) => a.key && !a.disabled && a.key.toLowerCase() === e.key.toLowerCase());
            if (hit) {
              e.preventDefault();
              e.stopPropagation();
              pick(hit.id);
            }
          }}
        >
          <AriaMenu aria-label={label} onAction={pick} disabledKeys={actions.filter((a) => a.disabled).map((a) => a.id)} className="outline-none">
            {entries.map((e) =>
              'sep' in e ? (
                <Separator key={e.sep} className="augur-menu-line" />
              ) : (
                <MenuItem key={e.id} id={e.id} textValue={e.label} className="augur-menu-item" data-danger={e.danger || undefined}>
                  {e.icon || e.danger ? <Icon name={e.danger ? 'error' : e.icon!} size={16} className="augur-menu-icon" /> : null}
                  <span className="augur-menu-name">
                    <span className="augur-menu-label">{e.label}</span>
                    {e.disabled && e.reason ? <span className="augur-menu-why">{e.reason}</span> : null}
                  </span>
                  {e.key ? <kbd className="augur-menu-key">{e.key}</kbd> : null}
                </MenuItem>
              ),
            )}
          </AriaMenu>
        </div>
      </Popover>
    </MenuTrigger>
  );
}
