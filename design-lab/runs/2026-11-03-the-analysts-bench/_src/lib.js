/* ---- shared helpers (same in every page of the run) ---- */
const $ = (s, el = document) => el.querySelector(s);
const $$ = (s, el = document) => [...el.querySelectorAll(s)];
const I = (n, size = 16, stroke = 1.5) => Icons.svg(n, { size, stroke });
const P = id => id === 'model' ? { name: 'the assistant', role: 'model, in pencil' } : DATA.people[id];
const F = id => DATA.floors[id];
const T = id => DATA.techniques[id];
const first = id => id === 'model' ? 'Assistant' : P(id).name.split(' ')[0];
const fmt = n => n.toLocaleString('en-GB');
const plural = (n, one, many) => `${fmt(n)} ${n === 1 ? one : (many || one + 's')}`;
const sum = (a, f) => a.reduce((t, x) => t + f(x), 0);
const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
const css = v => getComputedStyle(document.documentElement).getPropertyValue(v).trim();
const ms = v => parseFloat(css(v)) || 0;
const STATE = { tech: false, gateway: DATA.gateway.on };
const ME = DATA.me;
/* lower-case only a sentence's first letter, and never a name: "Low Moor" and "Calder" keep their capitals */
const PROPER = new Set([...Object.values(DATA.people).flatMap(p => p.name.split(' ')), ...DATA.supplier.split(' '), ...DATA.org.split(' '), ...Object.values(DATA.floors).flatMap(f => f.name.split(' ')), ...DATA.missedByMonth.months, 'Low', 'Calder', 'Calder’s', 'Highways', 'Tuesday', 'Thursday', 'January', 'Dan', 'Procurement', 'Customer']);
String.prototype.lc = function () { const w = String(this).split(/[\s,:;]/)[0]; return PROPER.has(w) || /^[A-Z0-9-]{2,}/.test(w) ? String(this) : this.charAt(0).toLowerCase() + this.slice(1); };

/* ======================== the one rule (the briefing run's yardstick) ======================== */
const WT = { strong: 3, fair: 2, weak: 1 };
function strength(g) {
  if (!g) return 'weak';
  const r = g[0], c = +g[1];
  if ('AB'.includes(r) && c <= 2) return 'strong';
  if ('ABC'.includes(r) && c <= 3) return 'fair';
  return 'weak';
}
function sideInfo(srcs) {
  const st = srcs.map(s => strength(DATA.sources[s].grade));
  const best = st.includes('strong') ? 'strong' : st.includes('fair') ? 'fair' : 'weak';
  const n = st.length, w = sum(st, s => WT[s]);
  let rung;
  if (n >= 2 && best === 'strong') rung = 0;
  else if ((n === 1 && best === 'strong') || (n >= 2 && best === 'fair')) rung = 1;
  else if ((n === 1 && best === 'fair') || (n >= 2 && best === 'weak')) rung = 2;
  else rung = 3;
  return { n, best, w, rung };
}
function derive(fid) {
  const f = DATA.facts[fid];
  if (!f) return null;
  if (f.hidden) return { kind: 'hidden', word: DATA.outside.hidden.word, f };
  if (f.gap || !f.sides || !f.sides.length) return { kind: 'gap', word: DATA.outside.gap.word, f };
  if (f.sides.length > 1) return { kind: 'dispute', word: DATA.outside.dispute.word, f };
  const s = sideInfo(f.sides[0]);
  return { kind: 'fact', rung: s.rung, word: DATA.yardstick[s.rung].word, n: s.n, best: s.best, f };
}
/* the word at word size: a five-step stick plus the word; title holds the rule */
function yw(fid, withWord = true) {
  const d = derive(fid);
  if (!d) return '';
  if (d.kind !== 'fact') return `<span class="yw ${d.kind}" title="${d.word}">${I(DATA.outside[d.kind].icon, 12)}${withWord ? d.word : ''}</span>`;
  const y = DATA.yardstick[d.rung];
  return `<span class="yw r${d.rung}" title="${y.word}: ${y.rule}"><span class="st" aria-hidden="true">${[4, 3, 2, 1, 0].map(k => `<i class="${k >= d.rung && d.rung < 4 ? 'on' : ''}"></i>`).join('')}</span>${withWord ? y.word : ''}</span>`;
}
const why = fid => {
  const d = derive(fid), f = DATA.facts[fid];
  if (d.kind === 'hidden') return `Kept on the ${F(f.hidden.floor).name} floor, which you can’t open. Ask ${P(f.hidden.ask).name}.`;
  if (d.kind === 'gap') return `Nobody has said yet. ${P(f.gap.who).name} could: ${f.gap.how}.`;
  const srcs = f.sides[0].map(s => DATA.sources[s].name).join(' and ');
  return `${d.n === 1 ? 'One source' : d.n + ' sources agree'}: ${srcs}. Best is ${DATA.strengthWord[d.best]}.`;
};

