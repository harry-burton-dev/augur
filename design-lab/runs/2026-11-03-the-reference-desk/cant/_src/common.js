/* ===== shared helpers (inlined into every variant) ===== */
const $ = (s, r) => (r || document).querySelector(s);
const $$ = (s, r) => [...(r || document).querySelectorAll(s)];
const esc = s => String(s == null ? '' : s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const RM = matchMedia('(prefers-reduced-motion: reduce)').matches;
const ic = (n, s) => Icons.svg(n, { size: s || 14, stroke: 1.5 });
const P = id => DATA.people[id];
const F = id => DATA.floors[id];
const E = id => DATA.empties[id];
const cap1 = s => s.charAt(0).toUpperCase() + s.slice(1);
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const day = iso => { const [y, m, d] = iso.split('-').map(Number); return `${d} ${MONTHS[m - 1]}${y !== 2026 ? ' ' + y : ''}`; };
const tok = n => parseFloat(getComputedStyle(document.documentElement).getPropertyValue(n)) || 0;
const MS = n => RM ? 0 : tok(n);

function breakSvg(small) {
  return `<svg class="mk mk-break${small ? ' s' : ''}" viewBox="0 0 28 12" aria-hidden="true"><path d="M2 2 L6 10 L10 2 L14 10 L18 2 L22 10 L26 2"/></svg>`;
}
function mark(st) {
  if (st === 'ok') return '<span class="mk mk-ok" aria-hidden="true"></span>';
  if (st === 'gap') return '<span class="mk mk-gap" aria-hidden="true"></span>';
  if (st === 'none') return '<span class="mk mk-none" aria-hidden="true">none</span>';
  if (st === 'na') return '<span class="mk mk-na" aria-hidden="true">n/a</span>';
  if (st === 'stale') return '<span class="mk mk-stale" aria-hidden="true"></span>';
  if (st === 'norecord') return breakSvg(true);
  if (st === 'hidden') return `<span class="mk mk-unseen" aria-hidden="true">${ic('lock', 9)}</span>`;
  return '';
}
/* one line per supplier: why the answer stands as it does for it */
function whyLine(s) {
  const k = s.keeper ? P(s.keeper).n : '';
  if (s.st === 'ok') return `Last ${esc(s.via)} ${esc(day(s.last))}`;
  if (s.st === 'none') return esc(s.by);
  if (s.st === 'gap') return `Contact isn’t recorded anywhere. ${esc(k)} could say`;
  if (s.st === 'stale') return `Last ${esc(day(s.last))}, but its reports were last read in ${esc(s.read)}`;
  if (s.st === 'norecord') return `Last ${esc(day(s.last))}; the depot inbox for January to April was lost`;
  if (s.st === 'na') return `Contract ended ${esc(s.ended)}, before the date you asked about`;
  if (s.st === 'hidden') return `Kept on the ${esc(F(s.floor).n)} team floor`;
  return '';
}
const SUP = () => DATA.q1.suppliers;
const visible = () => SUP().filter(s => s.st !== 'hidden');
const applies = () => visible().filter(s => s.st !== 'na');
const answered = () => applies().filter(s => s.st === 'ok' || s.st === 'none');
const silentKnown = () => answered().filter(s => s.silent);
const byState = st => SUP().filter(s => s.st === st);
const pct = (a, b) => Math.round(100 * a / b);

/* timers for the auto-demo; R replays */
const TIMERS = [];
const later = (fn, t) => { TIMERS.push(setTimeout(fn, RM ? Math.min(t, 1) : t)); };
const clearTimers = () => TIMERS.splice(0).forEach(clearTimeout);

/* the T switch: technical words one step down; the G switch: model gateway on or off */
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
    b.innerHTML = on ? `${ic('pencil-line', 14)}Model gateway on` : `${ic('circle-slash', 14)}Model gateway off`;
    b.title = on ? 'Pencil marks are the model’s. Press G to see the answer without it.' : DATA.gateway.offWhy;
  });
  gwHooks.forEach(f => f(on));
}

/* the top band and the question, from DATA */
function chrome(q, extraRead) {
  const here = F(DATA.here);
  return `<header class="top">
    <span class="brand">${esc(DATA.app)}</span>
    <span class="floorchip"><span class="fl"></span><b>${esc(here.n)}</b> · ${esc(here.word)} floor</span>
    <span class="sp"></span>
    <button class="chipbtn gwchip" data-gw aria-pressed="true"></button>
    <button class="chipbtn" data-tech aria-pressed="false">${ic('type', 14)}Technical words</button>
  </header>
  <section class="qhead">
    <p class="eyebrow">${esc(DATA.me.n)} asked · ${esc(DATA.askedAt)}</p>
    <h1 class="qwords">${esc(q.words)}</h1>
    <p class="readas"><span>Read as</span><b>${esc(q.read)}</b>${extraRead || ''}</p>
    <p class="tk">${esc(q.tech)}</p>
  </section>`;
}
function hints(list) {
  return `<div class="hints">${list.map(([k, t]) => `<span><span class="kbd">${k}</span>${t}</span>`).join('')}</div>`;
}
function wireCommon(replay) {
  $$('[data-tech]').forEach(b => b.addEventListener('click', () => setTech(!document.body.classList.contains('tech'))));
  $$('[data-gw]').forEach(b => b.addEventListener('click', () => setGateway(!GW)));
  addEventListener('keydown', e => {
    if (e.metaKey || e.ctrlKey || e.altKey || e.target.matches('input,textarea')) return;
    const k = e.key.toLowerCase();
    if (k === 'r') { replay(); }
    if (k === 't') { setTech(!document.body.classList.contains('tech')); }
    if (k === 'g') { setGateway(!GW); }
  });
  setGateway(GW);
}
