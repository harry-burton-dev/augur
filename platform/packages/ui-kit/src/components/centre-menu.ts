import { LitElement, css, html, nothing, type PropertyValues } from 'lit';
import { keyed } from 'lit/directives/keyed.js';
import { styleMap } from 'lit/directives/style-map.js';
import { base, reducedMotion } from '../shared.js';
import { animate, motionMode, tokenEasing, tokenValue } from '../motion.js';
import './icon.js';

export interface MenuOption {
  id?: string;
  label: string;
}

export interface MenuItem {
  id?: string;
  label: string;
  /** A UI kit icon name. */
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

/** The item a category with no items stands for. */
const itself = (cat: MenuCategory): MenuItem => ({ id: cat.id, label: cat.label, icon: cat.icon, detail: cat.detail, keywords: cat.keywords, ai: cat.ai });

/** Title picks the app (a letterbox of fades, chapters, film-title type); Orbit is the menu inside it (a 360° ring). */
export type MenuVariant = 'orbit' | 'title';

/** Anything that can swell the water, such as `ui-wave-background`. */
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

const TAU = Math.PI * 2;
/** Anything shown and reachable stays at least this opaque, so icons keep 3:1 contrast. Further things fade out. */
const SHOWN = 0.55;
/** A press has to travel this far before it is a drag; less is still a click. It also locks the drag to one axis. */
const DRAG_START = 6;
/** Wheel and trackpad movement settles on the nearest item this long after it stops. */
const SETTLE_MS = 120;
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
 * A centred, low-noise menu for keyboard and mouse that floats over the
 * water: categories run across, items run down, and one fixed focal point
 * stays in the middle. Only the focused category is named and only the
 * focused item is labelled.
 *
 * ← → pick a category, ↑ ↓ an item, Enter opens, Esc goes back, typing
 * searches every category, and right-click or the context-menu key shows an
 * item's options. With the mouse, hovering highlights in place and a click
 * moves things. The wheel, a trackpad and a press-and-drag all move both ways
 * in both variants: up and down through items, sideways through categories
 * (Orbit spins). Movement follows the hand, then settles on the nearest item.
 *
 * Categories are a tablist and the focused category's items a listbox, which
 * holds keyboard focus and points at the focused item.
 *
 * @fires ui-select - detail `{ item, category }` when an item is opened
 * @fires ui-option - detail `{ option, item, category }` when an option is chosen
 * @fires ui-back - Esc or Backspace with nothing left to clear
 * @fires ui-change - detail `{ category, item, query }` whenever the focus moves
 */
export class UiCentreMenu extends LitElement {
  static override properties = {
    categories: { attribute: false },
    variant: { type: String, reflect: true },
    labels: { type: String },
    hints: { type: String },
    search: { type: Boolean },
    startCategory: { type: Number, attribute: 'start-category' },
    label: { type: String },
    background: { attribute: false },
    focusY: { type: Number, attribute: 'focus-y' },
    pitchX: { type: Number, attribute: 'pitch-x' },
    pitchY: { type: Number, attribute: 'pitch-y' },
    intro: { type: Boolean },
    cat: { state: true },
    query: { state: true },
    options: { state: true },
    optIndex: { state: true },
    uses: { state: true },
    hover: { state: true },
    size: { state: true },
    spinning: { state: true },
    moving: { state: true },
    introDone: { state: true },
  };

  declare categories: MenuCategory[];
  declare variant: MenuVariant;
  /** `focus` labels only the focused item; `all` names every item to its right. */
  declare labels: 'focus' | 'all';
  /** `auto` fades the key hints after eight uses. */
  declare hints: 'auto' | 'always' | 'never';
  declare search: boolean;
  declare startCategory: number;
  declare label: string;
  declare background: MenuBackground | null;
  declare focusY: number;
  declare pitchX: number;
  declare pitchY: number;
  declare intro: boolean;

  declare private cat: number;
  declare private query: string;
  declare private options: MenuOption[] | null;
  declare private optIndex: number;
  declare private uses: number;
  declare private hover: { label: string; x: number; y: number; side: 'above' | 'right' } | null;
  declare private size: { w: number; h: number };
  /** Categories are being moved by hand: the items fade until it settles. */
  declare private spinning: boolean;
  /** Something follows the hand, so the rest-place transitions are off. */
  declare private moving: boolean;
  declare private introDone: boolean;

