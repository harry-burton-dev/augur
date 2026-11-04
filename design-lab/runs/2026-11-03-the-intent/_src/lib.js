/* ---- shared helpers (same in every page of the run) ---- */
const $ = (s, el = document) => el.querySelector(s);
const $$ = (s, el = document) => [...el.querySelectorAll(s)];
const I = (n, size = 16, stroke = 1.5) => Icons.svg(n, { size, stroke });
const P = id => DATA.people[id];
const F = id => DATA.floors[id];
const N = id => DATA.intents[id];
const FACT = id => DATA.facts[id];
const PART = id => DATA.parts.find(p => p.id === id);
const first = id => P(id).name.split(' ')[0];
const fmt = n => typeof n === 'number' ? n.toLocaleString('en-GB') : n;
const lc1 = s => s.charAt(0).toLowerCase() + s.slice(1);
const plural = (n, one, many) => `${fmt(n)} ${n === 1 ? one : (many || one + 's')}`;
const sum = (a, f) => a.reduce((t, x) => t + f(x), 0);
const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
const css = v => getComputedStyle(document.documentElement).getPropertyValue(v).trim();
const ms = v => parseFloat(css(v)) || 0;
const STATE = { tech: false, gateway: DATA.gateway.on };
let ME = DATA.me;

/* every limit by id, from whichever intent holds it */
const LIMIT = id => { for (const k in DATA.intents) { const l = (N(k).limits || []).find(x => x.id === id); if (l) return Object.assign({ intent: k }, l); } return null; };
/* every limit an intent is bound by: inherited first, then its own */
const limitsOf = id => [...(N(id).inherits || []).map(LIMIT), ...(N(id).limits || []).map(l => Object.assign({ intent: id, own: true }, l))];
const TASK = (iid, tid) => (N(iid).tasks || []).find(t => t.id === tid);
const OPTION = id => DATA.plan.options.find(o => o.id === id);
const ITEM = id => DATA.incoming.find(i => i.id === id);
const floorOf = iid => N(iid).floor;
const scopeName = iid => { const n = N(iid); return n.dept || n.team || F(n.floor).name; };

/* chips */
const fchip = fl => `<span class="fchip" data-tier="${fl}">${F(fl).name} · ${F(fl).word}</span>`;
function ichip(iid, o = {}) {
  const n = N(iid);
  const t = o.short ? '' : n.restricted ? `Restricted · held by ${P(n.owner).name}` : n.title;
  return `<span class="ichip ${o.lg ? 'lg' : ''} ${n.restricted ? 'restricted' : ''}" data-tier="${n.floor}" title="${n.restricted ? 'You can’t open this intent' : iid + ': ' + n.title}">${o.ring ? ringHTML(o.ring) : ''}<span class="iid">${iid}</span>${t ? `<span class="it">${t}</span>` : ''}</span>`;
}
const ringHTML = st => `<span class="ring ${st}" aria-hidden="true"></span>`;
const RING_WORD = { confirmed: 'Said back and confirmed', corrected: 'Said back, corrected', open: 'Not said back yet: an open question', na: 'Reads only' };
const person = (id, extra = '') => `<span class="who">${P(id).name}${extra ? ` <span class="muted">${extra}</span>` : ''}</span>`;
const partWord = id => PART(id) ? PART(id).w : id;
const limHTML = (l, o = {}) => `<div class="lim ${l.own ? '' : 'inh'} ${o.cross ? 'cross' : ''}"><span class="lid">${l.id}</span><span>${l.w}${o.tk !== false ? `<span class="tk">${l.tech || ''}</span>` : ''}</span>${o.owner === false ? '' : `<span class="lo">${P(l.owner).name}</span>`}</div>`;
const VERDICT = { within: ['Within intent', 'circle-check'], against: ['Within, against a task', 'circle-dot'], ask: ['Ask', 'hand'], limit: ['Across a limit', 'octagon-x'] };
const vdHTML = (o) => `<span class="vd ${o.verdict}">${I(VERDICT[o.verdict][1], 12)}${o.verdict === 'ask' || o.verdict === 'limit' ? (o.verdict === 'ask' ? 'Ask ' : 'Only ') + P(o.ask).name : VERDICT[o.verdict][0]}</span>`;
const rungHTML = r => { const n = { data: 1, information: 2, context: 3 }[r] || 0; return `<span class="rung" title="${r || 'unknown'}"><i class="${n >= 1 ? 'on' : ''}"></i><i class="${n >= 2 ? 'on' : ''}"></i><i class="${n >= 3 ? 'on' : ''}"></i>&nbsp;${r || '—'}</span>`; };

