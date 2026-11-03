/* ===== Shared helpers (built into every page) ===== */
const $ = s => document.querySelector(s);
const $$ = s => [...document.querySelectorAll(s)];
const ms = n => parseFloat(getComputedStyle(document.documentElement).getPropertyValue(n)) || 0;
const RM = matchMedia('(prefers-reduced-motion: reduce)').matches;
const ic = (n, s) => Icons.svg(n, { size: s || 16, stroke: 1.5 });
const P = id => DATA.people[id];
const FL = id => DATA.floors[id];
const GW = DATA.gateway;
const CL = id => DATA.claims.find(c => c.id === id);
const EM = id => DATA.empties.find(e => e.id === id);
const OPT = id => DATA.options.find(o => o.id === id);
const fmt = n => n == null ? 'some' : n.toLocaleString('en-GB');
const words = s => s.replace(/<[^>]+>/g, ' ').split(/\s+/).filter(Boolean).length;
const secs = s => Math.round(words(s) / DATA.readWpm * 60);

/* ----- the numbers every template uses, computed from records, never typed ----- */
const M = DATA.months, V = DATA.vehicles, C = DATA.contract, O = DATA.offer;
const VARS = {
  first: M[0].n, last: M[M.length - 1].n, m0: monthName(M[0].m), m4: monthName(M[M.length - 1].m),
  fail: V.filter(v => v.r === 'fail').length, all: V.length, gap: V.filter(v => v.r === 'gap').map(v => v.id).join(', '),
  rise: O.rise, offer: O.value.toFixed(2), value: C.value.toFixed(2), ends: C.ends, months: CL('k4').months,
  due: DATA.intent.due, askDue: DATA.intent.askDue, contract: C.name, reader: P(DATA.reader).short,
  total: M.reduce((a, b) => a + b.n, 0), theirs: DATA.theirs.n
};
function monthName(m) { return { Jan: 'January', Feb: 'February', Mar: 'March', Apr: 'April', May: 'May', Jun: 'June', Jul: 'July', Aug: 'August', Sep: 'September', Oct: 'October', Nov: 'November', Dec: 'December' }[m] || m; }
const fill = t => t.replace(/\{(\w+)\}/g, (_, k) => VARS[k] != null ? VARS[k] : `{${k}}`);
/* fill with the numbers marked as ink, so a reader can see which words came from records */
const fillInk = t => t.replace(/\{(\w+)\}/g, (_, k) => `<b class="num">${VARS[k]}</b>`);
const say = id => fill(CL(id).tpl);
const sayInk = id => fillInk(CL(id).tpl);

/* ----- confidence words (yardstick) ----- */
const YI = w => DATA.yardstick.findIndex(y => y.w === w);
const sure = w => `<span class="sure">${w}</span><span class="tk"> ${DATA.yardstick[YI(w)].r}</span>`;
const yard = w => `<span class="yard" aria-label="${w} on a scale of seven">${DATA.yardstick.map((y, i) => `<i class="${i === YI(w) ? 'on' : ''}"></i>`).join('')}</span>`;

/* ----- the empty marks ----- */
function wavy(w) { w = w || 28; let d = ''; for (let x = 0, i = 0; x <= w; x += 4, i++) d += `${i ? 'L' : 'M'}${x},${i % 2 ? 2 : 8}`;
  return `<svg class="mk mk-break" viewBox="0 0 ${w} 10" preserveAspectRatio="none" aria-hidden="true"><path d="${d}"/></svg>`; }
function mark(kind) {
  if (kind === 'gap') return '<span class="mk mk-gap" aria-hidden="true"></span>';
  if (kind === 'stale') return '<span class="mk mk-stale" aria-hidden="true"></span>';
  if (kind === 'break') return wavy();
  if (kind === 'unseen') return `<span class="mk mk-unseen" aria-hidden="true">${ic('lock', 10)}</span>`;
  if (kind === 'none') return '<span class="mk mk-none">none</span>';
  if (kind === 'na') return '<span class="mk mk-na">n/a</span>';
  if (kind === 'dis') return '<span class="mk mk-dis" aria-hidden="true"></span>';
  return '';
}
const emptyWho = e => e.who ? (e.mark === 'unseen' ? ` Ask <b class="who">${P(e.who).name}</b>, ${P(e.who).role}.` : ` <b class="who">${P(e.who).name}</b> could fill it${e.by ? ` by ${e.by}` : ''}.`) : '';
const emptyLi = e => `<li>${mark(e.mark)}<span><b>${e.says}:</b> ${e.is}.${emptyWho(e)}</span></li>`;

