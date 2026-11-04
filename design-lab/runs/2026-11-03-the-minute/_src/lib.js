/* ---- shared helpers (same in every page of the run) ---- */
const $ = (s, el = document) => el.querySelector(s);
const $$ = (s, el = document) => [...el.querySelectorAll(s)];
const I = (n, size = 16, stroke = 1.5) => Icons.svg(n, { size, stroke });
const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
const css = v => getComputedStyle(document.documentElement).getPropertyValue(v).trim();
const ms = v => parseFloat(css(v)) || 0;
const fmt = n => n.toLocaleString('en-GB');
let NOW = DATA.today;

/* lookups */
const P = id => DATA.people[id];
const Dn = id => DATA.decisions[id];
const Ac = id => DATA.actions[id];
const Mt = id => DATA.meetings.find(m => m.id === id);
const Kd = k => DATA.kinds[k];
const B = DATA.body;
const first = id => P(id).name.split(' ')[0];
const meetingOf = id => Mt(Dn(id).meeting);
const docT = id => (DATA.docs[id] || {}).title || id;
const intentT = id => (DATA.intents[id] || {}).title || id;

/* dates: ISO in the data, words on the page */
const MON = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const MONTH = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
const dP = iso => { const [y, m, d] = iso.split('-').map(Number); return { y, m, d: d || 1 }; };
const dt = (iso, style = 'long') => { if (!iso) return ''; const { y, m, d } = dP(iso); if (iso.length === 7) return style === 'long' ? `${MONTH[m - 1]} ${y}` : MON[m - 1]; return style === 'short' ? `${d} ${MON[m - 1]}` : style === 'month' ? `${MON[m - 1]} ${y}` : `${d} ${MON[m - 1]} ${y}`; };
const ts = iso => Date.UTC(dP(iso).y, dP(iso).m - 1, dP(iso).d);
const days = (a, b) => Math.round((ts(b) - ts(a)) / 864e5);
const le = (a, b) => ts(a) <= ts(b);

/* the decision's state on a date (time as an address: every view can ask "as at") */
const ST = {
  'not yet':  { w: 'Not yet made', cls: 'st-notyet' },
  'motion':   { w: 'Motion', cls: 'st-motion' },
  'in force': { w: 'In force', cls: 'st-force' },
  'review':   { w: 'Worth revisiting', cls: 'st-review' },
  'amended':  { w: 'Amended', cls: 'st-amended' },
  'reversed': { w: 'Reversed', cls: 'st-reversed' },
  'spent':    { w: 'Complete', cls: 'st-spent' },
  'lapsed':   { w: 'Lapsed', cls: 'st-lapsed' }
};
function statusAt(id, at = NOW) {
  const d = Dn(id), made = d.inForce || meetingOf(id).date;
  if (!le(made, at)) return 'not yet';
  if (d.reversedOn && le(d.reversedOn, at)) return 'reversed';
  if (d.amendedOn && le(d.amendedOn, at)) return 'amended';
  if (d.lapsedOn && le(d.lapsedOn, at)) return 'lapsed';
  if (d.spentOn && le(d.spentOn, at)) return 'spent';
  if ((d.revisitIf || []).some(t => t.tripped && le(t.tripped, at)) && !(d.affirmedOn && le(d.affirmedOn, at) && !(d.revisitIf || []).some(t => t.tripped && le(t.tripped, at) && ts(t.tripped) > ts(d.affirmedOn)))) return 'review';
  return 'in force';
}
const stHTML = (s, extra = '') => `<span class="stw ${ST[s].cls}"><i class="dm ${ST[s].cls}"></i>${ST[s].w}${extra}</span>`;
/* evidence pointer number within a decision */
const evN = (d, id) => Dn(d).evidence.findIndex(e => e.id === id) + 1;
const did = id => `<span class="did">${id}</span>`;

/* actions: one owner, one date, one state; history never overwritten */
const AS = {
  given:      { w: 'Given, not yet accepted', s: 'Given', icon: 'circle-dashed', q: 'asked' },
  accepted:   { w: 'Accepted by the owner',   s: 'Accepted', icon: 'circle-dot', q: 'acknowledged' },
  part:       { w: 'Part done',               s: 'Part done', icon: 'circle-dot', q: 'acting' },
  done:       { w: 'Done, says the owner',    s: 'Done', icon: 'circle-check', q: 'answered' },
  discharged: { w: 'Closed by the chair',     s: 'Closed', icon: 'circle-check-big', q: 'resolved' },
  overtaken:  { w: 'Overtaken by a decision', s: 'Overtaken', icon: 'circle-slash', q: 'withdrawn' },
  overdue:    { w: 'Past its date',           s: 'Overdue', icon: 'circle-alert', q: 'open' }
};
function dueAt(id, at = NOW) {
  const a = Ac(id); let due = a.due;
  (a.moves || []).forEach(m => { if (le(m.on, at)) due = m.to; });
  return due;
}
function actionAt(id, at = NOW) {
  const a = Ac(id);
  if (!le(a.set, at)) return null;
  let s = 'given', on = a.set, note = '';
  a.history.forEach(([d, st, n]) => { if (le(d, at) && st !== 'moved' && st !== 'overdue') { s = st; on = d; note = n || ''; } });
  const open = ['given', 'accepted', 'part'].includes(s);
  const due = dueAt(id, at);
  const late = open && ts(due) < ts(at) ? days(due, at) : 0;
  return { s, on, note, open, due, late, shown: late ? 'overdue' : s };
}
const amHTML = (st, size = 16) => `<span class="am am-${st}" title="${AS[st].w}">${I(AS[st].icon, size)}</span>`;

