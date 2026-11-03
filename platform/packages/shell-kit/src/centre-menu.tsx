import { useEffect, useImperativeHandle, useLayoutEffect, useRef, useState, useSyncExternalStore, type CSSProperties, type Ref } from 'react';
import { Icon } from '@augur/kit-common';
import { animate, motionMode, reducedMotion, tokenEasing, tokenValue } from './motion.js';

export interface MenuOption {
  id?: string;
  label: string;
}

export interface MenuItem {
  id?: string;
  label: string;
  /** An icon name. */
  icon?: string;
  /** One short fact ("3 unread", "Updated today"), never a sentence. */
  detail?: string;
  /** Extra words search should find it by. */
  keywords?: string;
  /** An agent or anything that is an AI: drawn as a bubble. */
  ai?: boolean;
  /** Secondary actions, shown only on right-click or the context-menu key. Never the main one. */
  options?: MenuOption[];
}

export interface MenuCategory {
  id?: string;
  label: string;
  icon?: string;
  ai?: boolean;
  /**
   * The items under it. With none, the category is a choice by itself: the
   * caption names it, and Enter or a click opens it, reported as an item with
   * the category's id, label, icon and detail. That is how one child stands
   * for its parent, rather than repeating it.
   */
  items: MenuItem[];
  /** One short line, shown when the category is a choice by itself. */
  detail?: string;
  /** Extra words search should find a category that is a choice by itself by. */
  keywords?: string;
  /** In Orbit, the larger part the category belongs to, named before it ("Organisation / People"). */
  section?: string;
}

/** Title picks the app (a letterbox of fades, chapters, film-title type); Orbit is the menu inside it (a 360° ring). */
export type MenuVariant = 'orbit' | 'title';

/** Anything that can swell the water, such as the Shell's `Water`. */
export interface MenuBackground {
  pulse(amount?: number): void;
}

interface Entry {
  item: MenuItem;
  cat: MenuCategory;
}

interface Place {
  x: number;
  y: number;
  z?: number;
  scale: number;
  opacity: number;
  blur?: number;
}

/** The item a category with no items stands for. */
const itself = (cat: MenuCategory): MenuItem => ({ id: cat.id, label: cat.label, icon: cat.icon, detail: cat.detail, keywords: cat.keywords, ai: cat.ai });

const TAU = Math.PI * 2;
/** Anything shown and reachable stays at least this opaque, so icons keep 3:1 contrast. Further things fade out. */
const SHOWN = 0.55;
/** A press has to travel this far before it is a drag; less is still a click. It also locks the drag to one axis. */
const DRAG_START = 6;
const mod = (a: number, n: number) => ((a % n) + n) % n;
const clamp = (n: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, n));
const lerp = (a: number, b: number, t: number) => a + (b - a) * t;

/** A place part way between two others, so a fractional position draws smoothly between rest places. */
function between(a: Place, b: Place, t: number): Place {
  return {
    x: lerp(a.x, b.x, t),
    y: lerp(a.y, b.y, t),
    z: lerp(a.z ?? 0, b.z ?? 0, t),
    scale: lerp(a.scale, b.scale, t),
    opacity: lerp(a.opacity, b.opacity, t),
    blur: lerp(a.blur ?? 0, b.blur ?? 0, t),
  };
}

/** Draw a fractional offset `d` from the focus with `at`, which knows only whole steps. */
function placeAt(d: number, at: (d: number) => Place): Place {
  const lo = Math.floor(d);
  return d === lo ? at(d) : between(at(lo), at(lo + 1), d - lo);
}

/** Search across every category: the label, its keywords and the category's name. */
export function searchMenu(categories: MenuCategory[], query: string): Entry[] {
  const q = query.toLowerCase();
  const out: Entry[] = [];
  for (const cat of categories) {
    if (!cat.items.length && `${cat.label} ${cat.keywords ?? ''} ${cat.detail ?? ''}`.toLowerCase().includes(q)) out.push({ item: itself(cat), cat });
    for (const item of cat.items) if (`${item.label} ${item.keywords ?? ''} ${cat.label}`.toLowerCase().includes(q)) out.push({ item, cat });
  }
  return out;
}

/**
 * What the centre menu knows and does, apart from drawing it. `<CentreMenu>`
 * makes one and hands it to its `ref`; the host sets `categories`,
 * `startCategory` and `background` on it and listens for:
 *
 * ui-select `{ item, category }` when an item is opened, ui-option
 * `{ option, item, category }` when an option is chosen, ui-back on Esc or
 * Backspace with nothing left to clear, ui-change `{ category, item, query }`
 * whenever the focus moves.
 */