  /** The focused item in each category, and in the search results under `q`. */
  private focusByCat = new Map<number | 'q', number>();
  private rot = 0;
  private target = 0;
  private spinFrame = 0;
  private drag: { x: number; y: number; last: number; t: number; v: number; axis: 'x' | 'y' | null; id: number } | null = null;
  private suppressClick = false;
  /** How far between rest places the items (down) and Title's categories (across) are, while moving. */
  private nudgeY = 0;
  private nudgeX = 0;
  /** The axis a wheel or trackpad gesture locked to, until it settles. */
  private wheelAxis: 'x' | 'y' | null = null;
  private settleTimer = 0;
  private pressed = -1;
  private resizeObserver?: ResizeObserver;
  private lastChange = '';
  private get reduce() {
    return reducedMotion();
  }

  constructor() {
    super();
    this.categories = [];
    this.variant = 'orbit';
    this.labels = 'focus';
    this.hints = 'auto';
    this.search = true;
    this.startCategory = 0;
    this.label = 'Menu';
    this.background = null;
    this.focusY = 0.5;
    this.pitchX = 132;
    this.pitchY = 60;
    this.intro = true;
    this.cat = 0;
    this.query = '';
    this.options = null;
    this.optIndex = 0;
    this.uses = 0;
    this.hover = null;
    this.size = { w: 0, h: 0 };
    this.spinning = false;
    this.moving = false;
    this.introDone = false;
  }

  /* ---- what callers can do ---- */

