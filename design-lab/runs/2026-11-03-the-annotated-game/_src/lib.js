/* ---- shared helpers (same in every page of the run) ---- */
const $ = (s, el = document) => el.querySelector(s);
const $$ = (s, el = document) => [...el.querySelectorAll(s)];
const I = (n, size = 16, stroke = 1.5) => Icons.svg(n, { size, stroke });
const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
const css = v => getComputedStyle(document.documentElement).getPropertyValue(v).trim();
const ms = v => parseFloat(css(v)) || 0;
const fmt = n => n.toLocaleString('en-GB');
const esc = s => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;');

/* people. 'body' is the meeting itself, never a person */
const P = id => id === 'body' ? { name: DATA.body.short, role: DATA.body.name, floor: DATA.body.floor, initials: DATA.body.code } : DATA.people[id];
const first = id => id === 'body' ? 'the meeting' : P(id).name.split(' ')[0];
const who = id => `<span class="who" data-tier="${P(id).floor}">${id === 'body' ? 'the meeting' : P(id).name}</span>`;
const face = (id, cls = '') => `<span class="face ${cls}" data-tier="${P(id).floor}" title="${P(id).name}, ${P(id).role}">${P(id).initials}</span>`;
const list = a => a.length < 2 ? a.join('') : a.slice(0, -1).join(', ') + ' and ' + a[a.length - 1];

/* dates: ISO in the data, words on the page */
const MON = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const MONTH = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
const dP = iso => { const [y, m, d] = iso.split('-').map(Number); return { y, m, d: d || 1 }; };
const dt = (iso, style = 'long') => { if (!iso) return ''; const { y, m, d } = dP(iso); if (iso.length === 7) return style === 'long' ? `${MONTH[m - 1]} ${y}` : MON[m - 1]; return style === 'short' ? `${d} ${MON[m - 1]}` : style === 'month' ? `${MON[m - 1]} ${y}` : `${d} ${MON[m - 1]} ${y}`; };
const ts = iso => Date.UTC(dP(iso).y, dP(iso).m - 1, dP(iso).d);
const days = (a, b) => Math.round((ts(b) - ts(a)) / 864e5);
const le = (a, b) => ts(a) <= ts(b);
const addDays = (iso, n) => new Date(ts(iso) + n * 864e5).toISOString().slice(0, 10);

/* the game */
const DEC = DATA.decision;
const MOVES = DATA.moves;
const MV = n => MOVES.find(m => m.n === n);
const ANN = n => DATA.annotations[n] || [];
const selfMark = n => ANN(n).find(a => a.self);
const reviewMarks = n => ANN(n).filter(a => !a.self && !a.pos);
const posMark = n => ANN(n).find(a => a.pos);
const mainMark = n => reviewMarks(n)[0];

/* ---- the computed view: read from the decision's own lines, as at a date. Never typed ---- */
function seriesAt(key, at) {
  const pts = DATA.series[key].pts.filter(([d]) => le(d, at));
  return pts.length ? pts[pts.length - 1][1] : DATA.series[key].pts[0][1];
}
const clamp = (v, a = -1, b = 1) => Math.max(a, Math.min(b, v));
function lineAt(L, at) {
  const v = seriesAt(L.series, at);
  if (L.kind === 'max') return { id: L.id, v, h: clamp((L.at - v) / L.at), crossed: v > L.at };
  if (L.kind === 'by') {
    const missing = Math.max(0, L.need - v);
    if (!missing) return { id: L.id, v, h: 1, crossed: false };
    if (ts(at) < ts(L.by)) { const el = clamp(days(L.from, at) / days(L.from, L.by), 0, 1); return { id: L.id, v, h: Math.max(0, 1 - 1.5 * el * missing / L.need), crossed: false, left: days(at, L.by) }; }
    return { id: L.id, v, h: -missing / L.need, crossed: true };
  }
  const share = (L.was - v) / (L.was - L.plan);
  return { id: L.id, v, h: clamp((share - 0.5) * 2), crossed: false, share };
}
function posAt(at) {
  const lines = DATA.lines.map(L => lineAt(L, at));
  const h = Math.min(...lines.map(l => l.h));
  const crossed = lines.filter(l => l.crossed).length;
  let p = DATA.positions.find(x => h >= x.min);
  if (crossed >= 2) p = DATA.positions[DATA.positions.length - 1];
  const weakest = lines.find(l => l.h === h);
  return { lines, h, crossed, s: p.s, w: p.w, say: p.say, rank: DATA.positions.indexOf(p), weakest };
}
const POS = s => DATA.positions.find(p => p.s === s);
const posOfMove = n => posAt(MV(n).on);
/* critical moments the records find: the position falls two steps, or a line is newly crossed */
function recordsCritical() {
  const out = [];
  MOVES.forEach((m, i) => { if (!i) return; const a = posOfMove(MOVES[i - 1].n), b = posOfMove(m.n);
    if (b.rank - a.rank >= 2 || b.crossed > a.crossed) out.push(m.n); });
  return out;
}
const peopleCritical = () => Object.keys(DATA.annotations).map(Number).filter(n => ANN(n).some(a => a.crit));