export class CentreMenuModel extends EventTarget {
  variant: MenuVariant = 'orbit';
  /** `focus` labels only the focused item; `all` names every item to its right. */
  labels: 'focus' | 'all' = 'focus';
  /** `auto` fades the key hints after eight uses. */
  hints: 'auto' | 'always' | 'never' = 'auto';
  search = true;
  label = 'Menu';
  background: MenuBackground | null = null;
  focusY = 0.5;
  pitchX = 132;
  pitchY = 60;
  intro = true;

  cat = 0;
  query = '';
  options: MenuOption[] | null = null;
  optIndex = 0;
  uses = 0;
  hover: { label: string; x: number; y: number; side: 'above' | 'right' } | null = null;
  size = { w: 0, h: 0 };
  /** Categories are being moved by hand: the items fade until it settles. */
  spinning = false;
  /** Something follows the hand, so the rest-place transitions are off. */
  moving = false;
  introDone = false;
  pressed = -1;
  rot = 0;
  /** How far between rest places the items (down) and Title's categories (across) are, while moving. */
  nudgeY = 0;
  nudgeX = 0;

  private _categories: MenuCategory[] = [];
  private _startCategory = 0;
  /** The focused item in each category, and in the search results under `q`. */
  private focusByCat = new Map<number | 'q', number>();
  private target = 0;
  private spinFrame = 0;
  private drag: { x: number; y: number; last: number; t: number; v: number; axis: 'x' | 'y' | null; id: number } | null = null;
  suppressClick = false;
  /** The axis a wheel or trackpad gesture locked to, until it settles. */
  private wheelAxis: 'x' | 'y' | null = null;
  private settleTimer = 0;
  private lastChange = '';
  private menuEl: HTMLElement | null = null;
  private listEl: HTMLElement | null = null;
  private listeners = new Set<() => void>();
  private revision = 0;
  private committed: (() => void)[] = [];

  /* ---- drawing ---- */

  subscribe = (listener: () => void) => {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  };

  getRevision = () => this.revision;

  requestUpdate() {
    this.revision++;
    for (const l of this.listeners) l();
  }

  /** Resolves once what has changed is drawn. */
  get updateComplete(): Promise<boolean> {
    if (!this.listeners.size) return Promise.resolve(true);
    return new Promise((resolve) => this.committed.push(() => resolve(true)));
  }

  /** <CentreMenu> calls this after each draw. */
  drawn(menu: HTMLElement | null, list: HTMLElement | null) {
    this.menuEl = menu;
    this.listEl = list;
    const cur = this.current;
    const key = `${this.cat}|${cur?.item.id ?? cur?.item.label ?? ''}|${this.query}`;
    if (key !== this.lastChange) {
      this.lastChange = key;
      this.emit('ui-change', { category: this.cats[this.cat] ?? null, item: cur?.item ?? null, query: this.query });
    }
    const done = this.committed;
    this.committed = [];
    for (const d of done) d();
  }

  get categories() {
    return this._categories;
  }
  set categories(list: MenuCategory[]) {
    this._categories = list;
    this.reset(false);
  }

  get startCategory() {
    return this._startCategory;
  }
  set startCategory(i: number) {
    this._startCategory = i;
    this.reset(true);
  }

  private reset(start: boolean) {
    const n = this.cats.length;
    if (start || this.cat >= n) this.cat = clamp(this._startCategory || 0, 0, Math.max(0, n - 1));
    this.rot = this.target = this.cat * this.step;
    if (this.focusIndex >= this.column.length) this.focusByCat.set(this.query ? 'q' : this.cat, Math.max(0, this.column.length - 1));
    this.requestUpdate();
  }

  /* ---- what callers can do ---- */

  focus(options?: FocusOptions) {
    this.listEl?.focus({ preventScroll: true, ...options });
  }

  setCategory(i: number) {
    this.setQuery('');
    this.setCat(i);
  }

  setItem(j: number) {
    this.setFocus(clamp(j, 0, Math.max(0, this.column.length - 1)));
  }

  find(q: string) {
    this.setQuery(q);
  }

  /** The icon of what's in focus: the focused item's, or the focused category's when it is a choice by itself. What a move carries across. */
  focusedIcon(): HTMLElement | null {
    const root = this.menuEl;
    return (root?.querySelector<HTMLElement>('.item.focus svg') ?? root?.querySelector<HTMLElement>('.cat.focus svg')) as HTMLElement | null;
  }

  /** Where what's in focus rests on screen, for a carried icon to land on; null before the menu has drawn. */
  focusedRect(): DOMRect | null {
    const root = this.menuEl;
    const el = root?.querySelector<HTMLElement>('.item.focus') ?? root?.querySelector<HTMLElement>('.cat.focus');
    const rect = el?.getBoundingClientRect();
    return rect && rect.width ? rect : null;
  }

