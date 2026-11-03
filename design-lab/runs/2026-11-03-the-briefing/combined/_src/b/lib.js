/* ---- shared helpers for the b-screens ---- */
const $ = (s, el = document) => el.querySelector(s);
const $$ = (s, el = document) => [...el.querySelectorAll(s)];
const I = (n, size = 16, stroke = 1.5) => Icons.svg(n, { size, stroke });
const P = id => DATA.people[id];
const F = id => DATA.floors[id];
const fmt = n => n.toLocaleString('en-GB');
const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
const RANK = Object.fromEntries(DATA.floorOrder.map((f, i) => [f, i]));
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const D = s => new Date(s + 'T00:00:00Z');
const dayStr = d => `${d.getUTCDate()} ${MONTHS[d.getUTCMonth()]}`;
const addDays = (s, n) => { const d = D(s); d.setUTCDate(d.getUTCDate() + n); return d.toISOString().slice(0, 10); };
const daysBetween = (a, b) => Math.round((D(b) - D(a)) / 864e5);
const NUMW = ['none', 'one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine', 'ten'];
const word = n => NUMW[n] ?? fmt(n);
const cap = s => s.charAt(0).toUpperCase() + s.slice(1);

/* ---- the answer, worked out from the vans on a given day (one query feeds every height) ---- */
function answer(day = DATA.today) {
  const vans = DATA.vans.map(v => {
    /* an inspection recorded on or before `day` moves the due date six months on */
    const done = v.inspected && v.inspected <= day;
    const due = done ? addDays(v.inspected, 182) : v.due;
    return { ...v, due, done, late: daysBetween(due, day) };
  });
  const overdue = vans.filter(v => v.late > 0).sort((a, b) => b.late - a.late);
  const ahead = vans.filter(v => v.late <= 0).sort((a, b) => a.due.localeCompare(b.due));
  const nextDate = ahead[0].due;
  const dueSoon = ahead.filter(v => v.due === nextDate);
  const rest = overdue.filter(v => v.late <= 14);
  const north = DATA.depots.find(d => d.mine);
  return {
    day, vans, overdue, dueSoon,
    overdueN: overdue.length, fleet: DATA.vans.length,
    dueSoonN: dueSoon.length, dueSoonDay: dayStr(D(nextDate)),
    forecast: overdue.length + dueSoon.length,
    worst: overdue[0], fortnight: overdue.filter(v => v.late > 14).length,
    rest: rest.length, restMin: Math.min(...rest.map(v => v.late)), restMax: Math.max(...rest.map(v => v.late)),
    north: { ...north, n: overdue.length }
  };
}
let A = answer();
const SLOTS = () => ({
  overdue: A.overdueN, fleet: A.fleet, subject: DATA.subject, forecast: A.forecast, dueSoon: A.dueSoonDay,
  worstDays: A.worst.late, kestrelSays: DATA.kestrel.says
});
const fill = (tpl, o = SLOTS()) => tpl.replace(/\{(\w+)\}/g, (_, k) => o[k] ?? '');

