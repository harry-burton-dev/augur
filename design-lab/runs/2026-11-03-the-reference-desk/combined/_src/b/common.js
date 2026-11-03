/* ===== shared helpers (inlined into both screens) ===== */
const $ = (s, r) => (r || document).querySelector(s);
const $$ = (s, r) => [...(r || document).querySelectorAll(s)];
const esc = s => String(s == null ? '' : s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const RM = matchMedia('(prefers-reduced-motion: reduce)').matches;
const ic = (n, s) => Icons.svg(n, { size: s || 14, stroke: 1.5 });
const P = id => DATA.people[id];
const F = id => DATA.floors[id];
const cap1 = s => s.charAt(0).toUpperCase() + s.slice(1);
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const day = iso => { if (!iso) return ''; const [y, m, d] = iso.split('-').map(Number); return `${d} ${MONTHS[m - 1]}${y !== 2026 ? ' ' + y : ''}`; };
const tok = n => { const v = getComputedStyle(document.documentElement).getPropertyValue(n).trim(); return parseFloat(v) || 0; };
const MS = n => RM ? 0 : tok(n);
const pct = (a, b) => Math.round(100 * a / b);
const plural = (n, one, many) => n === 1 ? one : many;

function breakSvg() {
  return `<svg class="mk mk-break" viewBox="0 0 28 12" aria-hidden="true"><path d="M2 2 L6 10 L10 2 L14 10 L18 2 L22 10 L26 2"/></svg>`;
}
function mark(st) {
  if (st === 'ok') return '<span class="mk mk-ok" aria-hidden="true"></span>';
  if (st === 'gap') return '<span class="mk mk-gap" aria-hidden="true"></span>';
  if (st === 'none') return '<span class="mk mk-none" aria-hidden="true">none</span>';
  if (st === 'na') return '<span class="mk mk-na" aria-hidden="true">n/a</span>';
  if (st === 'stale') return '<span class="mk mk-stale" aria-hidden="true"></span>';
  if (st === 'norecord') return breakSvg();
  if (st === 'hidden') return `<span class="mk mk-unseen" aria-hidden="true">${ic('lock', 9)}</span>`;
  if (st === 'noplace') return '<span class="mk mk-noplace" aria-hidden="true"></span>';
  return '';
}

/* timers for the auto-demo; R replays */
const TIMERS = [];
const later = (fn, t) => { TIMERS.push(setTimeout(fn, RM ? Math.min(t, 1) : t)); };
const clearTimers = () => TIMERS.splice(0).forEach(clearTimeout);

/* T: technical words one step down. G: model gateway on or off */
function setTech(on) {
  document.body.classList.toggle('tech', on);
  $$('[data-tech]').forEach(b => b.setAttribute('aria-pressed', on ? 'true' : 'false'));
}
let GW = DATA.gateway.on;
const gwHooks = [];
function setGateway(on) {
  GW = on;
  document.body.classList.toggle('gwoff', !on);
  $$('[data-gw]').forEach(b => {
    b.classList.toggle('off', !on);
    b.setAttribute('aria-pressed', on ? 'true' : 'false');
    b.innerHTML = on ? `${ic('pencil-line', 14)}Model gateway on · pencil` : `${ic('circle-slash', 14)}Model gateway off`;
    b.title = on ? 'Pencil marks are the model gateway’s. Press G: no number changes, only the route.' : DATA.gateway.offWhy;
  });
  gwHooks.forEach(f => f(on));
}

function topBand(crumb) {
  const here = F(DATA.here);
  return `<header class="top">
    <span class="brand">${esc(DATA.app)}</span>
    <span class="floorchip"><span class="fl"></span><b>${esc(here.n)}</b> · ${esc(here.word)} floor</span>
    ${crumb ? `<span class="crumb">${crumb}</span>` : ''}
    <span class="sp"></span>
    <button class="chipbtn gwchip" data-gw aria-pressed="true"></button>
    <button class="chipbtn" data-tech aria-pressed="false">${ic('type', 14)}Technical words</button>
  </header>`;
}
function hints(list) {
  return `<div class="hints">${list.map(([k, t]) => `<span><span class="kbd">${k}</span>${t}</span>`).join('')}</div>`;
}
function wireCommon(replay, onKey) {
  $$('[data-tech]').forEach(b => b.addEventListener('click', () => setTech(!document.body.classList.contains('tech'))));
  $$('[data-gw]').forEach(b => b.addEventListener('click', () => setGateway(!GW)));
  addEventListener('keydown', e => {
    if (e.metaKey || e.ctrlKey || e.altKey || e.target.matches('input,textarea')) return;
    const k = e.key.toLowerCase();
    if (k === 'r') { replay(); return; }
    if (k === 't') { setTech(!document.body.classList.contains('tech')); return; }
    if (k === 'g') { setGateway(!GW); return; }
    if (onKey) onKey(k, e);
  });
  setGateway(GW);
}
/* a number that rolls once from a to b (a crossfade when motion is reduced) */
function roll(el, to) {
  if (!el) return;
  const from = parseInt(el.textContent, 10);
  if (RM || isNaN(from) || from === to) { el.textContent = to; return; }
  const dur = tok('--motion-calm'), t0 = performance.now();
  const step = now => { const k = Math.min(1, (now - t0) / dur); el.textContent = Math.round(from + (to - from) * (1 - Math.pow(1 - k, 3))); if (k < 1) requestAnimationFrame(step); };
  requestAnimationFrame(step);
}
