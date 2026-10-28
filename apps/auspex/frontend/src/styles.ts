import { html } from 'lit';

/**
 * Auspex's look, from the kit's foundation tokens only: its colours, type
 * styles, space scale, radii, surfaces and structure. Pictures do the work
 * tables would elsewhere: the map, floor orbs, app tiles, people as discs and
 * the week as a line of days.
 */
export const styles = html`<style>
  auspex-app, auspex-access { display: block; color: var(--ink); font-family: var(--font-sans); }
  .ax-stage { width: min(var(--measure-wide), 100% - 2 * var(--edge)); margin: 0 auto; padding: var(--space-6) 0 var(--space-8); display: flex; flex-direction: column; gap: var(--space-5); }
  .ax-pane { background: var(--surface-pane); backdrop-filter: blur(var(--surface-blur)); -webkit-backdrop-filter: blur(var(--surface-blur)); border-radius: var(--radius-card); padding: var(--space-6); display: flex; flex-direction: column; gap: var(--space-5); min-width: 0; }
  .ax-label { font-size: var(--type-label); line-height: var(--leading-label); letter-spacing: var(--tracking-label); text-transform: uppercase; color: var(--ink-muted); margin: 0; font-weight: 400; }
  .ax-muted { color: var(--ink-muted); }
  .ax-meta { font-size: var(--type-meta); line-height: var(--leading-meta); }
  .ax-section { display: flex; flex-direction: column; gap: var(--space-4); min-width: 0; }

  /* The "You can" line: at most two actions, and why. */
  .ax-can { display: flex; flex-direction: column; gap: var(--space-3); border-top: 1px solid var(--hairline); padding-top: var(--space-4); }
  .ax-can .acts { display: flex; flex-wrap: wrap; align-items: center; gap: var(--space-3) var(--space-5); }
  .ax-can p { margin: 0; font-size: var(--type-meta); line-height: var(--leading-meta); color: var(--ink-muted); max-width: var(--measure-prose); }
  .ax-can p b { color: var(--ink); font-weight: 400; }

  /* The map */
  .ax-map { overflow-x: auto; margin: 0 calc(-1 * var(--space-3)); padding: 0 var(--space-3); }
  .auspex-map { width: 100%; height: auto; display: block; font-family: var(--font-sans); overflow: visible; }
  .auspex-map .link { fill: none; stroke: var(--hairline-strong); stroke-width: 1; }
  .auspex-map .link.closed { stroke: var(--hairline); stroke-dasharray: 2 4; }
  .auspex-map .link.lit { stroke: var(--floor-team-high); stroke-width: 2; opacity: 0.8; }
  .auspex-map .node { cursor: pointer; outline: none; }
  .auspex-map .hit { fill: transparent; }
  .auspex-map .mark { stroke-width: 1.5; transition: transform var(--motion-quick) var(--ease-out); }
  .auspex-map .org .mark { fill: url(#auspex-org); stroke: var(--floor-org-high); }
  .auspex-map .team.stand .mark { fill: url(#auspex-team); stroke: var(--floor-team-high); }
  .auspex-map .team.see .mark { fill: var(--slate-deep); stroke: var(--floor-team-high); stroke-dasharray: 3 2.5; }
  .auspex-map .team.closed .mark { fill: none; stroke: var(--ink-muted); }
  .auspex-map .halo { fill: none; stroke: var(--green); stroke-width: 2; }
  .auspex-map .halo.ping { transform-origin: 0 0; animation: ax-ping var(--motion-ping) var(--ease-ping) infinite; }
  .auspex-map text { paint-order: stroke; stroke: var(--slate-deep); stroke-width: 5px; stroke-linejoin: round; }
  .auspex-map .name { fill: var(--ink); font-size: var(--type-body); dominant-baseline: middle; }
  .auspex-map .closed .name { fill: var(--ink-muted); font-size: var(--type-meta); }
  .auspex-map .folded { fill: var(--ink-muted); font-size: var(--type-small); }
  .auspex-map .why { fill: var(--ink-muted); font-size: var(--type-small); dominant-baseline: middle; }
  .auspex-map .closed .why { display: none; }
  .auspex-map .lock { color: var(--ink-muted); }
  .auspex-map .lock path, .auspex-map .lock rect, .auspex-map .lock circle { fill: none; stroke: currentColor; stroke-width: 2; stroke-linecap: round; stroke-linejoin: round; }
  .auspex-map .node:hover .mark, .auspex-map .node:focus-visible .mark { transform: scale(1.25); }
  .auspex-map .node:focus-visible .hit { stroke: var(--focus); stroke-width: 2; }
  .auspex-map .node:hover .name, .auspex-map .node:focus-visible .name { text-decoration: underline; text-underline-offset: 4px; }
  @keyframes ax-ping { from { transform: scale(1); opacity: 0.7; } to { transform: scale(1.8); opacity: 0; } }

  /* What the marks mean */
  .ax-key { display: flex; flex-wrap: wrap; gap: var(--space-2) var(--space-5); font-size: var(--type-meta); line-height: var(--leading-meta); color: var(--ink-muted); margin: 0; padding: 0; list-style: none; }
  .ax-key li { display: inline-flex; align-items: center; gap: var(--space-2); }
  .ax-key i { width: 12px; height: 12px; border-radius: 50%; display: inline-block; box-sizing: border-box; }
  .ax-key .stand { background: radial-gradient(circle at 35% 30%, var(--floor-team-high), var(--floor-team-low)); }
  .ax-key .see { border: 1.5px dashed var(--floor-team-high); }
  .ax-key .closed { width: 8px; height: 8px; border: 1.5px solid var(--ink-muted); }
  .ax-key .here { border: 2px solid var(--green); }

  /* Your own floor, beside the map */
  .ax-own { display: flex; align-items: center; gap: var(--space-4); padding: var(--space-4); border-radius: var(--radius-inset); background: var(--surface-inset); cursor: pointer; border: 0; color: inherit; font: inherit; text-align: left; width: 100%; }
  .ax-own:hover, .ax-own:focus-visible { background: var(--surface-raised); }
  .ax-own:focus-visible { outline: 2px solid var(--focus); outline-offset: 2px; }
  .ax-own .t1 { font-size: var(--type-body); line-height: var(--leading-body); }
  .ax-own .t2 { font-size: var(--type-meta); line-height: var(--leading-meta); color: var(--ink-muted); }

  /* A floor's orb: its colour, its kind's icon */
  .ax-orb { flex: none; width: 72px; height: 72px; border-radius: 50%; display: grid; place-items: center; color: var(--slate-deep); position: relative; }
  .ax-orb.sm { width: 40px; height: 40px; }
  .ax-orb.org { background: radial-gradient(circle at 35% 30%, var(--floor-org-high), var(--floor-org-low)); }
  .ax-orb.team { background: radial-gradient(circle at 35% 30%, var(--floor-team-high), var(--floor-team-low)); }
  .ax-orb.personal { background: radial-gradient(circle at 35% 30%, var(--floor-you-high), var(--floor-you-low)); }
  .ax-orb.see, .ax-orb.closed { background: none; border: 1.5px dashed var(--floor-team-high); color: var(--floor-team-high); }
  .ax-orb.closed { border: 1.5px solid var(--ink-muted); color: var(--ink-muted); }
  .ax-orb.here::after { content: ""; position: absolute; inset: -7px; border-radius: 50%; border: 2px solid var(--green); }
  .ax-hero { display: flex; align-items: center; gap: var(--space-5); }
  .ax-hero ui-heading { flex: 1; min-width: 0; }

  /* Apps as tiles */
  .ax-tiles { display: grid; grid-template-columns: repeat(auto-fill, minmax(148px, 1fr)); gap: var(--space-3); }
  .ax-tile { display: flex; flex-direction: column; align-items: flex-start; gap: var(--space-3); padding: var(--space-4); border-radius: var(--radius-inset); background: var(--surface-inset); border: 1px solid transparent; color: inherit; font: inherit; text-align: left; cursor: pointer; min-width: 0; }
  .ax-tile:hover, .ax-tile:focus-visible { background: var(--surface-raised); border-color: var(--hairline-strong); }
  .ax-tile:focus-visible { outline: 2px solid var(--focus); outline-offset: 2px; }
  .ax-tile .glyph { width: 40px; height: 40px; border-radius: 50%; display: grid; place-items: center; border: 1px solid var(--hairline-strong); }
  .ax-tile .nm { font-size: var(--type-body); line-height: var(--leading-body); overflow-wrap: anywhere; }
  .ax-tile .st { display: flex; align-items: flex-start; gap: var(--space-2); font-size: var(--type-small); line-height: var(--leading-small); color: var(--ink-muted); }
  .ax-tile .st::before { content: ""; flex: none; width: 7px; height: 7px; margin-top: 4px; border-radius: 50%; border: 1.5px solid currentColor; box-sizing: border-box; }
  .ax-tile.on .st { color: var(--ink); }
  .ax-tile.on .st::before { background: var(--success); border-color: var(--success); }
  .ax-tile.off .glyph, .ax-tile.off .nm { opacity: 0.55; }
  .ax-tile.blocked .st { color: var(--danger); }
  .ax-tile.blocked .st::before { border-radius: 1px; width: 7px; height: 7px; background: var(--danger); border-color: var(--danger); transform: rotate(45deg); }

  /* People as discs */
  .ax-people { display: flex; flex-wrap: wrap; gap: var(--space-4) var(--space-3); margin: 0; padding: 0; list-style: none; }
  .ax-person { display: flex; flex-direction: column; align-items: center; gap: var(--space-2); width: 72px; text-align: center; }
  .ax-disc { width: 44px; height: 44px; border-radius: 50%; display: grid; place-items: center; background: var(--surface-raised); border: 1px solid var(--hairline-strong); font-size: var(--type-meta); letter-spacing: var(--tracking-soft); }
  .ax-person.lead .ax-disc { border: 2px solid var(--floor-team-high); }
  .ax-person.you .ax-disc { box-shadow: 0 0 0 2px var(--slate-deep), 0 0 0 4px var(--green); }
  .ax-person .nm { font-size: var(--type-small); line-height: var(--leading-small); overflow-wrap: anywhere; }
  .ax-person .rl { font-size: var(--type-small); line-height: var(--leading-small); color: var(--ink-muted); }
  .ax-more { border: 0; background: none; color: inherit; font: inherit; cursor: pointer; padding: 0; }

  /* The week as a line of days */
  .ax-week { display: grid; grid-template-columns: repeat(7, 1fr); align-items: end; gap: var(--space-2); }
  .ax-day { display: flex; flex-direction: column; align-items: center; gap: var(--space-2); }
  .ax-day .dots { display: flex; flex-direction: column-reverse; gap: 3px; min-height: 44px; justify-content: flex-start; align-items: center; }
  .ax-day .dots i { width: 8px; height: 8px; border-radius: 50%; background: var(--floor-team-high); display: block; }
  .ax-day .dots i.app { background: var(--floor-org-high); }
  .ax-day .day { font-size: var(--type-small); line-height: var(--leading-small); color: var(--ink-muted); border-top: 1px solid var(--hairline-strong); width: 100%; text-align: center; padding-top: var(--space-2); }
  .ax-day.today .day { color: var(--ink); }
  .ax-events { margin: 0; padding: 0; list-style: none; display: flex; flex-direction: column; gap: var(--space-2); font-size: var(--type-meta); line-height: var(--leading-meta); }
  .ax-events li { display: flex; justify-content: space-between; gap: var(--space-3); }
  .ax-events li span:last-child { color: var(--ink-muted); white-space: nowrap; }

  /* An answer: the rules from the org down, the deciding one marked */
  .ax-chain { margin: 0; padding: 0; list-style: none; display: flex; flex-direction: column; }
  .ax-step { display: grid; grid-template-columns: 40px minmax(0, 1fr); gap: var(--space-4); position: relative; padding-bottom: var(--space-5); }
  .ax-step:last-child { padding-bottom: 0; }
  .ax-step:not(:last-child)::before { content: ""; position: absolute; left: 19.5px; top: 44px; bottom: 4px; border-left: 1px solid var(--hairline-strong); }
  .ax-step .t1 { font-size: var(--type-body); line-height: var(--leading-body); }
  .ax-step .t2 { font-size: var(--type-meta); line-height: var(--leading-meta); color: var(--ink-muted); }
  .ax-step .verdict { display: inline-flex; align-items: center; gap: var(--space-2); font-size: var(--type-label); letter-spacing: var(--tracking-label); text-transform: uppercase; margin-left: var(--space-3); color: var(--ink-muted); vertical-align: middle; }
  .ax-step.decides .ax-orb { box-shadow: 0 0 0 2px var(--slate-deep), 0 0 0 4px var(--ink); }
  .ax-step.decides.no .ax-orb { box-shadow: 0 0 0 2px var(--slate-deep), 0 0 0 4px var(--danger); }
  .ax-step.decides.no .verdict { color: var(--danger); }
  .ax-step.decides.yes .verdict { color: var(--success); }
  .ax-step.quiet .ax-orb { opacity: 0.6; }
  .ax-answer { display: flex; align-items: center; gap: var(--space-4); }
  .ax-answer .big { width: 56px; height: 56px; border-radius: 50%; display: grid; place-items: center; flex: none; border: 2px solid var(--success); color: var(--success); }
  .ax-answer .big.no { border-color: var(--danger); color: var(--danger); }

  /* Closed teams and the names inside them */
  .ax-names { margin: 0; padding: 0; list-style: none; display: flex; flex-wrap: wrap; gap: var(--space-2); }
  .ax-names li { padding: var(--space-1) var(--space-3); border-radius: var(--radius-pill); border: 1px solid var(--hairline-strong); font-size: var(--type-meta); line-height: var(--leading-meta); color: var(--ink-muted); }
  .ax-path { display: flex; flex-wrap: wrap; align-items: center; gap: var(--space-2); font-size: var(--type-meta); line-height: var(--leading-meta); color: var(--ink-muted); }
  .ax-path b { color: var(--ink); font-weight: 400; }

  /* Who can open this: asked from another app, over it */
  .ax-stage.glance { width: min(var(--measure-glance), 100% - 2 * var(--edge)); }
  auspex-access .ax-pane { background: var(--surface-overlay); box-shadow: var(--shadow-overlay); }
  .ax-whos { margin: 0; padding: 0; list-style: none; display: flex; flex-direction: column; }
  .ax-who { display: grid; grid-template-columns: 40px minmax(0, 1fr) auto; align-items: center; gap: var(--space-3); padding: var(--space-3) 0; border-bottom: 1px solid var(--hairline); }
  .ax-who:last-child { border-bottom: 0; }
  .ax-who .txt { display: flex; flex-direction: column; min-width: 0; }
  .ax-who .t1 { font-size: var(--type-body); line-height: var(--leading-body); }
  .ax-who .t2 { font-size: var(--type-meta); line-height: var(--leading-meta); color: var(--ink-muted); }
  .ax-who .lvl { font-size: var(--type-label); letter-spacing: var(--tracking-label); text-transform: uppercase; color: var(--ink-muted); white-space: nowrap; }
  .ax-who.out .t1 { color: var(--ink-muted); }

  /* The replay: a month of days, each a column of marks, played forward */
  .ax-replay { display: grid; grid-template-columns: repeat(30, minmax(0, 1fr)); align-items: end; gap: 3px; border-bottom: 1px solid var(--hairline-strong); padding-bottom: var(--space-2); }
  .ax-rday { border: 0; background: none; padding: var(--space-1) 0; cursor: pointer; display: flex; justify-content: center; border-radius: var(--radius-inset); min-height: calc(var(--tallest) * 11px + var(--space-2)); align-items: flex-end; transition: opacity var(--motion-quick) var(--ease-out); }
  .ax-rday:hover, .ax-rday:focus-visible { background: var(--surface-inset); }
  .ax-rday:focus-visible { outline: 2px solid var(--focus); outline-offset: 1px; }
  .ax-rday.later { opacity: 0.25; }
  .ax-rday.picked { background: var(--surface-raised); box-shadow: inset 0 -2px 0 var(--green); }
  .ax-rday .marks { display: flex; flex-direction: column-reverse; gap: 3px; align-items: center; }
  .ax-rday i, .ax-key i.people, .ax-key i.app, .ax-key i.blocked, .ax-key i.team { width: 8px; height: 8px; display: block; border-radius: 50%; background: var(--floor-team-high); }
  .ax-rday i.app, .ax-key i.app { border-radius: 2px; background: var(--floor-org-high); }
  .ax-rday i.team, .ax-key i.team { background: none; border: 1.5px solid var(--floor-team-high); box-sizing: border-box; }
  .ax-rday i.blocked, .ax-key i.blocked { border-radius: 1px; background: var(--danger); transform: rotate(45deg) scale(0.85); }
  .ax-scrub { display: flex; align-items: center; gap: var(--space-4); }
  .ax-scrub input[type=range] { flex: 1; min-width: 0; accent-color: var(--green); }
  .ax-scrub .when { min-width: 5em; text-align: right; }
  .ax-tally { margin: 0; padding: 0; list-style: none; display: flex; flex-wrap: wrap; gap: var(--space-2); }
  .ax-tally li { display: inline-flex; align-items: center; gap: var(--space-2); padding: var(--space-1) var(--space-3); border-radius: var(--radius-pill); background: var(--surface-inset); font-size: var(--type-meta); line-height: var(--leading-meta); }
  .ax-tally li::before { content: ""; width: 7px; height: 7px; border-radius: 50%; background: var(--floor-team-high); }
  .ax-tally li.lead { background: none; padding-left: 0; color: var(--ink-muted); }
  .ax-tally li.lead::before { display: none; }
  .ax-tally li.app::before { border-radius: 2px; background: var(--floor-org-high); }
  .ax-tally li.team::before { background: none; border: 1.5px solid var(--floor-team-high); box-sizing: border-box; }

  /* The plant room: each part a machine with a lamp, its version and a meter of how fast it answered */
  auspex-plant, auspex-replay { display: flex; flex-direction: column; gap: var(--space-5); }
  .ax-orb.plant { background: none; border: 1.5px solid var(--hairline-strong); color: var(--ink); }
  .ax-release { display: flex; flex-wrap: wrap; align-items: center; gap: var(--space-3) var(--space-4); padding: var(--space-4); border-radius: var(--radius-inset); background: var(--surface-inset); }
  .ax-release .ver { display: flex; flex-direction: column; font-size: var(--type-title-s); line-height: var(--leading-title-s); font-variant-numeric: tabular-nums; }
  .ax-release .ver.out { color: var(--green); }
  .ax-release .arrow { color: var(--ink-muted); }
  .ax-machines { margin: 0; padding: 0; list-style: none; display: grid; grid-template-columns: repeat(auto-fill, minmax(200px, 1fr)); gap: var(--space-3); }
  .ax-machine { display: grid; grid-template-columns: auto minmax(0, 1fr) auto; grid-template-areas: "lamp nm ver" "meter meter meter" "st st st"; align-items: center; gap: var(--space-2) var(--space-3); padding: var(--space-4); border-radius: var(--radius-inset); background: var(--surface-inset); border: 1px solid transparent; }
  .ax-machine .lamp { grid-area: lamp; width: 10px; height: 10px; border-radius: 50%; border: 1.5px solid var(--ink-muted); box-sizing: border-box; }
  .ax-machine .nm { grid-area: nm; font-size: var(--type-body); line-height: var(--leading-body); overflow-wrap: anywhere; }
  .ax-machine .ver { grid-area: ver; font-size: var(--type-small); line-height: var(--leading-small); color: var(--ink-muted); font-variant-numeric: tabular-nums; }
  .ax-machine .meter { grid-area: meter; height: 3px; border-radius: var(--radius-pill); background: var(--hairline); overflow: hidden; }
  .ax-machine .meter i { display: block; height: 100%; background: var(--success); border-radius: inherit; }
  .ax-machine .st { grid-area: st; font-size: var(--type-small); line-height: var(--leading-small); color: var(--ink-muted); }
  .ax-machine.up .lamp { background: var(--success); border-color: var(--success); box-shadow: 0 0 0 3px color-mix(in srgb, var(--success) 25%, transparent); }
  .ax-machine.slow .lamp { background: var(--warning); border-color: var(--warning); }
  .ax-machine.slow .meter i { background: var(--warning); }
  .ax-machine.down { border-color: var(--danger); }
  .ax-machine.down .lamp { background: var(--danger); border-color: var(--danger); animation: ax-blink var(--motion-ping) var(--ease-ping) infinite; }
  .ax-machine.down .st { color: var(--danger); }
  @keyframes ax-blink { 50% { opacity: 0.35; } }

  /* Home's card */
  auspex-glance { display: flex; flex-direction: column; gap: var(--space-4); }
  auspex-glance .ax-climb { display: flex; align-items: center; gap: var(--space-2); }
  auspex-glance .ax-climb .step { width: 10px; height: 10px; border-radius: 50%; }
  auspex-glance .ax-climb .bar { flex: 1; max-width: 32px; border-top: 1px solid var(--hairline-strong); }

  @media (max-width: 640px) {
    .ax-pane { padding: var(--space-5); }
    .ax-hero { align-items: flex-start; }
    .ax-orb { width: 56px; height: 56px; }
  }
  @media (prefers-reduced-motion: reduce) {
    .auspex-map .halo.ping { animation: none; display: none; }
    .auspex-map .mark { transition: none; }
    .ax-rday { transition: none; }
    .ax-machine.down .lamp { animation: none; }
  }
</style>`;