/* what a touch reads as: "limit L3 of ORG-07" */
function touchWord([iid, kind, ref]) {
  const n = N(iid);
  if (kind === 'limit') return `limit ${ref}: ${LIMIT(ref).w}`;
  if (kind === 'task') return `key task ${ref}: ${TASK(iid, ref).w}`;
  if (kind === 'end') { const e = n.end[+ref.slice(1) - 1]; return `done looks like: ${e.w}`; }
  if (kind === 'freedom') return `freedom: ${n.freedom[+ref.slice(1) - 1]}`;
  if (kind === 'purpose') return 'its purpose';
  if (kind === 'unseen') return 'a part you can’t open';
  return kind;
}
/* the rank rule: an order, not a score */
function rankOf(it) {
  if (!it.touches || !it.touches.length) return 7;
  const k = it.touches.map(t => t[1]);
  if (it.restricted) return 6;
  if (it.mine && k.includes('limit')) return 1;
  if (it.mine) return 2;
  if (k.includes('limit')) return 3;
  if (k.includes('task') || k.includes('freedom')) return 4;
  return 5;
}
const ranked = (items = DATA.incoming) => [...items].sort((a, b) => rankOf(a) - rankOf(b) || a.bitesRank - b.bitesRank || a.t.localeCompare(b.t));
/* which touch to name first */
const topTouch = it => [...it.touches].sort((a, b) => ['limit', 'task', 'freedom', 'end', 'purpose', 'unseen'].indexOf(a[1]) - ['limit', 'task', 'freedom', 'end', 'purpose', 'unseen'].indexOf(b[1]))[0];

/* a measure line: start, now, target */
function measure(fid, o = {}) {
  const f = FACT(fid), lo = Math.min(f.start, f.target, f.now), hi = Math.max(f.start, f.target, f.now);
  if (hi === lo) return `<span class="meas flat micro muted">${f.now} so far · held at ${f.target}</span>`;
  const pad = (hi - lo) * .08 || 1, a = lo - pad, b = hi + pad, x = v => ((v - a) / (b - a)) * 100;
  const ghost = o.ghost != null ? `<i class="m-ghost" style="left:${x(o.ghost)}%"></i>` : '';
  return `<span class="meas" title="${f.w}: ${f.now}${f.unit} now, ${f.target}${f.unit} by ${f.by}"><span class="m-track"><i class="m-run" style="left:${Math.min(x(f.start), x(f.now))}%;width:${Math.abs(x(f.now) - x(f.start))}%"></i><i class="m-target" style="left:${x(f.target)}%"></i><i class="m-now" style="left:${x(f.now)}%"></i>${ghost}</span></span>`;
}

/* top bar */
function topHTML(crumbs, hints, floor) {
  const me = P(ME), fl = floor || me.floor;
  return `<header class="top"><p class="brand">AUGUR</p>
    <nav class="crumb" aria-label="Where you are">${crumbs.map((c, i) => (i ? I('chevron-right', 14) : '') + (i === crumbs.length - 1 ? `<b>${c}</b>` : `<span>${c}</span>`)).join('')}</nav>
    <span class="fchip" data-tier="${fl}">${F(fl).name} · ${F(fl).word}</span>
    <div class="hints">${hints.map(([k, w, id]) => `<span ${id ? `id="${id}"` : ''}><span class="kbd">${k}</span>${w}</span>`).join('')}</div></header>`;
}
const STD = [['T', 'doctrine words', 'h-t'], ['R', 'replay']];
const STDG = [['T', 'doctrine words', 'h-t'], ['G', 'gateway off', 'h-g'], ['R', 'replay']];

/* keys shared by every page */
function commonKeys(e, rerender, replay) {
  if (e.metaKey || e.ctrlKey || e.altKey) return false;
  if (e.target.closest && e.target.closest('input,textarea,select,[contenteditable]')) return false;
  const k = e.key.toLowerCase();
  if (k === 'r') { replay(); return true; }
  if (k === 't') { STATE.tech = !STATE.tech; document.body.classList.toggle('tech', STATE.tech); markKeys(); return true; }
  if (k === 'g' && $('#h-g')) { STATE.gateway = !STATE.gateway; rerender(); markKeys(); return true; }
  return false;
}
function markKeys() { $('#h-t')?.classList.toggle('on', STATE.tech); $('#h-g')?.classList.toggle('on', !STATE.gateway); }

/* timers for the auto demo, cleared on replay */
let TIMERS = [];
const later = (fn, t) => TIMERS.push(setTimeout(fn, reduced ? Math.min(t, 50) : t));
const clearLater = () => { TIMERS.forEach(clearTimeout); TIMERS = []; };
const MOMENT = () => ms('--motion-run'); /* the moment plays at ~1.2 s */
function settle() { document.body.classList.add('pre'); requestAnimationFrame(() => requestAnimationFrame(() => document.body.classList.remove('pre'))); }