/* an action as at a date */
function actionAt(a, at) {
  if (!le(a.set, at)) return null;
  let due = a.due[0][1]; a.due.forEach(([on, d]) => { if (le(on, at)) due = d; });
  const moved = a.due.filter(([on]) => le(on, at)).length - 1;
  if (a.overtaken && le(a.overtaken, at)) return { s: 'overtaken', w: 'Overtaken by D-131', due, moved };
  if (a.done && le(a.done, at)) return { s: 'done', w: 'Done ' + dt(a.done, 'short'), due, moved };
  const late = ts(due) < ts(at);
  if (a.part && le(a.part[0], at)) return { s: late ? 'late' : 'part', w: a.part[1] + (late ? ' · late' : ''), due, moved };
  return { s: late ? 'late' : 'open', w: late ? 'Late' : 'Open', due, moved };
}
const recordAt = at => DATA.record.filter(r => le(r.on, at));

/* ---- marks ---- */
const MK = g => DATA.marks[g] || DATA.signs[g] || (g === DATA.unclear.s ? DATA.unclear : null) || POS(g) || { w: g };
const toneOf = g => (DATA.marks[g] || {}).tone || (POS(g) ? 'pos' : 'plain');
const gl = (g, cls = '') => `<span class="gl gl-${toneOf(g)} ${cls}" title="${MK(g).w}">${g}</span>`;
const posGl = (s, cls = '') => `<span class="gl gl-pos ${cls}" title="${POS(s).w} (from the records)">${s}</span>`;

/* the evaluation bar: light from the top is "on course", ground from the bottom is "off course" */
function evalBar(h, opts = {}) {
  const f = (clamp(h) + 1) / 2;
  const blind = opts.blind ? `<span class="eb-blind" title="${DATA.unclear.w}"></span>` : '';
  return `<span class="eb ${opts.flat ? 'flat' : ''}" role="img" aria-label="Computed position ${(h * 100).toFixed(0)} in a range of minus 100 to 100"><span class="eb-on" style="${opts.flat ? 'width' : 'height'}:${(f * 100).toFixed(1)}%"></span>${blind}</span>`;
}

/* the curve: the computed position over the game, with moves as ticks */
const G0 = MOVES[0].on, G1 = DEC.ended;
function curve(opts = {}) {
  const w = opts.w || 600, h = opts.h || 120, pad = opts.pad || 6, from = opts.from || G0, to = opts.to || addDays(G1, 6), upto = opts.upto || to;
  const X = d => pad + (ts(d) - ts(from)) / (ts(to) - ts(from)) * (w - 2 * pad);
  const Y = v => h / 2 - clamp(v) * (h / 2 - pad);
  const pts = []; for (let d = from; le(d, upto); d = addDays(d, 2)) pts.push([d, posAt(d).h]);
  const end = posAt(upto).h; pts.push([upto, end]);
  let path = ''; pts.forEach(([d, v], i) => { path += (i ? 'L' : 'M') + X(d).toFixed(1) + ' ' + Y(v).toFixed(1) + ' '; });
  const area = path + `L${X(upto).toFixed(1)} ${(h / 2).toFixed(1)} L${X(from).toFixed(1)} ${(h / 2).toFixed(1)} Z`;
  const bands = DATA.positions.slice(0, -1).map(p => `<line x1="${pad}" x2="${w - pad}" y1="${Y(p.min).toFixed(1)}" y2="${Y(p.min).toFixed(1)}" class="cv-band"/>`).join('');
  const rc = opts.crit === false ? [] : recordsCritical();
  const ticks = (opts.ticks === false ? [] : MOVES.filter(m => le(m.on, upto))).map(m => {
    const x = X(m.on).toFixed(1), sel = opts.sel === m.n;
    return `<line x1="${x}" x2="${x}" y1="${h - pad}" y2="${h - pad - (m.side === 'world' ? 4 : 7)}" class="cv-tick ${m.side} ${sel ? 'sel' : ''}"/>` +
      (rc.includes(m.n) ? `<circle cx="${x}" cy="${Y(posOfMove(m.n).h).toFixed(1)}" r="3.5" class="cv-crit"/>` : '') +
      (sel ? `<line x1="${x}" x2="${x}" y1="${pad}" y2="${h - pad}" class="cv-sel"/>` : '');
  }).join('');
  const nowx = opts.now ? `<line x1="${X(opts.now).toFixed(1)}" x2="${X(opts.now).toFixed(1)}" y1="0" y2="${h}" class="cv-now"/>` : '';
  const label = `Computed position from ${dt(from)} to ${dt(upto)}: ${MOVES.filter(m => le(m.on, upto)).map(m => 'move ' + m.n + ' ' + POS(posOfMove(m.n).s).w).join(', ')}`;
  return `<svg class="cv" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}" role="img" aria-label="${label}">
    <line x1="${pad}" x2="${w - pad}" y1="${h / 2}" y2="${h / 2}" class="cv-mid"/>${bands}
    <path d="${area}" class="cv-area"/><path d="${path}" class="cv-ln"/>${ticks}${nowx}</svg>`;
}
const curveX = (opts, d) => { const w = opts.w || 600, pad = opts.pad || 6, from = opts.from || G0, to = opts.to || addDays(G1, 6); return pad + (ts(d) - ts(from)) / (ts(to) - ts(from)) * (w - 2 * pad); };

