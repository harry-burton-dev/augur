/* ===== Shared helpers (generated into every sheet) ===== */
const $ = s => document.querySelector(s);
const $$ = s => [...document.querySelectorAll(s)];
const ms = n => parseFloat(getComputedStyle(document.documentElement).getPropertyValue(n)) || 0;
const RM = matchMedia('(prefers-reduced-motion: reduce)').matches;
const ic = (n, s) => Icons.svg(n, { size: s || 16, stroke: 1.5 });
const FL = id => DATA.floors[id];
const P = id => DATA.people[id];
const SRC = id => DATA.sources.find(s => s.id === id);
const PART = id => DATA.parts.find(p => p.id === id);
const A = id => DATA.actors[id];
const fmt = n => n == null ? 'some' : n.toLocaleString('en-GB');
const Q = DATA.question, ANS = DATA.answer, SAV = DATA.saved, GW = DATA.gateway;
const srcNo = id => DATA.sources.findIndex(s => s.id === id) + 1;

/* the empty marks, drawn small enough to sit in a line */
const mGap = (label, who) => `<span class="gapslot"><span class="gl">${label}</span>${who ? `<span class="gw">${who}</span>` : ''}</span>`;
const mShadow = text => `<span class="shadowslot">${ic('lock', 14)}<span>${text}</span></span>`;
function mWavy(w) { w = w || 28; let d = ''; for (let x = 0, i = 0; x <= w; x += 4, i++) d += `${i ? 'L' : 'M'}${x},${i % 2 ? 2 : 8}`;
  return `<svg class="wavy" width="${w}" height="10" viewBox="0 0 ${w} 10" aria-hidden="true"><path d="${d}" style="fill:none;stroke:var(--ink-muted);stroke-width:1"/></svg>`; }
const mNoRecord = text => `<span style="display:inline-flex;align-items:center;gap:var(--space-2)">${mWavy()}<span class="muted">${text}</span>${mWavy()}</span>`;

/* the assistant (model gateway) on or off, and technical words, as page state */
const STATE = { gw: GW.on, tech: false };
const HOOKS = { gw: [], tech: [] };
function setGW(v) { STATE.gw = v; document.body.classList.toggle('nogw', !v); const b = $('#swg'); if (b) { b.setAttribute('aria-checked', v); b.querySelector('.ss').textContent = v ? 'on' : 'off'; } HOOKS.gw.forEach(f => f(v)); }
function setTech(v) { STATE.tech = v; document.body.classList.toggle('show-tech', v); const b = $('#swt'); if (b) { b.setAttribute('aria-checked', v); b.querySelector('.ss').textContent = v ? 'on' : 'off'; } HOOKS.tech.forEach(f => f(v)); }
function toggles() {
  return `<div class="toggles"><button class="sw" id="swg" role="switch" aria-checked="true">${ic('circle-dashed', 14)}<span>${GW.Plain}</span><span class="ss">on</span><span class="kbd">G</span></button>
    <button class="sw" id="swt" role="switch" aria-checked="false">${ic('code', 14)}<span>Technical words</span><span class="ss">off</span><span class="kbd">T</span></button></div>`;
}
function wireToggles() {
  const g = $('#swg'), t = $('#swt');
  if (g) g.addEventListener('click', () => setGW(!STATE.gw));
  if (t) t.addEventListener('click', () => setTech(!STATE.tech));
  document.addEventListener('keydown', e => { if (e.metaKey || e.ctrlKey || e.altKey) return;
    if (e.key === 'g' || e.key === 'G') setGW(!STATE.gw);
    if (e.key === 't' || e.key === 'T') setTech(!STATE.tech); });
}
/* timers for the auto-demo; R replays from the start */
const TIMERS = [];
const later = (fn, t) => TIMERS.push(setTimeout(fn, t));
function boot(reset, demo) {
  const w = $('#wrap');
  const run = () => { TIMERS.splice(0).forEach(clearTimeout); setGW(GW.on); setTech(false); reset(); w.classList.add('pre'); later(() => { w.classList.remove('pre'); demo(); }, ms('--motion-run')); };
  document.addEventListener('keydown', e => { if ((e.key === 'r' || e.key === 'R') && !e.metaKey && !e.ctrlKey) run(); });
  wireToggles();
  run();
}