  /**
   * Step aside before the next screen: going deeper, Title's other apps drift
   * outward and Orbit's ring tips back into the distance; going back, the
   * menu sinks. Either way it fades. Resolves when done, or at once if the
   * move is jumped to its end. Under reduced motion it only fades.
   */
  leave(way: 'deeper' | 'back' = 'deeper'): Promise<void> {
    const scene = this.menuEl;
    if (!scene) return Promise.resolve();
    const duration = tokenValue('motion-base', 240) * (way === 'back' ? 0.8 : 1);
    const easing = tokenEasing('ease-in');
    const away =
      motionMode() === 'reduce'
        ? 'none'
        : way === 'back'
          ? `translateY(${tokenValue('travel-near', 24)}px) scale(0.98)`
          : this.variant === 'orbit'
            ? 'perspective(900px) rotateX(18deg) scale(0.92)'
            : 'scale(1.06)';
    return animate(scene, [{ transform: 'none', opacity: 1, filter: 'none' }, { transform: away, opacity: 0, filter: way === 'deeper' && this.variant === 'orbit' && away !== 'none' ? 'blur(4px)' : 'none' }], {
      duration,
      easing,
      fill: 'forwards',
    });
  }

  /** The focused category, item and query. */
  get state() {
    const cur = this.current;
    return { category: this.cats[this.cat] ?? null, item: cur?.item ?? null, query: this.query };
  }

  /** Stops the ring and the timers, when the menu goes. */
  stop() {
    cancelAnimationFrame(this.spinFrame);
    this.spinFrame = 0;
    clearTimeout(this.settleTimer);
  }

  /* ---- derived ---- */

  get cats() {
    return (this._categories ?? []).filter((c) => c && Array.isArray(c.items));
  }

  get column(): Entry[] {
    if (this.query) return searchMenu(this.cats, this.query);
    const cat = this.cats[this.cat];
    return cat ? cat.items.map((item) => ({ item, cat })) : [];
  }

  get focusIndex() {
    return this.focusByCat.get(this.query ? 'q' : this.cat) ?? 0;
  }

  get current(): Entry | undefined {
    const column = this.column;
    if (column.length) return column[this.focusIndex];
    const cat = this.cats[this.cat];
    return !this.query && cat && !cat.items.length ? { item: itself(cat), cat } : undefined;
  }

  get step() {
    return TAU / Math.max(1, this.cats.length);
  }

  /* ---- moving ---- */

  emit(name: string, detail?: unknown) {
    this.dispatchEvent(new CustomEvent(name, { detail }));
  }

  private swell(n: number) {
    this.background?.pulse(n);
  }

  use() {
    this.uses++;
    this.requestUpdate();
  }

  setFocus(n: number) {
    this.focusByCat.set(this.query ? 'q' : this.cat, n);
    this.requestUpdate();
  }

  private setCat(i: number) {
    const n = this.cats.length;
    if (!n) return;
    i = this.variant === 'orbit' ? mod(i, n) : clamp(i, 0, n - 1);
    if (this.variant === 'orbit') this.orbitTo(i);
    if (i === this.cat && !this.query) return;
    this.cat = i;
    this.options = null;
    this.swell(1);
    this.requestUpdate();
  }

  private moveItem(dz: number) {
    const n = clamp(this.focusIndex + dz, 0, Math.max(0, this.column.length - 1));
    if (n === this.focusIndex) return;
    this.setFocus(n);
    this.swell(0.3);
  }

  private setQuery(q: string) {
    if (q === this.query) return;
    this.query = q;
    this.focusByCat.set('q', 0);
    this.options = null;
    this.requestUpdate();
  }

  activate() {
    const cur = this.current;
    if (!cur) return;
    this.pressed = this.focusIndex;
    this.requestUpdate();
    setTimeout(() => {
      this.pressed = -1;
      this.requestUpdate();
    }, tokenValue('motion-base', 240));
    this.emit('ui-select', { item: cur.item, category: cur.cat });
    this.swell(1.6);
  }

  openOptions() {
    const cur = this.current;
    if (!cur?.item.options?.length) return;
    this.options = cur.item.options;
    this.optIndex = 0;
    this.requestUpdate();
  }

  chooseOption() {
    const option = this.options?.[this.optIndex];
    const cur = this.current;
    this.options = null;
    this.requestUpdate();
    if (option && cur) this.emit('ui-option', { option, item: cur.item, category: cur.cat });
  }

  setHover(hover: CentreMenuModel['hover']) {
    this.hover = hover;
    this.requestUpdate();
  }

  setOptIndex(i: number) {
    this.optIndex = i;
    this.requestUpdate();
  }

  /* ---- moving by hand: wheel, trackpad and drag share one model ---- */

  /** Move the items by a fraction of an item; the focus follows the nearest one. */
  private slideItems(by: number) {
    const n = this.column.length;
    if (!n) return;
    const pos = clamp(this.focusIndex + this.nudgeY + by, -0.3, n - 0.7);
    const near = clamp(Math.round(pos), 0, n - 1);
    if (near !== this.focusIndex) {
      this.setFocus(near);
      this.swell(0.3);
    }
    this.nudgeY = pos - near;
    this.moving = true;
    this.requestUpdate();
  }

