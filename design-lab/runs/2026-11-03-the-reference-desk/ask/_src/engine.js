/* ---- The ask: shared engine (inlined into every variant at build) ----
   A question is four loose words, each set by a choice:
     kind  "suppliers"   all | live | since
     who   "we"          here | mine | all
     via   "heard from"  a set of contact kinds
     since "since spring" a date
   Everything counted here is counted from the record, never by a model. */
const Q = (() => {
  const D = DATA;
  const MON = ['January','February','March','April','May','June','July','August','September','October','November','December'];
  const year = +D.today.slice(0, 4);
  const day = (md) => `${year}-${md}`;
  const fmt = (iso, short) => { if (!iso) return ''; const [y, m, d] = iso.split('-').map(Number); return short ? `${d} ${MON[m - 1].slice(0, 3)}` : `${d} ${MON[m - 1]} ${y}`; };
  const esc = (s) => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const C = Object.fromEntries(D.contacts.map(c => [c.id, c]));
  const S = D.suppliers.map(([name, floor, contract, contacts], i) => ({ id: 's' + i, name, floor, contract, contacts }));
  const myTeam = (f) => f.startsWith('team:') && D.me.teams.includes(f.slice(5));
  const unseen = (s) => s.floor.startsWith('team:') && !myTeam(s.floor);
  const floorName = (s) => s.floor === 'here' ? D.floor.name : s.floor === 'org' ? 'the Org' : s.floor.slice(5);
  const floorTier = (s) => s.floor === 'here' ? 'department' : s.floor === 'org' ? 'org' : 'team';

  /* the choices for each loose word; order is the record's order (by date, by size), never a ranking */
  const spring = D.calendar.seasons.spring;
  const named = D.named.find(n => n.word === 'spring');
  const WORDS = {
    since: {
      word: 'since spring', ask: 'When you say spring, which day should it start from?',
      why: 'Spring can start on different days. These are the ones this deployment knows, in date order.',
      opts: [
        { id: day(spring[0]), label: fmt(day(spring[0])), sub: 'spring, by the calendar', via: 'rule' },
        { id: day(D.calendar.fyStart), label: fmt(day(D.calendar.fyStart)), sub: `start of the ${D.calendar.fyName}`, via: 'rule' },
        { id: named.date, label: fmt(named.date), sub: `${named.label}, found by name in ${named.where.split(' · ')[0]}`, via: 'record' }
      ]
    },
    via: {
      word: 'heard from', ask: 'What counts as hearing from a supplier?', multi: true,
      why: 'Every dated thing in the record that names a supplier. Tick any; none is ticked for you.',
      opts: D.contacts.map(c => ({ id: c.id, label: c.label[0].toUpperCase() + c.label.slice(1), sub: c.src, via: 'record', far: !!c.far }))
    },
    kind: {
      word: 'suppliers', ask: 'Which suppliers should be in it?',
      why: '"Suppliers" matched the kind Supplier by name. These are the ways the record can narrow it.',
      opts: [
        { id: 'all', label: 'Every supplier on record', via: 'record' },
        { id: 'live', label: 'With a contract live today', via: 'record' },
        { id: 'since', label: 'With a contract live at any time since then', via: 'record' }
      ]
    },
    who: {
      word: 'we', ask: 'Who is “we”?',
      why: `The floors you can see from ${D.floor.name}, smallest first.`,
      opts: [
        { id: 'here', label: D.floor.name, sub: 'this floor', via: 'record' },
        { id: 'mine', label: `${D.floor.name} and ${D.me.teams.join(', ')}`, sub: 'and the teams you are on', via: 'record' },
        { id: 'all', label: 'Everything you can see', sub: 'including what the Org keeps', via: 'record' }
      ]
    }
  };
  const ORDER = ['since', 'via', 'kind', 'who'];
  /* the model's reading, shown as a guess until the person says yes */
  const GUESS = { via: { ids: ['invoice', 'delivery', 'letter'], text: 'they sent you something: an invoice, a delivery note or a letter' } };

  function inScope(s, who) {
    if (unseen(s)) return false;
    if (who === 'here') return s.floor === 'here';
    if (who === 'mine') return s.floor === 'here' || myTeam(s.floor);
    return true;
  }
  function kindOk(s, kind, since) {
    if (!kind || kind === 'all') return true;
    if (s.contract === 'live') return true;
    if (kind === 'since' && s.contract.startsWith('ended:')) return s.contract.slice(6) >= since;
    return false;
  }
  const last = (s, via) => s.contacts.filter(([k]) => !via || via.has(k)).map(([, d]) => d).sort().pop() || null;
  /* defaults stand in for a loose word only to COUNT; the sentence still shows it loose */
  function full(c) {
    return { since: c.since || WORDS.since.opts[0].id, via: c.via && c.via.size ? c.via : new Set(D.contacts.map(x => x.id)), kind: c.kind || 'all', who: c.who || 'all' };
  }
  function run(c) {
    const f = full(c);
    const pool = S.filter(s => inScope(s, f.who) && kindOk(s, f.kind, f.since));
    const rows = pool.map(s => ({ s, last: last(s, f.via), any: last(s, null) }));
    const quiet = rows.filter(r => !r.last || r.last < f.since).sort((a, b) => (a.last || '') < (b.last || '') ? -1 : 1);
    return {
      pool: pool.length, quiet, heard: rows.length - quiet.length,
      never: quiet.filter(r => !r.any), unseen: S.some(s => unseen(s) && (f.who === 'all')),
      unseenAsk: D.elsewhere.map(e => `${e.name} (ask ${e.ask})`).join(', ')
    };
  }
  const count = (c) => run(c).quiet.length;
  /* what picking this option would leave, before you pick it (consequence preview) */
  function countIf(c, word, id) {
    const n = Object.assign({}, c);
    if (word === 'via') { const v = new Set(c.via || []); v.has(id) ? v.delete(id) : v.add(id); n.via = v; } else n[word] = id;
    return count(n);
  }
  const isSet = (c, w) => w === 'via' ? !!(c.via && c.via.size) : !!c[w];

  const join = (a, w) => a.length < 2 ? a.join('') : a.slice(0, -1).join(', ') + ' ' + (w || 'or') + ' ' + a[a.length - 1];
  /* each loose word as words in the sharp sentence */
  function phrase(c, w) {
    if (w === 'kind') return c.kind === 'live' ? 'Suppliers with a contract live today' : c.kind === 'since' ? 'Suppliers with a contract live since then' : 'Every supplier';
    if (w === 'who') return c.who === 'here' ? `kept on ${D.floor.name}` : c.who === 'mine' ? `on ${D.floor.name} or ${D.me.teams.join(', ')}` : 'that you can see';
    if (w === 'via') return 'no ' + join([...c.via].map(id => C[id].word), 'or');
    if (w === 'since') return 'since ' + fmt(c.since);
    return '';
  }
  /* the sentence as segments: loose words stay in the person's own words until set */
  function segments(c, guess) {
    const slot = (w) => {
      if (isSet(c, w)) return { slot: w, state: 'set', text: phrase(c, w) };
      if (guess && guess[w]) return { slot: w, state: 'guess', text: phrase(Object.assign({}, c, { [w]: new Set(GUESS[w].ids) }), w) };
      return { slot: w, state: 'loose', text: w === 'kind' ? 'Suppliers' : WORDS[w].word };
    };
    const via = slot('via'), who = slot('who'), kind = slot('kind');
    const wl = who.state === 'loose', vl = via.state === 'loose';
    const g = [kind];
    if (!wl) g.push({ text: ' ' }, who);
    if (!vl) g.push({ text: ' with ' }, via);
    else if (wl) g.push({ text: ' ' }, who, { text: ' have not ' }, via);
    else g.push({ text: ', not ' }, via);
    g.push({ text: ' ' }, slot('since'));
    if (wl && !vl) g.push({ text: ' (' }, Object.assign(who, { text: '“we”: whose?' }), { text: ')' });
    g.push({ text: '.' });
    return g;
  }
  function sentenceHtml(c, guess, cls) {
    return segments(c, guess).map(g => g.slot ? `<span class="${cls || 'ph'} ${g.state}" data-w="${g.slot}">${esc(g.text)}</span>` : esc(g.text)).join('');
  }
  /* the register one step down (T) */
  function tech(c) {
    const f = full(c);
    const fl = { here: '{regional-services}', mine: '{regional-services, north-waters}', all: 'visible(me)' }[f.who];
    const k = { all: '', live: ' ∧ contract.state = live', since: ` ∧ contract.live_during([${f.since}, today])` }[f.kind];
    return `atlas:Supplier ∣ floor ∈ ${fl}${k} ∧ max(contact.date ∣ kind ∈ {${[...f.via].join(', ')}}) < ${f.since}`;
  }
  return { D, WORDS, ORDER, GUESS, S, run, count, countIf, isSet, phrase, segments, sentenceHtml, tech, fmt, esc, floorName, floorTier, C, unseen };
})();