/* people */
const who = (id, opts = {}) => `<span class="who" data-tier="${P(id).floor}">${opts.initials ? P(id).initials : P(id).name}</span>`;
const face = (id, cls = '') => `<span class="face ${cls}" data-tier="${P(id).floor}" title="${P(id).name}, ${P(id).role}">${P(id).initials}</span>`;
const list = a => a.length < 2 ? a.join('') : a.slice(0, -1).join(', ') + ' and ' + a[a.length - 1];

/* series and their tripwires */
function seriesAt(key, at = NOW) {
  const s = DATA.series[key]; const ym = at.slice(0, 7);
  const pts = s.points.filter(([m]) => m <= ym);
  return pts.length ? pts[pts.length - 1][1] : null;
}
function spark(key, opts = {}) {
  const s = DATA.series[key], w = opts.w || 96, h = opts.h || 22, upto = (opts.at || NOW).slice(0, 7);
  const pts = s.points.filter(([m]) => m <= upto);
  if (pts.length < 2) return '';
  const vals = s.points.map(p => p[1]).concat(opts.line != null ? [opts.line] : []);
  const max = Math.max(...vals) * 1.08, min = Math.min(0, ...vals), n = s.points.length - 1;
  const X = i => 2 + i * (w - 4) / n, Y = v => h - 2 - (v - min) * (h - 4) / (max - min);
  const ink = pts.map(([, v], i) => `${X(i).toFixed(1)},${Y(v).toFixed(1)}`).join(' ');
  const last = pts.length - 1, lv = pts[last][1];
  const over = opts.line != null && (opts.op === '<' ? lv < opts.line : lv > opts.line);
  const tw = opts.line != null ? `<line x1="0" x2="${w}" y1="${Y(opts.line).toFixed(1)}" y2="${Y(opts.line).toFixed(1)}" class="sp-tw"/>` : '';
  return `<svg class="spk" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}" role="img" aria-label="${s.label}: ${pts.map(([m, v]) => dt(m, 'short') + ' ' + v).join(', ')}${opts.line != null ? '; revisit line at ' + opts.line : ''}">${tw}<polyline points="${ink}" fill="none" class="sp-ln"/><circle cx="${X(last).toFixed(1)}" cy="${Y(lv).toFixed(1)}" r="2.25" class="${over ? 'sp-over' : 'sp-dot'}"/></svg>`;
}

/* one time scale and one now line (one-now): x for an ISO date between two dates */
const scaleX = (from, to, w) => iso => (ts(iso) - ts(from)) / (ts(to) - ts(from)) * w;

/* two registers and the model gateway */
const STATE = { tech: false, gateway: true };
function topHTML(crumbs, hints, opts = {}) {
  const fl = DATA.floors[opts.floor || B.floor];
  return `<header class="top"><p class="brand">AUGUR</p>
    <nav class="crumb" aria-label="Where you are">${crumbs.map((c, i) => (i ? I('chevron-right', 14) : '') + (i === crumbs.length - 1 ? `<b>${c}</b>` : `<span>${c}</span>`)).join('')}</nav>
    <span class="fchip" data-tier="${opts.floor || B.floor}">${fl.name} · ${fl.word}</span>
    ${opts.as ? `<span class="asat">${I('calendar', 14)} as at <b>${dt(opts.as)}</b></span>` : ''}
    <div class="hints">${hints.map(([k, w, id]) => `<span ${id ? `id="${id}"` : ''}><span class="kbd">${k}</span>${w}</span>`).join('')}</div></header>`;
}
function commonKeys(e, rerender, replay) {
  const k = e.key.toLowerCase();
  if (e.metaKey || e.ctrlKey || e.altKey) return false;
  if (e.target.closest && e.target.closest('input,textarea,[contenteditable="true"]')) return false;
  if (k === 'r') { replay(); return true; }
  if (k === 't') { STATE.tech = !STATE.tech; document.body.classList.toggle('tech', STATE.tech); $('#h-t')?.classList.toggle('on', STATE.tech); return true; }
  if (k === 'g') { STATE.gateway = !STATE.gateway; $('#h-g')?.classList.toggle('on', !STATE.gateway); rerender && rerender(); return true; }
  return false;
}

/* timers for the moment, cleared on replay */
let TIMERS = [];
const later = (fn, t) => TIMERS.push(setTimeout(fn, reduced ? Math.min(t, 50) : t));
const clearLater = () => { TIMERS.forEach(clearTimeout); TIMERS = []; };
const MOMENT = () => ms('--motion-run');
/* deposit once: everything with .dep settles in, then nothing moves */
function settle() { document.body.classList.add('pre'); requestAnimationFrame(() => requestAnimationFrame(() => document.body.classList.remove('pre'))); }