  /** Move the categories by a fraction of one: Orbit spins its ring, Title slides its row. */
  private slideCats(by: number) {
    if (!this.cats.length) return;
    if (this.query) this.setQuery('');
    if (!this.spinning) {
      cancelAnimationFrame(this.spinFrame);
      this.spinFrame = 0;
      this.spinning = true;
      this.options = null;
      this.hover = null;
    }
    if (this.variant === 'orbit') {
      this.rot += by * this.step;
      this.target = this.rot;
    } else this.nudgeX = clamp(this.cat + this.nudgeX + by, -0.3, this.cats.length - 0.7) - this.cat;
    this.moving = true;
    this.requestUpdate();
  }

  /** The category nearest the focal point while the row is being moved. */
  nearestCat() {
    return this.variant === 'orbit' ? mod(Math.round(this.rot / this.step), this.cats.length) : clamp(Math.round(this.cat + this.nudgeX), 0, this.cats.length - 1);
  }

  /** Come to rest on the nearest item and category, carried on by `throwX`/`throwY` (steps per ms). */
  private settle(throwX = 0, throwY = 0) {
    clearTimeout(this.settleTimer);
    this.wheelAxis = null;
    if (this.spinning) {
      let i: number;
      if (this.variant === 'orbit') {
        const idx = Math.round(this.rot / this.step + throwX * 300);
        i = mod(idx, this.cats.length);
        this.target = idx * this.step;
        this.spin();
      } else i = clamp(Math.round(this.cat + this.nudgeX + throwX * 300), 0, this.cats.length - 1);
      this.nudgeX = 0;
      this.spinning = false;
      if (i !== this.cat) {
        this.cat = i;
        this.options = null;
        this.swell(1);
      }
    }
    if (this.nudgeY || throwY) {
      const n = this.column.length;
      const j = clamp(Math.round(this.focusIndex + this.nudgeY + throwY * 300), 0, Math.max(0, n - 1));
      this.nudgeY = 0;
      if (j !== this.focusIndex) {
        this.setFocus(j);
        this.swell(0.3);
      }
    }
    this.moving = false;
    this.requestUpdate();
  }

  /* ---- Orbit's ring: a continuous angle that eases to its target ---- */

  private orbitTo(i: number) {
    const d = mod(i * this.step - this.target + Math.PI, TAU) - Math.PI;
    this.target += d;
    this.spin();
  }

  private spin() {
    if (this.spinFrame) return;
    let last = performance.now();
    const tick = (now: number) => {
      const dt = Math.min(48, now - last);
      last = now;
      this.rot += (this.target - this.rot) * (reducedMotion() ? 1 : 1 - Math.exp(-dt / 110));
      if (Math.abs(this.target - this.rot) < 0.0006) this.rot = this.target;
      this.requestUpdate();
      this.spinFrame = this.rot !== this.target ? requestAnimationFrame(tick) : 0;
    };
    this.spinFrame = requestAnimationFrame(tick);
  }

  /** Pixels of hand movement per step: a category across, an item down. */
  private get pitch() {
    return { x: this.variant === 'orbit' ? this.pitchX * 1.1 : this.pitchX, y: this.pitchY };
  }

  onPointerDown = (e: PointerEvent) => {
    if (e.button !== 0 || (e.target as HTMLElement).closest?.('.options')) return;
    this.drag = { x: e.clientX, y: e.clientY, last: 0, t: performance.now(), v: 0, axis: null, id: e.pointerId };
  };

  onPointerMove = (e: PointerEvent) => {
    const d = this.drag;
    if (!d || e.pointerId !== d.id) return;
    if (!d.axis) {
      const dx = e.clientX - d.x;
      const dy = e.clientY - d.y;
      if (Math.hypot(dx, dy) < DRAG_START) return;
      d.axis = Math.abs(dx) >= Math.abs(dy) ? 'x' : 'y';
      d.last = d.axis === 'x' ? d.x : d.y;
      try {
        this.menuEl?.setPointerCapture(e.pointerId);
      } catch {
        /* the pointer may already be gone */
      }
      this.options = null;
      this.hover = null;
      clearTimeout(this.settleTimer);
    }
    const now = performance.now();
    const at = d.axis === 'x' ? e.clientX : e.clientY;
    const by = -(at - d.last) / this.pitch[d.axis];
    if (d.axis === 'x') this.slideCats(by);
    else this.slideItems(by);
    d.v = 0.75 * d.v + 0.25 * (by / Math.max(1, now - d.t));
    d.last = at;
    d.t = now;
  };