/* ======================== assumption marks, from the word ======================== */
function markOf(a) {
  if (a.mark) return a.mark;                     /* a person (or a technique) lowered it, with a reason */
  const d = derive(a.fact);
  if (!d) return 'unsupported';
  if (d.kind === 'gap' || d.kind === 'hidden') return d.kind;
  if (d.kind === 'dispute') return 'unsupported';
  return d.rung <= 1 ? 'solid' : d.rung === 2 ? 'caveats' : 'unsupported';
}
const amk = (k, withWord = true) => `<span class="amk ${k}" title="${DATA.marks[k].word}: ${DATA.marks[k].rule}"><i aria-hidden="true"></i>${withWord ? DATA.marks[k].word : ''}</span>`;
const A = id => DATA.assumptions.find(a => a.id === id);
const markCount = () => { const c = {}; DATA.assumptions.forEach(a => { const k = markOf(a); c[k] = (c[k] || 0) + 1; }); return c; };

/* ======================== competing explanations ======================== */
const X = DATA.ach;
const H = id => X.hyps.find(h => h.id === id);
const hypsShown = () => X.hyps.filter(h => !h.pencil || STATE.gateway);
const MW = { I: 1, II: 2 };
/* weight of a mark: a fact that is only "possible" counts half and can't rule anything out alone */
function markWeight(row, hid) {
  const m = row.m[hid]; if (!MW[m]) return 0;
  const d = derive(row.fact); return d && d.kind === 'fact' && d.rung >= 3 ? MW[m] / 2 : MW[m];
}
const against = (hid, rows = X.rows) => sum(rows, r => markWeight(r, hid));
const touched = (hid, rows = X.rows) => rows.filter(r => r.m[hid]).length;
const tested = hid => touched(hid) >= 3;
const rowAgainst = (r, hs = hypsShown()) => sum(hs, h => markWeight(r, h.id));
const diagnostic = (r, hs = hypsShown()) => hs.some(h => MW[r.m[h.id]]) && hs.some(h => !MW[r.m[h.id]]);
const MARKWORD = { C: 'fits', I: 'against', II: 'rules it out', '': 'says nothing' };
const cm = (m, extra = '') => `<span class="cm ${m} ${extra}" title="${MARKWORD[m || '']}"></span>`;

/* the grid: explanations across, facts down, one mark per cell; totals count only what is against */
function matrixHTML(o = {}) {
  const hs = o.hyps || hypsShown(), rows = (o.rows || X.rows).filter(r => !(o.off || new Set()).has(r.id));
  const lit = o.lit || new Set(), open = o.open || new Set();
  const gone = o.gone || new Set(), tr = o.totRows || rows;
  const maxA = Math.max(1, ...hs.map(h => against(h.id, tr)));
  return `<table class="mx ${o.compact ? 'compact' : ''}"><thead><tr><th class="fh">${o.corner || 'Fact · its word'}</th>${hs.map(h => `<th class="hh ${h.pencil ? 'pen' : ''} ${o.hot === h.id ? 'hot' : ''}" title="${h.say}"><span>${h.short}</span>${h.pencil ? `<span class="byline">${I('pencil', 10)}assistant</span>` : ''}</th>`).join('')}</tr></thead>
  <tbody>${rows.map(r => `<tr class="${lit.has(r.id) ? 'lit' : ''} ${diagnostic(r, hs) ? '' : 'nd'} ${gone.has(r.id) ? 'gone' : ''}"><th class="fr"><span class="ft">${DATA.facts[r.fact].say}</span>${o.words === false ? '' : yw(r.fact)}</th>${hs.map(h => `<td>${open.has(h.id) ? cm('', 'open') : cm(r.m[h.id], derive(r.fact).rung >= 3 ? 'weak' : '')}</td>`).join('')}</tr>`).join('')}</tbody>
  ${o.totals === false ? '' : `<tfoot><tr><th class="fr">Against it ${o.tech !== false ? '<span class="tk">rules it out = 2, against = 1; a fact that is only possible counts half</span>' : ''}</th>${hs.map(h => { const a = against(h.id, tr), t = tested(h.id); return `<td><span class="tot ${a === 0 && t ? 'least' : ''}">${open.has(h.id) || !t ? '<span class="small muted">untested</span>' : `<b class="num">${a}</b><i style="width:${a / maxA * 100}%"></i>`}</span></td>`; }).join('')}</tr></tfoot>`}</table>`;
}

