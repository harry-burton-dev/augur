/* ---- shared helpers and the recipe engine (same in every variant) ---- */
const $ = (s, el = document) => el.querySelector(s);
const $$ = (s, el = document) => [...el.querySelectorAll(s)];
const I = (n, size = 16, stroke = 1.5) => Icons.svg(n, { size, stroke });
const P = id => DATA.people[id];
const F = id => DATA.floors[id];
const fmt = n => n == null ? '' : n.toLocaleString('en-GB');
const plural = (n, one, many) => `${fmt(n)} ${n === 1 ? one : (many || one + 's')}`;
const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
const css = v => getComputedStyle(document.documentElement).getPropertyValue(v).trim();
const ms = v => parseFloat(css(v)) || 0;
const esc = s => String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const COLS = 'ABCDEFGHIJKLMNOP';
const lc = s => s.charAt(0).toLowerCase() + s.slice(1);
const MON = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const DEPOT = id => DATA.depots.find(d => d.id === id);
const KD = id => DATA.kinds.inspection.details.find(d => d.id === id);
const VAN = id => { const v = DATA.vans.find(x => x[0] === id); return v && { id: v[0], depot: v[1], odo: v[2], last: v[3] }; };
const STEP = id => DATA.recipe.steps.find(s => s.id === id);
const FIRM = DATA.firm;

/* ---------- reading values: each returns null when it can't read, never a guess ---------- */
const RE_VAN = /^\s*([A-Za-z]{2})[\s.\-]*(\d{1,2})\s*$/;
function readVan(v) { const m = String(v || '').match(RE_VAN); return m ? `${m[1].toUpperCase()}-${m[2].padStart(2, '0')}` : null; }
function dateShape(v) {
  v = String(v || '').trim();
  if (/^\d{5}$/.test(v)) return 'serial';
  if (/^\d{1,2}\/\d{1,2}\/\d{4}$/.test(v)) return 'd/m/y';
  if (/^\d{4}-\d{2}-\d{2}$/.test(v)) return 'y-m-d';
  if (/^\d{1,2}\s+[A-Za-z]{3}$/.test(v)) return 'd Mon';
  return null;
}
const SHAPE_WORD = { serial: 'a spreadsheet day number', 'd/m/y': 'day/month/year', 'y-m-d': 'year-month-day', 'd Mon': 'day and month, no year' };
function readDate(v, year) {
  v = String(v || '').trim(); const sh = dateShape(v); let d, m, y;
  if (sh === 'serial') { const t = new Date(Date.UTC(1899, 11, 30) + (+v) * 864e5); d = t.getUTCDate(); m = t.getUTCMonth(); y = t.getUTCFullYear(); }
  else if (sh === 'd/m/y') { const p = v.split('/'); d = +p[0]; m = +p[1] - 1; y = +p[2]; }
  else if (sh === 'y-m-d') { const p = v.split('-'); y = +p[0]; m = +p[1] - 1; d = +p[2]; }
  else if (sh === 'd Mon') { const p = v.split(/\s+/); d = +p[0]; m = MON.findIndex(x => x.toLowerCase() === p[1].toLowerCase()); y = year; }
  else return null;
  return { d, m, y, shape: sh, text: `${d} ${MON[m]} ${y}` };
}
function readResult(v) {
  const s = String(v || '').replace(/[–—]/g, '-').trim();
  const m = s.match(/^(pass|fail)\b(.*)$/i); if (!m) return null;
  const rest = m[2].replace(/[()]/g, '').replace(/^\s*-\s*/, '').trim();
  const adv = /^advisory\b/i.test(rest);
  const note = rest.replace(/^advisory\s*:?\s*/i, '').trim();
  return { result: /fail/i.test(m[1]) ? 'failed' : adv ? 'passed with advisory' : 'passed', note };
}
function readMiles(v) {
  const s = String(v || '').replace(/\s*mi(les)?\.?$/i, '').replace(/[,\s]/g, '');
  return /^\d+$/.test(s) ? +s : null;
}
const squash = s => String(s || '').toLowerCase().replace(/[^a-z]/g, '');
function lev(a, b) { const d = Array.from({ length: a.length + 1 }, (_, i) => [i]); for (let j = 1; j <= b.length; j++) d[0][j] = j;
  for (let i = 1; i <= a.length; i++) for (let j = 1; j <= b.length; j++) d[i][j] = Math.min(d[i - 1][j] + 1, d[i][j - 1] + 1, d[i - 1][j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1)); return d[a.length][b.length]; }