/* ----- word-sized pictures ----- */
function spark(w, h, opts) {
  w = w || 64; h = h || 16; opts = opts || {};
  const max = Math.max(...M.map(m => m.n), DATA.theirs.n), n = M.length;
  const X = i => (i / (n - 1)) * (w - 4) + 2, Y = v => h - 2 - (v / max) * (h - 4);
  let pts = M.map((m, i) => [X(i), Y(m.n)]);
  let ln = '', hole = '';
  for (let i = 0; i < n - 1; i++) {
    const seg = `M${pts[i][0].toFixed(1)},${pts[i][1].toFixed(1)}L${pts[i + 1][0].toFixed(1)},${pts[i + 1][1].toFixed(1)}`;
    if (M[i].hole || M[i + 1].hole) hole += seg; else ln += seg;
  }
  const last = pts[n - 1];
  const them = opts.them ? `<circle class="them" cx="${last[0]}" cy="${Y(DATA.theirs.n).toFixed(1)}" r="2"/>` : '';
  return `<svg class="spark" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}" role="img" aria-label="Missed collections by month: ${M.map(m => m.m + ' ' + m.n).join(', ')}"><path class="ln" d="${ln}"/><path class="hole" d="${hole}"/>${them}<circle class="end" cx="${last[0]}" cy="${last[1].toFixed(1)}" r="2"/></svg>`;
}
const iso = (name, n, cls, size) => Array.from({ length: n }, () => `<span class="iso ${cls || ''}">${ic(name, size || 14)}</span>`).join('');

/* ----- the records behind each claim (the third height) ----- */
function incidents() {
  const out = []; let id = 1031;
  M.forEach((m, mi) => { for (let i = 0; i < m.n; i++) {
    let day = 1 + Math.floor((i + 0.5) * (29 / m.n));
    if (m.hole) { /* the log lost 8–21 Aug: push those days out of the hole */ if (day >= 8 && day <= 21) day = day < 15 ? 7 - (i % 6) : 22 + (i % 8); }
    out.push({ id: `INC-26-${id++}`, m: m.m, day: Math.max(1, day), street: DATA.streets[(i * 3 + mi) % DATA.streets.length] }); } });
  return out;
}
const INC = incidents();
function recordsHTML(cid) {
  const c = CL(cid); let h = '';
  h += `<h3>Where it comes from</h3><div class="srcl">${c.src.map(s => `<div>${ic(s.app === 'atlas' ? 'database' : 'file-text', 14)}<span><b>${s.doc ? DATA.docs[s.doc].title : s.k}</b> · ${s.app === 'atlas' ? DATA.apps.atlas : DATA.apps.artifacts} · kept on ${FL(s.floor).name}<span class="tk"> · ${s.doc || s.k.replace(/ /g, '_')}</span></span></div>`).join('')}</div>`;
  h += `<h3>How sure</h3><p class="say" style="font-size:var(--type-small);line-height:var(--leading-small)">${yard(c.sure)} ${sure(c.sure)}: ${c.sureWhy}.</p>`;
  if (cid === 'k1') {
    h += `<h3>Records · ${VARS.total} missed collections</h3>`;
    M.forEach(m => {
      const rows = INC.filter(r => r.m === m.m);
      h += `<div class="mhead"><span>${monthName(m.m)}</span><span>${m.n}</span></div>`;
      rows.slice(0, 2).forEach(r => h += `<div class="rec"><span class="id">${r.id}</span><span>Missed collection, ${r.street}</span><span class="d">${r.day} ${m.m}</span></div>`);
      if (m.hole) h += `<div class="rec">${wavy(40)}<span class="muted">${m.hole}: no record, ${m.holeWhy}</span><span></span></div>`;
      if (rows.length > 2) h += `<div class="rec more"><button class="ref">and ${rows.length - 2} more in ${monthName(m.m)}</button></div>`;
      if (m.m === DATA.theirs.m) h += `<div class="rec dis"><span class="id">${DATA.theirs.doc}</span><span>${DATA.theirs.who} counts <b>${DATA.theirs.n}</b> for ${monthName(m.m)}, not ${m.n}</span><span class="d">${DATA.docs[DATA.theirs.doc].date.slice(0, 5)}</span></div>`;
    });
  } else if (cid === 'k2') {
    h += `<h3>Records · ${VARS.all} vehicles</h3>`;
    V.forEach(v => h += v.r === 'gap'
      ? `<div class="rec gaprow"><span class="id">${v.id}</span><span><span class="gapbox" style="display:inline-block;width:var(--space-6);height:var(--space-3);vertical-align:-1px"></span> not inspected yet · <b style="font-weight:400">${P(v.who).name}</b> by ${v.by}</span><span class="d"></span></div>`
      : `<div class="rec"><span class="id">${v.id}</span><span>${v.r === 'pass' ? 'Passed' : `<b style="font-weight:400;color:var(--light)">Failed</b>: ${v.why}`}</span><span class="d">Oct</span></div>`);
    h += `<div class="rec"><span class="id">safety</span><span>${mark('none')} safety incidents, checked by ${P(DATA.safety.checkedBy).name}</span><span class="d">30 Oct</span></div>`;
  } else {
    const d = c.src.filter(s => s.doc).map(s => s.doc);
    h += `<h3>Records</h3>`;
    d.forEach(id => h += `<div class="rec"><span class="id">${id}</span><span>${DATA.docs[id].title}, from ${DATA.docs[id].from}</span><span class="d">${DATA.docs[id].date.slice(0, 6)}</span></div>`);
    h += `<div class="rec"><span class="id">${C.id}</span><span>Contract: ${C.name}, ${C.supplier}, £${C.value}m a year, ends ${C.ends}</span><span class="d"></span></div>`;
  }
  const em = DATA.empties.filter(e => e.for === cid);
  if (em.length) h += `<h3>What this can’t see</h3><ul class="elist">${em.map(emptyLi).join('')}</ul>`;
  return h;
}
function drawer() {
  return `<aside class="drawer" id="drawer" aria-label="Records" aria-hidden="true"><header><p class="eyebrow">Records · how do you know?</p><h2 id="dh"></h2><p class="say" id="ds"></p><button class="x" id="dx" aria-label="Close records">${ic('x', 18)}</button></header><div class="body scroll" id="db"></div></aside>`;
}
let OPEN = null;
function openRecords(cid) {
  const d = $('#drawer'); if (!d) return;
  OPEN = cid; const c = CL(cid);
  $('#dh').textContent = c.head; $('#ds').innerHTML = say(cid); $('#db').innerHTML = recordsHTML(cid);
  d.classList.add('open'); d.setAttribute('aria-hidden', 'false');
  $$('.chip[data-claim]').forEach(x => x.classList.toggle('on', x.dataset.claim === cid));
  HOOKS.open.forEach(f => f(cid));
}
function closeRecords() { const d = $('#drawer'); if (!d) return; OPEN = null; d.classList.remove('open'); d.setAttribute('aria-hidden', 'true'); $$('.chip.on').forEach(x => x.classList.remove('on')); HOOKS.open.forEach(f => f(null)); }
const recN = c => c.src.reduce((a, s) => a + s.n, 0);
const chip = (cid, label) => { const c = CL(cid); return `<button class="chip ${c.disagree ? 'dis' : ''}" data-claim="${cid}" aria-label="Show the records for: ${c.head}">${ic(c.disagree ? 'split' : 'database', 12)}${label || `${recN(c)} record${recN(c) === 1 ? '' : 's'}`}</button>`; };

