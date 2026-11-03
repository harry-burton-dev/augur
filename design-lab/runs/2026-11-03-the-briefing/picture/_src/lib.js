/* ---------- shared helpers for the picture variants (inlined by _src/build.js) ---------- */
const U = (() => {
  const css = getComputedStyle(document.documentElement);
  const ms = n => parseFloat(css.getPropertyValue(n)) || 0;
  const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const $ = (s, r) => (r || document).querySelector(s);
  const $$ = (s, r) => Array.from((r || document).querySelectorAll(s));
  const esc = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const fill = (t, o) => t.replace(/\{(\w+)\}/g, (_, k) => (o[k] !== undefined ? o[k] : '{' + k + '}'));
  const cap = s => s.charAt(0).toUpperCase() + s.slice(1);
  const MON = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
  const MONL = ['January','February','March','April','May','June','July','August','September','October','November','December'];
  const monthWord = (ym, style) => {
    const [y, m] = ym.split('-').map(Number);
    if (style === 'short') return MON[m - 1] + ' ' + String(y).slice(2);
    if (style === 'mon') return MON[m - 1];
    return MONL[m - 1] + ' ' + y;
  };
  const M = DATA.months, N = M.length;
  const mi = ym => M.indexOf(ym);
  const site = id => DATA.sites.find(s => s.id === id);
  const seen = () => DATA.sites.filter(s => !s.unseen);
  const unseen = () => DATA.sites.filter(s => s.unseen);
  const mean = a => { const v = a.filter(x => x !== null); return v.length ? v.reduce((p, c) => p + c, 0) / v.length : null; };
  const sum = a => a.reduce((p, c) => p + (c || 0), 0);
  const totals = sites => M.map((_, i) => sites.some(s => s.inc[i] === null) ? null : sites.reduce((p, s) => p + s.inc[i], 0));
  const areaWord = a => DATA.areas[a];

  /* best single change point: split that minimises squared error of two means */
  function changePoint(v) {
    let best = null, bi = 3;
    for (let i = 3; i <= N - 3; i++) {
      if (v[i] === null) continue;
      const A = v.slice(0, i).filter(x => x !== null), B = v.slice(i).filter(x => x !== null);
      const ma = mean(A), mb = mean(B);
      const e = A.reduce((p, x) => p + (x - ma) ** 2, 0) + B.reduce((p, x) => p + (x - mb) ** 2, 0);
      if (best === null || e < best) { best = e; bi = i; }
    }
    return bi;
  }
  function yard(pct) { return DATA.yardstick.find(y => pct >= y.lo).word; }
  function trend(v, measure) {
    const cp = changePoint(v);
    const before = v.slice(0, cp).filter(x => x !== null), after = v.slice(cp).filter(x => x !== null);
    const a = Math.round(mean(before)), b = Math.round(mean(after.slice(-3)));
    const hi = Math.max(...before);
    const k = after.filter(x => x > hi).length, n = after.length;
    const ra = mean(before), rb = mean(after);
    let verb = 'held steady';
    if (rb - ra >= 1 && rb > ra * 1.25) verb = b >= 2 * a ? 'doubled' : 'rose';
    else if (ra - rb >= 1 && rb < ra * 0.8) verb = 'fell';
    const since = monthWord(M[cp]);
    const conf = yard(Math.min(90, Math.round(100 * k / n)));
    const text = verb === 'held steady' ? fill(DATA.templates.flat, { measure, a }) : fill(DATA.templates.trend, { measure, verb, a, b, since });
    return { cp, a, b, k, n, verb, since, conf, text, confText: fill(DATA.templates.trendConf, { word: conf, kText: k === n ? 'all ' + n : k + ' of the ' + n, since: monthWord(M[cp], 'mon') }) };
  }
  /* per-site rise before/after an index */
  function riseBy(cp) {
    return seen().map(s => {
      const a = mean(s.inc.slice(0, cp)), b = mean(s.inc.slice(cp));
      return { s, a, b, d: b - a };
    });
  }
  function riseShare(cp, area) {
    const r = riseBy(cp), tot = sum(r.map(x => Math.max(0, x.d))), g = r.filter(x => x.s.area === area);
    return { pct: Math.round(100 * sum(g.map(x => Math.max(0, x.d))) / tot), names: g.map(x => x.s.short) };
  }
  const lastK = (s, k) => sum(s.inc.slice(-k));

  /* ---------- records (one row per incident, generated from the monthly counts) ---------- */
  function records() {
    const out = []; let n = 4100;
    seen().forEach((s, si) => s.inc.forEach((c, i) => {
      for (let k = 0; k < (c || 0); k++) {
        const day = ((si * 7 + i * 3 + k * 11) % 27) + 1;
        const late = s.area === 'north' && i >= mi(DATA.event.month);
        const kind = late ? (k % 3 === 2 ? 'vehicle' : 'slip') : DATA.incidentKinds[(si + i + k) % 4].id;
        out.push({ id: 'INC-' + (n++), date: M[i] + '-' + String(day).padStart(2, '0'), month: M[i], site: s, kind,
          night: late ? k % 4 !== 3 : (si + k) % 5 === 0,
          who: DATA.reporters[(si + i + k) % DATA.reporters.length], src: (k + i) % 4 === 0 ? 'Inspection report' : 'Depot incident log' });
      }
    }));
    return out.sort((a, b) => b.date.localeCompare(a.date));
  }
  const kindWord = id => DATA.incidentKinds.find(k => k.id === id).word;

  /* ---------- pictures ---------- */
  function ticks(max) {
    const steps = [1, 2, 5, 10, 20, 50, 100, 200, 500];
    const st = steps.find(s => max / s <= 5) || 1000;
    const t = []; for (let v = 0; v <= max + 1e-9; v += st) t.push(v);
    if (t[t.length - 1] < max) t.push(t[t.length - 1] + st);
    return t;
  }
  function wavy(x1, x2, y, amp) {
    let d = 'M' + x1 + ' ' + y; const seg = 6, w = (x2 - x1) / seg;
    for (let i = 0; i < seg; i++) d += ' Q' + (x1 + w * i + w / 2) + ' ' + (y + (i % 2 ? amp : -amp)) + ' ' + (x1 + w * (i + 1)) + ' ' + y;
    return d;
  }
  /* line over time; series: [{label, values, emph}] */
  function line(o) {
    const w = o.w || 760, h = o.h || 300, p = Object.assign({ l: 36, r: 150, t: 22, b: 28 }, o.pad || {});
    const all = o.series.flatMap(s => s.values).filter(v => v !== null);
    const tk = ticks(o.yMax || Math.max(...all)), ym = tk[tk.length - 1];
    const x = i => p.l + i * (w - p.l - p.r) / (N - 1), y = v => p.t + (1 - v / ym) * (h - p.t - p.b);
    let g = '';
    if (!o.bare) {
      tk.forEach(t => { g += `<line class="grid${t === 0 ? ' zero' : ''}" x1="${p.l}" x2="${w - p.r + 8}" y1="${y(t)}" y2="${y(t)}"/><text class="yt" x="${p.l - 8}" y="${y(t) + 4}" text-anchor="end">${t}</text>`; });
      M.forEach((m, i) => { if (i % 3 === 0 || i === N - 1) g += `<text class="xt" x="${x(i)}" y="${h - 6}" text-anchor="middle">${monthWord(m, 'short')}</text>`; });
    }
    if (o.event) {
      const ex = x(mi(o.event.month));
      g += `<line class="evt" x1="${ex}" x2="${ex}" y1="${p.t - 6}" y2="${h - p.b}"/>`;
      if (!o.bare) g += `<text class="evl" x="${ex + 6}" y="${p.t}">${esc(o.event.word)}</text>`;
    }
    o.series.forEach((s, si) => {
      const segs = []; let cur = [];
      s.values.forEach((v, i) => { if (v === null) { if (cur.length) segs.push(cur); cur = []; } else cur.push([x(i), y(v)]); });
      if (cur.length) segs.push(cur);
      segs.forEach(sg => { g += `<path class="ln draw ${s.emph ? 'emph' : 'ctx'}" pathLength="1" d="M${sg.map(q => q.join(' ')).join(' L')}"/>`; });
      s.values.forEach((v, i) => {
        if (v === null && i > 0 && i < N - 1 && s.values[i - 1] !== null && s.values[i + 1] !== null) {
          const yy = (y(s.values[i - 1]) + y(s.values[i + 1])) / 2;
          g += `<path class="brk" d="${wavy(x(i - 1) + 4, x(i + 1) - 4, yy, o.bare ? 2 : 4)}"/>`;
          if (s.emph && !o.bare) g += `<text class="brl" x="${x(i)}" y="${yy - 10}" text-anchor="middle">no record</text>`;
        }
      });
      const li = s.values.length - 1 - [...s.values].reverse().findIndex(v => v !== null);
      if (s.emph || o.dots) g += `<circle class="dot ${s.emph ? 'emph' : 'ctx'}" cx="${x(li)}" cy="${y(s.values[li])}" r="${o.bare ? 2 : 3}"/>`;
      if (!o.bare && s.label) g += `<text class="dl ${s.emph ? 'emph' : 'ctx'}" x="${x(li) + 10}" y="${y(s.values[li]) + 4 + (s.dy || 0)}">${esc(s.label)} <tspan class="dv">${s.values[li]}</tspan></text>`;
    });
    return `<svg class="ch${o.bare ? ' bare' : ''}" viewBox="0 0 ${w} ${h}" ${o.bare ? '' : 'width="100%"'} preserveAspectRatio="xMinYMin meet" role="img" aria-label="${esc(o.aria || 'line chart')}">${g}</svg>`;
  }
  /* bars, longest first; rows: [{label, value, emph, unseen, gap, note}] */
  function bars(rows, o) {
    o = o || {};
    const max = o.max || Math.max(...rows.filter(r => r.value != null).map(r => r.value));
    const fmt = o.fmt || (v => v);
    return `<div class="bars">${rows.map((r, i) => {
      let track, val;
      if (r.unseen) { track = `<span class="bt unseen-t">${Icons.svg('lock', { size: 12 })} kept by ${esc(r.unseen.keptBy)} · ask ${esc(r.unseen.ask)}</span>`; val = `<span class="bv muted">not yours to see</span>`; }
      else if (r.gap) { track = `<span class="bt"><span class="mk-gap s"></span> <span class="gapw">not known yet · ${esc(r.gap.who)} could fill it</span></span>`; val = `<span class="bv muted">?</span>`; }
      else { track = `<span class="bt"><span class="bf${r.emph ? ' emph' : ''}" style="--w:${(100 * r.value / max).toFixed(1)}%;--i:${i}"></span></span>`; val = `<span class="bv">${fmt(r.value)}</span>`; }
      return `<div class="br${r.emph ? ' emph' : ''}"><span class="bl">${esc(r.label)}</span>${track}${val}</div>`;
    }).join('')}</div>`;
  }
  /* equal tiles placed roughly where each site is */
  function tiles(o) {
    const max = Math.max(...seen().map(o.value));
    return `<div class="tiles">${DATA.sites.map((s, i) => {
      const st = `grid-column:${s.gx};grid-row:${s.gy};--i:${i}`;
      if (s.unseen) return `<div class="tile unseen-t" style="${st}"><b>${esc(s.short)}</b><span>${Icons.svg('lock', { size: 12 })} ${esc(s.unseen.keptBy)}</span><span class="tw">ask ${esc(s.unseen.ask)}</span></div>`;
      const v = o.value(s);
      return `<div class="tile${o.emph && o.emph(s) ? ' emph' : ''}" style="${st};--v:${(v / max).toFixed(2)}"><b>${esc(s.short)}</b><span class="tv">${v}</span><span class="tw">${esc(areaWord(s.area))}</span></div>`;
    }).join('')}</div>`;
  }
  /* count with symbols; rows: [{label, items:[{cls}], note, stale}] */
  function count(rows, icon, o) {
    o = o || {};
    let k = 0;
    return `<div class="iso">${rows.map(r => `<div class="ir"><span class="il">${esc(r.label)}${r.stale ? `<span class="age">${esc(r.stale)}</span>` : ''}</span><span class="is">${r.items.map(it => `<span class="sym ${it.cls}" style="--i:${k++}" title="${esc(it.title || '')}">${Icons.svg(it.icon || icon, { size: o.size || 20, stroke: 1.5 })}</span>`).join('')}</span><span class="in">${r.note != null ? r.note : r.items.length}</span></div>`).join('')}</div>`;
  }
  /* before and after; rows: [{label, a, b, emph}] */
  function slope(rows, o) {
    o = o || {};
    const w = o.w || 760, p = { l: 230, r: 230, t: 34, b: 12 }; let h = o.h || 300;
    const mx = ticks(Math.max(...rows.flatMap(r => [r.a, r.b])));
    const ym = mx[mx.length - 1], y = v => p.t + (1 - v / ym) * (h - p.t - p.b), xa = p.l, xb = w - p.r;
    let g = `<text class="xt" x="${xa}" y="${p.t - 16}" text-anchor="middle">${esc(o.aWord || 'Before')}</text><text class="xt" x="${xb}" y="${p.t - 16}" text-anchor="middle">${esc(o.bWord || 'After')}</text>`;
    g += `<line class="grid" x1="${xa}" x2="${xa}" y1="${p.t}" y2="${h - p.b}"/><line class="grid" x1="${xb}" x2="${xb}" y1="${p.t}" y2="${h - p.b}"/>`;
    const placed = { a: [], b: [] };
    const nudge = (arr, v) => { let yy = y(v); while (arr.some(q => Math.abs(q - yy) < 15)) yy += 15; arr.push(yy); return yy; };
    [...rows].sort((r1, r2) => (r1.emph ? 1 : 0) - (r2.emph ? 1 : 0)).forEach(r => {
      g += `<path class="ln draw ${r.emph ? 'emph' : 'ctx'}" pathLength="1" d="M${xa} ${y(r.a)} L${xb} ${y(r.b)}"/>`;
      g += `<circle class="dot ${r.emph ? 'emph' : 'ctx'}" cx="${xa}" cy="${y(r.a)}" r="3"/><circle class="dot ${r.emph ? 'emph' : 'ctx'}" cx="${xb}" cy="${y(r.b)}" r="3"/>`;
    });
    let hy = h;
    [...rows].sort((r1, r2) => r2.b - r1.b).forEach(r => {
      const yy = nudge(placed.b, r.b); hy = Math.max(hy, yy + 10);
      g += `<text class="dl ${r.emph ? 'emph' : 'ctx'}" x="${xb + 10}" y="${yy + 4}">${esc(r.label)} <tspan class="dv">${r.b.toFixed(1)}</tspan></text>`;
    });
    [...rows].filter(r => r.emph).sort((r1, r2) => r2.a - r1.a).forEach(r => {
      g += `<text class="dl emph" x="${xa - 10}" y="${nudge(placed.a, r.a) + 4}" text-anchor="end"><tspan class="dv">${r.a.toFixed(1)}</tspan> ${esc(r.label)}</text>`;
    });
    const ctx = rows.filter(r => !r.emph);
    if (ctx.length) { const lo = Math.min(...ctx.map(r => r.a)), hi = Math.max(...ctx.map(r => r.a)); g += `<text class="dl ctx" x="${xa - 10}" y="${nudge(placed.a, (lo + hi) / 2) + 4}" text-anchor="end">${ctx.length} others, ${lo.toFixed(1)} to ${hi.toFixed(1)}</text>`; }
    h = hy;
    return `<svg class="ch" viewBox="0 0 ${w} ${h}" width="100%" preserveAspectRatio="xMinYMin meet" role="img" aria-label="before and after">${g}</svg>`;
  }
  /* small pictures on the same scale */
  function multiples(o) {
    const ymax = Math.max(...seen().flatMap(s => s.inc.filter(v => v !== null)));
    return `<div class="mult">${DATA.sites.map(s => {
      if (s.unseen) return `<div class="mc unseen-t"><b>${esc(s.short)}</b><span>${Icons.svg('lock', { size: 12 })} kept by ${esc(s.unseen.keptBy)}</span></div>`;
      const t = trend(s.inc, ''), rose = t.verb !== 'held steady' && t.verb !== 'fell';
      return `<div class="mc${rose ? ' emph' : ''}"><b>${esc(s.short)}</b><span class="mv">${rose ? t.verb : 'held steady'}</span>${line({ series: [{ values: s.inc, emph: rose }], w: 200, h: 56, yMax: ymax, bare: true, pad: { l: 2, r: 6, t: 4, b: 4 }, event: o && o.event })}</div>`;
    }).join('')}</div>`;
  }
  function table(rows, cols, o) {
    o = o || {};
    return `<table class="rec"><thead><tr>${cols.map(c => `<th>${esc(c.h)}</th>`).join('')}</tr></thead><tbody>${rows.slice(0, o.limit || rows.length).map(r => `<tr>${cols.map(c => `<td>${c.f(r)}</td>`).join('')}</tr>`).join('')}</tbody></table>`;
  }

  /* ---------- pencil (model) and ink ---------- */
  function pencil(o) {
    return `<div class="pencil" data-pencil><p class="pk">${Icons.svg('pencil-line', { size: 12 })} Suggested by the model · pencil until a person accepts it</p><p class="pb">${o.body}</p><div class="pa"><button class="acc" type="button">Accept</button><button class="aside" type="button">Set aside</button><span class="pl">${o.links || ''}</span></div><p class="inked-by"></p></div><p class="gw-note">${Icons.svg('power-off', { size: 12 })} Model gateway is off: no suggestions here. Nothing on the picture or in the finding changed.</p>`;
  }
  function wirePencils(root) {
    $$('.pencil', root).forEach(p => {
      $('.acc', p).onclick = () => { p.classList.add('inked'); $('.inked-by', p).textContent = 'Accepted by ' + DATA.viewer.initials + ' today · still marked as the model’s words'; };
      $('.aside', p).onclick = () => { p.classList.add('set-aside'); };
    });
  }

  /* ---------- page plumbing: keys, demo, hints ---------- */
  let timers = [];
  function later(t, f) { timers.push(setTimeout(f, reduced ? Math.min(t, ms('--motion-quick')) : t)); }
  function clear() { timers.forEach(clearTimeout); timers = []; }
  async function type(el, text, per) {
    if (reduced) { el.textContent = text; return; }
    el.textContent = '';
    for (let i = 0; i < text.length; i++) { el.textContent += text[i]; await new Promise(r => timers.push(setTimeout(r, per || ms('--motion-instant') / 8))); }
  }
  function keys(extra) {
    document.addEventListener('keydown', e => {
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      const k = e.key.toLowerCase();
      if (e.target.closest && e.target.closest('input,textarea,select')) return;
      if (k === 't') { document.body.classList.toggle('tech'); flag('techflag', document.body.classList.contains('tech')); }
      else if (k === 'g') { document.body.classList.toggle('gw-off'); flag('gwflag', !document.body.classList.contains('gw-off')); }
      else if (k === 'r') { clear(); window.replay && window.replay(); }
      else if (extra) extra(k, e);
    });
  }
  function flag(id, on) { const b = document.getElementById(id); if (b) b.setAttribute('aria-pressed', on ? 'true' : 'false'); }
  function hints(list) {
    const base = [['R', 'replay'], ['T', 'technical words'], ['G', 'model gateway on/off']];
    return `<div class="hintbar hints">${list.concat(base).map(([k, w]) => `<span><span class="kbd">${k}</span>${w}</span>`).join('')}</div>`;
  }
  function floorLine() { return `<span class="floorline" data-tier="${DATA.floor.tier}"></span><span>${esc(DATA.floor.name)} <span class="muted">· ${esc(DATA.floor.word)}</span></span>`; }
  return { ms, reduced, $, $$, esc, fill, cap, monthWord, mi, site, seen, unseen, mean, sum, totals, trend, riseBy, riseShare, lastK, records, kindWord, line, bars, tiles, count, slope, multiples, table, pencil, wirePencils, later, clear, type, keys, hints, floorLine, areaWord, M, N };
})();