/* ---------- a first look at a column, before any recipe: shapes, blanks, distinct values ---------- */
const shapeOf = v => String(v).trim().replace(/[A-Z]/g, 'A').replace(/[a-z]/g, 'a').replace(/[0-9]/g, '9').replace(/(.)\1+/g, '$1$1').replace(/\s+/g, ' ');
function dataLinesOf(res) { return res.lines.filter(l => l.n > 3 && l.cells.some(c => String(c || '').trim()) && String(l.cells[0] || '').trim().toUpperCase() !== 'TOTAL'); }
function profile(res, col) {
  const i = res.header.indexOf(col), out = { col, i, shapes: {}, blanks: [], values: {}, n: 0 };
  dataLinesOf(res).forEach(l => { const v = String(l.cells[i] ?? '').trim(); out.n++;
    if (!v) { out.blanks.push(l.n); return; }
    const sh = shapeOf(v); (out.shapes[sh] = out.shapes[sh] || { ex: v, lines: [] }).lines.push(l.n);
    (out.values[v] = out.values[v] || []).push(l.n); });
  out.ways = Object.keys(out.shapes).length; out.distinct = Object.keys(out.values).length;
  return out;
}

/* ---------- the engine: run a recipe over a file. Nothing is dropped: every line ends with a role ---------- */
/* roles: title, header, blank, total (not records); copy, aside (didn't fit); stop (waiting on a person); land (becomes a record) */
function run(fileKey, steps = DATA.recipe.steps, answers = {}) {
  const file = DATA.files[fileKey];
  const L = file.lines.map((c, i) => ({ n: i + 1, cells: c.slice(), role: null, by: null, why: '' }));
  const res = { fileKey, file, lines: L, header: [], st: {}, stops: [], recs: [], total: null, leftOut: [], checks: [] };
  const S = id => res.st[id] || (res.st[id] = { changed: 0, values: [], aside: [], shapes: {}, groups: {}, near: [], stop: null, col: null, found: true });
  const live = () => L.filter(l => !l.role || l.role === 'land' || l.role === 'stop');
  const named = st => { const n = [...(st.col || [])]; if (answers.rename && answers.rename[n[0]]) n.push(answers.rename[n[0]]); return n; };
  const col = st => { for (const n of named(st)) { const i = res.header.indexOf(n); if (i >= 0) return i; } return -1; };
  const recOf = l => l.rec || (l.rec = { n: l.n, cells: l.cells, v: {}, flags: [] });
  const stopCol = (st, s) => {
    const want = named(st)[0];
    const guess = res.header.map((h, i) => ({ h, i, fit: live().filter(l => st.op === 'van' || st.op === 'match' ? readVan(l.cells[i]) : true).length }))
      .filter(x => !res.used.has(x.h)).sort((a, b) => b.fit - a.fit)[0];
    s.found = false;
    const stop = { step: st.id, kind: 'column', want, guess: guess && guess.h, fit: guess && guess.fit, of: live().length };
    if (!res.stops.find(x => x.kind === 'column' && x.want === want)) res.stops.push(stop); else stop.also = true;
    s.stop = stop;
  };
  res.used = new Set();
  for (const st of steps) {
    const s = S(st.id);
    if (st.op === 'skipTop') { L.slice(0, st.n).forEach(l => { l.role = 'title'; l.by = st.id; }); s.aside = L.slice(0, st.n).map(l => l.n); }
    else if (st.op === 'header') { const h = L[st.line - 1]; h.role = 'header'; h.by = st.id; res.header = h.cells.slice(); }
    else if (st.op === 'total') {
      live().filter(l => String(l.cells[0] || '').trim().toUpperCase() === st.first).forEach(l => {
        l.role = 'total'; l.by = st.id; const m = l.cells.join(' ').match(/(\d+)\s+visits/i);
        res.total = { said: m ? +m[1] : null, line: l.n, text: l.cells.filter(Boolean).join(' · ') }; s.aside.push(l.n);
      });
    }
    else if (st.op === 'blank') live().filter(l => l.cells.every(c => !String(c || '').trim())).forEach(l => { l.role = 'blank'; l.by = st.id; s.aside.push(l.n); });
    else if (st.op === 'copies') {
      const seen = {};
      live().forEach(l => { const k = l.cells.join('␟'); if (seen[k]) { l.role = 'copy'; l.by = st.id; l.of = seen[k]; l.why = `an exact copy of line ${seen[k]}`; s.aside.push(l.n); } else seen[k] = l.n; });
    }
    else if (st.op === 'van') {
      const i = col(st); if (i < 0) { stopCol(st, s); continue; } s.col = res.header[i]; res.used.add(res.header[i]);
      live().forEach(l => {
        const raw = l.cells[i], out = readVan(raw);
        if (!out) {
          if (st.unreadable === 'aside') { l.role = 'aside'; l.by = st.id; l.why = `“${raw}” isn’t a van number`; s.aside.push(l.n); }
          else { l.role = 'stop'; l.by = st.id; l.why = `“${raw}” isn’t a van number`; s.stop = s.stop || { step: st.id, kind: 'value', lines: [] }; s.stop.lines.push(l.n); if (!res.stops.includes(s.stop)) res.stops.push(s.stop); }
          return;
        }
        const r = recOf(l); r.v.van = { raw, val: out, col: res.header[i], by: out !== raw ? [st.id] : [] };
        if (out !== raw) { s.changed++; s.values.push([raw, out, l.n]); }
      });
    }
    else if (st.op === 'date') {
      const i = col(st); if (i < 0) { stopCol(st, s); continue; } s.col = res.header[i]; res.used.add(res.header[i]);
      live().forEach(l => {
        const raw = l.cells[i], d = readDate(raw, st.year);
        if (!d) { l.role = 'stop'; l.by = st.id; l.why = `“${raw}” can’t be read as a date`; return; }
        s.shapes[d.shape] = (s.shapes[d.shape] || 0) + 1;
        const r = recOf(l); r.v.on = { raw, val: d.text, col: res.header[i], by: [st.id], shape: d.shape }; s.changed++; s.values.push([raw, d.text, l.n]);
      });
    }
    else if (st.op === 'group') {
      const i = col(st); if (i < 0) { stopCol(st, s); continue; } s.col = res.header[i]; res.used.add(res.header[i]);
      const map = {}; st.groups.forEach(g => g.from.forEach(f => map[f] = g.to));
      live().forEach(l => {
        const raw = l.cells[i]; let to = map[raw], near = false;
        if (!to && st.near) {
          let best = null; Object.keys(map).forEach(k => { const dd = lev(squash(k), squash(raw)); if (dd <= 2 && (!best || dd < best.d)) best = { k, d: dd }; });
          if (best) { to = map[best.k]; near = best.k; }
        }
        if (!to) { l.role = 'stop'; l.by = st.id; l.why = `“${raw}” isn’t one of the depots`; return; }
        (s.groups[to] = s.groups[to] || {})[raw] = ((s.groups[to] || {})[raw] || 0) + 1;
        if (near && !s.near.find(x => x.raw === raw)) s.near.push({ raw, like: near, to, lines: [] });
        if (near) s.near.find(x => x.raw === raw).lines.push(l.n);
        const r = recOf(l); r.v.depot = { raw, val: DEPOT(to).name, id: to, col: res.header[i], by: [st.id], near };
        if (raw !== DEPOT(to).name) { s.changed++; s.values.push([raw, DEPOT(to).name, l.n]); }
      });
    }
    else if (st.op === 'result') {
      const i = col(st); if (i < 0) { stopCol(st, s); continue; } s.col = res.header[i]; res.used.add(res.header[i]);
      live().forEach(l => {
        const raw = l.cells[i], r0 = readResult(raw);
        if (!r0) {
          const ans = answers.value && answers.value[raw];
          if (ans === 'aside') { l.role = 'aside'; l.by = st.id; l.why = `“${raw}” isn’t a result ${DATA.app} knows yet`; l.waiting = true; s.aside.push(l.n); }
          else { l.role = 'stop'; l.by = st.id; l.why = `“${raw}” isn’t a result ${DATA.app} knows`; s.stop = s.stop || { step: st.id, kind: 'value', value: raw, lines: [] }; s.stop.lines.push(l.n); if (!res.stops.includes(s.stop)) res.stops.push(s.stop); }
          return;
        }
        const r = recOf(l); r.v.result = { raw, val: r0.result, col: res.header[i], by: [st.id] };
        if (r0.note) r.v.rnote = { raw, val: r0.note, col: res.header[i], by: [st.id] };
        s.changed++; s.values.push([raw, r0.result + (r0.note ? ' · ' + r0.note : ''), l.n]);
      });
    }
    else if (st.op === 'miles') {
      const i = col(st); if (i < 0) { stopCol(st, s); continue; } s.col = res.header[i]; res.used.add(res.header[i]);
      live().forEach(l => {
        const raw = l.cells[i], m = readMiles(raw), r = recOf(l);
        if (m == null) { r.v.odometer = { raw, val: null, col: res.header[i], by: [st.id], aside: true, why: `“${raw}” can’t be read as miles` }; s.aside.push(l.n); return; }
        const out = fmt(m); r.v.odometer = { raw, val: out, num: m, col: res.header[i], by: out !== raw ? [st.id] : [] };
        if (out !== raw) { s.changed++; s.values.push([raw, out, l.n]); }
      });
    }
    else if (st.op === 'match') {
      const i = col(st); if (i < 0) { stopCol(st, s); continue; }
      s.matched = new Set(); s.fresh = new Set();
      live().filter(l => l.rec && l.rec.v.van).forEach(l => {
        const id = l.rec.v.van.val, v = VAN(id);
        if (v) { l.rec.van = { id, status: 'match' }; s.matched.add(id); }
        else { l.rec.van = { id, status: 'new' }; s.fresh.add(id); }
      });
    }
    else if (st.op === 'map') {
      const asked = Object.entries(st.cols).filter(([, d]) => d === 'asked').map(([c]) => c);
      res.leftOut = res.header.filter(h => h && !(h in st.cols) && !res.used.has(h));
      res.asked = asked;
      if (!res.header.length) continue;
      const iNote = res.header.indexOf('Notes'), iType = res.header.indexOf('Type');
      live().filter(l => l.role !== 'stop').forEach(l => {
        const r = recOf(l); l.role = 'land'; l.by = l.by || st.id;
        const notes = [r.v.rnote && r.v.rnote.val, iNote >= 0 && l.cells[iNote]].filter(Boolean);
        if (iType >= 0 && l.cells[iType]) r.v.kindOfVisit = { raw: l.cells[iType], val: l.cells[iType], col: 'Type', by: [st.id], waiting: true };
        r.v.note = { raw: iNote >= 0 ? l.cells[iNote] : '', val: notes.join('; '), col: 'Notes', by: r.v.rnote ? ['s9'] : [] };
        if (st.firm) r.v.by = { raw: '', val: FIRM.name, col: null, by: [st.id], fromFile: true };
      });
    }
  }
  res.recs = L.filter(l => l.role === 'land').map(l => l.rec);
  L.filter(l => l.role === 'stop' && !res.stops.some(s => s.lines && s.lines.includes(l.n))).forEach(l => {
    const s = res.st[l.by]; if (!s.stop) { s.stop = { step: l.by, kind: 'value', lines: [] }; res.stops.push(s.stop); } if (s.stop.lines) s.stop.lines.push(l.n);
  });
  return res;
}

