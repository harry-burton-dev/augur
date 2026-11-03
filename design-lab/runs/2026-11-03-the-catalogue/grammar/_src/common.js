/* ===== Shared helpers (generated into every sheet) ===== */
const $ = s => document.querySelector(s);
const $$ = s => [...document.querySelectorAll(s)];
const ms = n => parseFloat(getComputedStyle(document.documentElement).getPropertyValue(n)) || 0;
const RM = matchMedia('(prefers-reduced-motion: reduce)').matches;
const ic = (n, s) => Icons.svg(n, { size: s || 16, stroke: 1.5 });
const K = id => DATA.kinds.find(k => k.id === id) || DATA.elsewhere.find(k => k.id === id);
const FL = id => DATA.floors[id];
const T = id => DATA.terms.find(t => t.id === id);
const REC = DATA.record;
const fmt = n => n.toLocaleString('en-GB');
const det = n => REC.details.find(d => d.n === n);
const byState = s => REC.details.find(d => d.state === s);
const SRC = id => REC.sources.find(s => s.id === id);

/* one stage per empty-looking state, all drawn from the specimen card */
function stateStage(id) {
  const g = byState('gap'), st = byState('stale'), no = byState('none'), h = REC.hidden, nr = REC.noRecord;
  if (id === 'gap') return `<div class="gapslot"><span class="gl">${g.n} · not known yet</span><span class="gw">${g.who}</span></div>`;
  if (id === 'none') return `<div class="vrow"><span class="k">${no.n}</span><span class="nonev">${no.v}<span class="ref">${no.ref}</span></span></div>`;
  if (id === 'stale') return `<div class="vrow"><span class="k">${st.n}</span><span>${st.v} <span class="staleage">${st.age}</span></span></div>`;
  if (id === 'shadow') return `<div class="shadowslot sm">${ic('lock', 14)}<span>${h.n} · kept on ${FL(h.floor).name}</span></div>`;
  if (id === 'could') return `<div class="sm muted">Could also hold: <span style="color:var(--ink)">${REC.could.join(', ')}</span></div>`;
  if (id === 'norecord') { let w = ''; for (let y = 2; y <= 22; y += 4) w += `${w ? 'L' : 'M'}${(y / 4) % 2 ? 94 : 90},${y}`; let w2 = ''; for (let y = 2; y <= 22; y += 4) w2 += `${w2 ? 'L' : 'M'}${(y / 4) % 2 ? 134 : 130},${y}`;
    return `<svg viewBox="0 0 220 40" style="display:block;width:100%;height:calc(var(--space-6) - var(--space-1))" aria-hidden="true">
      <rect x="0" y="4" width="90" height="16" data-tier="${FL(REC.floor).tier}" style="fill:color-mix(in srgb, var(--fc) 26%, transparent)"/>
      <rect x="92" y="4" width="40" height="16" style="fill:url(#x-stale)"/>
      <path d="${w}" style="fill:none;stroke:var(--ink-muted);stroke-dasharray:2 2"/><path d="${w2}" style="fill:none;stroke:var(--ink-muted);stroke-dasharray:2 2"/>
      <rect x="134" y="4" width="86" height="16" data-tier="${FL(REC.floor).tier}" style="fill:color-mix(in srgb, var(--fc) 26%, transparent)"/>
      <text x="112" y="36" text-anchor="middle" style="font:400 var(--type-small) var(--font-mono);fill:var(--ink)">no record ${nr.from} to ${nr.to}</text></svg>`; }
  return '';
}
/* the strip of six empty-looking states; opts.tech shows the technical line, opts.ids picks and orders them */
function renderFamily(el, opts) {
  opts = opts || {};
  const ids = opts.ids || DATA.states.map(s => s.id);
  el.style.setProperty('--n', ids.length);
  el.innerHTML = ids.map((id, i) => { const s = DATA.states.find(x => x.id === id);
    return `<div class="st dep" style="--i:${i}" data-state="${id}"><div class="stage">${stateStage(id)}</div>
      <div class="nm">${s.plain}<small>${s.from}</small></div><p class="d">${s.d}</p>
      ${opts.tech === false ? '' : `<p class="tk">${s.tech} · never “${s.never}”</p>`}</div>`; }).join('');
  Icons.hydrate(el);
}
/* one shared hatch pattern for SVG */
document.body.insertAdjacentHTML('afterbegin', `<svg width="0" height="0" style="position:absolute" aria-hidden="true"><defs>
  <pattern id="x-stale" width="8" height="8" patternUnits="userSpaceOnUse" patternTransform="rotate(45)"><line x1="0" y1="0" x2="0" y2="8" style="stroke:var(--x-hatch);stroke-width:1"/></pattern>
  <pattern id="x-shadow" width="8" height="8" patternUnits="userSpaceOnUse" patternTransform="rotate(135)"><line x1="0" y1="0" x2="0" y2="8" style="stroke:var(--hairline);stroke-width:1"/></pattern></defs></svg>`);
/* timers for the auto-demo; R replays from the start */
const TIMERS = [];
const later = (fn, t) => TIMERS.push(setTimeout(fn, t));
function boot(reset, demo) {
  const w = $('#wrap');
  const run = () => { TIMERS.splice(0).forEach(clearTimeout); reset(); w.classList.add('pre'); later(() => { w.classList.remove('pre'); demo(); }, ms('--motion-run')); };
  document.addEventListener('keydown', e => { if ((e.key === 'r' || e.key === 'R') && !e.metaKey && !e.ctrlKey) run(); });
  run();
}