  onPointerUp = () => {
    const d = this.drag;
    this.drag = null;
    if (!d?.axis) return;
    this.suppressClick = true;
    setTimeout(() => (this.suppressClick = false), 0);
    if (performance.now() - d.t > 90) d.v = 0; // held still before letting go: no throw
    this.use();
    this.settle(d.axis === 'x' ? d.v : 0, d.axis === 'y' ? d.v : 0);
  };

  /* ---- keys, wheel, hover ---- */

  onKey = (e: KeyboardEvent) => {
    if (e.ctrlKey || e.metaKey || e.altKey) return;
    const key = e.key;
    let handled = true;
    if (this.options) {
      if (key === 'ArrowDown') this.setOptIndex(Math.min(this.options.length - 1, this.optIndex + 1));
      else if (key === 'ArrowUp') this.setOptIndex(Math.max(0, this.optIndex - 1));
      else if (key === 'Enter' || key === ' ') this.chooseOption();
      else if (['Escape', 'ArrowLeft', 'Backspace', 'ContextMenu'].includes(key)) {
        this.options = null;
        this.requestUpdate();
      } else handled = false;
    } else if (key === 'ArrowRight' || key === 'ArrowLeft') {
      this.setQuery('');
      this.setCat(this.cat + (key === 'ArrowRight' ? 1 : -1));
    } else if (key === 'ArrowDown') this.moveItem(1);
    else if (key === 'ArrowUp') this.moveItem(-1);
    else if (key === 'Home') this.setFocus(0);
    else if (key === 'End') this.setFocus(Math.max(0, this.column.length - 1));
    else if (key === 'Enter') this.activate();
    else if (key === 'ContextMenu' || (key === 'F10' && e.shiftKey)) this.openOptions();
    else if (key === 'Escape') this.query ? this.setQuery('') : this.emit('ui-back');
    else if (key === 'Backspace') this.query ? this.setQuery(this.query.slice(0, -1)) : this.emit('ui-back');
    else if (this.search && key.length === 1 && key !== ' ' && key !== '`') this.setQuery(this.query + key); // ` belongs to the Shell
    else if (key === ' ' && this.query) this.setQuery(`${this.query} `);
    else if (key === ' ') this.activate();
    else handled = false;
    if (handled) {
      e.preventDefault();
      this.use();
    }
  };

  onWheel = (e: WheelEvent) => {
    e.preventDefault();
    if (this.options) return;
    const px = e.deltaMode === 1 ? 40 : e.deltaMode === 2 ? this.size.h : 1;
    let dx = e.deltaX * px;
    let dy = e.deltaY * px;
    if (e.shiftKey && !dx) [dx, dy] = [dy, 0];
    const axis = this.wheelAxis ?? (Math.abs(dx) > Math.abs(dy) ? 'x' : 'y');
    const delta = axis === 'x' ? dx : dy;
    if (!delta) return;
    // a mouse wheel clicks in whole notches; a trackpad streams small, uneven amounts
    const notch = !this.wheelAxis && (e.deltaMode !== 0 || (Math.abs(delta) >= 50 && Number.isInteger(delta) && !(axis === 'x' ? dy : dx)));
    this.use();
    if (notch) {
      if (axis === 'x') {
        this.setQuery('');
        this.setCat(this.cat + Math.sign(delta));
      } else this.moveItem(Math.sign(delta));
      return;
    }
    this.wheelAxis = axis;
    if (axis === 'x') this.slideCats(delta / this.pitch.x);
    else this.slideItems(delta / this.pitch.y);
    clearTimeout(this.settleTimer);
    // settles on the nearest item a moment after it stops
    this.settleTimer = window.setTimeout(() => this.settle(), tokenValue('motion-instant', 80) * 1.5);
  };

  showHover(label: string, target: HTMLElement, side: 'above' | 'right') {
    const rr = this.menuEl?.getBoundingClientRect();
    const tr = target.getBoundingClientRect();
    if (!rr) return;
    this.setHover(
      side === 'above'
        ? { label, side, x: tr.left - rr.left + tr.width / 2, y: tr.top - rr.top - 8 }
        : { label, side, x: tr.right - rr.left + 12, y: tr.top - rr.top + tr.height / 2 },
    );
  }

  clickCat(i: number) {
    if (this.suppressClick) return;
    this.use();
    // a category that is a choice by itself opens on a second click, as an item does
    const opens = i === this.cat && !this.query && !this.cats[i]?.items.length;
    this.setQuery('');
    if (opens) this.activate();
    else this.setCat(i);
  }

  clickItem(j: number) {
    if (this.suppressClick) return;
    this.use();
    if (j === this.focusIndex) this.activate();
    else this.setFocus(j);
  }

  measure(box: DOMRect) {
    if (box.width !== this.size.w || box.height !== this.size.h) {
      this.size = { w: box.width, h: box.height };
      this.requestUpdate();
    }
  }

  /* ---- where things sit: one focal point; everything else is placed relative to it ---- */

