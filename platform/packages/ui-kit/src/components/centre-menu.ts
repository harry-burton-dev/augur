import { LitElement, css, html, nothing, type PropertyValues } from 'lit';
import { keyed } from 'lit/directives/keyed.js';
import { styleMap } from 'lit/directives/style-map.js';
import { base, reducedMotion } from '../shared.js';
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
  items: MenuItem[];
}

/** Title picks the app (letterbox, chapters, film-title type); Orbit is the menu inside it (a 360° ring). */
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
const mod = (a: number, n: number) => ((a % n) + n) % n;
const clamp = (n: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, n));

/** Search across every category: the label, its keywords and the category's name. */
export function searchMenu(categories: MenuCategory[], query: string): Entry[] {
  const q = query.toLowerCase();
  const out: Entry[] = [];
  for (const cat of categories)
    for (const item of cat.items) if (`${item.label} ${item.keywords ?? ''} ${cat.label}`.toLowerCase().includes(q)) out.push({ item, cat });
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
 * item's options. With the mouse, hovering highlights in place and only a
 * click moves things; Orbit also spins when dragged.
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
  declare private spinning: boolean;
  declare private introDone: boolean;

  /** The focused item in each category, and in the search results under `q`. */
  private focusByCat = new Map<number | 'q', number>();
  private rot = 0;
  private target = 0;
  private spinFrame = 0;
  private drag: { x: number; last: number; t: number; v: number; moved: boolean; id: number } | null = null;
  private suppressClick = false;
  private wheelY = 0;
  private wheelX = 0;
  private lastWheel = 0;
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
    this.introDone = false;
  }

  /* ---- what callers can do ---- */

  override focus(options?: FocusOptions) {
    this.root?.focus({ preventScroll: true, ...options });
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

  /** The focused category, item and query. */
  get state() {
    const cur = this.current;
    return { category: this.cats[this.cat] ?? null, item: cur?.item ?? null, query: this.query };
  }

  /* ---- derived ---- */

  private get root() {
    return this.renderRoot?.querySelector<HTMLElement>('.menu') ?? null;
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
    return this.column[this.focusIndex];
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

  /* ---- Orbit: a continuous ring angle; drag to spin with inertia, release snaps to a category ---- */

  private nearestCat() {
    return mod(Math.round(this.rot / this.step), this.cats.length);
  }

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

  private onPointerDown = (e: PointerEvent) => {
    if (this.variant !== 'orbit' || e.button !== 0 || (e.target as HTMLElement).closest?.('.options')) return;
    this.drag = { x: e.clientX, last: e.clientX, t: performance.now(), v: 0, moved: false, id: e.pointerId };
  };

  private onPointerMove = (e: PointerEvent) => {
    const d = this.drag;
    if (!d || e.pointerId !== d.id) return;
    if (!d.moved && Math.abs(e.clientX - d.x) < 5) return;
    if (!d.moved) {
      d.moved = true;
      try {
        this.root?.setPointerCapture(e.pointerId);
      } catch {
        /* the pointer may already be gone */
      }
      this.spinning = true;
      this.options = null;
      this.hover = null;
      cancelAnimationFrame(this.spinFrame);
      this.spinFrame = 0;
    }
    const now = performance.now();
    const dx = e.clientX - d.last;
    const k = this.step / (this.pitchX * 1.1);
    this.rot -= dx * k;
    this.target = this.rot;
    d.v = 0.75 * d.v + 0.25 * ((-dx * k) / Math.max(1, now - d.t));
    d.last = e.clientX;
    d.t = now;
    this.requestUpdate();
  };

  private onPointerUp = () => {
    const d = this.drag;
    this.drag = null;
    if (!d?.moved) return;
    this.suppressClick = true;
    setTimeout(() => (this.suppressClick = false), 0);
    this.spinning = false;
    if (performance.now() - d.t > 90) d.v = 0; // held still before letting go: no throw
    const idx = Math.round((this.rot + d.v * 300) / this.step);
    const i = mod(idx, this.cats.length);
    this.target = idx * this.step;
    this.use();
    if (i !== this.cat || this.query) {
      this.query = '';
      this.cat = i;
      this.options = null;
      this.swell(1);
    }
    this.spin();
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
    const now = performance.now();
    if (now - this.lastWheel > 200) this.wheelY = this.wheelX = 0;
    this.lastWheel = now;
    const across = e.shiftKey || Math.abs(e.deltaX) > Math.abs(e.deltaY);
    if (across) {
      this.wheelX += e.shiftKey ? e.deltaY : e.deltaX;
      if (Math.abs(this.wheelX) >= 60) {
        this.setCat(this.cat + (this.wheelX > 0 ? 1 : -1));
        this.wheelX = 0;
        this.use();
      }
    } else {
      this.wheelY += e.deltaY;
      if (Math.abs(this.wheelY) >= 50) {
        if (!this.options) this.moveItem(this.wheelY > 0 ? 1 : -1);
        this.wheelY = 0;
        this.use();
      }
    }
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
    this.setQuery('');
    this.setCat(i);
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
    if (this.hasUpdated) this.observe();
  }

  override disconnectedCallback() {
    super.disconnectedCallback();
    this.resizeObserver?.disconnect();
    cancelAnimationFrame(this.spinFrame);
    this.spinFrame = 0;
  }

  private observe() {
    const root = this.root;
    if (!root) return;
    if (typeof ResizeObserver === 'function') {
      this.resizeObserver ??= new ResizeObserver(() => this.measure());
      this.resizeObserver.observe(root);
    }
    this.measure();
  }

  private measure() {
    const r = this.root?.getBoundingClientRect();
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
    this.root?.addEventListener('wheel', this.onWheel, { passive: false });
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
            scale: 0.86 + 0.14 * dep + (this.drag ? 0.12 : 0.3) * wt,
            opacity: searching ? 0.1 : Math.max(0.14 + 0.62 * Math.pow(dep, 1.6), wt),
            blur: (1 - dep) * 1.6 * (1 - wt),
          },
          focused: !searching && !this.drag && wt > 0.9,
        };
      });
    }
    return this.cats.map((_, i) => {
      const d = i - this.cat;
      const ad = Math.abs(d);
      const title = this.variant === 'title';
      const opacity = searching
        ? title
          ? 0.08
          : 0.12
        : title
          ? [0.9, 0.3, 0.12][ad] ?? 0
          : [1, 0.5, 0.28, 0.12][ad] ?? 0;
      return {
        place: { x: g.cx + d * this.pitchX, y: g.rowY, scale: title ? (d === 0 ? 1.05 : 0.8) : d === 0 ? 1.3 : 1, opacity },
        focused: d === 0 && !searching,
      };
    });
  }

  private itemPlace(j: number): Place {
    const g = this.geometry();
    const d = j - this.focusIndex;
    const py = this.pitchY;
    if (this.variant === 'orbit') {
      // items recede by scale and blur, not depth, so they never ride up into the caption
      if (d === 0) return { x: g.cx, y: g.focus, scale: 1.35, opacity: 1 };
      if (d > 0) return { x: g.cx, y: g.focus + 128 + (d - 1) * py * 0.78, scale: 1 - d * 0.12, blur: d * 0.9, opacity: d <= 4 ? 0.7 - d * 0.14 : 0 };
      return { x: g.cx, y: g.rowY - 100, scale: 0.7, opacity: 0 }; // the ring owns the space above
    }
    // title
    if (d === 0) return { x: g.cx, y: g.focus, scale: 1.1, opacity: 1 };
    if (d > 0) return { x: g.cx, y: g.focus + 196 + (d - 1) * py, scale: 0.9, opacity: d === 1 ? 0.22 : 0 };
    return { x: g.cx, y: g.rowY - 104 - (-d - 1) * py, scale: 0.9, opacity: d === -1 ? 0.18 : 0 };
  }

  static override styles = [
    base,
    css`
      :host { position: absolute; inset: 0; display: block; z-index: var(--layer-menu); }
      .menu {
        position: absolute; inset: 0; overflow: hidden; outline: none; user-select: none; -webkit-user-select: none; touch-action: none;
        font-family: var(--font-sans); color: var(--ink);
        --wm-ease: cubic-bezier(0.2, 0.7, 0.2, 1); --wm-dur: 280ms;
      }
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
      .menu:focus-visible .item.focus { outline: 1.5px solid var(--focus); outline-offset: 9px; border-radius: 50%; }

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
      .orbit { perspective: 900px; cursor: grab; }
      .orbit.spinning { cursor: grabbing; }
      .ring { display: none; position: absolute; left: 0; top: 0; border-radius: 50%; border: 1px solid var(--ink-muted); opacity: 0.24; transform-origin: 50% 50%; }
      .orbit .ring { display: block; }
      .orbit .cat { transition: filter var(--motion-base); }
      .orbit .item { transition-duration: var(--motion-calm); }
      .orbit .col, .orbit .caption { transition: opacity var(--motion-base) var(--ease-standard), transform var(--wm-dur) var(--wm-ease); }
      .orbit.spinning .col, .orbit.spinning .caption { opacity: 0.1; }

      /* Title: letterbox, a chapter number, and the focused item set as a film title */
      .bar { display: none; position: absolute; left: 0; right: 0; height: var(--letterbox); z-index: 2; background: var(--slate-deep); transition: transform var(--motion-run) var(--ease-standard); }
      .title-variant .bar { display: block; }
      .bar.top { top: 0; transform: translateY(-100%); }
      .bar.bottom { bottom: 0; transform: translateY(100%); }
      .title-variant.in .bar { transform: none; }
      .title-variant .hints { z-index: 3; bottom: 3.5%; }
      .title-variant .catlabel { font-size: var(--type-label); line-height: var(--leading-label); font-weight: 400; letter-spacing: var(--tracking-title); }
      .title-variant .title { font-size: var(--type-display-fluid); font-weight: 200; letter-spacing: var(--tracking-label); text-transform: uppercase; line-height: var(--leading-display-fluid); margin-right: -0.2em; }
      .title-variant .detail { margin-top: var(--space-4); font-size: var(--type-label); line-height: var(--leading-label); letter-spacing: var(--tracking-title); text-transform: uppercase; }
      .title-variant .caption .title { animation: track var(--motion-run) var(--ease-out) both; }
      .title-variant .caption .detail { animation: fade var(--motion-calm) var(--ease-standard) both; animation-delay: var(--motion-slow); }
      @keyframes track { from { opacity: 0; letter-spacing: calc(var(--tracking-title) * 1.7); filter: blur(10px); } }
      .title-variant .cat.focus, .title-variant .item.focus { filter: none; }

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
    const cur = column[f];
    const variantClass = this.variant === 'title' ? 'title-variant' : 'orbit';
    const showIntro = this.intro && !this.introDone && !this.reduce;
    const ready = this.size.w > 0;
    const num = String(this.cat + 1).padStart(2, '0');
    const catText = searching
      ? `“${this.query}”`
      : this.variant === 'title'
        ? `${num}  /  ${cats[this.cat].label}`
        : this.drag?.moved
          ? cats[this.nearestCat()].label
          : cats[this.cat].label;
    const title = cur ? cur.item.label : searching ? 'No matches' : '';
    const detail = cur ? (searching ? [cur.cat.label, cur.item.detail].filter(Boolean).join(' · ') : (cur.item.detail ?? '')) : searching ? 'Esc to clear' : '';
    const hintText = `←→ category   ↑↓ item   Enter open   Esc back   Right-click options${this.search ? '   Type to search' : ''}${g.orbit ? '   Drag to spin' : ''}`;
    const live = cur ? `${cur.item.label}, ${f + 1} of ${column.length}${searching ? '' : `, ${cats[this.cat].label}`}` : searching ? 'No matches' : '';
    const places = this.catPlaces();
    const uid = 'm';

    return html`
      <div
        class="menu ${variantClass} ${showIntro ? 'intro' : ''} ${ready ? 'in' : ''} ${this.spinning ? 'spinning' : ''}"
        tabindex="0"
        role="application"
        aria-roledescription="menu"
        aria-label=${this.label}
        aria-activedescendant=${cur ? `${uid}-i${f}` : `${uid}-c${this.cat}`}
        style=${styleMap({ perspectiveOrigin: `${g.cx}px ${g.orbit ? g.rowY - 290 : g.rowY}px`, opacity: ready ? '' : '0' })}
        @keydown=${this.onKey}
        @pointerdown=${this.onPointerDown}
        @pointermove=${this.onPointerMove}
        @pointerup=${this.onPointerUp}
        @pointercancel=${this.onPointerUp}
        @mousedown=${(e: MouseEvent) => {
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
          <div class="row">
            ${cats.map(
              (c, i) => html`<div
                id="${uid}-c${i}"
                class="cat ${places[i].focused ? 'focus' : ''} ${c.ai ? 'ai' : ''}"
                role="menuitem"
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
          ${keyed(
            searching ? `q:${this.query}` : `c:${this.cat}`,
            html`<div class="col">
              ${column.map(
                (entry, j) => html`<div
                  id="${uid}-i${j}"
                  class="item ${j === f ? 'focus' : ''} ${entry.item.ai ? 'ai' : ''} ${j === this.pressed ? 'press' : ''}"
                  role="menuitem"
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
              )}
            </div>`,
          )}
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
