/* ---- shared helpers (same in every variant) ---- */
const $ = (s, el = document) => el.querySelector(s);
const $$ = (s, el = document) => [...el.querySelectorAll(s)];
const I = (n, size = 16, stroke = 1.5) => Icons.svg(n, { size, stroke });
const P = id => DATA.people[id];
const F = id => DATA.floors[id];
const K = id => DATA.kinds[id];
const ITEM = id => DATA.items.find(x => x.id === id);
const ME = () => P(DATA.me);
const first = id => P(id).name.split(' ')[0];
const fmt = n => n.toLocaleString('en-GB');
const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
const css = v => getComputedStyle(document.documentElement).getPropertyValue(v).trim();
const ms = v => parseFloat(css(v)) || 0;
const plural = (n, w, ws) => `${n} ${n === 1 ? w : (ws || w + 's')}`;

/* who holds a thing, as a sentence. "rule" and "import" are not people, and say so */
const whoName = id => id === 'rule' ? 'a rule' : id === 'import' ? 'an import' : P(id).name;

/* people */
function ini(id, cls = '') {
  const p = P(id);
  return `<span class="ini ${cls} ${p.in === 'off' ? 'off' : ''}" data-tier="${p.floor}" title="${p.name}, ${p.role} · ${F(p.floor).word} floor">${p.ini}</span>`;
}
function pchip(id, opts = {}) {
  const p = P(id);
  return `<span class="pchip" data-tier="${p.floor}">${ini(id, opts.sm ? 'sm' : '')}<b>${opts.first ? first(id) : p.name}</b>${opts.role ? `<span class="r">${p.role}</span>` : ''}</span>`;
}
const fchip = f => `<span class="fchip" data-tier="${f}">${F(f).word}</span>`;

/* time words. h is hours from now */
function dueWords(it) {
  if (it.h < 0) { const d = Math.floor(-it.h / 24), hh = Math.round(-it.h % 24); return { main: it.due, sub: `${d} d ${hh} h over`, past: true }; }
  if (it.h < 24) return { main: it.due, sub: `in ${Math.floor(it.h)} h ${Math.round((it.h % 1) * 60)} min`, past: false };
  if (it.h < 48) return { main: it.due, sub: 'tomorrow', past: false };
  return { main: it.due, sub: `in ${Math.round(it.h / 24)} days`, past: false };
}

/* the strip: one shape for a thing someone holds. fields left to right:
   floor band · kind and id · what it is · who holds it · its time */
function stripHTML(it, o = {}) {
  const k = K(it.kind), d = dueWords(it);
  const cls = ['strip', 'dep', o.cocked ?? (it.cock && !o.noCock) ? 'cocked' : '', o.transit || it.to ? 'transit' : '', o.ghost ? 'ghost' : '', o.sel ? 'sel' : '', o.cls || ''].join(' ');
  let hold;
  if (it.to) hold = `${ini(it.holder, 'sm')}<span class="arrow-hold">${I('arrow-right', 12)}</span>${ini(it.to, 'sm')}`;
  else if (it.next) hold = `${ini(it.holder, 'sm')}<span class="arrow-hold">${I('arrow-right', 12)}</span>${ini(it.next, 'sm')}`;
  else if (it.pointedBy) hold = `${ini(it.holder, 'sm')}<span class="arrow-hold" title="pointed out to you">${I('eye', 12)}</span>`;
  else hold = ini(it.holder);
  const tag = o.tag || 'div';
  return `<${tag} class="${cls}" data-tier="${it.floor}" data-id="${it.id}" style="--i:${o.i ?? 0}" ${tag === 'button' ? `aria-label="${k.word}: ${it.title}. ${it.state}."` : ''}>
    ${it.cock ? `<span class="cocknote" aria-hidden="true">${I('corner-down-right', 14)}</span>` : ''}
    <span class="f fid"><span class="id">${I(k.icon, 13)}${it.id}</span><span class="kw">${k.short || k.word}</span></span>
    <span class="f fbody"><span class="tt">${it.title}</span><span class="ln">${o.line ?? (it.cock && !o.noCock ? `<span class="cockline">cocked: ${it.cock.note}</span>` : it.state + ' · ' + it.line)}</span></span>
    <span class="f hold">${hold}</span>
    <span class="f due"><span class="${d.past ? 'past' : ''}">${d.main}</span><small class="${d.past ? 'past' : ''}">${d.sub}</small></span>
  </${tag}>`;
}

/* a stamp: who, the word, when. always upright */
function stampHTML(who, word, at, cls = '') {
  const p = P(who);
  return `<span class="stamp ${cls}" data-tier="${p.floor}"><span class="w">${word}</span><span class="n">${p.name}</span><span class="d">${at || 'not yet'}</span></span>`;
}
const initialHTML = (who, at) => `<span class="initial" data-tier="${P(who).floor}">${ini(who, 'sm')}${at}</span>`;

/* top bar */
function topHTML(crumbs, hints) {
  const me = ME(), fl = F(DATA.myFloor);
  return `<header class="top"><p class="brand">AUGUR</p>
    <nav class="crumb" aria-label="Where you are">${crumbs.map((c, i) => (i ? I('chevron-right', 14) : '') + (i === crumbs.length - 1 ? `<b>${c}</b>` : `<span>${c}</span>`)).join('')}</nav>
    <span class="fchip" data-tier="${DATA.myFloor}">${fl.name} · ${fl.word}</span>
    <span class="pchip" data-tier="${me.floor}">${ini(DATA.me, 'sm')}<span class="r">${DATA.now.day} · ${DATA.now.time}</span></span>
    <div class="hints">${hints.map(([k, w, id]) => `<span ${id ? `id="${id}"` : ''}><span class="kbd">${k}</span>${w}</span>`).join('')}</div></header>`;
}

