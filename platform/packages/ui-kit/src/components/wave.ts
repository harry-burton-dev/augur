import { LitElement, css, html, unsafeCSS } from 'lit';
import { reducedMotion } from '../shared.js';

/**
 * The water: soft navy and green bands drifting over a slate radial ground,
 * blurred into a glow and finished with a fine grain. Engine and presets from
 * the design system's Wave Background Tuner.
 */

export type WaveGroup = 'navy' | 'green';

export interface WaveColours {
  navy: string;
  green: string;
  slate: string;
  slateDeep: string;
}

export interface WaveGlobal {
  speed: number;
  /** Blur in px; it hides the low drawing resolution. */
  blur: number;
  sat: number;
  /** The canvas draws at this fraction of the element's size. Keep it low: it is what keeps the water cheap. */
  res: number;
  grain: number;
  /** How much each band swells and fades while it drifts, 0 to 1. */
  breathe: number;
}

/** One band. `y`, `amp` and `thick` are fractions of the height, `len` of the width; a negative `speed` drifts backwards. */
export interface WaveBand {
  group: WaveGroup;
  y: number;
  amp: number;
  len: number;
  speed: number;
  thick: number;
  alpha: number;
  phase: number;
}

export interface WaveConfig {
  colors: WaveColours;
  global: WaveGlobal;
  waves: WaveBand[];
}

export const wavePresets = {
  'Calm Tide': {
    colors: { navy: '#1E40AF', green: '#34D399', slate: '#2A3240', slateDeep: '#1C222C' },
    global: { speed: 1, blur: 18, sat: 1.15, res: 0.35, grain: 0.06, breathe: 0.2 },
    waves: [
      { group: 'navy', y: 0.62, amp: 0.1, len: 1.3, speed: 0.8, thick: 0.22, alpha: 0.85, phase: 0 },
      { group: 'navy', y: 0.7, amp: 0.07, len: 0.9, speed: -0.5, thick: 0.14, alpha: 0.55, phase: 2.1 },
      { group: 'green', y: 0.42, amp: 0.08, len: 1.1, speed: 1.1, thick: 0.1, alpha: 0.55, phase: 1.3 },
      { group: 'green', y: 0.48, amp: 0.05, len: 0.7, speed: -0.7, thick: 0.06, alpha: 0.35, phase: 4 },
    ],
  },
  'Deep Ocean': {
    colors: { navy: '#1D4ED8', green: '#10B981', slate: '#1F2733', slateDeep: '#0F141B' },
    global: { speed: 0.5, blur: 34, sat: 1.0, res: 0.25, grain: 0.05, breathe: 0.15 },
    waves: [
      { group: 'navy', y: 0.72, amp: 0.14, len: 1.8, speed: 0.5, thick: 0.4, alpha: 0.9, phase: 0 },
      { group: 'navy', y: 0.85, amp: 0.08, len: 1.2, speed: -0.3, thick: 0.3, alpha: 0.6, phase: 1.4 },
      { group: 'green', y: 0.58, amp: 0.1, len: 1.5, speed: 0.6, thick: 0.12, alpha: 0.3, phase: 2.6 },
    ],
  },
  Aurora: {
    colors: { navy: '#2563EB', green: '#34D399', slate: '#26303D', slateDeep: '#151A22' },
    global: { speed: 1.4, blur: 26, sat: 1.35, res: 0.3, grain: 0.07, breathe: 0.35 },
    waves: [
      { group: 'green', y: 0.3, amp: 0.12, len: 0.9, speed: 1.2, thick: 0.16, alpha: 0.75, phase: 0 },
      { group: 'green', y: 0.36, amp: 0.09, len: 0.6, speed: -0.9, thick: 0.08, alpha: 0.5, phase: 2.5 },
      { group: 'navy', y: 0.45, amp: 0.14, len: 1.1, speed: 0.7, thick: 0.24, alpha: 0.7, phase: 1.1 },
      { group: 'navy', y: 0.25, amp: 0.06, len: 1.4, speed: -0.4, thick: 0.1, alpha: 0.4, phase: 3.3 },
    ],
  },
  'Sonar Line': {
    colors: { navy: '#3B82F6', green: '#34D399', slate: '#2A3240', slateDeep: '#1A2029' },
    global: { speed: 0.8, blur: 6, sat: 1.2, res: 0.6, grain: 0.04, breathe: 0.4 },
    waves: [
      { group: 'navy', y: 0.55, amp: 0.06, len: 1.0, speed: 0.9, thick: 0.02, alpha: 0.9, phase: 0 },
      { group: 'navy', y: 0.58, amp: 0.04, len: 0.7, speed: -0.6, thick: 0.015, alpha: 0.5, phase: 2 },
      { group: 'green', y: 0.52, amp: 0.05, len: 0.8, speed: 1.3, thick: 0.015, alpha: 0.8, phase: 1 },
    ],
  },
  Minimal: {
    colors: { navy: '#1E40AF', green: '#34D399', slate: '#2E3644', slateDeep: '#252C38' },
    global: { speed: 0.4, blur: 40, sat: 1.0, res: 0.2, grain: 0.03, breathe: 0.1 },
    waves: [
      { group: 'navy', y: 0.75, amp: 0.06, len: 2.0, speed: 0.4, thick: 0.3, alpha: 0.55, phase: 0 },
      { group: 'green', y: 0.3, amp: 0.05, len: 2.0, speed: -0.4, thick: 0.2, alpha: 0.22, phase: 2 },
    ],
  },
  'Split Field': {
    colors: { navy: '#1E40AF', green: '#34D399', slate: '#2A3240', slateDeep: '#1C222C' },
    global: { speed: 0.9, blur: 22, sat: 1.2, res: 0.3, grain: 0.06, breathe: 0.25 },
    waves: [
      { group: 'green', y: 0.18, amp: 0.06, len: 1.2, speed: 0.8, thick: 0.18, alpha: 0.55, phase: 0 },
      { group: 'green', y: 0.24, amp: 0.04, len: 0.8, speed: -0.6, thick: 0.08, alpha: 0.35, phase: 2 },
      { group: 'navy', y: 0.82, amp: 0.06, len: 1.2, speed: -0.8, thick: 0.24, alpha: 0.85, phase: 1 },
      { group: 'navy', y: 0.76, amp: 0.04, len: 0.8, speed: 0.6, thick: 0.1, alpha: 0.5, phase: 3 },
    ],
  },
} satisfies Record<string, WaveConfig>;