/* what the run would send to Triage, and what it sets aside. All counted from the run */
function plate(res) {
  const data = res.lines.filter(l => !['title', 'header', 'blank', 'total'].includes(l.role));
  const land = res.lines.filter(l => l.role === 'land'), aside = res.lines.filter(l => l.role === 'aside'), copies = res.lines.filter(l => l.role === 'copy'), stopped = res.lines.filter(l => l.role === 'stop');
  const fresh = [...new Set(res.recs.filter(r => r.van && r.van.status === 'new').map(r => r.van.id))];
  const latest = {}; res.recs.forEach(r => { if (r.van && r.van.status === 'match' && r.v.odometer && r.v.odometer.num != null) latest[r.van.id] = r; });
  const odo = Object.values(latest).map(r => ({ id: r.van.id, was: VAN(r.van.id).odo, now: r.v.odometer.num, n: r.n })).filter(x => x.was !== x.now);
  const valuesAside = res.recs.filter(r => r.v.odometer && r.v.odometer.aside).map(r => ({ n: r.n, raw: r.v.odometer.raw, why: r.v.odometer.why, van: r.v.van.val }));
  const depots = [...new Set(res.recs.map(r => r.v.depot && r.v.depot.id).filter(Boolean))];
  const spellings = res.recs.filter(r => r.v.depot && r.v.depot.raw !== r.v.depot.val).length;
  const waiting = res.recs.filter(r => r.v.kindOfVisit).length;
  return {
    data: data.length, land: land.length, aside, copies, stopped, fresh, odo, valuesAside, depots, spellings, waiting,
    vans: [...new Set(res.recs.map(r => r.van && r.van.id))].length,
    notRecords: res.lines.filter(l => ['title', 'header', 'blank', 'total'].includes(l.role)),
    balances: res.total ? res.total.said === land.length + aside.length + stopped.length : null
  };
}