/* ---- confidence: one rule over grades and agreement (confidence run). Never typed. ---- */
const strength = g => { const l = g[0], d = +g[1]; return (l <= 'B' && d <= 2) ? 'strong' : (l <= 'C' && d <= 3) ? 'fair' : 'weak'; };
const WEIGHT = { strong: 3, fair: 2, weak: 1 };
const ORDER = { strong: 0, fair: 1, weak: 2 };
const root = id => DATA.sources[id].derivedFrom ? root(DATA.sources[id].derivedFrom) : id;
function side(obs) {
  /* copies of one origin count once, at the best grade among them */
  const by = {};
  obs.forEach(id => { const r = root(id), s = strength(DATA.sources[id].grade); if (!by[r] || ORDER[s] < ORDER[by[r]]) by[r] = s; });
  const list = Object.values(by);
  const best = list.sort((a, b) => ORDER[a] - ORDER[b])[0];
  return { n: list.length, best, w: list.reduce((a, s) => a + WEIGHT[s], 0) };
}
function rungOf(s) {
  if (!s.n) return null;
  if (s.n >= 2 && s.best === 'strong') return 0;
  if ((s.n === 1 && s.best === 'strong') || (s.n >= 2 && s.best === 'fair')) return 1;
  if ((s.n === 1 && s.best === 'fair') || s.n >= 2) return 2;
  return 3;
}
function derive(id) {
  const c = DATA.claims[id];
  const f = side(c.obs.filter(o => o[1] === 'for').map(o => o[0]));
  const a = side(c.obs.filter(o => o[1] === 'against').map(o => o[0]));
  let kind = 'word', rung = rungOf(f), why;
  if (!a.n) why = `${word(f.n)} independent source${f.n > 1 ? 's' : ''}, best ${f.best}, none against`;
  else if (f.w >= 2 * a.w) { rung = Math.min(rung + 1, 3); why = `weight ${f.w} for, ${a.w} against: drops one word`; }
  else if (a.w >= 2 * f.w) { rung = 4; why = `weight against ${a.w} is twice ${f.w}`; }
  else { kind = 'dispute'; rung = null; why = `weight ${f.w} for, ${a.w} against: within 2×, nothing settled`; }
  if (c.count) return { kind: kind === 'dispute' ? 'dispute' : 'count', why };
  return { kind, rung, why };
}
/* a person may lower a word, never raise it */
const LOWERED = {};
function cw(id) {
  const d = derive(id);
  if (d.kind !== 'word') return '';
  const r = Math.max(d.rung, LOWERED[id] ?? 0);
  return `<span class="cw" data-claim="${id}" title="Worked out from the sources, not typed. ${d.why}"><span class="yd" aria-hidden="true">${DATA.yardstick.map((_, k) => `<i class="${k === r ? 'on' : ''}"></i>`).join('')}</span>${DATA.yardstick[r].toLowerCase()}<span class="tk">&nbsp;· ${d.why}</span></span>`;
}
const weakest = () => Math.max(...Object.keys(DATA.claims).map(derive).filter(d => d.kind === 'word').map(d => d.rung));

/* ---- marks: the six ways to be empty (catalogue run) ---- */
const mkGap = () => '<span class="mk-gap" aria-hidden="true"></span>';
const mkDis = () => '<span class="mk-disagree" aria-hidden="true"></span>';
const unseen = (txt) => `<span class="unseen">${I('lock', 11)} ${txt}</span>`;
function mkBreak(w = 22) { return `<svg class="mk-break" width="${w}" height="10" viewBox="0 0 ${w} 10" aria-hidden="true"><path d="M1 5 q${w / 8} -4 ${w / 4} 0 t${w / 4} 0 t${w / 4} 0 t${w / 4 - 2} 0"/></svg>`; }