/* ---- tokens as time: JS reads its pauses from the motion tokens, never a magic number ---- */
const Tok = {
  ms(name) { const v = getComputedStyle(document.documentElement).getPropertyValue(name).trim(); return parseFloat(v) * (v.endsWith('ms') ? 1 : 1000) || 0; },
  reduced: () => matchMedia('(prefers-reduced-motion: reduce)').matches
};
/* a replayable auto-demo: steps = [[delayFromPrevious, fn], ...] */
const Demo = (() => {
  let timers = [];
  return {
    play(steps) { this.stop(); let t = 0; steps.forEach(([d, fn]) => { t += d; timers.push(setTimeout(fn, t)); }); },
    stop() { timers.forEach(clearTimeout); timers = []; }
  };
})();
/* type text into an element, a few letters a beat (quick, never looping) */
function typeInto(el, text, total, done) {
  if (Tok.reduced()) { el.value !== undefined ? el.value = text : el.textContent = text; done && done(); return; }
  const step = Math.max(1, Math.round(text.length / 12)); let i = 0;
  const beat = total / Math.ceil(text.length / step);
  (function tick() { i = Math.min(text.length, i + step); const v = text.slice(0, i); el.value !== undefined ? el.value = v : el.textContent = v; if (i < text.length) setTimeout(tick, beat); else done && done(); })();
}

