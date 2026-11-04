/* ---- shared helpers (same in every page of the run) ---- */
const $ = (s, el = document) => el.querySelector(s);
const $$ = (s, el = document) => [...el.querySelectorAll(s)];
const I = (n, size = 16, stroke = 1.5) => Icons.svg(n, { size, stroke });
const P = id => DATA.people[id];
const F = id => DATA.floors[id];
const A = id => DATA.agents[id];
const K = id => DATA.kinds.find(k => k.id === id);
const L = n => DATA.ladder[n];
const first = id => P(id).name.split(' ')[0];
const fmt = n => n.toLocaleString('en-GB');
const plural = (n, one, many) => `${fmt(n)} ${n === 1 ? one : (many || one + 's')}`;
const sum = (a, f) => a.reduce((t, x) => t + f(x), 0);
const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
const css = v => getComputedStyle(document.documentElement).getPropertyValue(v).trim();
const ms = v => parseFloat(css(v)) || 0;
const STATE = { tech: false, gateway: DATA.gateway.on };
let ME = DATA.me;

/* the maker's mark */
const mm = (aid, ink = false, lg = false) => `<span class="mm${ink ? ' ink' : ''}${lg ? ' lg' : ''}" title="${A(aid).name}, an agent">${A(aid).mark}</span>`;
/* the ladder at word size, with the kind's cap */
function rungs(level, cap = 3) {
  return `<span class="rungs" aria-hidden="true">${DATA.ladder.map(r => `<i class="${r.n < level ? 'on' : r.n === level ? 'at' : r.n > cap ? 'capped' : ''}"></i>`).join('')}</span>`;
}
const lvl = (level, cap = 3, withName = true) => `<span class="lvl" title="Rung ${level} of ${DATA.ladder.length - 1}: ${L(level).name}">${rungs(level, cap)}${withName ? L(level).name : ''}</span>`;
const fchip = fl => `<span class="fchip" data-tier="${fl}">${F(fl).name} · ${F(fl).word}</span>`;
const person = (id, extra = '') => `<span class="who">${P(id).name}${extra ? `<span class="muted">${extra}</span>` : ''}</span>`;

/* the mode line: what the agent is doing now, what it will do next, what stops it */
function modeHTML(aid, opts = {}) {
  const a = A(aid), g = STATE.gateway;
  const held = a.now.w === 'Holding';
  const now = !g && !held ? { w: 'Paused', what: 'the model gateway is off', step: `${P(DATA.gateway.admin).name} can turn it on`, tech: 'gateway 403 · run waits, nothing lost' } : a.now;
  const nx = opts.next || a.next[0];
  return `<div class="mode ${held ? 'held' : ''} ${opts.v ? 'v' : ''}" role="status" aria-label="${a.name}: ${now.w} ${now.what}">
    <div>${mm(aid)}<span><span class="ml">Agent</span><span class="mv"><b>${a.name}</b></span></span></div>
    <div class="now ${opts.boxNow ? 'boxed' : ''}"><span class="ml">Now</span><span class="mv"><b>${now.w}</b> ${now.what}</span><span class="mv muted">${now.step}</span><span class="tk">${now.tech}</span></div>
    <div class="${opts.boxNext ? 'boxed' : ''}"><span class="ml">Next</span><span class="mv"><b>${nx.w}</b> ${nx.what}</span><span class="mv muted">${a.next[1] ? 'then ' + a.next[1].w.toLowerCase() + ' ' + a.next[1].what : (nx.when || '&nbsp;')}</span></div>
    <div><span class="ml">Works under</span><span class="mv">${P(a.supervisor).name}</span><span class="mv muted">deputy ${P(a.deputy).name}</span></div>
    <div><span class="ml">Rung</span><span class="mv">${lvl(a.level)}</span><span class="mv muted num">${a.calls.used} of ${a.calls.limit} calls today</span></div>
  </div>`;
}

/* top bar */
function topHTML(crumbs, hints, floor) {
  const me = P(ME), fl = floor || me.floor;
  return `<header class="top"><p class="brand">AUGUR</p>
    <nav class="crumb" aria-label="Where you are">${crumbs.map((c, i) => (i ? I('chevron-right', 14) : '') + (i === crumbs.length - 1 ? `<b>${c}</b>` : `<span>${c}</span>`)).join('')}</nav>
    <span class="fchip" data-tier="${fl}">${F(fl).name} · ${F(fl).word}</span>
    <div class="hints">${hints.map(([k, w, id]) => `<span ${id ? `id="${id}"` : ''}><span class="kbd">${k}</span>${w}</span>`).join('')}</div></header>`;
}
const STD = [['T', 'ADR words', 'h-t'], ['G', 'gateway off', 'h-g'], ['R', 'replay']];

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

/* timers for the auto demo, cleared on replay */
let TIMERS = [];
const later = (fn, t) => TIMERS.push(setTimeout(fn, reduced ? Math.min(t, 50) : t));
const clearLater = () => { TIMERS.forEach(clearTimeout); TIMERS = []; };
const MOMENT = () => ms('--motion-run'); /* the moment plays at ~1.2 s */
function settle() { document.body.classList.add('pre'); requestAnimationFrame(() => requestAnimationFrame(() => document.body.classList.remove('pre'))); }

/* diary sums: every count on every page is summed from DATA.diary */
const D = {
  of: (kind, aid) => DATA.diary.filter(d => d.kind === kind && (!aid || d.agent === aid)),
  n: (kind, aid) => sum(D.of(kind, aid), d => d.n),
  reports: aid => sum(DATA.diary.filter(d => d.kind === 'batch' && (!aid || d.agent === aid)), d => d.reports || 0),
  waiting: () => D.n('batch') + D.n('held') + D.n('disagree')
};
const KIND_WORD = { batch: 'Waits as a batch', held: 'Waits one by one', outside: 'Outside its scope', done: 'Done, can be undone', standby: 'Stands by', disagree: 'Sources disagree', limit: 'Couldn’t do' };
const KIND_ICON = { batch: 'layers', held: 'hand', outside: 'fence', done: 'check', standby: 'circle-pause', disagree: 'split', limit: 'gauge' };