/* ---------- what landing a run would move elsewhere (consequence preview), worked out from the dates ---------- */
const pd = s => { const p = String(s).split(/\s+/); return Date.UTC(+p[2], MON.indexOf(p[1]), +p[0]); };
function overdue(depot, res, today = DATA.today) {
  const t = new Date(pd(today)); t.setUTCMonth(t.getUTCMonth() - DATA.inspectEveryMonths);
  const vans = DATA.vans.filter(v => v[1] === depot).map(v => VAN(v[0]));
  const last = id => { let d = pd(VAN(id).last); (res ? res.recs : []).forEach(r => { if (r.van && r.van.id === id) d = Math.max(d, pd(r.v.on.val)); }); return d; };
  return { of: vans.length, ids: vans.filter(v => last(v.id) < +t).map(v => v.id) };
}
function downstream(res) {
  return DATA.downstream.map(d => {
    const was = overdue(d.depot), now = overdue(d.depot, res), name = DEPOT(d.depot).name, cleared = was.ids.filter(x => !now.ids.includes(x));
    if (d.kind === 'overdue') return { ...d, now: `${was.ids.length} of ${was.of} overdue`, after: `${now.ids.length} of ${now.of} overdue`, why: `${plural(cleared.length, 'overdue van')} (${cleared.join(', ')}) ${cleared.length === 1 ? 'was' : 'were'} inspected in this file` };
    if (d.kind === 'intent') return { ...d, now: d.state, after: `${plural(res.recs.filter(r => r.v.depot.id === d.depot).length, 'inspection')} added as evidence; ${P(d.owner).name} decides its state`, why: `it is bound to the ${was.of} ${name} vans` };
    return { ...d, now: 'quiet', after: `tells ${P(d.owner).name.split(' ')[0]} once: “something happened”`, why: `the count it watches moves from ${was.ids.length} to ${now.ids.length}` };
  });
}

