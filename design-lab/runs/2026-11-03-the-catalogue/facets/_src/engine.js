/* ---- Facet engine, shared by every variant (inlined at build) ----
   Choices: sel = {facetId: Set(valueIds)}. OR inside a facet, AND across facets.
   Every value reads as one of: a value id, GAP (expected but not recorded) or NA (this kind has no such detail). */
const F = (() => {
  const GAP = '_gap', NA = '_na';
  const KIND = Object.fromEntries(DATA.kinds.map(k => [k.id, k]));
  const FACET = Object.fromEntries(DATA.facets.map(f => [f.id, f]));
  FACET.kind.values = DATA.kinds.map(k => ({ id: k.id, label: k.many[0].toUpperCase() + k.many.slice(1) }));
  const recs = DATA.records.map(a => ({ id: a[0], name: a[1], kind: a[2], service: a[3], state: a[4], region: a[5], date: a[6], reach: a[7], triage: a[8], intents: a[9], docs: a[10], missing: a[11] }));
  const Y = DATA.year;
  function bucket(d) { const y = +d.slice(0, 4); return y < Y ? 'before' : y === Y ? 'this' : y === Y + 1 ? 'next' : 'later'; }
  function val(r, fid) {
    if (fid === 'when') { if (!KIND[r.kind].date) return NA; return r.date ? bucket(r.date) : GAP; }
    const v = r[fid]; return v == null ? GAP : v;
  }
  const visible = r => !r.reach && !r.triage;
  function matches(r, sel, skip) {
    for (const fid in sel) { if (fid === skip) continue; const s = sel[fid]; if (!s || !s.size) continue; if (!s.has(val(r, fid))) return false; }
    return true;
  }
  const results = (sel, pool) => (pool || recs).filter(r => visible(r) && matches(r, sel));
  function counts(fid, sel) {
    const c = {}; FACET[fid].values.forEach(v => c[v.id] = 0); c[GAP] = 0; c[NA] = 0;
    recs.forEach(r => { if (visible(r) && matches(r, sel, fid)) c[val(r, fid)]++; });
    return c;
  }
  function clone(sel) { const o = {}; for (const k in sel) o[k] = new Set(sel[k]); return o; }
  function pick(sel, fid, vid, mode) { const o = clone(sel); if (mode === 'only') o[fid] = new Set([vid]); else { o[fid] = o[fid] || new Set(); o[fid].has(vid) ? o[fid].delete(vid) : o[fid].add(vid); } return o; }
  /* what picking this value would leave, before you pick it */
  const leaves = (sel, fid, vid, mode) => results(pick(sel, fid, vid, mode || 'add')).length;
  const size = sel => Object.values(sel).reduce((n, s) => n + (s ? s.size : 0), 0);
  function label(fid, vid) {
    if (vid === GAP) return 'Not recorded';
    if (vid === NA) return 'Does not apply';
    const v = FACET[fid].values.find(x => x.id === vid); return v ? v.label : vid;
  }
  function kindsIn(list) { const s = new Set(list.map(r => r.kind)); return DATA.kinds.filter(k => s.has(k.id)); }
  function things(sel, n) {
    const ks = sel.kind && sel.kind.size ? [...sel.kind].map(k => KIND[k]) : null;
    if (ks && ks.length === 1) return n === 1 ? ks[0].one : ks[0].many;
    if (ks) return ks.map(k => k.many).join(' or ');
    return n === 1 ? 'thing' : 'things';
  }
  const join = (a, w) => a.length < 2 ? a.join('') : a.slice(0, -1).join(', ') + ' ' + (w || 'or') + ' ' + a[a.length - 1];
  /* a facet choice as words in a sentence */
  function phrase(sel, fid) {
    const s = sel[fid]; if (!s || !s.size) return '';
    const ls = [...s].map(v => label(fid, v));
    if (fid === 'service') return 'about ' + join(ls.map(x => x.toLowerCase()));
    if (fid === 'state') return 'that are ' + join(ls.map(x => x.toLowerCase()));
    if (fid === 'region') return s.has(GAP) && s.size === 1 ? 'with no place recorded' : 'in the ' + join(ls);
    if (fid === 'when') {
      const ks = sel.kind && sel.kind.size === 1 ? KIND[[...sel.kind][0]] : null;
      const w = join(ls.map(x => x.toLowerCase()));
      return ks && ks.verb ? 'that ' + ks.verb + ' ' + w : 'with a key date ' + w;
    }
    return '';
  }
  function describe(sel) {
    const n = results(sel).length;
    const parts = ['service', 'region', 'state', 'when'].map(f => phrase(sel, f)).filter(Boolean);
    return { n, text: [things(sel, n)].concat(parts).join(' ') };
  }
  /* Why is this empty? Every zero gets a reason, never a blank. */
  function why(sel, fid, vid) {
    const base = recs.filter(r => visible(r) && matches(r, sel, fid));
    const app = base.filter(r => val(r, fid) !== NA);
    const want = pick(sel, fid, vid, 'only');
    const reach = recs.filter(r => r.reach && !r.triage && matches(r, want));
    const tri = recs.filter(r => r.triage && matches(r, want));
    const out = [];
    const T = things(sel, 2);
    if (!base.length) out.push({ type: 'before', icon: 'list-filter', head: 'Your other choices leave nothing', text: 'Nothing is left before this choice. Undo a choice to see more.' });
    else if (!app.length) {
      const has = DATA.kinds.filter(k => fid !== 'when' || k.date).map(k => k.many);
      out.push({ type: 'na', icon: 'ban', head: 'Does not apply', text: cap(T) + ' have no ' + (FACET[fid].plain.toLowerCase()) + ' detail here. Only ' + join(has, 'and') + ' do.' });
    }
    const gaps = app.filter(r => val(r, fid) === GAP);
    if (reach.length) {
      const by = {}; reach.forEach(r => (by[r.reach] = by[r.reach] || []).push(r));
      Object.keys(by).forEach(k => { const fl = DATA.elsewhere[k]; out.push({ type: 'reach', icon: 'lock', head: by[k].length + ' kept on ' + fl.name, text: 'A ' + fl.type + ' floor below yours: you can’t open ' + (by[k].length === 1 ? 'it' : 'them') + ' from here. Ask ' + fl.ask + '.', n: by[k].length }); });
    }
    if (tri.length) out.push({ type: 'triage', icon: 'inbox', head: tri.length + ' waiting in Triage', text: 'Proposed by a source, not accepted yet. ' + (tri.length === 1 ? 'It counts' : 'They count') + ' once someone accepts ' + (tri.length === 1 ? 'it' : 'them') + '.', n: tri.length });
    if (gaps.length) { const ks = kindsIn(gaps); out.push({ type: 'gap', icon: 'circle-dashed', head: gaps.length + ' with no ' + FACET[fid].plain.toLowerCase() + ' recorded', text: 'Any of them could be ' + label(fid, vid).toLowerCase() + '. ' + join(ks.map(k => k.keeper), 'or') + ' can fill ' + (gaps.length === 1 ? 'it' : 'them') + ' in.', n: gaps.length }); }
    if (base.length && app.length) {
      const c = counts(fid, sel); const near = FACET[fid].values.filter(v => v.id !== vid && c[v.id]).map(v => label(fid, v.id).toLowerCase() + ' ' + c[v.id]);
      out.unshift({ type: 'none', icon: 'search-x', head: 'None, checked ' + app.length + ' ' + things(sel, app.length), text: 'No ' + T + ' are ' + label(fid, vid).toLowerCase() + '.' + (near.length ? ' Nearest: ' + near.slice(0, 3).join(', ') + '.' : '') });
    }
    return out;
  }
  /* the whole result is empty: which single choice to undo gives most back */
  function recover(sel) {
    let best = null;
    for (const fid in sel) for (const vid of sel[fid] || []) {
      const s = pick(sel, fid, vid, 'add'); const n = results(s).length;
      if (!best || n > best.n) best = { fid, vid, n };
    }
    return best;
  }
  const cap = s => s ? s[0].toUpperCase() + s.slice(1) : s;
  const css = getComputedStyle(document.documentElement);
  const ms = name => parseFloat(css.getPropertyValue(name)) || 0;
  const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const wait = t => new Promise(r => setTimeout(r, reduced ? 1 : t));
  const esc = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  function fmtDate(r) { const k = KIND[r.kind]; if (!k.date) return ''; if (!r.date) return null; const [y, m] = r.date.split('-'); return k.date + ' ' + ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'][+m - 1] + ' ' + y; }
  /* one result row: kind, name, where, key date; gaps drawn as gaps */
  function row(r) {
    const k = KIND[r.kind]; const d = fmtDate(r);
    const reg = r.region ? label('region', r.region) : null;
    return '<li class="res"><span class="ki">' + Icons.svg(k.icon, { size: 16 }) + '</span><span class="nm">' + esc(r.name) + '<small>' + k.one + ' · ' + label('service', r.service).toLowerCase() + '</small></span>' +
      (reg ? '<span class="rg">' + reg + '</span>' : '<span class="rg gapv" title="Where is not recorded. ' + k.keeper + ' can fill it.">where?</span>') +
      (d === '' ? '<span class="dt na">no key date</span>' : d ? '<span class="dt">' + d + '</span>' : '<span class="dt gapv" title="' + k.date + ' is not recorded. ' + k.keeper + ' can fill it.">' + k.date + '?</span>') +
      (r.missing.length ? '<span class="ms" title="Missing: ' + r.missing.join(', ') + '">' + r.missing.length + ' gap' + (r.missing.length > 1 ? 's' : '') + '</span>' : '<span class="ms ok"></span>') + '</li>';
  }
  function reasons(list) {
    return list.map(x => '<div class="why w-' + x.type + '"><span class="wi">' + Icons.svg(x.icon, { size: 16 }) + '</span><div><b>' + esc(x.head) + '</b><span>' + esc(x.text) + '</span></div></div>').join('');
  }
  const elsewhereTotal = () => recs.filter(r => r.reach).length;
  const triageTotal = () => recs.filter(r => r.triage).length;
  return { GAP, NA, KIND, FACET, recs, val, visible, matches, results, counts, pick, leaves, size, label, things, describe, phrase, why, recover, ms, reduced, wait, esc, row, reasons, cap, join, fmtDate, clone, elsewhereTotal, triageTotal };
})();

/* the app frame shared by every variant: Data Atlas on a Department floor */
function frame(active) {
  const nav = [['compass', 'What we keep', 0], ['list-filter', 'Find', 1], ['inbox', 'Triage', 0, F.triageTotal()], ['pencil-line', 'Studio', 0, null, true]];
  return '<nav class="rail" aria-label="Data Atlas"><div class="an">' + DATA.app + '</div>' +
    nav.map(n => '<a class="nav' + (n[2] ? ' on' : '') + (n[4] ? ' off' : '') + '" href="#" ' + (n[4] ? 'aria-disabled="true" title="Admins change the kinds of thing here. Ask your floor admin."' : '') + '>' + Icons.svg(n[0], { size: 16 }) + '<span>' + n[1] + '</span>' + (n[3] != null ? '<span class="n">' + n[3] + '</span>' : '') + (n[4] ? '<span class="n">' + Icons.svg('lock', { size: 12 }) + '</span>' : '') + '</a>').join('') +
    '<div class="foot"><span class="fl"></span><b>' + DATA.floor.name + '</b><br>' + DATA.floor.short + ' floor. You see what is kept here and above. ' + F.elsewhereTotal() + ' things kept on floors below are counted, not shown.</div></nav>';
}
function keys(list) { return '<div class="keys" aria-hidden="true">' + list.map(k => '<span><span class="kbd">' + k[0] + '</span> ' + k[1] + '</span>').join('') + '</div>'; }
