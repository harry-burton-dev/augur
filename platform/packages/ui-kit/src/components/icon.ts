import { LitElement, css, html, svg, type SVGTemplateResult } from 'lit';
import { unsafeSVG } from 'lit/directives/unsafe-svg.js';
import {
  Activity, ArrowLeft, ArrowRight, ArrowUpDown, Bell, BellOff, Bookmark, Building, Building2, CalendarRange, ChartColumn, Check, ChevronDown, Clock, Diamond, Download, EighthNotes, Ellipsis,
  FileText, Folder, House, Image, Inbox, KeyRound, LayoutGrid, Library, ListFilter, Mail, Monitor, Palette, Plus, Power, Search,
  Send, ShieldCheck, SlidersHorizontal, Sparkles, Star, Tag, Triangle, Undo2, Upload, UserPlus, UserRound, UsersRound, Video, Wifi, X,
  type IconNode,
} from 'lucide';
import { base } from '../shared.js';

const draw = (node: IconNode): SVGTemplateResult => {
  const markup = node
    .map(([tag, attrs]) => `<${tag} ${Object.entries(attrs).map(([k, v]) => `${k}="${v}"`).join(' ')}/>`)
    .join('');
  return svg`${unsafeSVG(markup)}`;
};

/**
 * Line icons from Lucide (ISC licence, lucide.dev) on a 24 grid, drawn in
 * currentColor. The keys are the kit's own names, so callers never depend on
 * Lucide's naming; to add one, import it above and give it a name here.
 * Gloss only ever comes from the bubble.
 */
export const icons = {
  apps: draw(LayoutGrid),
  find: draw(Search),
  agents: draw(Sparkles),
  account: draw(UserRound),
  settings: draw(SlidersHorizontal),
  home: draw(House),
  library: draw(Library),
  document: draw(FileText),
  folder: draw(Folder),
  admin: draw(ShieldCheck),
  people: draw(UsersRound),
  'user-plus': draw(UserPlus),
  department: draw(Building2),
  org: draw(Building),
  key: draw(KeyRound),
  plus: draw(Plus),
  bell: draw(Bell),
  chart: draw(ChartColumn),
  close: draw(X),
  back: draw(ArrowLeft),
  arrow: draw(ArrowRight),
  check: draw(Check),
  'chevron-down': draw(ChevronDown),
  // Status shapes: the shape, not only the colour, says which state it is.
  error: draw(Diamond),
  warning: draw(Triangle),
  // Used by the centre menu.
  star: draw(Star),
  clock: draw(Clock),
  mail: draw(Mail),
  image: draw(Image),
  music: draw(EighthNotes),
  video: draw(Video),
  display: draw(Monitor),
  network: draw(Wifi),
  download: draw(Download),
  upload: draw(Upload),
  power: draw(Power),
  palette: draw(Palette),
  pulse: draw(Activity),
  // Row and group actions: the ⋯ that opens a menu, and muting an app.
  more: draw(Ellipsis),
  mute: draw(BellOff),
  // Finding documents: tags, filters, sorting, and saved views.
  tag: draw(Tag),
  filter: draw(ListFilter),
  sort: draw(ArrowUpDown),
  view: draw(Bookmark),
  // Publishing: putting a version out, what's been put out to you, and taking it back.
  publish: draw(Send),
  inbox: draw(Inbox),
  withdraw: draw(Undo2),
  // A run of documents that comes out on a cadence, such as a weekly report.
  series: draw(CalendarRange),
} satisfies Record<string, SVGTemplateResult>;

export type IconName = keyof typeof icons;

export const iconNames = Object.keys(icons) as IconName[];

/**
 * A line icon, bare (hairline) or inside a swirling soap bubble lit by one
 * light. Unknown names draw nothing rather than a broken glyph.
 */
export class UiIcon extends LitElement {
  static override properties = {
    name: { type: String },
    bubble: { type: Boolean, reflect: true },
    size: { type: Number },
    label: { type: String },
  };

  declare name: string;
  declare bubble: boolean;
  declare size: number;
  /** Set only when the icon carries meaning on its own; otherwise it is hidden from readers. */
  declare label: string;

  constructor() {
    super();
    this.name = '';
    this.bubble = false;
    this.size = 24;
    this.label = '';
  }

  static override styles = [
    base,
    css`
      :host { display: inline-flex; position: relative; flex: none; color: inherit; }
      svg { width: 100%; height: 100%; display: block; fill: none; stroke: currentColor; stroke-width: 1.5; stroke-linecap: round; stroke-linejoin: round; position: relative; z-index: 1; }
      .rim { display: none; }
      :host([bubble]) {
        border-radius: 50%;
        background:
          radial-gradient(circle at 34% 28%, color-mix(in srgb, var(--light) 75%, transparent) 0, color-mix(in srgb, var(--light) 12%, transparent) 13%, transparent 32%),
          radial-gradient(circle, transparent 58%, color-mix(in srgb, var(--ink) 10%, transparent) 100%);
        box-shadow: 0 0 26px color-mix(in srgb, var(--green) 35%, transparent), 0 10px 18px color-mix(in srgb, var(--shade) 30%, transparent);
      }
      :host([bubble]) svg { stroke-width: 1.75; }
      :host([bubble]) .rim {
        display: block;
        position: absolute;
        inset: 0;
        border-radius: 50%;
        background: conic-gradient(
          color-mix(in srgb, var(--green) 90%, transparent),
          color-mix(in srgb, var(--navy) 90%, transparent),
          color-mix(in srgb, var(--ink) 80%, transparent),
          color-mix(in srgb, var(--green) 60%, transparent),
          color-mix(in srgb, var(--navy) 90%, transparent),
          color-mix(in srgb, var(--green) 90%, transparent)
        );
        -webkit-mask: radial-gradient(closest-side, transparent calc(100% - 2.5px), #000 calc(100% - 1.5px));
        mask: radial-gradient(closest-side, transparent calc(100% - 2.5px), #000 calc(100% - 1.5px));
        animation: ui-swirl var(--motion-drift) linear infinite;
      }
      @keyframes ui-swirl { to { transform: rotate(360deg); } }
    `,
  ];

  override willUpdate() {
    // `size` is the whole box; a bubble keeps its drawing a quarter in from each side.
    this.style.width = this.style.height = `${this.size}px`;
    this.style.padding = this.bubble ? `${this.size / 4}px` : '';
  }

  override render() {
    const drawing = icons[this.name as IconName];
    return html`<span class="rim"></span>${drawing
      ? html`<svg viewBox="0 0 24 24" role=${this.label ? 'img' : 'presentation'} aria-label=${this.label || ''} aria-hidden=${this.label ? 'false' : 'true'}>${drawing}</svg>`
      : ''}`;
  }
}

if (!customElements.get('ui-icon')) customElements.define('ui-icon', UiIcon);

declare global {
  interface HTMLElementTagNameMap {
    'ui-icon': UiIcon;
  }
}