/* ---------- the recipe in words (plain first, admin words with T) ---------- */
function stepWords(st, res) {
  const s = res && res.st[st.id] || {}, c = (st.col || [])[0], used = s.col || c;
  const g = st.groups ? st.groups.reduce((a, x) => a + x.from.length, 0) : 0;
  switch (st.op) {
    case 'skipTop': return { w: `Skip the first ${st.n} lines: a title, not visits`, tk: `skip_rows = ${st.n}`, icon: 'scissors' };
    case 'header': return { w: `Use line ${st.line} as the column names`, tk: `header_row = ${st.line}`, icon: 'heading' };
    case 'total': return { w: `Set the ${st.first} line aside, and check our count against it`, tk: `filter(A <> '${st.first}') · assert count = total`, icon: 'sigma' };
    case 'blank': return { w: 'Set aside empty lines', tk: 'filter(not all_blank(row))', icon: 'rows-3' };
    case 'copies': return { w: 'Set aside exact copies of a line', tk: 'distinct_on(all columns) · keep first', icon: 'copy' };
    case 'van': return { w: `Write van numbers in ${used} like ${st.example[1]}`, ex: st.example, tk: `${used} := upper(letters) || '-' || lpad(digits, 2, '0')`, icon: 'truck', more: st.unreadable === 'aside' ? 'set aside a line with no van number' : '' };
    case 'date': return { w: `Read ${used} ${st.order}, written like ${st.example[1]}`, ex: st.example, tk: `strptime(${used}, ['%d/%m/%Y','%Y-%m-%d','%d %b']) ∪ excel_serial · year ${st.year} if missing`, icon: 'calendar' };
    case 'group': return { w: `Group ${g} spellings in ${used} into ${st.groups.length} depots`, tk: `cluster(${used}; fingerprint, distance ≤ 2) → Site`, icon: 'combine', more: st.near ? 'and near spellings of them' : '' };
    case 'result': return { w: `Split ${used} into a result and a note`, ex: st.example, tk: `${used} → outcome ∈ {passed, passed with advisory, failed}, comment`, icon: 'split' };
    case 'miles': return { w: `Read ${used} as miles`, ex: st.example, tk: `try_cast(replace(${used}, ',', '') as int)`, icon: 'gauge', more: 'set aside a reading that can’t be read' };
    case 'match': return { w: `Match vans to the vans ${DATA.app} keeps, and propose new ones`, tk: `match Vehicle on id (exact) · else propose new`, icon: 'link' };
    case 'map': return { w: `Make each line an ${DATA.kinds[st.kind].word} by ${FIRM.short}`, tk: `→ ${DATA.kinds[st.kind].tech}{${DATA.kinds[st.kind].details.map(d => d.tech).join(', ')}}`, icon: 'clipboard-check' };
  }
  return { w: st.op, tk: st.op, icon: 'circle' };
}
/* the count each line shows, from the run */
function stepCount(st, res) {
  const s = res.st[st.id]; if (!s) return '';
  if (s.stop && s.stop.kind === 'column') return `can’t find ${s.stop.want}`;
  if (s.stop && s.stop.lines) return `${plural(s.stop.lines.length, 'line')} stopped`;
  switch (st.op) {
    case 'skipTop': return plural(s.aside.length, 'line');
    case 'header': return `${res.header.length} columns`;
    case 'total': return res.total ? `it says ${res.total.said}` : 'none found';
    case 'blank': case 'copies': return s.aside.length ? `${plural(s.aside.length, 'line')} set aside` : 'none';
    case 'van': return s.changed || s.aside.length ? `${plural(s.changed, 'value')}${s.aside.length ? ` · ${s.aside.length} set aside` : ''}` : 'all fine as they came';
    case 'date': return `${plural(s.changed, 'date')} · ${Object.keys(s.shapes).length} ways`;
    case 'group': return `${plural(s.changed, 'value')}${s.near.length ? ` · ${s.near.length} new spelling` : ''}`;
    case 'result': return `${plural(s.changed, 'value')}${s.aside.length ? ` · ${s.aside.length} set aside` : ''}`;
    case 'miles': return s.changed || s.aside.length ? `${plural(s.changed, 'value')}${s.aside.length ? ` · ${s.aside.length} can’t read` : ''}` : 'all fine as they came';
    case 'match': return s.matched ? `${s.matched.size} known · ${s.fresh.size} new` : '';
    case 'map': return plural(res.recs.length, DATA.kinds[st.kind].word);
  }
  return '';
}
function stepState(st, res) { const s = res.st[st.id]; if (!s) return 'todo'; if (s.stop) return 'stop'; if (s.near && s.near.length) return 'check'; return 'ok'; }