export type WavePreset = keyof typeof wavePresets;

export const DEFAULT_WAVE: WavePreset = 'Calm Tide';

const TOKEN_VARS: Record<keyof WaveColours, string> = { navy: '--navy', green: '--green', slate: '--slate', slateDeep: '--slate-deep' };

const GRAIN =
  "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='120' height='120'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='.9' numOctaves='2'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E\")";

export interface WaveOverrides {
  colors?: Partial<WaveColours>;
  global?: Partial<WaveGlobal>;
  waves?: WaveBand[];
}

/**
 * A preset with any overrides on top. The default takes its colours from the
 * tokens when they are given, so a token change reaches it; variants keep their own.
 */
export function resolveWave(preset: string = DEFAULT_WAVE, overrides: WaveOverrides = {}, tokens: Partial<WaveColours> = {}): WaveConfig {
  const name = (preset in wavePresets ? preset : DEFAULT_WAVE) as WavePreset;
  const base = wavePresets[name];
  return {
    colors: { ...base.colors, ...(name === DEFAULT_WAVE ? tokens : {}), ...overrides.colors },
    global: { ...base.global, ...overrides.global },
    waves: (overrides.waves ?? base.waves).map((w) => ({ ...w })),
  };
}

/** Where a band's centre line sits at x and time t: two sine waves added together, so there is no loop point. */
export function waveY(w: WaveBand, x: number, t: number, width: number, height: number): number {
  const k = (Math.PI * 2) / (width * w.len);
  return (
    height * w.y +
    Math.sin(x * k + t * w.speed + w.phase) * height * w.amp +
    Math.sin(x * k * 0.47 - t * w.speed * 0.6 + w.phase * 1.7) * height * w.amp * 0.5
  );
}