  geometry() {
    const { w, h } = this.size;
    const orbit = this.variant === 'orbit';
    const cx = w / 2;
    const rowY = h * this.focusY - (this.variant === 'title' ? 92 : 56);
    const R = orbit ? Math.min(this.pitchX * 2.5, w * 0.4) : this.pitchX * 2.2;
    return { cx, rowY, focus: rowY + 92, R, orbit };
  }

  catPlaces(): { place: Place; focused: boolean }[] {
    const g = this.geometry();
    const searching = !!this.query;
    if (g.orbit) {
      const step = this.step;
      return this.cats.map((_, i) => {
        const th = i * step - this.rot;
        const c = Math.cos(th);
        const dep = (c + 1) / 2;
        const wrapped = mod(th + Math.PI, TAU) - Math.PI;
        const wt = Math.max(0, 1 - Math.abs(wrapped) / (step * 0.5));
        const x = g.cx + Math.sin(th) * g.R;
        const z = (c - 1) * g.R;
        return {
          place: {
            x,
            y: g.rowY,
            z,
            scale: 0.86 + 0.14 * dep + (this.spinning ? 0.12 : 0.3) * wt,
            opacity: searching ? 0.1 : SHOWN + (1 - SHOWN) * Math.max(Math.pow(dep, 1.6), wt),
            blur: (1 - dep) * 1.6 * (1 - wt),
          },
          focused: !searching && !this.spinning && wt > 0.9,
        };
      });
    }
    const title = this.variant === 'title';
    const at = (d: number): Place => {
      const ad = Math.abs(d);
      const opacity = searching ? (title ? 0.08 : 0.12) : title ? ([0.9, SHOWN][ad] ?? 0) : ([1, 0.8, SHOWN][ad] ?? 0);
      return { x: g.cx + d * this.pitchX, y: g.rowY, scale: title ? (d === 0 ? 1.05 : 0.8) : d === 0 ? 1.3 : 1, opacity };
    };
    return this.cats.map((_, i) => ({
      place: placeAt(i - this.cat - this.nudgeX, at),
      focused: i === this.cat && !searching && !this.spinning,
    }));
  }

  itemPlace(j: number): Place {
    return placeAt(j - this.focusIndex - this.nudgeY, (d) => this.itemPlaceAt(d));
  }

  /** Where the item `d` steps from the focus rests. */
  private itemPlaceAt(d: number): Place {
    const g = this.geometry();
    const py = this.pitchY;
    if (this.variant === 'orbit') {
      // items recede by scale and blur, not depth, so they never ride up into the caption
      if (d === 0) return { x: g.cx, y: g.focus, scale: 1.35, opacity: 1 };
      if (d > 0) return { x: g.cx, y: g.focus + 128 + (d - 1) * py * 0.78, scale: 1 - d * 0.12, blur: d * 0.9, opacity: d <= 3 ? 0.8 - (d - 1) * 0.12 : 0 };
      return { x: g.cx, y: g.focus - 72, scale: 0.8, blur: 2, opacity: 0 }; // fades out short of the ring, which owns the space above
    }
    // title
    if (d === 0) return { x: g.cx, y: g.focus, scale: 1.1, opacity: 1 };
    if (d > 0) return { x: g.cx, y: g.focus + 196 + (d - 1) * py, scale: 0.9, opacity: d === 1 ? SHOWN : 0 };
    return { x: g.cx, y: g.rowY - 104 - (-d - 1) * py, scale: 0.9, opacity: d === -1 ? SHOWN : 0 };
  }
}

function place(p: Place, extra: Record<string, string> = {}): CSSProperties {
  return {
    transform: `translate3d(${(p.x - 20).toFixed(1)}px, ${(p.y - 20).toFixed(1)}px, ${(p.z ?? 0).toFixed(1)}px) scale(${p.scale})`,
    opacity: p.opacity,
    pointerEvents: p.opacity > 0.05 ? undefined : 'none',
    filter: p.blur ? `blur(${p.blur.toFixed(1)}px)` : undefined,
    ...extra,
  } as CSSProperties;
}

function MenuIcon({ name, ai }: { name?: string; ai?: boolean }) {
  const icon = <Icon name={name ?? 'apps'} size={ai ? 28 : 40} />;
  return ai ? <span className="aerie-bubble">{icon}</span> : icon;
}

/** The menu's root element, carrying its model, so a test or a tool can reach it as the Lit element's own methods. */
export type CentreMenuElement = HTMLDivElement & { menu?: CentreMenuModel };

export interface CentreMenuProps {
  variant?: MenuVariant;
  /** What the menu is, read aloud ("Apps", "Admin menu"). */
  label?: string;
  labels?: 'focus' | 'all';
  hints?: 'auto' | 'always' | 'never';
  search?: boolean;
  intro?: boolean;
  /** Gets the menu's model: set `categories` and `startCategory` on it and listen to it. */
  ref?: Ref<CentreMenuModel>;
}