/* ---------- shared pieces of markup ---------- */
function topHTML(crumbs, hints) {
  const me = P(DATA.me), fl = F(DATA.myFloor);
  return `<header class="top"><p class="brand">AUGUR</p>
    <nav class="crumb" aria-label="Where you are">${crumbs.map((c, i) => (i ? I('chevron-right', 14) : '') + (i === crumbs.length - 1 ? `<b>${c}</b>` : `<span>${c}</span>`)).join('')}</nav>
    <span class="fchip" data-tier="${DATA.myFloor}">${fl.name} · ${fl.word}</span>
    <div class="hints">${hints.map(([k, w, id]) => `<span ${id ? `id="${id}"` : ''}><span class="kbd">${k}</span>${w}</span>`).join('')}</div></header>`;
}
/* raw value (as it came: typewriter) and kept value (as we keep it: set type) */
const raw = v => `<span class="rawv">${v === '' || v == null ? '<i class="emp">empty</i>' : esc(v)}</span>`;
const kept = v => `<span class="keptv">${esc(v)}</span>`;
const arrow = () => `<span class="to" aria-label="becomes">${I('arrow-right', 12)}</span>`;
const pair = (a, b) => `<span class="pair">${raw(a)}${arrow()}${kept(b)}</span>`;
const stepNo = id => `<span class="sno" title="recipe line ${id.slice(1)}">${id.slice(1)}</span>`;
const ROLE_WORD = { title: 'title, not a visit', header: 'column names', blank: 'empty line', total: 'the file’s own total', copy: 'exact copy', aside: 'set aside', stop: 'stopped: needs you', land: 'becomes an inspection' };
const ROLE_ICON = { title: 'heading', header: 'heading', blank: 'minus', total: 'sigma', copy: 'copy', aside: 'archive', stop: 'hand', land: 'check' };