/* ======================== small parts ======================== */
const mins = (n, over = false) => `<span class="mins ${over ? 'over' : ''}">${I('timer', 13)}${n} min</span>`;
const tq = (tid, size = 16) => `<span class="tq">${I(T(tid).icon, size)}${T(tid).name}</span>`;
const fchip = fl => `<span class="fchip" data-tier="${F(fl).tier}">${F(fl).name} · ${F(fl).word}</span>`;
const W = id => DATA.watches.find(w => w.id === id);
const watchHTML = (w, opts = {}) => `<div class="wl ${w.sees ? '' : 'blind'}">${I(w.sees ? 'eye' : 'eye-off', 14)}<span><b>${w.say}</b> ${w.line}${opts.owner === false ? '' : ` <span class="muted">· ${P(w.owner).name}</span>`}</span>${w.sees ? (opts.listens === false ? '' : `<span class="cant">listens to ${w.listens}</span>`) : `<span class="cant"><span class="blindtag">${I('eye-off', 10)}can’t see</span> ${w.cant}</span>`}</div>`;
const pencilBy = () => `<span class="byline">${I('pencil', 11)}the assistant, in pencil</span>`;

/* the offer: one technique, with why, its price said first, and a quiet way out */
function offerHTML(tid, whyText, opts = {}) {
  const t = T(tid);
  return `<div class="offer card ${opts.cls || ''}"><p class="lbl">${opts.label || 'AUGUR offers one technique'}</p>
    <div style="display:flex;align-items:center;gap:var(--space-3);flex-wrap:wrap"><span class="tq" style="font-size:var(--type-heading);line-height:var(--leading-heading);font-weight:300">${I(t.icon, 22)}${t.name}</span>${mins(t.minutes)}<span class="small muted">${t.people}</span></div>
    <span class="tk">${t.tech}</span>
    <p class="small"><span class="muted">Why this one:</span> ${whyText}</p>
    <p class="small"><span class="muted">You get:</span> ${t.makes.charAt(0).toLowerCase() + t.makes.slice(1)}. <span class="muted">Kept</span> ${t.kept.toLowerCase()}.</p>
    ${opts.then ? `<p class="small"><span class="muted">Then:</span> ${opts.then}</p>` : ''}
    <div style="display:flex;gap:var(--space-2);flex-wrap:wrap;margin-top:var(--space-1)"><button class="btn go">${I('play', 14)}Start · ${t.minutes} min</button><button class="btn">Not now</button>${opts.extra || ''}</div></div>`;
}

/* top bar */
function topHTML(crumbs, hints, floor = 'fac') {
  return `<header class="top"><p class="brand">AUGUR</p>
    <nav class="crumb" aria-label="Where you are">${crumbs.map((c, i) => (i ? I('chevron-right', 14) : '') + (i === crumbs.length - 1 ? `<b>${c}</b>` : `<span>${c}</span>`)).join('')}</nav>
    ${fchip(floor)}
    <div class="hints">${hints.map(([k, w, id, opt]) => `<span ${id ? `id="${id}"` : ''} class="${opt ? 'opt' : ''}"><span class="kbd">${k}</span>${w}</span>`).join('')}</div></header>`;
}
const STD = [['T', 'trade names', 'h-t'], ['G', 'model off', 'h-g'], ['R', 'replay']];

/* keys shared by every page */
function commonKeys(e, rerender, replay) {
  if (e.metaKey || e.ctrlKey || e.altKey) return false;
  if (e.target.closest && e.target.closest('input,textarea,select')) return false;
  const k = e.key.toLowerCase();
  if (k === 'r') { replay(); return true; }
  if (k === 't') { STATE.tech = !STATE.tech; document.body.classList.toggle('tech', STATE.tech); return true; }
  if (k === 'g') { STATE.gateway = !STATE.gateway; rerender(); return true; }
  return false;
}
function markKeys() { $('#h-t')?.classList.toggle('on', STATE.tech); $('#h-g')?.classList.toggle('on', !STATE.gateway); }
const gatewayNote = () => STATE.gateway ? '' : `<p class="small muted">${I('power-off', 12)} The model is off (${P(DATA.gateway.admin).name} can turn it on). Pencil is gone; no mark, count or word changed.</p>`;

/* timers for the moment, cleared on replay */
let TIMERS = [];
const later = (fn, t) => TIMERS.push(setTimeout(fn, reduced ? Math.min(t, 50) : t));
const clearLater = () => { TIMERS.forEach(clearTimeout); TIMERS = []; };
const MOMENT = () => ms('--motion-run'); /* the moment plays at ~1.2 s */
function settle() { document.body.classList.add('pre'); requestAnimationFrame(() => requestAnimationFrame(() => document.body.classList.remove('pre'))); }