/* ---- the pictures. Same answer, word size and full size ---- */
function picCount(a = A, big = false, prev = null) {
  const sz = big ? 22 : 15, gap = big ? 'var(--space-1)' : '0';
  const late = new Set(a.overdue.map(v => v.id));
  const was = prev ? new Set(prev.overdue.map(v => v.id)) : null;
  return `<span class="sym ${big ? 'big' : ''}" style="--g:${gap}" role="img" aria-label="${a.overdueN} of ${a.fleet} vans overdue, one symbol per van">${[...a.vans].sort((x, y) => late.has(y.id) - late.has(x.id)).map(v => `<span class="${late.has(v.id) ? 'on' : ''} ${was && late.has(v.id) !== was.has(v.id) ? 'new' : ''}" title="${v.id}">${I('truck', sz, big ? 1.5 : 1.25)}</span>`).join('')}</span>`;
}
function picBars(a = A, big = false) {
  const max = Math.ceil(a.worst.late / 10) * 10;
  if (!big) {
    const w = 56, rows = a.overdue.length, h = rows * 3;
    return `<svg class="wsz" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}" role="img" aria-label="Days late, longest first: ${a.overdue.map(v => v.late).join(', ')}">${a.overdue.map((v, i) => `<rect x="0" y="${i * 3}" width="${(v.late / max * w).toFixed(1)}" height="2" fill="${v.late > 14 ? 'var(--x-proposed-data)' : 'var(--x-proposed-data-ctx)'}"/>`).join('')}</svg>`;
  }
  const W = 340, L = 50, row = 18, H = a.overdue.length * row + 26;
  const X = d => L + d / max * (W - L - 34);
  const ticks = [0, max / 2, max];
  return `<svg class="full" width="100%" viewBox="0 0 ${W} ${H}" role="img" aria-label="Days late per overdue van">
    ${ticks.map(t => `<line x1="${X(t)}" x2="${X(t)}" y1="0" y2="${H - 18}" stroke="var(--hairline)"/><text x="${X(t)}" y="${H - 4}" text-anchor="middle" class="ax">${t}</text>`).join('')}
    <line x1="${X(14)}" x2="${X(14)}" y1="0" y2="${H - 18}" stroke="var(--ink-muted)" stroke-dasharray="2 3"/><text x="${X(14) + 4}" y="${H - 22}" class="ax">a fortnight</text>
    ${a.overdue.map((v, i) => `<text x="${L - 6}" y="${i * row + 12}" text-anchor="end" class="lb">${v.id}</text><rect x="${X(0)}" y="${i * row + 3}" width="${(X(v.late) - X(0)).toFixed(1)}" height="${row - 7}" rx="1" fill="${v.late > 14 ? 'var(--x-proposed-data)' : 'var(--x-proposed-data-ctx)'}"/><text x="${X(v.late) + 4}" y="${i * row + 12}" class="vl">${v.late}</text>`).join('')}
  </svg>`;
}
function seriesNow(a = A) { return [...DATA.series, { m: MONTHS[D(a.day).getUTCMonth()], v: a.overdueN, now: true }]; }
function picLine(a = A, big = false, extra = null) {
  const s = seriesNow(a);
  if (extra) s.push(extra);
  const max = Math.max(...s.map(p => p.v || 0), A.forecast);
  const W = big ? 340 : 72, H = big ? 150 : 20, L = big ? 26 : 2, B = big ? 20 : 2, T = big ? 14 : 2;
  const X = i => L + i * (W - L - (big ? 30 : 4)) / (s.length - 1), Y = v => T + (H - T - B) - v / max * (H - T - B);
  let segs = [], cur = [];
  s.forEach((p, i) => { if (p.v == null) { if (cur.length) segs.push(cur); cur = []; } else cur.push([X(i), Y(p.v)]); });
  if (cur.length) segs.push(cur);
  const gapI = s.findIndex(p => p.v == null);
  const wav = gapI > 0 ? (() => { const x0 = X(gapI - 1) + 3, x1 = X(gapI + 1) - 3, y = Y((s[gapI - 1].v + s[gapI + 1].v) / 2), n = 4, st = (x1 - x0) / n; let d = `M${x0} ${y}`; for (let k = 0; k < n; k++) d += ` q${st / 2} ${k % 2 ? 3 : -3} ${st} 0`; return `<path d="${d}" fill="none" stroke="var(--ink-muted)" stroke-dasharray="2 2"/>`; })() : '';
  const lines = segs.map(sg => sg.length > 1 ? `<polyline points="${sg.map(p => p.map(n => n.toFixed(1)).join(',')).join(' ')}" fill="none" stroke="var(--x-proposed-data)" stroke-width="${big ? 1.75 : 1.25}" stroke-linejoin="round"/>` : `<circle cx="${sg[0][0]}" cy="${sg[0][1]}" r="${big ? 2 : 1.25}" fill="var(--x-proposed-data)"/>`).join('');
  const last = s.length - 1, pl = s[last];
  const nowI = s.findIndex(p => p.now);
  const seam = extra ? `<line x1="${(X(nowI) + X(last)) / 2}" x2="${(X(nowI) + X(last)) / 2}" y1="${T - 2}" y2="${H - B + 2}" class="seamline"/>` : '';
  if (!big) return `<svg class="wsz" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}" role="img" aria-label="Overdue at each month end: ${s.map(p => p.m + ' ' + (p.v ?? 'no record')).join(', ')}">${wav}${lines}${seam}<circle cx="${X(last)}" cy="${Y(pl.v)}" r="2" fill="var(--light)"/></svg>`;
  const yt = [0, Math.round(max / 2), max];
  return `<svg class="full" width="100%" viewBox="0 0 ${W} ${H}" role="img" aria-label="Overdue vans at each month end, from zero">
    ${yt.map(t => `<line x1="${L}" x2="${W - 30}" y1="${Y(t)}" y2="${Y(t)}" stroke="var(--hairline)"/><text x="${L - 6}" y="${Y(t) + 3}" text-anchor="end" class="ax">${t}</text>`).join('')}
    ${s.map((p, i) => `<text x="${X(i)}" y="${H - 5}" text-anchor="middle" class="ax">${p.m}</text>`).join('')}
    ${wav}<text x="${X(gapI)}" y="${Y((s[gapI - 1].v + s[gapI + 1].v) / 2) - 8}" text-anchor="middle" class="ax">no record</text>
    ${lines}${seam}<circle cx="${X(last)}" cy="${Y(pl.v)}" r="3" fill="var(--light)"/><text x="${X(last) + 6}" y="${Y(pl.v) + 4}" class="vl">${pl.v}</text>
  </svg>`;
}
function picTiles(a = A, big = false) {
  const t = DATA.depots.map(d => ({ ...d, n: d.mine ? a.overdueN : d.n }));
  if (!big) return `<span class="tiles-w" role="img" aria-label="One tile per depot">${t.map(d => `<i style="grid-column:${d.col};grid-row:${d.row}" class="${d.hidden ? 'h' : d.none ? 'x' : d.n / d.of > .25 ? 'on' : d.n ? 'lo' : ''}"></i>`).join('')}</span>`;
  return `<div class="tiles" role="img" aria-label="One equal tile per depot">${t.map(d => `<div class="tile ${d.hidden ? 'h' : d.none ? 'x' : ''} ${d.mine ? 'mine' : ''}" style="grid-column:${d.col};grid-row:${d.row}">
    <b>${d.name}</b>${d.hidden ? `<span>${I('lock', 11)} some · ask ${P(d.keeper).name}</span>` : d.none ? `<span>${d.none}</span>` : `<span><em>${d.n}</em> of ${d.of}</span><span class="tb"><i style="width:${(d.n / d.of * 100).toFixed(0)}%"></i></span>`}</div>`).join('')}</div>`;
}
function picRecords(a = A, big = false) {
  if (!big) return `<span class="recs">${a.dueSoon.map(v => `<span class="rec">${v.id}</span>`).join('')}</span>`;
  const rows = [...a.dueSoon, ...a.vans.filter(v => v.late <= 0 && !a.dueSoon.includes(v)).sort((x, y) => x.due.localeCompare(y.due)).slice(0, 3)];
  const ds = new Set(a.dueSoon.map(v => v.id));
  return `<table class="rt"><thead><tr><th>Van</th><th>Next inspection</th><th>In</th></tr></thead><tbody>${rows.map(v => `<tr class="${ds.has(v.id) ? 'on' : ''}"><td>${v.id}</td><td>${dayStr(D(v.due))}</td><td>${-v.late} days</td></tr>`).join('')}</tbody></table>`;
}
function picNone(big = false) {
  if (!big) return '';
  const rows = DATA.yardstick.map((w, r) => {
    const here = Object.keys(DATA.claims).filter(id => { const d = derive(id); return d.kind === 'word' && d.rung === r; });
    return `<li class="${here.length ? 'on' : ''}"><span class="rw">${w}</span><span class="rc">${here.map(id => `<span class="chip">${cap(DATA.claims[id].text.split(' ').slice(0, 4).join(' '))}…</span>`).join('')}</span></li>`;
  }).join('');
  return `<div class="ruler"><div class="lifted">${mkDis()}<span><b>${A.overdueN}</b> depot log · <b>${DATA.kestrel.says}</b> ${DATA.kestrel.name} report</span><span class="q">lifted off the scale: sources disagree</span></div>
    <ul>${rows}</ul><div class="below">${mkGap()}<span>${fill(DATA.gap.what)}</span><span class="q">below the scale: not known yet</span></div></div>`;
}
function picture(form, big, a = A) {
  return { count: () => picCount(a, big), bars: () => picBars(a, big), line: () => picLine(a, big), tiles: () => picTiles(a, big), records: () => picRecords(a, big), none: () => picNone(big) }[form]();
}