  override focus(options?: FocusOptions) {
    this.list?.focus({ preventScroll: true, ...options });
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

  /**
   * The icon of what's in focus: the focused item's, or the focused
   * category's when it is a choice by itself. What a move carries across.
   */
  focusedIcon(): HTMLElement | null {
    const root = this.renderRoot;
    if (!root) return null;
    return root.querySelector<HTMLElement>('.item.focus ui-icon') ?? root.querySelector<HTMLElement>('.cat.focus ui-icon');
  }

  /** Where what's in focus rests on screen, for a carried icon to land on; null before the menu has drawn. */
  focusedRect(): DOMRect | null {
    const root = this.renderRoot;
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
    const scene = this.renderRoot?.querySelector<HTMLElement>('.menu');
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

  /* ---- derived ---- */

  private get root() {
    return this.renderRoot?.querySelector<HTMLElement>('.menu') ?? null;
  }

  private get list() {
    return this.renderRoot?.querySelector<HTMLElement>('.col') ?? null;
  }

  private get cats() {
    return (this.categories ?? []).filter((c) => c && Array.isArray(c.items));
  }

  private get column(): Entry[] {
    if (this.query) return searchMenu(this.cats, this.query);
    const cat = this.cats[this.cat];
    return cat ? cat.items.map((item) => ({ item, cat })) : [];
  }

  private get focusIndex() {
    return this.focusByCat.get(this.query ? 'q' : this.cat) ?? 0;
  }

  private get current(): Entry | undefined {
    const column = this.column;
    if (column.length) return column[this.focusIndex];
    const cat = this.cats[this.cat];
    return !this.query && cat && !cat.items.length ? { item: itself(cat), cat } : undefined;
  }

  private get step() {
    return TAU / Math.max(1, this.cats.length);
  }

  /* ---- moving ---- */

  private emit(name: string, detail?: unknown) {
    this.dispatchEvent(new CustomEvent(name, { detail, bubbles: true, composed: true }));
  }

  private swell(n: number) {
    this.background?.pulse(n);
  }

  private use() {
    this.uses++;
  }

  private setFocus(n: number) {
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
  }

  private activate() {
    const cur = this.current;
    if (!cur) return;
    this.pressed = this.focusIndex;
    this.requestUpdate();
    setTimeout(() => {
      this.pressed = -1;
      this.requestUpdate();
    }, 240);
    this.emit('ui-select', { item: cur.item, category: cur.cat });
    this.swell(1.6);
  }

  private openOptions() {
    const cur = this.current;
    if (!cur?.item.options?.length) return;
    this.options = cur.item.options;
    this.optIndex = 0;
  }

  private chooseOption() {
    const option = this.options?.[this.optIndex];
    const cur = this.current;
    this.options = null;
    if (option && cur) this.emit('ui-option', { option, item: cur.item, category: cur.cat });
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
  private nearestCat() {
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
      this.rot += (this.target - this.rot) * (this.reduce ? 1 : 1 - Math.exp(-dt / 110));
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

  private onPointerDown = (e: PointerEvent) => {
    if (e.button !== 0 || (e.target as HTMLElement).closest?.('.options')) return;
    this.drag = { x: e.clientX, y: e.clientY, last: 0, t: performance.now(), v: 0, axis: null, id: e.pointerId };
  };

  private onPointerMove = (e: PointerEvent) => {
    const d = this.drag;
    if (!d || e.pointerId !== d.id) return;
    if (!d.axis) {
      const dx = e.clientX - d.x;
      const dy = e.clientY - d.y;
      if (Math.hypot(dx, dy) < DRAG_START) return;
      d.axis = Math.abs(dx) >= Math.abs(dy) ? 'x' : 'y';
      d.last = d.axis === 'x' ? d.x : d.y;
      try {
        this.root?.setPointerCapture(e.pointerId);
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

  private onPointerUp = () => {
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

  private onKey = (e: KeyboardEvent) => {
    if (e.ctrlKey || e.metaKey || e.altKey) return;
    const key = e.key;
    let handled = true;
    if (this.options) {
      if (key === 'ArrowDown') this.optIndex = Math.min(this.options.length - 1, this.optIndex + 1);
      else if (key === 'ArrowUp') this.optIndex = Math.max(0, this.optIndex - 1);
      else if (key === 'Enter' || key === ' ') this.chooseOption();
      else if (['Escape', 'ArrowLeft', 'Backspace', 'ContextMenu'].includes(key)) this.options = null;
      else handled = false;
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

  private onWheel = (e: WheelEvent) => {
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
    this.settleTimer = window.setTimeout(() => this.settle(), SETTLE_MS);
  };

  private showHover(label: string, target: HTMLElement, side: 'above' | 'right') {
    const rr = this.root?.getBoundingClientRect();
    const tr = target.getBoundingClientRect();
    if (!rr) return;
    this.hover =
      side === 'above'
        ? { label, side, x: tr.left - rr.left + tr.width / 2, y: tr.top - rr.top - 8 }
        : { label, side, x: tr.right - rr.left + 12, y: tr.top - rr.top + tr.height / 2 };
  }

  private clickCat(i: number) {
    if (this.suppressClick) return;
    this.use();
    // a category that is a choice by itself opens on a second click, as an item does
    const opens = i === this.cat && !this.query && !this.cats[i]?.items.length;
    this.setQuery('');
    if (opens) this.activate();
    else this.setCat(i);
  }

  private clickItem(j: number) {
    if (this.suppressClick) return;
    this.use();
    if (j === this.focusIndex) this.activate();
    else this.setFocus(j);
  }

  /* ---- lifecycle ---- */

  override connectedCallback() {
    super.connectedCallback();
    // on the host, not the drawn menu: an empty menu draws a different element, which would drop them
    this.addEventListener('wheel', this.onWheel, { passive: false });
    if (this.hasUpdated) this.observe();
  }

  override disconnectedCallback() {
    super.disconnectedCallback();
    this.removeEventListener('wheel', this.onWheel);
    this.resizeObserver?.disconnect();
    cancelAnimationFrame(this.spinFrame);
    this.spinFrame = 0;
    clearTimeout(this.settleTimer);
  }

  private observe() {
    if (typeof ResizeObserver === 'function') {
      this.resizeObserver ??= new ResizeObserver(() => this.measure());
      this.resizeObserver.observe(this);
    }
    this.measure();
  }

  /** The host and the menu it draws share one box. */
  private measure() {
    const r = this.getBoundingClientRect();
    if (r && (r.width !== this.size.w || r.height !== this.size.h)) this.size = { w: r.width, h: r.height };
  }

  override willUpdate(changed: PropertyValues<this>) {
    if (changed.has('categories') || changed.has('startCategory')) {
      const n = this.cats.length;
      if (changed.has('startCategory') || this.cat >= n) this.cat = clamp(this.startCategory || 0, 0, Math.max(0, n - 1));
      this.rot = this.target = this.cat * this.step;
      if (this.focusIndex >= this.column.length) this.focusByCat.set(this.query ? 'q' : this.cat, Math.max(0, this.column.length - 1));
    }
  }

  override firstUpdated() {
    this.observe();
    setTimeout(() => (this.introDone = true), 1800);
  }

  override updated() {
    const cur = this.current;
    const key = `${this.cat}|${cur?.item.id ?? cur?.item.label ?? ''}|${this.query}`;
    if (key !== this.lastChange) {
      this.lastChange = key;
      this.emit('ui-change', { category: this.cats[this.cat] ?? null, item: cur?.item ?? null, query: this.query });
    }
  }

  /* ---- drawing: one focal point; everything else is placed relative to it ---- */

  private place(p: Place, extra: Record<string, string> = {}) {
    return styleMap({
      transform: `translate3d(${(p.x - 20).toFixed(1)}px, ${(p.y - 20).toFixed(1)}px, ${(p.z ?? 0).toFixed(1)}px) scale(${p.scale})`,
      opacity: String(p.opacity),
      pointerEvents: p.opacity > 0.05 ? '' : 'none',
      filter: p.blur ? `blur(${p.blur.toFixed(1)}px)` : '',
      ...extra,
    });
  }

  private geometry() {
    const { w, h } = this.size;
    const orbit = this.variant === 'orbit';
    const cx = w / 2;
    const rowY = h * this.focusY - (this.variant === 'title' ? 92 : 56);
    const R = orbit ? Math.min(this.pitchX * 2.5, w * 0.4) : this.pitchX * 2.2;
    return { cx, rowY, focus: rowY + 92, R, orbit };
  }

  private catPlaces(): { place: Place; focused: boolean }[] {
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

  private itemPlace(j: number): Place {
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

  static override styles = [
    base,
    css`
      :host { position: absolute; inset: 0; display: block; z-index: var(--layer-menu); }
      .menu {
        position: absolute; inset: 0; overflow: hidden; outline: none; user-select: none; -webkit-user-select: none; touch-action: none;
        font-family: var(--font-sans); color: var(--ink); cursor: grab;
        --wm-ease: var(--ease-out); --wm-dur: var(--motion-base);
      }
      .menu.moving { cursor: grabbing; }
      /* while it follows the hand nothing eases behind it; letting go turns the easing back on, which carries it to rest */
      .moving .cat, .moving .item, .moving .catlabel, .moving .caption { transition-property: opacity, filter; }
      .scene { position: absolute; inset: 0; transform-style: preserve-3d; pointer-events: none; }
      .row, .col { position: absolute; inset: 0; pointer-events: none; transform-style: preserve-3d; }
      .cat, .item {
        position: absolute; left: 0; top: 0; width: 40px; height: 40px; pointer-events: auto; cursor: pointer;
        display: grid; place-items: center; color: var(--ink); transform-origin: 50% 50%;
        transition: transform var(--wm-dur) var(--wm-ease), opacity var(--wm-dur) var(--wm-ease), filter var(--wm-dur) var(--wm-ease);
      }
      .cat:hover, .item:hover { opacity: 0.9 !important; }
      .cat.focus:not(.ai), .item.focus:not(.ai) { filter: drop-shadow(0 0 10px color-mix(in srgb, var(--green) 35%, transparent)); }
      .item.press { animation: press var(--motion-base) var(--wm-ease); }
      @keyframes press { 40% { filter: drop-shadow(0 0 18px color-mix(in srgb, var(--green) 70%, transparent)); } }
      .col { outline: none; }
      .col:focus-visible .item.focus { outline: 1.5px solid var(--focus); outline-offset: 9px; border-radius: 50%; }

      .catlabel, .caption, .hover, .options { position: absolute; left: 0; top: 0; white-space: nowrap; }
      .catlabel {
        font-size: var(--type-small); line-height: var(--leading-small); letter-spacing: var(--tracking-caps); text-transform: uppercase; color: var(--ink-muted);
        transition: transform var(--wm-dur) var(--wm-ease);
      }
      .catlabel.query { text-transform: none; letter-spacing: 0; font-size: var(--type-body); line-height: var(--leading-body); color: var(--green); }
      .caption { text-align: center; transition: transform var(--wm-dur) var(--wm-ease); }
      .title { font-size: var(--type-lead); line-height: var(--leading-lead); font-weight: 600; color: var(--ink); }
      .detail { margin-top: var(--space-1); font-size: var(--type-meta); line-height: var(--leading-meta); color: var(--ink-muted); min-height: 1.3em; }
      .itemlabel { position: absolute; left: 52px; top: 50%; transform: translateY(-50%); white-space: nowrap; font-size: var(--type-meta); line-height: var(--leading-meta); color: var(--ink-muted); pointer-events: none; }
      .item.focus .itemlabel { display: none; }
      .hover { pointer-events: none; font-size: var(--type-meta); line-height: var(--leading-meta); color: var(--ink-muted); opacity: 0; transition: opacity var(--motion-quick); }
      .hover.on { opacity: 1; }
      .options { pointer-events: auto; }
      .opt { position: relative; padding: var(--space-1) 0 var(--space-1) var(--space-4); font-size: var(--type-meta); line-height: var(--leading-meta); color: var(--ink-muted); cursor: pointer; }
      .opt.focus { color: var(--ink); }
      .opt.focus::before { content: ''; position: absolute; left: 0; top: 50%; width: 6px; height: 6px; margin-top: -3px; border-radius: 50%; background: var(--green); }
      .hints {
        position: absolute; left: 50%; bottom: var(--anchor-back); transform: translateX(-50%); white-space: pre; pointer-events: none;
        font-size: var(--type-small); line-height: var(--leading-small); color: var(--ink-muted); opacity: 0.8;
        transition: opacity var(--motion-run) var(--ease-standard);
      }
      .hints.gone { opacity: 0; }
      .live { position: absolute; width: 1px; height: 1px; overflow: hidden; clip: rect(0 0 0 0); white-space: nowrap; }

      /* intro: icons assemble out of blur, from the focus outward; new items assemble the same way */
      @keyframes arrive { from { opacity: 0; transform: translateY(18px) scale(0.7); filter: blur(8px); } }
      @keyframes born { from { opacity: 0; transform: translateY(10px) scale(0.85); filter: blur(6px); } }
      @keyframes fade { from { opacity: 0; } }
      .intro .cat > *, .intro .item > * { animation: arrive var(--motion-calm) var(--ease-out) both; animation-delay: calc(var(--i, 0) * var(--motion-instant) + var(--motion-quick)); }
      .intro .catlabel, .intro .caption { animation: fade var(--motion-run) var(--ease-standard) both; animation-delay: var(--motion-calm); }
      .menu:not(.intro) .item > * { animation: born var(--motion-calm) var(--ease-out) both; animation-delay: calc(var(--k, 0) * var(--motion-instant)); }

      /* Orbit: categories ride a ring receding into depth; items fall away behind the focus */
      .orbit { perspective: 900px; }
      .ring { display: none; position: absolute; left: 0; top: 0; border-radius: 50%; border: 1px solid var(--ink-muted); opacity: 0.24; transform-origin: 50% 50%; }
      .orbit .ring { display: block; }
      .orbit .cat { transition: filter var(--motion-base); }
      .orbit .item { transition-duration: var(--motion-calm); }
      .col, .caption { transition: opacity var(--motion-base) var(--ease-standard), transform var(--wm-dur) var(--wm-ease); }
      .spinning .col, .spinning .caption { opacity: 0.1; }

      /* Title: letterbox, a chapter number, and the focused item set as a film title */
      /* The letterbox is a fade, never a slab: the water shows through it, and the shell's band rests on the top one. */
      .bar { display: none; position: absolute; left: 0; right: 0; height: var(--letterbox); z-index: 2; pointer-events: none; transition: transform var(--motion-run) var(--ease-standard); }
      .title-variant .bar { display: block; }
      /* the shell's band brings its own fade, which is the top of the letterbox, so the menu draws only the bottom one */
      .bar.top { display: none !important; }
      .bar.bottom { bottom: 0; transform: translateY(100%); background: linear-gradient(to top, var(--scrim), transparent); }
      .title-variant.in .bar { transform: none; }
      .title-variant .hints { z-index: 3; bottom: 3.5%; }
      .title-variant .catlabel { font-size: var(--type-label); line-height: var(--leading-label); font-weight: 400; letter-spacing: var(--tracking-title); }
      .title-variant .title { font-size: var(--type-display-fluid); font-weight: 200; letter-spacing: var(--tracking-label); text-transform: uppercase; line-height: var(--leading-display-fluid); margin-right: -0.2em; }
      .title-variant .detail { margin-top: var(--space-4); font-size: var(--type-label); line-height: var(--leading-label); letter-spacing: var(--tracking-title); text-transform: uppercase; }
      .title-variant .caption .title { animation: track var(--motion-run) var(--ease-out) both; }
      .title-variant .caption .detail { animation: fade var(--motion-calm) var(--ease-standard) both; animation-delay: var(--motion-slow); }
      @keyframes track { from { opacity: 0; letter-spacing: calc(var(--tracking-title) * 1.7); filter: blur(10px); } }
      .title-variant .cat.focus, .title-variant .item.focus { filter: none; }

      /* One switch for both: the system's setting, and AUGUR's own (data-motion="reduce" on <html>), which the motion tokens carry in and .reduce marks. */
      .menu.reduce, .menu.reduce * { transition: none !important; animation: none !important; }
      @media (prefers-reduced-motion: reduce) {
        .menu, .menu * { transition: none !important; animation: none !important; }
      }
    `,
  ];

  override render() {
    const cats = this.cats;
    if (!cats.length) return html`<div class="menu" tabindex="-1"></div>`;
    const g = this.geometry();
    const searching = !!this.query;
    const column = this.column;
    const f = this.focusIndex;
    const cur = this.current;
    const variantClass = this.variant === 'title' ? 'title-variant' : 'orbit';
    const showIntro = this.intro && !this.introDone && !this.reduce;
    const ready = this.size.w > 0;
    const shown = this.spinning ? this.nearestCat() : this.cat;
    const num = String(shown + 1).padStart(2, '0');
    const section = cats[shown].section;
    const catText = searching
      ? `“${this.query}”`
      : this.variant === 'title'
        ? `${num}  /  ${cats[shown].label}`
        : section
          ? `${section}  /  ${cats[shown].label}`
          : cats[shown].label;
    const title = cur ? cur.item.label : searching ? 'No matches' : '';
    const detail = cur ? (searching ? [cur.cat.label, cur.item.detail].filter(Boolean).join(' · ') : (cur.item.detail ?? '')) : searching ? 'Esc to clear' : '';
    const hintText = 'Scroll or drag to move · Enter to open · Esc to go back';
    const live = cur
      ? column.length
        ? `${cur.item.label}, ${f + 1} of ${column.length}${searching ? '' : `, ${cats[this.cat].label}`}`
        : cur.item.label
      : searching
        ? 'No matches'
        : '';
    const places = this.catPlaces();
    const uid = 'm';

    return html`
      <div
        class="menu ${variantClass} ${showIntro ? 'intro' : ''} ${ready ? 'in' : ''} ${this.spinning ? 'spinning' : ''} ${this.moving ? 'moving' : ''} ${this.reduce ? 'reduce' : ''}"
        style=${styleMap({ perspectiveOrigin: `${g.cx}px ${g.orbit ? g.rowY - 290 : g.rowY}px`, opacity: ready ? '' : '0' })}
        @keydown=${this.onKey}
        @pointerdown=${this.onPointerDown}
        @pointermove=${this.onPointerMove}
        @pointerup=${this.onPointerUp}
        @pointercancel=${this.onPointerUp}
        @mousedown=${(e: MouseEvent) => {
          // the listbox keeps focus wherever the menu is pressed, so the keys go on working after a click on a category
          e.preventDefault();
          this.focus();
          if (e.button === 0 && this.options && !(e.target as HTMLElement).closest?.('.options')) this.options = null;
        }}
        @contextmenu=${(e: Event) => e.preventDefault()}
      >
        <div class="scene">
          <div
            class="ring"
            style=${styleMap({
              width: `${2 * g.R}px`,
              height: `${2 * g.R}px`,
              transform: `translate3d(${g.cx - g.R}px, ${g.rowY - g.R}px, ${-g.R}px) rotateX(90deg) rotateZ(${((this.rot * 180) / Math.PI).toFixed(2)}deg)`,
            })}
          ></div>
          <div class="row" role="tablist" aria-label=${this.label}>
            ${cats.map(
              (c, i) => html`<div
                id="${uid}-c${i}"
                class="cat ${places[i].focused ? 'focus' : ''} ${c.ai ? 'ai' : ''}"
                role="tab"
                tabindex="-1"
                aria-selected=${String(i === this.cat && !searching)}
                aria-controls="${uid}-list"
                aria-label=${c.label}
                style=${this.place(places[i].place, { '--i': String(Math.abs(i - this.cat)) })}
                @click=${() => this.clickCat(i)}
                @mouseenter=${(e: MouseEvent) => i !== this.cat && this.showHover(c.label, e.currentTarget as HTMLElement, 'above')}
                @mouseleave=${() => (this.hover = null)}
              >
                <ui-icon name=${c.icon ?? 'apps'} size="40" ?bubble=${!!c.ai}></ui-icon>
              </div>`,
            )}
          </div>
          <div
            class="col"
            id="${uid}-list"
            role="listbox"
            tabindex="0"
            aria-label=${searching ? `Results for ${this.query}` : cats[this.cat].label}
            aria-activedescendant=${column.length ? `${uid}-i${f}` : nothing}
          >
            ${keyed(
              searching ? `q:${this.query}` : `c:${this.cat}`,
              html`${column.map(
                (entry, j) => html`<div
                  id="${uid}-i${j}"
                  class="item ${j === f ? 'focus' : ''} ${entry.item.ai ? 'ai' : ''} ${j === this.pressed ? 'press' : ''}"
                  role="option"
                  aria-selected=${String(j === f)}
                  aria-label=${entry.item.label}
                  style=${this.place(this.itemPlace(j), { '--i': String(j + 2), '--k': String(j) })}
                  @click=${() => this.clickItem(j)}
                  @contextmenu=${(e: Event) => {
                    e.preventDefault();
                    this.use();
                    this.setFocus(j);
                    this.openOptions();
                  }}
                  @mouseenter=${(e: MouseEvent) =>
                    j !== this.focusIndex && this.labels !== 'all' && this.showHover(entry.item.label, e.currentTarget as HTMLElement, 'right')}
                  @mouseleave=${() => (this.hover = null)}
                >
                  <ui-icon name=${entry.item.icon ?? 'apps'} size="40" ?bubble=${!!entry.item.ai}></ui-icon>
                  ${this.labels === 'all' ? html`<span class="itemlabel">${entry.item.label}</span>` : nothing}
                </div>`,
              )}`,
            )}
          </div>
          <div class="catlabel ${searching ? 'query' : ''}" style=${styleMap({ transform: `translate(-50%, 0) translate3d(${g.cx}px, ${g.rowY - 62}px, 0)` })}>
            ${catText}
          </div>
          <div class="caption" style=${styleMap({ transform: `translate(-50%, 0) translate3d(${g.cx}px, ${g.focus + (this.variant === 'title' ? 52 : 46)}px, 0)` })}>
            ${keyed(title, html`<div class="title">${title}</div><div class="detail">${detail}</div>`)}
          </div>
          ${this.options
            ? html`<div class="options" role="menu" style=${styleMap({ transform: `translate(${g.cx + 64}px, ${g.focus - 18}px)` })}>
                ${this.options.map(
                  (op, i) => html`<div
                    class="opt ${i === this.optIndex ? 'focus' : ''}"
                    role="menuitem"
                    @mouseenter=${() => (this.optIndex = i)}
                    @click=${(e: Event) => {
                      e.stopPropagation();
                      this.optIndex = i;
                      this.chooseOption();
                    }}
                  >
                    ${op.label}
                  </div>`,
                )}
              </div>`
            : nothing}
        </div>
        <div class="bar top"></div>
        <div class="bar bottom"></div>
        <div
          class="hover ${this.hover ? 'on' : ''}"
          style=${styleMap({
            transform: this.hover
              ? this.hover.side === 'above'
                ? `translate(-50%, -100%) translate(${this.hover.x}px, ${this.hover.y}px)`
                : `translate(0, -50%) translate(${this.hover.x}px, ${this.hover.y}px)`
              : '',
          })}
        >
          ${this.hover?.label ?? ''}
        </div>
        ${this.hints === 'never' ? nothing : html`<div class="hints ${this.hints === 'auto' && this.uses >= 8 ? 'gone' : ''}">${hintText}</div>`}
        <div class="live" aria-live="polite">${live}</div>
      </div>
    `;
  }
}

if (!customElements.get('ui-centre-menu')) customElements.define('ui-centre-menu', UiCentreMenu);

declare global {
  interface HTMLElementTagNameMap {
    'ui-centre-menu': UiCentreMenu;
  }
}