/* ---------- one answer per question: finding (from templates), picture, notes ---------- */
const A = (() => {
  const T = DATA.templates, RS = DATA.recordSet, P = DATA.periods;
  const list = a => a.length < 2 ? a.join('') : a.slice(0, -1).join(', ') + ' and ' + a[a.length - 1];
  const tot = () => U.totals(U.seen());
  const evIdx = () => U.mi(DATA.event.month);
  const ev = { month: DATA.event.month, word: DATA.event.word };
  const notes = (withBreak) => {
    const n = [];
    if (withBreak) U.seen().filter(s => s.noRecord).forEach(s => n.push({ mark: 'break', text: U.fill(T.noRecord, { month: U.monthWord(s.noRecord.month), site: s.short, why: s.noRecord.why }), who: s.noRecord.who }));
    U.unseen().forEach(s => n.push({ mark: 'unseen', text: U.fill(T.unseen, { site: s.name, keptBy: s.unseen.keptBy, ask: s.unseen.ask }) }));
    return n;
  };
  const b = {};
  b.worse = o => {
    const t = tot(), tr = U.trend(t, RS.word), rs = U.riseShare(tr.cp, 'north');
    return { title: tr.text + '.', sub: U.fill(T.trendWhere, { share: rs.pct >= 90 ? 'Nearly all' : rs.pct + '%', group: U.areaWord('north'), names: list(rs.names) }) + '.',
      conf: tr.confText + '.', confWord: tr.conf, n: U.records().length,
      pic: () => U.line(Object.assign({ series: [{ label: 'All depots', values: t, emph: true }], event: ev, aria: tr.text }, o || {})), notes: notes(true), strength: 5 };
  };
  b.big = o => {
    const r = U.seen().map(s => ({ label: s.short, value: U.lastK(s, 3) })).sort((x, y) => y.value - x.value);
    const [f, s2] = r, x = f.value / s2.value;
    const title = x >= 1.5 ? U.fill(T.big, { top: f.label, measure: RS.lower, period: P.last3, v: f.value, x: x.toFixed(1), second: s2.label })
      : U.fill(T.bigClose, { top: f.label, measure: RS.lower, period: P.last3, v: f.value, second: s2.label, v2: s2.value });
    r[0].emph = true;
    U.unseen().forEach(s => r.push({ label: s.short, unseen: s.unseen }));
    return { title: title + '.', sub: U.fill(T.bigSub, { from: U.monthWord(U.M[U.N - 3]), to: U.monthWord(U.M[U.N - 1]) }), conf: T.countConf + '.', confWord: '',
      n: U.sum(U.seen().map(s => U.lastK(s, 3))), pic: () => U.bars(r), notes: notes(false), strength: 3 };
  };
  b.where = o => {
    const by = {}; U.seen().forEach(s => by[s.area] = (by[s.area] || 0) + U.lastK(s, 3));
    const all = U.sum(Object.values(by)), top = Object.keys(by).sort((x, y) => by[y] - by[x])[0];
    return { title: U.cap(U.fill(T.where, { pct: Math.round(100 * by[top] / all) + '%', measure: RS.lower, period: P.last3, area: U.areaWord(top) })) + '.',
      sub: U.fill(T.whereSub, { measure: RS.word, period: P.last3 }), conf: T.countConf + '.', confWord: '', n: all,
      pic: () => U.tiles({ value: s => U.lastK(s, 3), emph: s => s.area === top }), notes: notes(false), strength: 4 };
  };
  b.many = o => {
    const recs = U.records().filter(r => r.month === U.M[U.N - 1]);
    const by = DATA.incidentKinds.map(k => ({ k, rs: recs.filter(r => r.kind === k.id) })).filter(x => x.rs.length).sort((x, y) => y.rs.length - x.rs.length);
    const rows = by.map((x, i) => ({ label: x.k.word, items: x.rs.map(r => ({ icon: x.k.icon, cls: i === 0 ? 'hot' : '', title: r.id + ' · ' + r.site.short })) }));
    return { title: U.fill(T.manyInc, { n: recs.length, measure: RS.lower, period: P.last1, k: by[0].rs.length, kind: by[0].k.plural }) + '.',
      sub: 'One symbol is one ' + RS.one + '.', conf: T.countConf + '.', confWord: '', n: recs.length,
      pic: () => U.count(rows, 'circle', { size: o && o.size || 22 }), notes: notes(false), strength: 2 };
  };
  b.after = o => {
    const r = U.riseBy(evIdx()), up = r.filter(x => x.d >= 1).sort((x, y) => y.d - x.d);
    const rows = r.map(x => ({ label: x.s.short, a: x.a, b: x.b, emph: x.d >= 1 }));
    const conf = DATA.yardstick.find(y => y.lo === 25).word;
    return { title: U.fill(T.after, { measure: RS.word, k: up.length, N: r.length, event: DATA.event.word + ' on ' + DATA.event.date, top: up[0].s.short }) + '.',
      sub: 'Average ' + RS.lower + ' a month at each depot, before and after.', conf: U.fill(T.afterConf, { word: conf, cause: DATA.event.cause }) + '.', confWord: conf, n: U.records().length,
      pic: () => U.slope(rows, Object.assign({ aWord: 'Before ' + U.monthWord(DATA.event.month, 'short'), bWord: 'From ' + U.monthWord(DATA.event.month, 'short') }, o || {})), notes: notes(true), strength: 4 };
  };
  b.same = o => {
    const tr = U.seen().map(s => U.trend(s.inc, '')), k = tr.filter(t => t.verb === 'rose' || t.verb === 'doubled').length;
    return { title: U.fill(T.same, { k, m: tr.length - k }) + '.', sub: 'Every small picture uses the same scale.', conf: 'Each depot is judged on its own months.', confWord: '', n: U.records().length,
      pic: () => U.multiples({ event: ev }), notes: notes(true), strength: 4 };
  };
  const confHTML = a => a.confWord && a.conf.startsWith(a.confWord) ? `<b>${U.esc(a.confWord)}</b><span>${U.esc(a.conf.slice(a.confWord.length).trim())}</span>` : `<span>${U.esc(a.conf)}</span>`;
  return { get: (id, o) => b[id](o), list, confHTML };
})();
