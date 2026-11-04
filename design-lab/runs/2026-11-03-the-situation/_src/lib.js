/* ---- shared helpers (same in every page of the run) ---- */
const $ = (s, el = document) => el.querySelector(s);
const $$ = (s, el = document) => [...el.querySelectorAll(s)];
const I = (n, size = 16, stroke = 1.5) => Icons.svg(n, { size, stroke });
const RANK = Object.fromEntries(DATA.floorOrder.map((f, i) => [f, i]));
const P = id => DATA.people[id];
const F = id => DATA.floors[id];
const first = id => P(id).name.split(' ')[0];
const fmt = n => n.toLocaleString('en-GB');
const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
const css = v => getComputedStyle(document.documentElement).getPropertyValue(v).trim();
const ms = v => parseFloat(css(v)) || 0;
const R = DATA.reading;
const T = DATA.task;
const ALL = [...DATA.pieces, ...DATA.setAside, ...DATA.reopen.added];
const PC = id => ALL.find(p => p.id === id);
const INTENT = id => DATA.intents.find(x => x.id === id);
const READER = id => DATA.readers.find(x => x.id === id);
const CH = id => DATA.reopen.changes[id];
const STATE = { tech: false };

/* the three rungs, plain word first, the admin word one step down */
const RUNG = {
  data:    { n: 1, word: 'Data',        what: 'a reading',                        tech: 'observation · Data Atlas' },
  info:    { n: 2, word: 'Information', what: 'a reading given meaning',          tech: 'derived value · Explorer query' },
  context: { n: 3, word: 'Context',     what: 'meaning placed against a reader, a task and what else is going on', tech: 'working-set piece · Artifacts' }
};
const RUNGS = ['data', 'info', 'context'];
const APPICON = { 'Data Atlas': 'database', Explorer: 'compass', Artifacts: 'file-text', Mandate: 'target' };
/* the five reasons an answer moves (reference desk) */
const REASON = { happened: 'Something happened', learned: 'We learned about the past', access: 'Who can answer changed', settled: 'A guess was settled', meaning: 'A word changed meaning' };

function rm(rung, o = {}) {
  const r = RUNG[rung];
  return `<span class="rm ${o.lg ? 'lg' : ''}" data-r="${r.n}" title="${r.word}: ${r.what}"><span class="st" aria-hidden="true"><i></i><i></i><i></i></span>${o.word === false ? '' : `<span class="rw">${r.word}</span>`}<span class="tk">${r.tech}</span></span>`;
}
function liftHTML(l) {
  const L = DATA.lifts[l.k];
  return `<span class="lift" title="Lifted by ${L.word}">${I(L.icon, 12)}<span>${l.w}</span><span class="tk">&nbsp;· ${L.tech}</span></span>`;
}
const liftsHTML = p => (p.lift || []).map(liftHTML).join(' ');

/* access: a reader on floor f opens what is kept on f or the floors above it; restricted only by name */
function canOpen(src, readerId) {
  if (!readerId) return true;
  const p = P(readerId);
  if (src.restricted && !(src.restrictedTo || []).includes(readerId)) return false;
  return RANK[src.kept] <= RANK[p.floor];
}
function srcHTML(src, readerId) {
  if (!canOpen(src, readerId)) {
    return `<span class="unseen" title="${src.restricted || 'Kept on a floor this reader doesn’t read'}">${I('lock', 12)} not yours to see · ask ${P(src.keeper).name}</span>`;
  }
  return `<span class="src" data-tier="${src.kept}">${I(APPICON[src.app], 12)}<b>${src.title}</b><span class="fdot" aria-hidden="true"></span>${F(src.kept).word}${src.restricted ? ` ${I('lock', 12)}` : ''}<span class="tk">&nbsp;· ${src.tech}</span></span>`;
}
function whoHTML(id, o = {}) {
  const p = P(id);
  return `<span class="who" data-tier="${p.floor || 'outside'}"><span class="fdot" aria-hidden="true"></span><span>${p.name}${o.role ? `<span class="muted">, ${p.role}</span>` : ''}</span></span>`;
}
const mmHTML = (ink = true) => `<span class="mm ${ink ? 'ink' : ''}" title="${DATA.agent.name}, under ${P(DATA.agent.supervisor).name}">${DATA.agent.mark}</span>`;
function holdsHTML(p, broken) {
  return `<span class="holds ${broken ? 'broken' : ''}">${I(broken ? 'unlink' : 'link-2', 12)} holds while <b>${p.holds}</b></span>`;
}
function saidHTML(p) {
  return p.said ? `<span class="said">${I('quote', 12)} said by ${P(p.said).name}, not checked</span>` : '';
}
/* the class a piece's text takes, so each rung reads differently */
const asRung = r => r === 'data' ? 'as-data' : r === 'info' ? 'as-info' : 'as-context';

/* a piece of a working set, the standard row. opts: reader, why, holds, compact */
function pieceHTML(p, o = {}) {
  const reader = o.reader;
  const tier = p.rung === 'context' ? P(p.reader || T.decider).floor : '';
  const agent = p.agent ? `${mmHTML(true)} <span class="small muted">proposed by ${DATA.agent.name}, accepted by ${P(p.by).name}</span>` : '';
  return `<article class="pc dep ${o.cls || ''}" data-id="${p.id}" style="--i:${o.i || 0}">
    <div class="pc-h">${rm(p.rung)} ${liftsHTML(p)} ${p.disagree ? '<span class="mk-disagree" title="sources disagree"></span>' : ''}</div>
    <p class="pc-t ${asRung(p.rung)}" ${tier ? `data-tier="${tier}"` : ''}>${p.text}</p>
    <p class="pc-m">${srcHTML(p.src, reader)} ${saidHTML(p)} ${agent}</p>
    ${o.why === false ? '' : `<p class="pc-why"><q>${p.reason}</q> <span class="by">${P(p.by).name}, ${p.at}</span></p>`}
    ${o.holds === false || !p.holds ? '' : `<p>${holdsHTML(p, o.broken)}</p>`}
  </article>`;
}