/**
 * A centred, low-noise menu for keyboard and mouse that floats over the
 * water: categories run across, items run down, and one fixed focal point
 * stays in the middle. Only the focused category is named and only the
 * focused item is labelled.
 *
 * ← → pick a category, ↑ ↓ an item, Enter opens, Esc goes back, typing
 * searches every category, and right-click or the context-menu key shows an
 * item's options. With the mouse, hovering highlights in place and a click
 * moves things. The wheel, a trackpad and a press-and-drag all move both ways
 * in both variants (Orbit spins). Movement follows the hand, then settles.
 *
 * Categories are a tablist and the focused category's items a listbox, which
 * holds keyboard focus and points at the focused item.
 */
export function CentreMenu({ variant = 'orbit', label = 'Menu', labels = 'focus', hints = 'auto', search = true, intro = true, ref }: CentreMenuProps) {
  const [model] = useState(() => new CentreMenuModel());
  model.variant = variant;
  model.label = label;
  model.labels = labels;
  model.hints = hints;
  model.search = search;
  model.intro = intro;
  useImperativeHandle(ref, () => model, [model]);
  useSyncExternalStore(model.subscribe, model.getRevision, model.getRevision);
  const host = useRef<HTMLDivElement>(null);
  const menu = useRef<HTMLDivElement>(null);
  const list = useRef<HTMLDivElement>(null);

  useLayoutEffect(() => {
    if (host.current) (host.current as CentreMenuElement).menu = model;
    model.drawn(menu.current, list.current);
  });

  useEffect(() => {
    const el = host.current;
    if (!el) return;
    // on the host, not the drawn menu: an empty menu draws a different element, which would drop it
    el.addEventListener('wheel', model.onWheel, { passive: false });
    const measure = () => model.measure(el.getBoundingClientRect());
    const observer = typeof ResizeObserver === 'function' ? new ResizeObserver(measure) : undefined;
    observer?.observe(el);
    measure();
    const done = setTimeout(() => {
      model.introDone = true;
      model.requestUpdate();
    }, tokenValue('motion-shimmer', 1600) + tokenValue('motion-quick', 160));
    return () => {
      el.removeEventListener('wheel', model.onWheel);
      observer?.disconnect();
      clearTimeout(done);
      model.stop();
    };
  }, [model]);

  const cats = model.cats;
  if (!cats.length) {
    return (
      <div ref={host} className="aerie-centre" data-variant={variant}>
        <div ref={menu} className="aerie-menu" tabIndex={-1} />
      </div>
    );
  }
  const g = model.geometry();
  const searching = !!model.query;
  const column = model.column;
  const f = model.focusIndex;
  const cur = model.current;
  const showIntro = model.intro && !model.introDone && !reducedMotion();
  const ready = model.size.w > 0;
  const shown = model.spinning ? model.nearestCat() : model.cat;
  const num = String(shown + 1).padStart(2, '0');
  const section = cats[shown]!.section;
  const catText = searching ? `“${model.query}”` : variant === 'title' ? `${num}  /  ${cats[shown]!.label}` : section ? `${section}  /  ${cats[shown]!.label}` : cats[shown]!.label;
  const title = cur ? cur.item.label : searching ? 'No matches' : '';
  const detail = cur ? (searching ? [cur.cat.label, cur.item.detail].filter(Boolean).join(' · ') : (cur.item.detail ?? '')) : searching ? 'Esc to clear' : '';
  const live = cur ? (column.length ? `${cur.item.label}, ${f + 1} of ${column.length}${searching ? '' : `, ${cats[model.cat]!.label}`}` : cur.item.label) : searching ? 'No matches' : '';
  const places = model.catPlaces();
  const hover = model.hover;
  const classes = ['aerie-menu', variant === 'title' ? 'title-variant' : 'orbit', showIntro && 'intro', ready && 'in', model.spinning && 'spinning', model.moving && 'moving'].filter(Boolean).join(' ');

  return (
    <div ref={host} className="aerie-centre" data-variant={variant}>
      <div
        ref={menu}
        className={classes}
        style={{ perspectiveOrigin: `${g.cx}px ${g.orbit ? g.rowY - 290 : g.rowY}px`, opacity: ready ? undefined : 0 }}
        onKeyDown={(e) => model.onKey(e.nativeEvent)}
        onPointerDown={(e) => model.onPointerDown(e.nativeEvent)}
        onPointerMove={(e) => model.onPointerMove(e.nativeEvent)}
        onPointerUp={model.onPointerUp}
        onPointerCancel={model.onPointerUp}
        onMouseDown={(e) => {
          // the listbox keeps focus wherever the menu is pressed, so the keys go on working after a click on a category
          e.preventDefault();
          model.focus();
          if (e.button === 0 && model.options && !(e.target as HTMLElement).closest?.('.options')) {
            model.options = null;
            model.requestUpdate();
          }
        }}
        onContextMenu={(e) => e.preventDefault()}
      >
        <div className="scene">
          <div
            className="ring"
            style={{
              width: `${2 * g.R}px`,
              height: `${2 * g.R}px`,
              transform: `translate3d(${g.cx - g.R}px, ${g.rowY - g.R}px, ${-g.R}px) rotateX(90deg) rotateZ(${((model.rot * 180) / Math.PI).toFixed(2)}deg)`,
            }}
          />
          <div className="row" role="tablist" aria-label={label}>
            {cats.map((c, i) => (
              <div
                key={c.id ?? `${i}:${c.label}`}
                id={`m-c${i}`}
                className={`cat${places[i]!.focused ? ' focus' : ''}${c.ai ? ' ai' : ''}`}
                role="tab"
                tabIndex={-1}
                aria-selected={i === model.cat && !searching}
                aria-controls="m-list"
                aria-label={c.label}
                style={place(places[i]!.place, { '--i': String(Math.abs(i - model.cat)) })}
                onClick={() => model.clickCat(i)}
                onMouseEnter={(e) => i !== model.cat && model.showHover(c.label, e.currentTarget, 'above')}
                onMouseLeave={() => model.setHover(null)}
              >
                <MenuIcon name={c.icon} ai={c.ai} />
              </div>
            ))}
          </div>
          <div
            ref={list}
            className="col"
            id="m-list"
            role="listbox"
            tabIndex={0}
            aria-label={searching ? `Results for ${model.query}` : cats[model.cat]!.label}
            aria-activedescendant={column.length ? `m-i${f}` : undefined}
          >
            <div key={searching ? `q:${model.query}` : `c:${model.cat}`} style={{ display: 'contents' }}>
              {column.map((entry, j) => (
                <div
                  key={`${entry.cat.id ?? entry.cat.label}:${entry.item.id ?? entry.item.label}:${j}`}
                  id={`m-i${j}`}
                  className={`item${j === f ? ' focus' : ''}${entry.item.ai ? ' ai' : ''}${j === model.pressed ? ' press' : ''}`}
                  role="option"
                  aria-selected={j === f}
                  aria-label={entry.item.label}
                  style={place(model.itemPlace(j), { '--i': String(j + 2), '--k': String(j) })}
                  onClick={() => model.clickItem(j)}
                  onContextMenu={(e) => {
                    e.preventDefault();
                    model.use();
                    model.setFocus(j);
                    model.openOptions();
                  }}
                  onMouseEnter={(e) => j !== model.focusIndex && model.labels !== 'all' && model.showHover(entry.item.label, e.currentTarget, 'right')}
                  onMouseLeave={() => model.setHover(null)}
                >
                  <MenuIcon name={entry.item.icon} ai={entry.item.ai} />
                  {model.labels === 'all' ? <span className="itemlabel">{entry.item.label}</span> : null}
                </div>
              ))}
            </div>
          </div>
          <div className={`catlabel${searching ? ' query' : ''}`} style={{ transform: `translate(-50%, 0) translate3d(${g.cx}px, ${g.rowY - 62}px, 0)` }}>
            {catText}
          </div>
          <div className="caption" style={{ transform: `translate(-50%, 0) translate3d(${g.cx}px, ${g.focus + (variant === 'title' ? 52 : 46)}px, 0)` }}>
            <div key={title} style={{ display: 'contents' }}>
              <div className="title">{title}</div>
              <div className="detail">{detail}</div>
            </div>
          </div>
          {model.options ? (
            <div className="options" role="menu" style={{ transform: `translate(${g.cx + 64}px, ${g.focus - 18}px)` }}>
              {model.options.map((op, i) => (
                <div
                  key={op.id ?? op.label}
                  className={`opt${i === model.optIndex ? ' focus' : ''}`}
                  role="menuitem"
                  onMouseEnter={() => model.setOptIndex(i)}
                  onClick={(e) => {
                    e.stopPropagation();
                    model.setOptIndex(i);
                    model.chooseOption();
                  }}
                >
                  {op.label}
                </div>
              ))}
            </div>
          ) : null}
        </div>
        <div className="bar top" />
        <div className="bar bottom" />
        <div
          className={`hover${hover ? ' on' : ''}`}
          style={{
            transform: hover
              ? hover.side === 'above'
                ? `translate(-50%, -100%) translate(${hover.x}px, ${hover.y}px)`
                : `translate(0, -50%) translate(${hover.x}px, ${hover.y}px)`
              : undefined,
          }}
        >
          {hover?.label ?? ''}
        </div>
        {hints === 'never' ? null : <div className={`hints${hints === 'auto' && model.uses >= 8 ? ' gone' : ''}`}>Scroll or drag to move · Enter to open · Esc to go back</div>}
        <div className="live" aria-live="polite">
          {live}
        </div>
      </div>
    </div>
  );
}