/* the sheet as the file holds it. opts: lines (subset), cell(l, i) -> class, line(l) -> class, roles (show role gutter), cols */
function sheetHTML(res, o = {}) {
  const file = res.file, ncol = Math.max(...file.lines.map(c => c.length));
  const lines = o.lines ? res.lines.filter(l => o.lines.includes(l.n)) : res.lines;
  const head = `<tr class="ch"><th class="rn"></th>${Array.from({ length: ncol }, (_, i) => `<th>${COLS[i]}</th>`).join('')}${o.roles ? '<th class="rg">what it is</th>' : ''}</tr>`;
  const body = lines.map(l => {
    const merged = l.cells.length === 1 && l.cells[0] && ncol > 1;
    const cells = merged ? `<td colspan="${ncol}" class="merged ${o.cell ? o.cell(l, 0) || '' : ''}">${esc(l.cells[0])}</td>`
      : Array.from({ length: ncol }, (_, i) => `<td class="${o.cell ? o.cell(l, i) || '' : ''}">${esc(l.cells[i] || '')}</td>`).join('');
    const rg = o.roles ? `<td class="rg">${l.role ? `${I(ROLE_ICON[l.role], 12)} ${o.roleWord ? o.roleWord(l) : ROLE_WORD[l.role]}` : ''}</td>` : '';
    return `<tr data-n="${l.n}" class="r-${l.role || 'none'} ${o.line ? o.line(l) || '' : ''}"><th class="rn">${l.n}</th>${cells}${rg}</tr>`;
  }).join('');
  return `<table class="sheet ${o.cls || ''}" aria-label="${esc(file.name)}, sheet ${esc(file.sheet)}"><thead>${head}</thead><tbody>${body}</tbody></table>`;
}

