/* ======================================================================
   Sample data for one deployment (Vale Regional Services). Every name,
   word, count, grade and sentence on the page comes from here. In AUGUR
   it would come from Data Atlas (entities, details, observations with
   NATO-style grades, facts, floors), Artifacts (the briefing and its
   source documents) and Mandate (the intent the briefing feeds).
   The confidence WORD is never stored: derive() works it out from the
   grades and agreement with one fixed rule, the same for every reader.
   ====================================================================== */
const DATA = {
  org: 'Vale Regional Services',
  app: 'Artifacts',
  library: 'Facilities briefings',
  today: '3 Nov 2026',
  viewer: { name: 'Sam Okafor', role: 'Operator', floor: 'Facilities', tier: 'department', word: 'Department floor' },
  reader: { name: 'Jo Reyes', role: 'Head of Facilities' },
  briefing: {
    title: 'North waste round: renew Calder Waste?',
    status: 'Draft',
    question: 'Should we renew the North round contract with Calder Waste when it ends?',
    intent: { id: 'INT-208', title: 'Decide on the North waste contract', owner: 'Jo Reyes', due: '15 Dec 2026', kind: 'Renew or end a contract',
      /* the standard of proof this kind of decision asks for (set per decision kind in Mandate) */
      standard: 1 }
  },

  /* The yardstick: five rungs, a fixed rule each. Plain word on top, the rule beside it,
     the technical rule one step down (T). Words are fixed org-wide so every reader learns them once. */
  yardstick: [
    { id: 'ac', word: 'Almost certain', say: 'almost certain', rule: 'Two or more sources agree, one of them a source we usually trust. None disagree.', tech: '≥2 independent · best strong · 0 against', phia: '95–100%' },
    { id: 'vl', word: 'Very likely',    say: 'very likely',    rule: 'One source we usually trust, or two fair ones that agree. None disagree.', tech: '1 strong, or ≥2 with best fair · 0 against', phia: '80–90%' },
    { id: 'l',  word: 'Likely',         say: 'likely',         rule: 'One fair source, or two weak ones that agree.', tech: '1 fair, or ≥2 weak · 0 against', phia: '55–75%' },
    { id: 'p',  word: 'Possible',       say: 'possible',       rule: 'One weak or ungraded source, and nothing yet to check it against.', tech: '1 weak or ungraded · 0 for, 0 against', phia: '40–50%' },
    { id: 'u',  word: 'Unlikely',       say: 'unlikely',       rule: 'Better sources say otherwise: at least twice the weight against it.', tech: 'weight against ≥ 2 × weight for', phia: '10–35%' }
  ],
  /* Not on the yardstick: nothing to weigh, or nothing settled. Each says what would move it. */
  outside: {
    dispute: { word: 'Sources disagree', rule: 'Sources of about the same weight give different answers. Nobody has decided which is right.', tech: 'weight ratio < 2 · conflicting observations · no fact', icon: 'split' },
    gap:     { word: 'Not known yet',    rule: 'We expect this detail and nobody has said. There is nothing to weigh, so no word.', tech: 'expected detail · 0 observations · sh:minCount 1 not met', icon: 'square-dashed' },
    stale:   { word: 'Out of date',      rule: 'It was known, but is older than its review age. Its old word is kept in the past tense.', tech: 'fact older than review age · word not carried forward', icon: 'hourglass' },
    hidden:  { word: 'Not yours to see', rule: 'It exists on a floor you can’t open. No word, because you can’t weigh it.', tech: '403 · restricted on another floor', icon: 'lock' }
  },

  /* NATO-style grades (the Admiralty code), in plain words. */
  grades: {
    rel: { A: 'always reliable', B: 'usually reliable', C: 'fairly reliable', D: 'not usually reliable', E: 'unreliable', F: 'reliability can’t be judged' },
    cred: { 1: 'confirmed elsewhere', 2: 'probably true', 3: 'possibly true', 4: 'doubtful', 5: 'improbable', 6: 'truth can’t be judged' },
    strength: { strong: 'a source we usually trust', fair: 'a fair source', weak: 'a weak source' }
  },

  sources: {
    s1: { name: 'Contract CN-0412', kind: 'document', icon: 'file-text', where: 'Artifacts · Contracts', by: 'Procurement', date: '2 Apr 2024', grade: 'A1' },
    s2: { name: 'Procurement register', kind: 'record', icon: 'database', where: 'Data Atlas · Org floor', by: 'Procurement', date: '1 Nov 2026', grade: 'A2' },
    s3: { name: 'Depot missed-collection log', kind: 'record', icon: 'database', where: 'Depot operations · Team floor', by: 'Marta Kowal', date: '31 Oct 2026', grade: 'B3', note: 'August has 6 days missing' },
    s4: { name: 'Residents’ complaints export', kind: 'record', icon: 'database', where: 'Customer services', by: 'Customer services', date: '1 Nov 2026', grade: 'C3' },
    s5: { name: 'Calder quarterly report, Q3', kind: 'document', icon: 'file-text', where: 'Artifacts · Supplier reports', by: 'Calder Waste', date: '14 Oct 2026', grade: 'C3', note: 'written by the supplier' },
    s6: { name: 'Phone note, Calder account manager', kind: 'person', icon: 'user-round', where: 'Noted by Sam Okafor', by: 'Dan Reid, Calder Waste', date: '28 Oct 2026', grade: null },
    s8: { name: 'Insurance certificate', kind: 'document', icon: 'file-text', where: 'Artifacts · Contracts', by: 'Calder Waste', date: '12 Aug 2024', grade: 'A1' },
    s10: { name: 'Site count, North depot', kind: 'person', icon: 'user-round', where: 'Marta Kowal, depot lead', by: 'Marta Kowal', date: '30 Oct 2026', grade: 'B2' },
    s11: { name: 'Phone note, Calder account manager', kind: 'person', icon: 'user-round', where: 'Noted by Sam Okafor', by: 'Dan Reid, Calder Waste', date: '9 Sep 2026', grade: null },
    s9: { name: 'Contract schedule 3, vehicles', kind: 'document', icon: 'file-text', where: 'Artifacts · Contracts', by: 'Procurement', date: '2 Apr 2024', grade: 'B2' }
  },

  /* Missed collections a month on the North round (from s3). */
  months: ['Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct'],
  missed: [12, 15, 14, 26, 33, 31, 34],

  /* The briefing's claims, in reading order. Sides hold what each group of sources says. */
  claims: [
    { id: 'c1', short: 'Contract end', about: 'Contract CN-0412', detail: 'End date',
      sides: [{ value: '31 March 2027', sources: ['s1', 's2'] }],
      say: 'The contract ends on <b>31 March 2027</b>; notice to end it is due by <b>31 December</b>.' },
    { id: 'c2', short: 'Missed collections', about: 'North round', detail: 'Missed collections a month', spark: true,
      sides: [{ value: 'up from 14 to 31 a month', sources: ['s3', 's4'] }],
      say: 'Missed collections rose from <b>14 a month</b> (Apr–Jun) to <b>31 a month</b> since July.' },
    { id: 'c5', short: 'Road closures', about: 'Calder Waste', detail: 'Cause of missed collections',
      sides: [{ value: 'most were road closures', sources: ['s5'] }, { value: '4 of 124 were road closures', sources: ['s3', 's4'] }],
      say: 'Calder says most missed collections were caused by <b>road closures</b>.',
      against: 'The depot log and complaints show <b>4 of 124</b>.' },
    { id: 'c10', short: 'Tuesday round', about: 'North round', detail: 'Where complaints come from',
      sides: [{ value: 'mostly the Tuesday round', sources: ['s4'] }],
      say: 'Complaints come mostly from the <b>Tuesday round</b> (Ashby and Low Moor).' },
    { id: 'c3', short: 'New vehicles', about: 'Calder Waste', detail: 'Fleet changes planned',
      sides: [{ value: 'two new vehicles in January', sources: ['s6'] }],
      say: 'Calder will add <b>two new vehicles</b> to the round in January.' },
    { id: 'c9', short: 'Other bidders', about: 'Waste framework', detail: 'Suppliers able to bid',
      sides: [{ value: 'two other suppliers', sources: ['s2'] }],
      say: '<b>Two other suppliers</b> on the waste framework could bid for the round.' },
    { id: 'c4', short: 'Fleet size', about: 'North round', detail: 'Vehicles on the round',
      sides: [{ value: '9 vehicles', sources: ['s9'] }, { value: '7 vehicles', sources: ['s3'] }],
      say: 'The round runs on <b>{v}</b>.', decides: 'Jo Reyes, Head of Facilities' },
    { id: 'c6', short: 'Depot audit', about: 'Calder North depot', detail: 'Last health and safety audit', gap: true,
      shape: 'a date', who: 'Ola Mensah, contracts officer', how: 'ask Calder for its last audit report',
      say: 'The last health and safety audit of Calder’s North depot was on <span class="slot">a date</span>.' },
    { id: 'c8', short: 'Insurance', about: 'Calder Waste', detail: 'Public liability insurance',
      sides: [{ value: '£10m cover, until 12 Aug 2025', sources: ['s8'] }], stale: { asOf: '12 Aug 2024', review: '12 months', who: 'Ola Mensah, contracts officer' },
      say: 'Calder holds <b>£10m</b> public liability cover.' },
    { id: 'c7', short: 'Cost per lift', about: 'Contract CN-0412', detail: 'Cost per lift', hidden: true,
      floor: 'Finance', ask: 'Priya Nair, finance lead',
      say: 'Each lift costs us <span class="unseen-v">a sum</span>.' }
  ],

  /* What a model may draft for each key judgement: the prose after the word. Never the word itself. */
  drafts: {
    c1: 'the contract ends on 31 March 2027, so a decision to leave must be sent by 31 December.',
    c2: 'service on the North round got worse in July and has stayed worse: missed collections have more than doubled.',
    c9: 'we would have a choice if we went out to tender: two other framework suppliers could bid.',
    c10: 'the trouble is concentrated on the Tuesday round through Ashby and Low Moor.',
    c3: 'Calder will put two new vehicles on the round in January.',
    c5: 'road closures explain the drop in service, as Calder says.'
  },
  /* One detail's history, for watching a claim change kind (V6). Sources here join the list above. */
  story: {
    about: 'North round', detail: 'Vehicles on the round', review: '12 months',
    say: 'The round runs on {v}.',
    steps: [
      { date: '2 Sep 2026', what: 'The detail is expected for every round. Nobody has said.', sides: [], who: 'Marta Kowal, depot lead' },
      { date: '9 Sep 2026', what: 'Dan Reid (Calder) says 9 on the phone. Nobody graded the note.', sides: [{ value: '9 vehicles', sources: ['s11'] }] },
      { date: '16 Sep 2026', what: 'Contract schedule 3 also says 9.', sides: [{ value: '9 vehicles', sources: ['s11', 's9'] }] },
      { date: '31 Oct 2026', what: 'The depot log and a site count both say 7.', sides: [{ value: '9 vehicles', sources: ['s11', 's9'] }, { value: '7 vehicles', sources: ['s3', 's10'] }], decides: 'Jo Reyes, Head of Facilities' },
      { date: '6 Nov 2026', what: 'Jo Reyes decides 7: the schedule dates from 2024, and two vehicles left the round in May.', sides: [{ value: '7 vehicles', sources: ['s3', 's10'] }], set: { value: '9 vehicles', sources: ['s11', 's9'], why: 'kept, set aside by Jo Reyes: out of date since May' } },
      { date: '6 Nov 2027', what: 'A year on, nobody has checked again.', sides: [{ value: '7 vehicles', sources: ['s3', 's10'] }], stale: { asOf: '6 Nov 2026', review: '12 months', who: 'Marta Kowal, depot lead' } }
    ]
  },
  /* What a model may write: the bottom line, in pencil, citing claims. Never a confidence word. */
  pencil: {
    by: 'Drafted by the assistant',
    text: [
      ['Service on the North round has got worse since July, ', ['c2']],
      ['and Calder’s explanation doesn’t hold. ', ['c5']],
      ['Notice is due by 31 December; ', ['c1']],
      ['before renewing, settle the fleet size and get the depot audit.', ['c4', 'c6']]
    ]
  }
};