/* a move as one row of a score sheet */
function moveRow(m, opts = {}) {
  const r = mainMark(m.n), s = selfMark(m.n), pm = posMark(m.n);
  const marks = opts.marks === false ? '' : `${r ? gl(r.g) : ''}${reviewMarks(m.n).length > 1 ? gl(reviewMarks(m.n)[1].g, 'second') : ''}${pm ? gl(pm.g) : ''}`;
  const pos = opts.pos ? posGl(posOfMove(m.n).s) : '';
  return `<button class="mv ${m.side} ${opts.sel === m.n ? 'sel' : ''} ${opts.cls || ''}" data-n="${m.n}" aria-label="Move ${m.n}, ${dt(m.on)}: ${esc(m.san)}">
    <span class="mv-n">${m.n}</span><span class="mv-side" aria-hidden="true"></span>
    <span class="mv-san">${m.san}${m.sign ? ' ' + gl(m.sign) : ''}${m.door ? ` <span class="door" title="Can’t be undone">${I('door-closed', 13)}</span>` : ''}</span>
    <span class="mv-g">${marks}</span>${pos ? `<span class="mv-p">${pos}</span>` : ''}</button>`;
}

/* ---- frame ---- */
const STATE = { tech: false };
function topHTML(crumbs, hints, opts = {}) {
  const fl = DATA.floors[opts.floor || DEC.floor];
  return `<header class="top"><p class="brand">AUGUR</p>
    <nav class="crumb" aria-label="Where you are">${crumbs.map((c, i) => (i ? I('chevron-right', 14) : '') + (i === crumbs.length - 1 ? `<b>${c}</b>` : `<span>${c}</span>`)).join('')}</nav>
    <span class="fchip" data-tier="${opts.floor || DEC.floor}">${fl.name} · ${fl.word}</span>
    ${opts.as ? `<span class="asat">${I('calendar', 14)} as at <b>${dt(opts.as)}</b></span>` : ''}
    <div class="hints">${hints.map(([k, w, id]) => `<span ${id ? `id="${id}"` : ''}><span class="kbd">${k}</span>${w}</span>`).join('')}</div></header>`;
}
function commonKeys(e, rerender, replay) {
  const k = e.key.toLowerCase();
  if (e.metaKey || e.ctrlKey || e.altKey) return false;
  if (e.target.closest && e.target.closest('input,textarea,[contenteditable="true"]')) return false;
  if (k === 'r') { replay(); return true; }
  if (k === 't') { STATE.tech = !STATE.tech; document.body.classList.toggle('tech', STATE.tech); $('#h-t')?.classList.toggle('on', STATE.tech); return true; }
  return false;
}
/* timers for the moment, cleared on replay */
let TIMERS = [];
const later = (fn, t) => TIMERS.push(setTimeout(fn, reduced ? Math.min(t, 50) : t));
const clearLater = () => { TIMERS.forEach(clearTimeout); TIMERS = []; };
const MOMENT = () => ms('--motion-run');
function settle() { document.body.classList.add('pre'); requestAnimationFrame(() => requestAnimationFrame(() => document.body.classList.remove('pre'))); }