/* the reading as a line, with the contract limit; months beyond the series can be passed in */
function chart(o = {}) {
  const w = o.w || 360, h = o.h || 120, pad = 18;
  const s = o.series || R.series;
  const max = Math.max(...s.map(p => p.v), R.limit) * 1.15;
  const X = i => pad + i * (w - pad * 2) / (s.length - 1), Y = v => h - pad - v * (h - pad * 2) / max;
  const pts = s.map((p, i) => `${X(i).toFixed(1)},${Y(p.v).toFixed(1)}`).join(' ');
  const lim = o.limit === false ? '' : `<line x1="${pad}" x2="${w - pad}" y1="${Y(R.limit)}" y2="${Y(R.limit)}" stroke="var(--ink-muted)" stroke-dasharray="3 3"/><text x="${pad}" y="${Y(R.limit) - 4}" text-anchor="start" fill="var(--ink-muted)" style="font:var(--x-proposed-type-micro) var(--font-mono)">limit ${R.limit}</text>`;
  const dots = s.map((p, i) => `<circle cx="${X(i)}" cy="${Y(p.v)}" r="${o.hi && o.hi.includes(p.m) ? 3.5 : 2}" fill="${o.hi && o.hi.includes(p.m) ? 'var(--light)' : 'var(--ink)'}"/>`).join('');
  const labels = s.map((p, i) => `<text x="${X(i)}" y="${h - 3}" text-anchor="middle" fill="var(--ink-muted)" style="font:var(--x-proposed-type-micro) var(--font-mono)">${p.m}</text>`).join('');
  const vals = o.values ? s.map((p, i) => `<text x="${X(i)}" y="${Y(p.v) - 7}" text-anchor="middle" fill="${o.hi && o.hi.includes(p.m) ? 'var(--light)' : 'var(--ink-muted)'}" style="font:var(--x-proposed-type-micro) var(--font-mono)">${p.v}</text>`).join('') : '';
  const extra = o.extra ? o.extra(X, Y) : '';
  return `<svg class="chart" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}" role="img" aria-label="${R.label} by month: ${s.map(p => p.m + ' ' + p.v).join(', ')}; limit ${R.limit}">${lim}${extra}<polyline points="${pts}" fill="none" stroke="var(--ink)" stroke-width="1.5" stroke-linejoin="round"/>${dots}${vals}${labels}</svg>`;
}

/* top bar */
function topHTML(crumbs, hints, floor = T.floor) {
  return `<header class="top"><p class="brand">AUGUR</p>
    <nav class="crumb" aria-label="Where you are">${crumbs.map((c, i) => (i ? I('chevron-right', 14) : '') + (i === crumbs.length - 1 ? `<b>${c}</b>` : `<span>${c}</span>`)).join('')}</nav>
    <span class="fchip" data-tier="${floor}">${F(floor).name} · ${F(floor).word}</span>
    <div class="hints">${hints.map(([k, w, id]) => `<span ${id ? `id="${id}"` : ''}><span class="kbd">${k}</span>${w}</span>`).join('')}</div></header>`;
}

/* timers for the auto demo, cleared on replay */
let TIMERS = [];
const later = (fn, t) => TIMERS.push(setTimeout(fn, reduced ? Math.min(t, 60) : t));
const clearLater = () => { TIMERS.forEach(clearTimeout); TIMERS = []; };

/* one runner per page: render(), then the moment at about 1.2 s; R replays, T shows the admin words */
function play(render, moment, keys) {
  const replay = () => {
    clearLater();
    document.body.classList.add('pre');
    render(true);
    requestAnimationFrame(() => requestAnimationFrame(() => document.body.classList.remove('pre')));
    if (moment) later(moment, ms('--motion-run'));
  };
  document.addEventListener('keydown', e => {
    if (e.metaKey || e.ctrlKey || e.altKey) return;
    if (e.target.closest && e.target.closest('input,textarea')) return;
    const k = e.key.toLowerCase();
    if (k === 'r') { replay(); return; }
    if (k === 't') { STATE.tech = !STATE.tech; document.body.classList.toggle('tech', STATE.tech); $('#h-t')?.classList.toggle('on', STATE.tech); return; }
    keys && keys(e, k);
  });
  replay();
  return replay;
}
const hydrate = el => Icons.hydrate(el || document.body);
const lc = s => s[0].toLowerCase() + s.slice(1);

/* three weeks on: the state of each piece when the set is reopened */
const STATEW = { holds: 'Still holds', changed: 'Changed', gone: 'No longer holds', orphan: 'Its one source has moved on', new: 'New since' };
const STATEICON = { holds: 'check', changed: 'git-commit-horizontal', gone: 'unlink', orphan: 'user-x', new: 'plus' };
const stateOf = id => (CH(id) || {}).state || (DATA.reopen.added.some(a => a.id === id) ? 'new' : 'holds');
const RO = DATA.reopen;
function stateChip(id) {
  const s = stateOf(id), c = CH(id);
  return `<span class="stc st-${s}">${I(STATEICON[s], 12)} ${STATEW[s]}${c ? ` · ${c.on}` : ''}</span>`;
}