/* ======================== the one rule ======================== */
const W = { strong: 3, fair: 2, weak: 1 };
function strength(g) {
  if (!g) return 'weak';
  const r = g[0], c = +g[1];
  if ('AB'.includes(r) && c <= 2) return 'strong';
  if ('ABC'.includes(r) && c <= 3) return 'fair';
  return 'weak';
}
function sideInfo(side) {
  const st = side.sources.map(s => strength(DATA.sources[s].grade));
  const best = st.includes('strong') ? 'strong' : st.includes('fair') ? 'fair' : 'weak';
  const n = st.length, w = st.reduce((a, s) => a + W[s], 0);
  let rung;
  if (n >= 2 && best === 'strong') rung = 0;
  else if ((n === 1 && best === 'strong') || (n >= 2 && best === 'fair')) rung = 1;
  else if ((n === 1 && best === 'fair') || (n >= 2 && best === 'weak')) rung = 2;
  else rung = 3;
  return { n, best, w, rung };
}
/* weigh any set of sides with the one rule (used for claims, and for a claim's history) */
function weigh(sides, stale) {
  let r;
  if (!sides || !sides.length) return { kind: 'gap', word: DATA.outside.gap.word };
  if (sides.length === 1) {
    const s = sideInfo(sides[0]);
    r = stale ? { kind: 'stale', was: s.rung, word: DATA.outside.stale.word, sides: [s] }
              : { kind: 'fact', rung: s.rung, word: DATA.yardstick[s.rung].word, sides: [s] };
  } else {
    const a = sideInfo(sides[0]), b = sideInfo(sides[1]);
    const ratio = Math.max(a.w, b.w) / Math.min(a.w, b.w);
    if (ratio < 2) r = { kind: 'dispute', word: DATA.outside.dispute.word, sides: [a, b], ratio };
    else if (a.w > b.w) r = { kind: 'fact', rung: Math.min(a.rung + 1, 3), sides: [a, b], ratio, lean: 0 };
    else r = { kind: 'fact', rung: 4, sides: [a, b], ratio, lean: 1 };
    if (r.kind === 'fact') r.word = DATA.yardstick[r.rung].word;
  }
  return r;
}
const CACHE = {};
function derive(c) {
  if (typeof c === 'string') c = DATA.claims.find(x => x.id === c);
  if (CACHE[c.id]) return CACHE[c.id];
  let r;
  if (c.gap) r = { kind: 'gap', word: DATA.outside.gap.word };
  else if (c.hidden) r = { kind: 'hidden', word: DATA.outside.hidden.word };
  else r = weigh(c.sides, c.stale);
  r.id = c.id; r.claim = c;
  return (CACHE[c.id] = r);
}
/* why this word, as a template sentence (ink, never a model) */
function why(c) {
  const d = derive(c), Y = DATA.yardstick;
  const nm = n => n === 1 ? 'one source' : n === 2 ? 'two sources' : n + ' sources';
  if (d.kind === 'gap') return `Nobody has said yet. ${c.who} could fill it: ${c.how}.`;
  if (d.kind === 'hidden') return `It is kept on the ${c.floor} floor, which you can’t open. Ask ${c.ask}.`;
  if (d.kind === 'stale') return `On ${c.stale.asOf} it was ${Y[d.was].say}. It should be checked every ${c.stale.review}, and nothing newer has come in.`;
  if (d.kind === 'dispute') return `${cap(nm(d.sides[0].n))} ${d.sides[0].n===1?'says':'say'} ${c.sides[0].value}; ${nm(d.sides[1].n)} ${d.sides[1].n===1?'says':'say'} ${c.sides[1].value}. They weigh about the same, so nobody can pick yet.`;
  const s = d.sides[0];
  if (d.lean === 1) return `${cap(nm(s.n))} says so (${DATA.grades.strength[s.best]}). ${cap(nm(d.sides[1].n))} with twice the weight say ${c.sides[1].value}.`;
  if (d.lean === 0) return `${cap(nm(s.n))} agree, but ${nm(d.sides[1].n)} disagree${d.sides[1].n === 1 ? 's' : ''}, so it drops one word.`;
  const best = DATA.grades.strength[s.best];
  return s.n === 1 ? `One source, ${best}. Nothing disagrees.` : `${cap(nm(s.n))} agree, the best ${best}. Nothing disagrees.`;
}
/* what would move it, and who */
function next(c) {
  const d = derive(c);
  if (d.kind === 'gap') return { say: `${c.who} could fill it`, who: c.who, act: 'Ask' };
  if (d.kind === 'hidden') return { say: `Ask ${c.ask} to share it, or to answer for you`, who: c.ask, act: 'Ask' };
  if (d.kind === 'stale') return { say: `A current certificate would bring it back`, who: c.stale.who, act: 'Ask' };
  if (d.kind === 'dispute') return { say: `${c.decides} decides which is right, or a third source settles it`, who: c.decides, act: 'Ask to decide' };
  if (d.rung === 4) return { say: `Only new evidence for it would change this`, who: null, act: null };
  if (d.rung === 0) return { say: `Nothing more is needed`, who: null, act: null };
  const s = d.sides[0];
  if (d.rung === 3) return { say: `A second source, or a graded one, would make it likely`, who: null, act: 'Find a source' };
  if (d.rung === 2) return { say: `A source we usually trust would make it very likely`, who: null, act: 'Find a source' };
  return { say: s.n === 1 ? `A second source agreeing would make it almost certain` : `A source we usually trust would make it almost certain`, who: null, act: 'Find a source' };
}
function cap(s) { return s.charAt(0).toUpperCase() + s.slice(1); }
function claim(id) { return DATA.claims.find(c => c.id === id); }
function sayValue(c, i) { return c.say.replace('{v}', c.sides ? c.sides[i || 0].value : ''); }
function gradePlain(g) { return g ? `${DATA.grades.rel[g[0]]}, ${DATA.grades.cred[g[1]]}` : 'not graded'; }