/* ---- shared chrome: Data Atlas rail, the gateway line, the keys ---- */
const Shell = {
  ic: (n, s) => Icons.svg(n, { size: s || 14, stroke: 1.5 }),
  rail(extra) {
    const D = Q.D;
    return `<nav class="rail" aria-label="${Q.esc(D.app)}">
      <p class="brand">${Q.esc(D.app)}</p>
      <a class="nav on" href="#">${Shell.ic('book-open-text')}Front page</a>
      <a class="nav" href="#">${Shell.ic('list-tree')}Kinds of thing<span class="n mono">${D.kinds.length}</span></a>
      <a class="nav" href="#">${Shell.ic('inbox')}Triage<span class="n mono">4</span></a>
      <a class="nav" href="#">${Shell.ic('bookmark')}Saved questions<span class="n mono">${D.saved.length}</span></a>
      ${extra || ''}
      <div class="foot"><span class="fl"></span>On <b>${Q.esc(D.floor.name)}</b><br>a Department floor</div>
    </nav>`;
  },
  /* which steps used the model gateway: always said, and G shows the page without it */
  gatewayLine(on) {
    const g = Q.D.gateway;
    return on
      ? `<span class="gw on">${Shell.ic('cpu', 13)}Model gateway on · ${g.used} of ${g.limit} calls today</span>`
      : `<span class="gw off">${Shell.ic('cpu', 13)}Model gateway off · turned on by an admin (${Q.esc(g.admin)}) · everything below works without it</span>`;
  },
  via(kind, text) {
    const m = { record: ['database', 'from the record'], rule: ['spell-check', 'by name and spelling'], model: ['cpu', 'model gateway'], you: ['user-round', 'you said'] }[kind];
    return `<span class="via v-${kind}" title="${m[1]}">${Shell.ic(m[0], 11)}${Q.esc(text || m[1])}</span>`;
  },
  keys(list) {
    return `<div class="keys" aria-label="Keyboard">${list.map(([k, t]) => `<span><span class="kbd">${k}</span>${t}</span>`).join('')}</div>`;
  },
  /* the six ways to be empty, as used on this surface */
  never: () => `<span class="mk mk-gap mk-sm" aria-hidden="true"></span>`,
  unseen: (t) => `<span class="unseen">${Shell.ic('lock', 11)}${Q.esc(t)}</span>`,
  brk: () => `<svg class="mk mk-break" viewBox="0 0 28 12" aria-hidden="true"><path d="M1 6 Q4.5 1 8 6 T15 6 T22 6 T27 6"/></svg>`
};
/* the front page behind the box: contents of this floor, quiet */
function contentsHtml() {
  const D = Q.D;
  return `<div class="contents" aria-label="Contents">${D.kinds.map(k => `<span>${Q.esc(k.many[0].toUpperCase() + k.many.slice(1))}<b class="mono">${k.n}</b></span>`).join('')}</div>`;
}
