import { createContext, useContext, type ReactNode } from 'react';
import { Tab as AriaTab, TabList as AriaTabList, TabPanel as AriaTabPanel, Tabs as AriaTabs, type Key } from 'react-aria-components';
import { cx } from './cx.js';

const Unavailable = createContext<Record<string, string>>({});

export interface TabsProps {
  selected?: string;
  defaultSelected?: string;
  onChange?: (id: string) => void;
  /**
   * Tabs that can't show anything to this person now, each with why in one
   * sentence. They stay in the line, dimmed, and can still be opened: their
   * panel says why instead of showing its content.
   */
  unavailable?: Record<string, string>;
  /** TabList, then a TabPanel for each tab. */
  children: ReactNode;
  className?: string;
}

/**
 * Views of one thing, side by side: a line of names with an ink rule under the
 * one you're on. Arrows move between them and the panel follows (React Aria).
 * Use tabs for views of the same thing, never for steps or for places.
 */
export function Tabs({ selected, defaultSelected, onChange, unavailable = {}, children, className }: TabsProps) {
  return (
    <Unavailable.Provider value={unavailable}>
      <AriaTabs
        selectedKey={selected}
        defaultSelectedKey={defaultSelected}
        onSelectionChange={(k: Key) => onChange?.(String(k))}
        className={cx('augur-tabs', className)}
      >
        {children}
      </AriaTabs>
    </Unavailable.Provider>
  );
}

/** The line of tab names. Name it for what it switches ("Collection views"). */
export function TabList({ label, children }: { label: string; children: ReactNode }) {
  return (
    <AriaTabList aria-label={label} className="augur-tab-list">
      {children}
    </AriaTabList>
  );
}

export interface TabProps {
  id: string;
  children: ReactNode;
  /** A number after the name ("Needs you 3"). */
  count?: number;
}

export function Tab({ id, children, count }: TabProps) {
  const why = useContext(Unavailable)[id];
  return (
    <AriaTab id={id} className="augur-tab" data-unavailable={why ? true : undefined}>
      {children}
      {count != null ? <span className="augur-tab-count">{count}</span> : null}
    </AriaTab>
  );
}

/** A tab's content; for an unavailable tab, why it can't be shown. */
export function TabPanel({ id, children }: { id: string; children: ReactNode }) {
  const why = useContext(Unavailable)[id];
  return (
    <AriaTabPanel id={id} className="augur-tab-panel">
      {why ? <p className="augur-tab-why">{why}</p> : children}
    </AriaTabPanel>
  );
}