/* ---- reading time: words at the org's speed, plus a second per word-size picture ---- */
const textOf = html => { const d = document.createElement('div'); d.innerHTML = html; $$('.tk,svg,.sym,.tiles-w,.recs,.cw .yd', d).forEach(n => n.remove()); return d.textContent.replace(/\s+/g, ' ').replace(/\s+([.,:;])/g, '$1').trim(); };
const wordsIn = html => textOf(html).split(/\s+/).filter(w => /[\w\d]/.test(w)).length;
const secs = (html, pic) => wordsIn(html) * 60 / DATA.readWpm + (pic ? DATA.pictureSec : 0);

/* ---- reach: a reader opens what's kept on their floor (their own team, for a team) and above ---- */
function canOpen(f, pid) {
  const p = P(pid);
  if (f === 'team') return p.floor === 'team' && p.team === DATA.myTeam;
  return RANK[f] <= RANK[p.floor];
}
const total = g => Object.values(g.kept).reduce((a, b) => a + b, 0);
const openN = (g, pid) => g.restricted ? 0 : Object.entries(g.kept).reduce((a, [f, n]) => a + (canOpen(f, pid) ? n : 0), 0);
const allTotal = () => DATA.groups.reduce((a, g) => a + total(g), 0);
const allOpen = pid => DATA.groups.reduce((a, g) => a + openN(g, pid), 0);
const Gp = id => DATA.groups.find(g => g.id === id);