/* ----- page state: assistant (model gateway) on or off, technical words ----- */
const STATE = { gw: GW.on, tech: false };
const HOOKS = { gw: [], tech: [], open: [] };
function setGW(v) { STATE.gw = v; document.body.classList.toggle('nogw', !v); const b = $('#swg'); if (b) { b.setAttribute('aria-checked', v); b.querySelector('.ss').textContent = v ? 'on' : 'off'; } HOOKS.gw.forEach(f => f(v)); }
function setTech(v) { STATE.tech = v; document.body.classList.toggle('show-tech', v); const b = $('#swt'); if (b) { b.setAttribute('aria-checked', v); b.querySelector('.ss').textContent = v ? 'on' : 'off'; } HOOKS.tech.forEach(f => f(v)); }
function band(extra) {
  const t = DATA.topic;
  return `<header class="band"><p class="brand">AUGUR</p><nav class="crumbs" aria-label="Where you are">${DATA.apps.artifacts}<span class="sep">${ic('chevron-right', 14)}</span>${t.library}<span class="sep">${ic('chevron-right', 14)}</span><b>${t.title}</b></nav><span class="floortag" data-tier="${FL(t.floor).tier}">Kept on ${FL(t.floor).name}</span>${extra || ''}<div class="toggles"><button class="sw" id="swg" role="switch" aria-checked="true">${ic('circle-dashed', 14)}<span>${GW.Plain}</span><span class="ss">on</span><span class="kbd">G</span></button><button class="sw" id="swt" role="switch" aria-checked="false">${ic('code', 14)}<span>Technical words</span><span class="ss">off</span><span class="kbd">T</span></button></div></header>`;
}
function wire() {
  document.addEventListener('click', e => { if (e.target.closest('#swg')) setGW(!STATE.gw); if (e.target.closest('#swt')) setTech(!STATE.tech); const c = e.target.closest('[data-claim]'); if (c) { OPEN === c.dataset.claim ? closeRecords() : openRecords(c.dataset.claim); } if (e.target.closest('#dx')) closeRecords(); });
  document.addEventListener('keydown', e => { if (e.metaKey || e.ctrlKey || e.altKey) return;
    if (e.key === 'g' || e.key === 'G') setGW(!STATE.gw);
    if (e.key === 't' || e.key === 'T') setTech(!STATE.tech);
    if (e.key === 'Escape') closeRecords(); });
}
/* timers for the auto-demo; R replays from the start */
const TIMERS = [];
const later = (fn, t) => TIMERS.push(setTimeout(fn, RM ? Math.min(t, ms('--motion-base')) : t));
function boot(reset, demo) {
  const w = $('#wrap');
  const run = () => { TIMERS.splice(0).forEach(clearTimeout); closeRecords(); setGW(GW.on); setTech(false); reset(); Icons.hydrate(); w.classList.add('pre'); later(() => { w.classList.remove('pre'); demo(); }, ms('--motion-run')); };
  document.addEventListener('keydown', e => { if ((e.key === 'r' || e.key === 'R') && !e.metaKey && !e.ctrlKey && !e.altKey) run(); });
  wire();
  run();
}