const rgb = (hex: string) => {
  let h = hex.trim().replace(/^#/, '');
  if (h.length === 3) h = h.replace(/./g, (c) => c + c);
  const n = parseInt(h.slice(0, 6), 16) || 0;
  return `${(n >> 16) & 255},${(n >> 8) & 255},${n & 255}`;
};

/**
 * The water, filling its positioned parent behind everything else. Use Calm
 * Tide unless a screen has a reason not to; pick one variant per screen.
 *
 * Drawing pauses while it is off screen or the tab is hidden, and holds still
 * under reduced motion. `pulse()` swells the bands, then they settle: the
 * centre menu calls it as you move.
 */
export class UiWaveBackground extends LitElement {
  static override properties = {
    preset: { type: String, reflect: true },
    colors: { attribute: false },
    global: { attribute: false },
    waves: { attribute: false },
    paused: { type: Boolean, reflect: true },
  };

  declare preset: string;
  declare colors: Partial<WaveColours> | undefined;
  declare global: Partial<WaveGlobal> | undefined;
  declare waves: WaveBand[] | undefined;
  declare paused: boolean;

  private config: WaveConfig = resolveWave();
  private ctx: CanvasRenderingContext2D | null = null;
  private canvas?: HTMLCanvasElement;
  private w = 1;
  private h = 1;
  private t = 0;
  private boost = 0;
  private last: number | null = null;
  private raf = 0;
  private visible = true;
  private resizeObserver?: ResizeObserver;
  private intersection?: IntersectionObserver;
  private get reduce() {
    return reducedMotion();
  }

  constructor() {
    super();
    this.preset = DEFAULT_WAVE;
    this.paused = false;
  }

  static override styles = css`
    :host { position: absolute; inset: 0; display: block; overflow: hidden; pointer-events: none; z-index: var(--layer-ground, 0); border-radius: inherit; }
    .ground, canvas, .grain { position: absolute; inset: 0; width: 100%; height: 100%; }
    canvas { display: block; mix-blend-mode: screen; }
    .grain { background-image: ${unsafeCSS(GRAIN)}; }
  `;

  /** The resolved settings in use now. */
  getConfig(): WaveConfig {
    return resolveWave(this.preset, { colors: this.colors, global: this.global, waves: this.waves }, this.tokenColours());
  }

  get time() {
    return this.t;
  }

  play() {
    this.paused = false;
  }

  pause() {
    this.paused = true;
  }

  seek(time: number) {
    this.t = +time || 0;
    this.draw();
  }

  /** A swell: the bands speed up and brighten, then settle over about a second. */
  pulse(amount = 1) {
    if (!this.reduce) this.boost = Math.min(2.5, this.boost + amount);
  }

  /** Read the colour tokens again, after a theme change. */
  refreshColours() {
    this.applyConfig();
  }

  private tokenColours(): Partial<WaveColours> {
    if (!this.isConnected) return {};
    const cs = getComputedStyle(this);
    const out: Partial<WaveColours> = {};
    for (const [key, name] of Object.entries(TOKEN_VARS) as [keyof WaveColours, string][]) {
      const v = cs.getPropertyValue(name).trim();
      if (/^#[0-9a-f]{3,8}$/i.test(v)) out[key] = v;
    }
    return out;
  }

  override willUpdate(changed: Map<string, unknown>) {
    if (changed.has('preset') || changed.has('colors') || changed.has('global') || changed.has('waves')) this.config = this.getConfig();
  }

  override updated(changed: Map<string, unknown>) {
    if (changed.has('preset') || changed.has('colors') || changed.has('global') || changed.has('waves')) this.resize();
  }

  override render() {
    const { colors: c, global: g } = this.config;
    return html`<div class="ground" style="background: radial-gradient(120% 90% at 50% 40%, ${c.slate} 0%, ${c.slateDeep} 100%)"></div>
      <canvas style="filter: blur(${g.blur}px) saturate(${g.sat})"></canvas>
      <div class="grain" style="opacity: ${g.grain}"></div>`;
  }

  override firstUpdated() {
    this.canvas = this.renderRoot.querySelector('canvas') ?? undefined;
    try {
      this.ctx = this.canvas?.getContext('2d') ?? null;
    } catch {
      this.ctx = null; // no canvas: the radial ground alone, which is also what shows while it starts
    }
    this.start();
  }

  override connectedCallback() {
    super.connectedCallback();
    if (this.hasUpdated) this.start();
  }

  override disconnectedCallback() {
    super.disconnectedCallback();
    cancelAnimationFrame(this.raf);
    this.raf = 0;
    this.resizeObserver?.disconnect();
    this.intersection?.disconnect();
  }

  private start() {
    if (this.raf) return;
    if (typeof ResizeObserver === 'function') {
      this.resizeObserver ??= new ResizeObserver(() => this.resize());
      this.resizeObserver.observe(this);
    }
    if (typeof IntersectionObserver === 'function') {
      this.intersection ??= new IntersectionObserver((entries) => (this.visible = entries[0]?.isIntersecting ?? true));
      this.intersection.observe(this);
    }
    this.applyConfig();
    this.last = null;
    this.raf = requestAnimationFrame(this.frame);
  }

  private applyConfig() {
    this.config = this.getConfig();
    this.requestUpdate();
    this.resize();
  }

  private resize() {
    if (!this.canvas) return;
    const r = this.getBoundingClientRect();
    this.w = this.canvas.width = Math.max(1, Math.floor(r.width * this.config.global.res));
    this.h = this.canvas.height = Math.max(1, Math.floor(r.height * this.config.global.res));
    this.draw();
  }

  private frame = (now: number) => {
    this.raf = requestAnimationFrame(this.frame);
    const dt = this.last == null ? 0 : Math.min(50, now - this.last); // clamped, so a tab switch doesn't jump
    this.last = now;
    if (this.paused || this.reduce) return;
    this.t += dt * 0.0012 * this.config.global.speed * (1 + 2.4 * this.boost);
    this.boost *= Math.exp(-dt / 650);
    if (this.boost < 0.002) this.boost = 0;
    if (this.visible && !document.hidden) this.draw();
  };

  private draw() {
    const ctx = this.ctx;
    if (!ctx) return;
    ctx.clearRect(0, 0, this.w, this.h);
    ctx.globalCompositeOperation = 'lighter';
    for (const w of this.config.waves) this.drawBand(ctx, w);
    ctx.globalCompositeOperation = 'source-over';
  }

  private drawBand(ctx: CanvasRenderingContext2D, w: WaveBand) {
    const { w: W, h: H, t } = this;
    const step = Math.max(3, W / 80);
    const half = Math.max(0.5, H * w.thick * 0.5);
    const b = this.config.global.breathe;
    const a = Math.max(0, w.alpha * (1 - b + b * Math.sin(t * 0.7 + w.phase)) * (1 + 0.55 * this.boost));
    const colour = rgb(this.config.colors[w.group] ?? '#ffffff');
    ctx.beginPath();
    for (let x = -step; x <= W + step; x += step) ctx.lineTo(x, waveY(w, x, t, W, H) - half);
    for (let x = W + step; x >= -step; x -= step) ctx.lineTo(x, waveY(w, x, t, W, H) + half);
    ctx.closePath();
    const cy = H * w.y;
    const ext = half + H * w.amp * 1.5;
    const g = ctx.createLinearGradient(0, cy - ext, 0, cy + ext);
    g.addColorStop(0, `rgba(${colour},0)`);
    g.addColorStop(0.5, `rgba(${colour},${a})`);
    g.addColorStop(1, `rgba(${colour},0)`);
    ctx.fillStyle = g;
    ctx.fill();
  }
}

if (!customElements.get('ui-wave-background')) customElements.define('ui-wave-background', UiWaveBackground);

declare global {
  interface HTMLElementTagNameMap {
    'ui-wave-background': UiWaveBackground;
  }
}
