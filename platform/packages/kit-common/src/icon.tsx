import type { LucideIcon, LucideProps } from 'lucide-react';
import {
  Activity, Anchor, Archive, ArrowLeft, ArrowRight, ArrowUpDown, Ban, Bell, BellOff, Bird, Bookmark, Building, Building2, CalendarDays, CalendarRange, Car, ChartColumn, Check, ChevronDown, Clock, Compass, Diamond, Download, EighthNotes, Ellipsis, FileText, Folder, FolderPlus, Gauge, GitPullRequest, History, House, Image, Inbox, Info, KeyRound, LayoutGrid, Library, Link, List, ListFilter, Lock, Mail, Map as MapIcon, MapPin, Monitor, Network, Palette, PanelLeftClose, PanelLeftOpen, PanelRightClose, PanelRightOpen, Pause, Pencil, Plane, Play, Plus, Power, Search, Send, Server, ShieldCheck, Ship, SlidersHorizontal, Sparkles, Star, Tag, Trash2, Triangle, Undo2, Upload, User, UserPlus, UserRound, UsersRound, Video, Warehouse, Wifi, X,
} from 'lucide-react';

/**
 * Line icons from Lucide (ISC licence, lucide.dev) on a 24 grid, drawn in
 * currentColor. The keys are AUGUR's own names, the same as the Lit kit's, so
 * callers never depend on Lucide's naming. To add one, import it above and
 * name it here.
 */
export const icons = {
  apps: LayoutGrid,
  find: Search,
  agents: Sparkles,
  account: UserRound,
  settings: SlidersHorizontal,
  home: House,
  library: Library,
  document: FileText,
  folder: Folder,
  admin: ShieldCheck,
  people: UsersRound,
  'user-plus': UserPlus,
  department: Building2,
  org: Building,
  key: KeyRound,
  plus: Plus,
  bell: Bell,
  chart: ChartColumn,
  close: X,
  back: ArrowLeft,
  arrow: ArrowRight,
  check: Check,
  'chevron-down': ChevronDown,
  // Status shapes: the shape, not only the colour, says which state it is.
  error: Diamond,
  warning: Triangle,
  // Used by the centre menu.
  star: Star,
  clock: Clock,
  compass: Compass,
  mail: Mail,
  image: Image,
  music: EighthNotes,
  video: Video,
  display: Monitor,
  network: Wifi,
  download: Download,
  upload: Upload,
  power: Power,
  palette: Palette,
  pulse: Activity,
  // Row and group actions: the ⋯ that opens a menu, and muting an app.
  more: Ellipsis,
  mute: BellOff,
  // Finding documents: tags, filters, sorting, and saved views.
  tag: Tag,
  filter: ListFilter,
  sort: ArrowUpDown,
  view: Bookmark,
  // Publishing: putting a version out, what's been put out to you, and taking it back.
  publish: Send,
  inbox: Inbox,
  withdraw: Undo2,
  // A run of documents that comes out on a cadence, such as a weekly report.
  series: CalendarRange,
  preview: GitPullRequest,
  // Admin's areas and lists, so nothing repeats the icon of what it sits under.
  list: List,
  structure: Network,
  gauge: Gauge,
  // Finding your way round the platform (Auspex): the app, one person, what's closed to you and why, and what changed.
  explore: Bird,
  person: User,
  lock: Lock,
  blocked: Ban,
  history: History,
  // Auspex's replay, played and paused, and its plant room: the parts AUGUR runs on.
  play: Play,
  pause: Pause,
  server: Server,
  // Data Atlas: the app itself, and the kinds of thing its entities are.
  atlas: MapIcon,
  vessel: Ship,
  aircraft: Plane,
  vehicle: Car,
  place: MapPin,
  port: Anchor,
  facility: Warehouse,
  event: CalendarDays,
  calendar: CalendarDays,
  // App kit: a neutral notice, a line of explanation.
  info: Info,
  // A link between records (`@augur/records`' relations).
  link: Link,
  // ui-app-frame's rail and drawer, open and closed.
  'rail-close': PanelLeftClose,
  'rail-open': PanelLeftOpen,
  'drawer-close': PanelRightClose,
  'drawer-open': PanelRightOpen,
  // An object's actions in ui-radial-menu.
  rename: Pencil,
  delete: Trash2,
  archive: Archive,
  'folder-plus': FolderPlus,
} satisfies Record<string, LucideIcon>;

export type IconName = keyof typeof icons;

export const iconNames = Object.keys(icons) as IconName[];

export interface IconProps extends Omit<LucideProps, 'ref'> {
  /** One of AUGUR's icon names. An unknown name draws nothing rather than a broken glyph. */
  name: IconName | (string & {});
  /** The whole box, in pixels. */
  size?: number;
  /** Only when the icon means something on its own; otherwise readers skip it. */
  label?: string;
}

/** A line icon in currentColor. */
export function Icon({ name, size = 24, label, ...rest }: IconProps) {
  const Glyph = (icons as Record<string, LucideIcon>)[name];
  if (!Glyph) return null;
  return <Glyph size={size} strokeWidth={1.5} aria-hidden={label ? undefined : true} aria-label={label} role={label ? 'img' : undefined} focusable="false" {...rest} />;
}
