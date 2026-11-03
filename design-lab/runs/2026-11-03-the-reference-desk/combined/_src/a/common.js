/* ======================================================================
   Shared helpers and the one answer engine (prefix a). run() is the only
   place a count is made. The model gateway never reaches it: a guess is
   returned beside the rows (pencil), never inside them.
   ====================================================================== */
const MON = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const MONL = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
const U = {
  esc: s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c])),
  d: s => { const [y, m, d] = s.split('-').map(Number); return { y, m: m - 1, d }; },
  day: s => { const t = U.d(s); return t.d + ' ' + MON[t.m]; },
  dayY: s => { const t = U.d(s); return t.d + ' ' + MONL[t.m] + ' ' + t.y; },
  dayS: s => { const t = U.d(s); return t.d + ' ' + MON[t.m] + ' ' + t.y; },
  I: (n, s) => Icons.svg(n, { size: s || 16, stroke: 1.5 }),
  list: (a, w) => a.length < 2 ? a.join('') : a.slice(0, -1).join(', ') + ' ' + (w || 'and') + ' ' + a[a.length - 1],
  cap: s => s.charAt(0).toUpperCase() + s.slice(1),
  plural: (n, one, many) => n + ' ' + (n === 1 ? one : (many || one + 's')),
  kbd: k => '<span class="kbd">' + k + '</span>',
  wait: ms => new Promise(r => setTimeout(r, ms)),
  /* durations come from motion tokens only */
  ms: v => { const s = getComputedStyle(document.documentElement).getPropertyValue(v).trim(); return U.reduced() ? 0 : (parseFloat(s) || 0); },
  reduced: () => matchMedia('(prefers-reduced-motion: reduce)').matches,
  floor: id => DATA.floors[id],
  fl: id => '<span class="fl" data-tier="' + DATA.floors[id].tier + '">' + U.esc(DATA.floors[id].name) + '</span>',
  person: id => DATA.people[id],
  /* who or what set a step: you, a rule, keys and spelling, the model (pencil) */
  by: (k, extra) => {
    const m = {
      you:   ['user-round-check', 'you chose'],
      rule:  ['list-checks', 'Data Atlas rule'],
      match: ['search-check', 'key, name, spelling'],
      words: ['book-open-text', 'deployment word list'],
      model: ['pencil-line', 'model’s reading'],
      none:  ['ban', 'no model']
    }[k];
    return '<span class="by ' + k + '">' + U.I(m[0], 12) + U.esc(extra || m[1]) + '</span>';
  },
  hydrate: el => { if (window.Icons && Icons.hydrate) Icons.hydrate(el); }
};

/* ---------------------------------------------------------------------
   run(): one rerun of the question.
   o.viewer  person id (whose access)       o.asOf  the day it runs
   o.spring  'mar' | 'apr' | 'loose'        o.scope 'running' | 'all' | 'loose'
   o.gateway model gateway on? (only decides whether a stored meaning-match
             shows as a pencil guess or as "matched nobody, in Triage")
   --------------------------------------------------------------------- */
function run(o) {
  const P = DATA.people[o.viewer], sees = new Set(P.sees);
  const R = { silent: [], heard: [], depends: [], notKnown: [], noRecord: [], dontApply: [], guesses: [], unmatched: [], hiddenOn: [], seen: 0, contacts: 0 };
  const cutOf = id => DATA.words.spring.readings.find(r => r.id === id).date;
  const lo = o.spring === 'loose' ? cutOf('mar') : cutOf(o.spring);
  const hi = o.spring === 'loose' ? cutOf('apr') : lo;
  const L = DATA.lost;
  for (const s of DATA.suppliers) {
    if (!sees.has(s.keptOn)) { if (!R.hiddenOn.includes(s.keptOn)) R.hiddenOn.push(s.keptOn); continue; }
    R.seen++;
    const running = s.contract[0] <= o.asOf && o.asOf <= s.contract[1];
    const cs = s.contacts.filter(c => sees.has(DATA.sources[c.src].floor) && (c.logged || c.on) <= o.asOf);
    R.contacts += cs.length;
    const last = cs.reduce((a, c) => !a || c.on > a.on ? c : a, null);
    const row = { s, last, running };
    if (!running && o.scope === 'running') { R.dontApply.push(row); continue; }
    if (!last) { R.notKnown.push(row); continue; }
    /* a phoning supplier whose calls fall in the lost window: no record, nobody can close it */
    if (s.phones && last.on < lo && L.to >= lo) { R.noRecord.push(row); continue; }
    let g;
    if (last.on >= hi) g = 'heard';
    else if (last.on < lo) g = 'silent';
    else { g = 'depends'; row.on = 'spring'; }
    if (!running && o.scope === 'loose') { if (g === 'heard') { R.dontApply.push(row); continue; } g = 'depends'; row.on = row.on ? 'both' : 'suppliers'; }
    R[g].push(row);
    /* a stored meaning-match: pencil beside the row, never in the count */
    const m = s.meaning;
    if (m && (g === 'silent' || g === 'depends') && sees.has(DATA.sources[m.src].floor) && m.on <= o.asOf) {
      (o.gateway ? R.guesses : R.unmatched).push({ row, m });
      row.pencil = o.gateway ? 'guess' : 'unmatched';
    }
  }
  R.applies = R.seen - R.dontApply.length;
  R.covered = R.silent.length + R.heard.length;
  R.cantSay = R.notKnown.length + R.noRecord.length;
  R.count = R.silent.length;
  R.countHi = R.silent.length + R.depends.length;
  R.splits = { spring: R.depends.filter(r => r.on !== 'suppliers').length, suppliers: R.depends.filter(r => r.on !== 'spring').length, heard: 0, we: 0 };
  R.loose = o.spring === 'loose' || o.scope === 'loose';
  R.cut = lo; R.cutHi = hi;
  return R;
}
/* the answer's sentence, built from its steps by template, never written by a model */
function sentence(o, opts) {
  opts = opts || {};
  const sp = DATA.words.spring.readings, su = DATA.words.suppliers.readings;
  const blank = (txt, cls, title) => '<span class="b ' + (cls || '') + '"' + (title ? ' title="' + U.esc(title) + '"' : '') + '>' + txt + '</span>';
  const scope = o.scope === 'loose' ? blank('<i>any, or only with a contract running?</i>', 'loose', 'kept loose: both readings shown')
    : blank(o.scope === 'running' ? 'with a contract running on the day' : 'of any kind, running or ended', 'you');
  const heard = o.gateway === false && opts.route === 'off'
    ? blank(DATA.words.contact.listed, 'you', 'you ticked these from the deployment’s word list')
    : blank(DATA.words.contact.listed, 'model', 'the model’s reading, ' + (opts.agreed || 'agreed by you') + '. The dashes stay.') + (opts.initials ? '<span class="ini" title="agreed by ' + U.esc(opts.agreedName || '') + '">' + opts.initials + '</span>' : '');
  const spring = o.spring === 'loose' ? blank('spring <i>(1 March or 1 April)</i>', 'loose', 'kept loose: both readings shown')
    : blank(U.dayY(sp.find(r => r.id === o.spring).date), 'you');
  return 'Suppliers ' + scope + ' whose last ' + heard + ' was before ' + spring;
}