/* timers for the auto demo, cleared on replay */
let TIMERS = [];
const later = (fn, t) => TIMERS.push(setTimeout(fn, reduced ? Math.min(t, 50) : t));
const clearLater = () => { TIMERS.forEach(clearTimeout); TIMERS = []; };
/* deposit: render with .pre, then lift it next frame */
function settle() { document.body.classList.add('pre'); requestAnimationFrame(() => requestAnimationFrame(() => document.body.classList.remove('pre'))); }
const typing = e => e.target.closest && e.target.closest('input,textarea,[contenteditable="true"]');
function onKeys(map) {
  document.addEventListener('keydown', e => {
    if (e.metaKey || e.ctrlKey || e.altKey || typing(e)) return;
    const f = map[e.key] || map[e.key.toLowerCase()];
    if (f) { e.preventDefault(); f(e); }
  });
}

/* the approval document: sections with their change marks, and who has signed for each */
const AP = DATA.approval;
const signedFor = n => AP.route.filter(r => r.at && r.covers.includes(n)).map(r => r.who);
function sectionsHTML(o = {}) {
  return `<ol class="secs">${AP.sections.map((s, i) => {
    const by = signedFor(s.n), mine = AP.route.find(r => r.who === DATA.me).covers.includes(s.n);
    const chw = s.ch === 'same' ? 'unchanged' : s.ch === 'new' ? 'new in ' + AP.version : 'changed';
    return `<li class="sec dep ${s.ch} ${o.hot && o.hot.includes(s.n) ? 'hot' : ''}" style="--i:${i}" data-n="${s.n}">
      <span class="sn">${s.n}</span><span class="sbd"><span class="st">${s.t} <span class="chw">${chw}</span></span>
      <span class="sw">${s.ch === 'changed' && o.diff !== false ? `<span class="struck">${s.old}</span> ` : ''}${s.words}</span></span>
      ${o.cover === false ? '' : `<span class="sby">${by.map(w => ini(w, 'sm')).join('')}${mine && o.mine ? o.mine(s.n) : ''}${!by.length && !mine && s.ch !== 'same' ? `<span class="nobody">nobody yet</span>` : ''}</span>`}</li>`;
  }).join('')}</ol>`;
}

/* SBAR: the four boxes of a handover. records-filled boxes say so; a person's boxes are in their words */
const SBAR = [['s', 'Situation', 'what it is now'], ['b', 'Background', 'how it got here'], ['a', 'Assessment', 'what I think'], ['r', 'Recommendation', 'what to do next']];
function sbarHTML(o = {}) {
  const h = DATA.handover, show = o.show ?? 4;
  return `<div class="sbar">${SBAR.map(([k, w, d], i) => {
    const box = h.sbar[k], on = i < show;
    return `<div class="sb ${on ? '' : 'blank'}" style="--i:${i}"><span class="sk">${k.toUpperCase()}</span><span class="sbw">${w}<small>${d}</small></span>
      <p class="sbt">${on ? box.text : ''}</p><span class="src">${on ? (box.src === 'records' ? I('database', 12) + ' from records' : I('pen-line', 12) + ' ' + first(h.from) + '’s words') : ''}</span></div>`;
  }).join('')}</div>`;
}

/* the team board */
const B = DATA.board;
const JK = k => B.jobKinds[k];
const STG = id => B.stages.find(s => s.id === id);
const jobsOf = id => B.jobs.filter(j => j.holder === id);
function tcard(j, o = {}) {
  const jk = JK(j.kind), hot = j.h < 8;
  return `<div class="tcard dep ${o.cls || ''}" data-tier="team" data-j="${j.id}" style="--i:${o.i ?? 0}" title="${j.t}, ${j.home} · ${jk.w} · ${STG(j.stage).w} · due ${j.due}">
    <span class="tc-h">${I(jk.icon, 12)}<span>${j.home}</span><span class="tc-d ${hot ? 'past' : ''}">${j.due}</span></span>
    <span class="tc-t">${j.t}</span>${o.foot ? `<span class="tc-f">${o.foot}</span>` : ''}</div>`;
}
function presence(id) {
  const p = P(id);
  return p.in === 'off' ? { w: p.away, cls: 'off' } : p.in === 'out' ? { w: p.where, cls: 'out' } : { w: p.away ? 'in · ' + p.away : 'in', cls: 'in' };
}

/* the ledger of one fact: entries are only ever added */
const FT = DATA.fact;
const byName = e => e.by === 'import' ? 'Import' : e.by === 'rule' ? 'A rule' : P(e.by).name;
function entryWords(e) {
  /* built lazily: each template only for its own kind of entry */
  const W = {
    set: () => `Set to <b>${e.v}</b> by an import from the ${e.src}, checked by ${P(e.who).name}.`,
    cited: () => `${e.note}. A document now relies on the value.`,
    second: () => `A second source, the ${e.src}, says <b>${e.v}</b>. The two disagree, so the fact is marked disputed.`,
    held: () => `${e.note}.`,
    note: () => `Note added: ${e.note.charAt(0).toLowerCase() + e.note.slice(1)}.`,
    correct: () => `Corrected from <span class="struck">${e.was}</span> to <b>${e.v}</b>. ${e.note}`
  };
  return W[e.act]();
}
/* the value after each entry: a running balance */
function running() { let v = null, disputed = false; return FT.entries.map(e => { if (e.act === 'set') v = e.v; if (e.act === 'second') disputed = true; if (e.act === 'correct') { v = e.v; disputed = false; } return { v, disputed }; }); }