/* ---- frame ---- */
const STATE = { tech: false, gateway: true };
function topHTML(crumbs, hints) {
  const fl = F(DATA.myFloor);
  return `<header class="top"><p class="brand">AUGUR</p>
    <nav class="crumb" aria-label="Where you are">${crumbs.map((c, i) => (i ? I('chevron-right', 14) : '') + (i === crumbs.length - 1 ? `<b>${c}</b>` : `<span>${c}</span>`)).join('')}</nav>
    <span class="fchip" data-tier="${DATA.myFloor}">${fl.name} · ${fl.word}</span>
    <div class="hints">${hints.map(([k, w, id]) => `<span ${id ? `id="${id}"` : ''}><span class="kbd">${k}</span>${w}</span>`).join('')}</div></header>`;
}
let TIMERS = [];
const later = (fn, t) => TIMERS.push(setTimeout(fn, reduced ? Math.min(t, 40) : t));
const clearLater = () => { TIMERS.forEach(clearTimeout); TIMERS = []; };

/* ---- sentence templates for the answers (ink) ---- */
const dep = id => DATA.depots.find(d => d.id === id);
function slotsAll() {
  const o = SLOTS();
  const ser = Object.fromEntries(DATA.series.map(p => [p.m.toLowerCase(), p.v]));
  DATA.depots.forEach(d => { o[d.id + 'Name'] = d.name; o[d.id + 'N'] = d.mine ? A.overdueN : d.n; o[d.id + 'Of'] = d.of; o[d.id + 'None'] = d.none; o[d.id + 'Team'] = d.team ? DATA.teams[d.team] : ''; if (d.hidden) o[d.id + 'Unseen'] = unseen(`some · ask ${P(d.keeper).name}`); });
  Object.assign(o, ser, {
    kestrelName: DATA.kestrel.name, booked: word(DATA.kestrel.booked), decider: P(DATA.decider).name, dis: mkDis(),
    worstId: A.worst.id, fortnightW: word(A.fortnight), restW: word(A.rest), restMin: A.restMin, restMax: A.restMax,
    nrWhatC: cap(DATA.noRecord.what), nrFrom: DATA.noRecord.from, nrTo: DATA.noRecord.to, brk: mkBreak(),
    gap: mkGap(), gapWhat: fill(DATA.gap.what), gapWho: P(DATA.gap.who).name, dueSoonW: cap(word(A.dueSoonN)),
    weakest: DATA.yardstick[weakest()].toLowerCase()
  });
  return o;
}
const numWrap = s => s.replace(/(^|[\s(])(\d+)(?=[\s.,:;)]|$)/g, '$1<span class="num">$2</span>');
function lineHTML(q, l) {
  const o = slotsAll();
  let t = l.tpl.replace(/\{w:(\w+)\}/g, (_, k) => '\u0001' + k + '\u0002');
  t = numWrap(t.replace(/\{pic\}/g, '\u0003').replace(/\{(\w+)\}/g, (_, k) => '\u0004' + k + '\u0005'));
  t = t.replace(/\u0004(\w+)\u0005/g, (_, k) => /^\d+$/.test(String(o[k])) ? `<span class="num">${o[k]}</span>` : (o[k] ?? ''));
  return t.replace(/\u0001(\w+)\u0002/g, (_, k) => cw(k)).replace('\u0003', picture(q.form, false));
}
/* cut to budget: from the last cuttable line up; what must stay, stays */
function plan(q) {
  const lines = q.lines.map(l => ({ ...l, html: lineHTML(q, l) }));
  const pic = q.form !== 'none';
  const cost = ls => ls.reduce((a, l) => a + secs(l.html, false), 0) + (pic ? DATA.pictureSec : 0);
  const kept = [...lines], cut = [];
  for (let i = kept.length - 1; i >= 0 && cost(kept) > q.budget; i--) if (kept[i].cut) cut.unshift(...kept.splice(i, 1));
  return { lines, kept, cut, full: cost(lines), now: cost(kept), over: cost(kept) > q.budget };
}
const PLANS = () => Object.fromEntries(DATA.questions.map(q => [q.id, plan(q)]));
const r1 = n => Math.round(n);