/* ======================== shared marks ======================== */
/* the word-size yardstick: five positions, the claim's own one filled. Position, not amount. */
function stick(d, opt) {
  opt = opt || {};
  const cells = [4, 3, 2, 1, 0].map(r => {
    let cls = 'st-c';
    if (d.kind === 'fact' && d.rung === r) cls += ' on';
    if (d.kind === 'stale' && d.was === r) cls += ' was';
    if (d.kind === 'dispute' && (d.sides[0].rung === r || d.sides[1].rung === r)) cls += ' two';
    return `<span class="${cls}"></span>`;
  }).join('');
  const k = d.kind;
  return `<span class="stick k-${k}" aria-hidden="true">${k === 'gap' ? '<span class="mk-gap s"></span>' : k === 'hidden' ? '<span class="mk-unseen">' + Icons.svg('lock', { size: 10, stroke: 2 }) + '</span>' : cells}</span>`;
}
/* the confidence word as a chip: word first, glyph second */
function word(d, opt) {
  opt = opt || {};
  const ic = d.kind === 'fact' ? '' : Icons.svg(DATA.outside[d.kind].icon, { size: 12, stroke: 1.75 });
  const tech = d.kind === 'fact' ? DATA.yardstick[d.rung].tech : DATA.outside[d.kind].tech;
  return `<span class="cw k-${d.kind}${d.kind === 'fact' ? ' r' + d.rung : ''}" title="${(d.kind === 'fact' ? DATA.yardstick[d.rung].rule : DATA.outside[d.kind].rule).replace(/"/g, '&quot;')}">${ic}<span class="cw-w">${d.word}</span>${opt.stick === false ? '' : stick(d)}</span>${opt.tech === false ? '' : `<span class="tk">${tech}</span>`}`;
}
function srcRow(id) {
  const s = DATA.sources[id], st = strength(s.grade);
  return `<li class="src s-${st}"><span class="src-i">${Icons.svg(s.icon, { size: 14 })}</span><span><b>${s.name}</b><span class="src-m">${s.where} · ${s.date}${s.note ? ' · ' + s.note : ''}</span><span class="src-g">${cap(DATA.grades.strength[st])}: ${gradePlain(s.grade)}<span class="tk"> · grade ${s.grade || '—'} · ${st} · weight ${W[st]}</span></span></span></li>`;
}