/* the recipe as a numbered list of lines */
function recipeHTML(res, o = {}) {
  const steps = o.steps || DATA.recipe.steps;
  return `<ol class="recipe ${o.cls || ''}">${steps.map((st, i) => {
    const w = stepWords(st, res), state = o.state ? o.state(st) : (res ? stepState(st, res) : 'ok');
    return `<li class="rl st-${state} ${o.on === st.id ? 'on' : ''} dep" style="--i:${i}" data-step="${st.id}">
      <span class="rn">${st.id.slice(1)}</span>
      <span class="rw">${w.w}${w.more ? `<span class="rm">, ${w.more}</span>` : ''}${o.examples !== false && w.ex ? `<span class="rex">${pair(w.ex[0], w.ex[1])}</span>` : ''}<span class="tk">${esc(w.tk)}</span></span>
      <span class="rc">${res ? stepCount(st, res) : ''}</span>
      <span class="rs" aria-label="${state}">${state === 'stop' ? I('hand', 14) : state === 'check' ? I('eye', 14) : state === 'todo' ? I('circle-dashed', 14) : I('check', 14)}</span></li>`;
  }).join('')}</ol>`;
}

/* the set-aside tray: every line and value that didn't fit, counted, with why */
function trayHTML(res, o = {}) {
  const p = plate(res);
  const rows = [
    ...p.aside.map(l => ({ n: l.n, what: l.cells.filter(Boolean).slice(0, 3).join(' · '), why: l.why, by: l.by, kind: l.waiting ? 'waiting' : 'line' })),
    ...p.copies.map(l => ({ n: l.n, what: l.cells.filter(Boolean).slice(0, 3).join(' · '), why: l.why, by: l.by, kind: 'copy' })),
    ...p.valuesAside.map(v => ({ n: v.n, what: `${v.van} · odometer ${v.raw}`, why: v.why + '; the rest of the line lands, its odometer marked not known yet', by: 's10', kind: 'value' }))
  ];
  return `<div class="tray ${o.cls || ''}"><p class="eyebrow">${I('archive', 12)} Set aside · ${plural(rows.length, 'thing')}, none lost</p>
    <ul>${rows.map((r, i) => `<li class="dep" style="--i:${i}"><span class="tn">line ${r.n}</span><span class="tw">${esc(r.what)}<small>${r.why}</small></span>${stepNo(r.by)}</li>`).join('')}</ul></div>`;
}

/* keys shared by every variant */
const STATE = { tech: false, gateway: true };
function commonKeys(e, rerender, replay) {
  const k = e.key.toLowerCase();
  if (e.metaKey || e.ctrlKey || e.altKey) return false;
  if (k === 'r') { replay(); return true; }
  if (k === 't') { STATE.tech = !STATE.tech; document.body.classList.toggle('tech', STATE.tech); $('#h-t')?.classList.toggle('on', STATE.tech); return true; }
  if (k === 'g' && $('#h-g')) { STATE.gateway = !STATE.gateway; $('#h-g')?.classList.toggle('on', !STATE.gateway); rerender(); return true; }
  return false;
}
/* timers for the auto demo, cleared on replay */
let TIMERS = [];
const later = (fn, t) => TIMERS.push(setTimeout(fn, reduced ? Math.min(t, 50) : t));
const clearLater = () => { TIMERS.forEach(clearTimeout); TIMERS = []; };
function settle(t) { document.body.classList.add('pre'); if (t) later(() => document.body.classList.remove('pre'), t); else requestAnimationFrame(() => requestAnimationFrame(() => document.body.classList.remove('pre'))); }