/* ======================== shared keys ======================== */
const UI = { tech: false, gw: true };
function setTech(on) { UI.tech = on; document.body.classList.toggle('tech', on); const b = document.getElementById('kT'); if (b) b.setAttribute('aria-pressed', on); }
function setGw(on) { UI.gw = on; document.body.classList.toggle('nogw', !on); const b = document.getElementById('kG'); if (b) b.setAttribute('aria-pressed', !on); if (window.onGw) window.onGw(on); }
const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
function ms(name) { return parseFloat(getComputedStyle(document.documentElement).getPropertyValue(name)) || 0; }
let timers = [];
function later(fn, t) { timers.push(setTimeout(fn, t)); }
function clearLater() { timers.forEach(clearTimeout); timers = []; }
/* the pencil bottom line (model) or the template one (ink) */
function bottomLine(target) {
  const P = DATA.pencil;
  if (UI.gw) {
    target.innerHTML = `<p class="pencil"><span class="pen-lane">${Icons.svg('pencil-line', { size: 12 })} ${P.by} · not yet accepted</span>${P.text.map(([t, ids]) => `<span class="pen-s">${t.trimEnd()}<sup>${ids.map(i => `<button class="cite" data-c="${i}">${DATA.claims.indexOf(claim(i)) + 1}</button>`).join('')}</sup> </span>`).join('')}</p>
    <p class="pen-floor">Rests on ${uniq(P.text.flatMap(x => x[1])).length} claims. ${weakestLine(uniq(P.text.flatMap(x => x[1])))}</p>`;
  } else {
    const facts = DATA.claims.map(derive).filter(d => d.kind === 'fact' && d.rung <= 1).slice(0, 2);
    const open = DATA.claims.map(derive).filter(d => d.kind === 'dispute' || d.kind === 'gap');
    target.innerHTML = `<p class="inkline">${facts.map(d => `<span class="il">${d.word}: ${d.claim.short.toLowerCase()}, ${d.claim.sides[0].value}.<sup><button class="cite" data-c="${d.id}">${DATA.claims.indexOf(d.claim) + 1}</button></sup></span>`).join(' ')} <span class="il">Open before deciding: ${open.map(d => `${d.claim.short.toLowerCase()} (${d.word.toLowerCase()})<sup><button class="cite" data-c="${d.id}">${DATA.claims.indexOf(d.claim) + 1}</button></sup>`).join(' and ')}.</span></p>
    <p class="pen-floor">${Icons.svg('power-off', { size: 12 })} The assistant is off, so this line is made from a template. No claim, word or count changed.</p>`;
  }
}
function uniq(a) { return [...new Set(a)]; }
function weakestLine(ids) {
  const ds = ids.map(derive);
  const order = d => d.kind === 'fact' ? (d.rung === 4 ? 4.5 : d.rung) : d.kind === 'dispute' ? 6 : d.kind === 'gap' ? 7 : 5;
  const w = ds.slice().sort((a, b) => order(b) - order(a))[0];
  return `It is no surer than its weakest: <b>${w.claim.short.toLowerCase()}</b>, ${w.word.toLowerCase()}.`;
}
function hints(list) {
  return list.map(([k, t]) => `<span>${k.split(' ').map(x => `<span class="kbd">${x}</span>`).join('')} ${t}</span>`).join('');
}
function baseKeys(e, replay) {
  if (e.metaKey || e.ctrlKey || e.altKey) return false;
  const k = e.key.toLowerCase();
  if (k === 'r') { replay(); return true; }
  if (k === 't') { setTech(!UI.tech); return true; }
  if (k === 'g') { setGw(!UI.gw); return true; }
  return false;
}
