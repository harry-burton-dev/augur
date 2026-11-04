/* ======================================================================
   Sample data for one deployment (Vale Regional Services). Every name,
   label, count, date, grade and sentence part on every page of this run
   comes from here; nothing in the markup repeats any of it. In AUGUR it
   would come from Data Atlas (facts, sources and their grades, the
   contract outcomes register), Mandate (the intent, its kind and bar,
   the decision record) and the bench's own result records.
   The story is the briefing run's and the minute run's: Facilities
   deciding whether to renew Calder Waste on the North round.
   ====================================================================== */
const DATA = {
  org: 'Vale Regional Services',
  today: '18 Nov 2026',
  me: 'sam',
  people: {
    sam:   { name: 'Sam Okafor',  role: 'operator, Facilities',          floor: 'fac' },
    jo:    { name: 'Jo Reyes',    role: 'Head of Facilities',            floor: 'fac' },
    ola:   { name: 'Ola Mensah',  role: 'contracts officer',             floor: 'fac' },
    marta: { name: 'Marta Kowal', role: 'depot lead',                    floor: 'depot' },
    priya: { name: 'Priya Nair',  role: 'finance lead',                  floor: 'fin' },
    nadia: { name: 'Nadia Osei',  role: 'Head of Facilities since Sep 2027', floor: 'fac' },
    malik: { name: 'Malik Haddad', role: 'deployment admin',             floor: 'org' }
  },
  floors: {
    org:   { name: 'Vale Regional Services', tier: 'org',        word: 'Org floor' },
    fac:   { name: 'Facilities',             tier: 'department', word: 'Department floor' },
    depot: { name: 'Depot operations',       tier: 'team',       word: 'Team floor' },
    fin:   { name: 'Finance',                tier: 'department', word: 'Department floor' },
    ws:    { name: 'Waste and Streets',      tier: 'department', word: 'Department floor' },
    parks: { name: 'Parks and Leisure',      tier: 'department', word: 'Department floor' },
    hou:   { name: 'Housing',                tier: 'department', word: 'Department floor', closed: true }
  },
  gateway: { on: true, admin: 'malik' },

  supplier: 'Calder Waste',
  round: 'North round',
  contract: { id: 'CN-0412', supplier: 'Calder Waste', what: 'North round waste collection', ends: '31 Mar 2027', notice: '31 Dec 2026' },
  intent: { id: 'INT-208', title: 'Decide on the North waste contract', owner: 'jo', due: '15 Dec 2026', kind: 'Renew or end a contract', floor: 'fac',
    bar: 1 /* the standard of proof this kind asks for: rung 1, very likely or better (briefing run) */, barSetBy: 'the owner of the kind, Procurement' },

  /* ---------- the yardstick, carried unchanged from the briefing run ---------- */
  yardstick: [
    { word: 'Almost certain', rule: 'Two or more sources agree, one of them a source we usually trust. None disagree.', tech: '≥2 independent · best strong · 0 against' },
    { word: 'Very likely',    rule: 'One source we usually trust, or two fair ones that agree. None disagree.',          tech: '1 strong, or ≥2 with best fair' },
    { word: 'Likely',         rule: 'One fair source, or two weak ones that agree.',                                    tech: '1 fair, or ≥2 weak' },
    { word: 'Possible',       rule: 'One weak or ungraded source, and nothing to check it against.',                     tech: '1 weak or ungraded' },
    { word: 'Unlikely',       rule: 'Better sources say otherwise, with at least twice the weight.',                    tech: 'weight against ≥ 2 × weight for' }
  ],
  outside: {
    dispute: { word: 'Sources disagree', icon: 'split' },
    gap:     { word: 'Not known yet',    icon: 'square-dashed' },
    hidden:  { word: 'Not yours to see', icon: 'lock' }
  },
  strengthWord: { strong: 'a source we usually trust', fair: 'a fair source', weak: 'a weak or ungraded source' },

  /* ---------- sources, with the grade Data Atlas already stores ---------- */
  sources: {
    s1:  { name: 'Contract CN-0412',                     grade: 'A1', by: 'Procurement',       kind: 'document' },
    s2:  { name: 'Procurement framework register',       grade: 'A2', by: 'Procurement',       kind: 'record' },
    s3:  { name: 'Depot missed-collection log',          grade: 'B3', by: 'Marta Kowal',       kind: 'record' },
    s4:  { name: 'Residents’ complaints export',         grade: 'C3', by: 'Customer services', kind: 'record' },
    s5:  { name: 'Calder quarterly report, Q3',          grade: 'C3', by: 'Calder Waste',      kind: 'document', note: 'written by the supplier' },
    s6:  { name: 'Phone note, Calder account manager',   grade: null, by: 'Dan Reid, Calder',  kind: 'person' },
    s10: { name: 'Site count, North depot',              grade: 'B2', by: 'Marta Kowal',       kind: 'person' },
    s12: { name: 'Highways road closures register',      grade: 'A2', by: 'Highways',          kind: 'record' },
    s13: { name: 'Council tax register',                 grade: 'A1', by: 'Revenues',          kind: 'record' },
    s14: { name: 'Planning register',                    grade: 'A2', by: 'Planning',          kind: 'record' },
    s15: { name: 'Calder staff return, October',         grade: 'C3', by: 'Calder Waste',      kind: 'document', note: 'written by the supplier' },
    s16: { name: 'Customer services change log',         grade: 'B2', by: 'Customer services', kind: 'record' },
    s17: { name: 'Contract outcomes register',           grade: 'A2', by: 'Procurement',       kind: 'record' },
    s18: { name: 'Tender records, 2018 to 2026',         grade: 'A2', by: 'Procurement',       kind: 'record' }
  },

  /* ---------- Data Atlas facts the techniques take as inputs ---------- */
  facts: {
    missed:   { say: 'Missed collections stepped up in July, from 14 to 31 a month', sides: [['s3', 's4']] },
    closures: { say: 'Road closures on the round fell after June: 5 in Apr to Jun, 3 in Jul to Oct', sides: [['s12']] },
    roadlog:  { say: 'Only 4 of 124 missed collections were logged as “road closed”', sides: [['s3']] },
    tuesday:  { say: 'Most complaints come from the Tuesday round (Ashby and Low Moor)', sides: [['s4']] },
    depotrise:{ say: 'The depot log, which doesn’t use the complaints form, shows the same rise', sides: [['s3']] },
    overtime: { say: 'Calder stopped overtime on the round at the end of June', sides: [['s5']] },
    agency:   { say: 'Calder’s two agency drivers since July work the Thursday round', sides: [['s15']] },
    lowmoor:  { say: '640 Low Moor homes joined the Tuesday round on 1 July', sides: [['s13', 's14']] },
    form:     { say: 'The online complaints form started on 4 August', sides: [['s16']] },
    fleet:    { say: 'The round has run 7 vehicles since May; the contract schedules 9', sides: [['s3', 's10']], set: 'The schedule’s 9 was set aside by Jo Reyes on 6 Nov: out of date since May' },
    vehjan:   { say: 'Calder will put two vehicles back on the round in January', sides: [['s6']] },
    bidders:  { say: 'Two other framework suppliers could bid for the round', sides: [['s2']] },
    price:    { say: 'Calder’s price per lift for a renewal', hidden: { floor: 'fin', ask: 'priya' } },
    audit:    { say: 'The last health and safety audit of Calder’s North depot', gap: { who: 'ola', how: 'ask Calder for its last audit report' } },
    tenders:  { say: 'Waste tenders here took 4 to 7 months from notice to start (6 since 2018)', sides: [['s18']] },
    lowmoor2: { say: 'Low Moor phase 2, 300 more homes, is due for occupation from May 2027', sides: [['s14']] },
    county:   { say: 'Calder started a county contract in July', sides: [], gap: { who: 'ola', how: 'ask Calder which crews work it' } }
  },
  missedByMonth: { months: ['Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct'], n: [12, 15, 14, 26, 33, 31, 34] },

  /* ---------- the bench: kinds of question, and the technique for each ---------- */
  kinds: [
    { id: 'why',    ask: 'Why did this happen?',                     verb: 'explain',  tid: 'ach',     cues: ['why', 'cause', 'fall', 'drop', 'worse', 'rise', 'happened'] },
    { id: 'next',   ask: 'How will it go? How long, how much?',      verb: 'forecast', tid: 'outside', cues: ['will', 'how long', 'how much', 'by when', 'recover', 'forecast', 'expect'] },
    { id: 'plan',   ask: 'Will our plan work?',                      verb: 'plan',     tid: 'kac',     cues: ['plan', 'work', 'depends', 'relies'] },
    { id: 'commit', ask: 'We’re about to commit. What could go wrong?', verb: 'commit', tid: 'pre',     cues: ['commit', 'sign', 'renew', 'launch', 'go ahead', 'decide whether'] },
    { id: 'told',   ask: 'Can we rely on what we’ve been told?',     verb: 'check',    tid: 'qic',     cues: ['told', 'says', 'claims', 'report', 'trust'] },
    { id: 'lean',   ask: 'We’re leaning one way. Are we right?',     verb: 'choose',   tid: 'against', cues: ['leaning', 'prefer', 'favourite', 'choose', 'which'] }
  ],
  techniques: {
    outside: { name: 'How things like this usually go', tech: 'Outside view · reference class forecasting (Kahneman and Lovallo 1993)', icon: 'library', minutes: 10, people: 'on your own',
      takes: 'Past cases like yours from Data Atlas', makes: 'A starting count (“4 of 11”) and each step you moved from it, with why', kept: 'Beside the forecast, scored when the date comes',
      may: 'find past cases that may belong in the class', never: 'choose the class or move the count' },
    ach:     { name: 'Competing explanations', tech: 'Analysis of competing hypotheses (Heuer 1999)', icon: 'git-compare-arrows', minutes: 25, people: '1 to 3 people',
      takes: 'Facts from Data Atlas, each with its word', makes: 'The explanation with least against it, and the next fact that would split the rest', kept: 'As the “why” under the decision',
      may: 'propose an explanation nobody listed, and facts to look for', never: 'mark a cell or rank the explanations' },
    kac:     { name: 'Check the assumptions', tech: 'Key assumptions check (Tradecraft Primer 2009)', icon: 'list-checks', minutes: 15, people: '1 or 2 people',
      takes: 'The plan’s text from Mandate, and the facts it rests on', makes: 'Each assumption marked solid, with caveats or unsupported, and a sign that would show it failing', kept: 'As the decision’s assumptions, each watched',
      may: 'point at sentences that assume something', never: 'mark an assumption' },
    pre:     { name: 'Imagine it failed', tech: 'Premortem (Klein 2007)', icon: 'skull', minutes: 20, people: '3 to 8 people, together',
      takes: 'The intent and the plan from Mandate', makes: 'Reasons it failed, turned into changes, watches or risks accepted', kept: 'As the decision’s watches and changes',
      may: 'add one reason, marked as its own', never: 'cluster, rank or drop a reason' },
    qic:     { name: 'Check the sources', tech: 'Quality of information check (Tradecraft Primer 2009)', icon: 'file-search', minutes: 10, people: 'on your own',
      takes: 'The sources under a judgement, with their grades', makes: 'Which source carries the weight, and what changes if it is wrong', kept: 'On the judgement it checked',
      may: 'find where two sources copy one origin', never: 'grade a source' },
    against: { name: 'The case against', tech: 'Devil’s advocacy (Tradecraft Primer 2009)', icon: 'swords', minutes: 15, people: 'you and a challenger',
      takes: 'Your favoured option and its facts', makes: 'The strongest case for the option you are not choosing, answered point by point', kept: 'Beside the choice, with each answer',
      may: 'argue the other side, in pencil', never: 'decide which side won' }
  },
  /* techniques left to training: named, with why, never offered at the point of work */
  training: [
    { name: 'Team A / Team B', why: 'needs two prepared teams and days, not minutes' },
    { name: 'Red team',        why: 'needs people outside the decision, set up in advance' },
    { name: 'High impact, low probability', why: 'useful, but people overuse it without practice' },
    { name: 'What if?',        why: 'a scenario exercise; better led by someone trained' },
    { name: 'Fishbone (Ishikawa)', why: 'good for processes; competing explanations covers the rest' },
    { name: 'Five whys',       why: 'follows one chain, the trap competing explanations avoids' },
    { name: 'Fermi estimate',  why: 'fine on paper; no facts to run it on' },
    { name: 'Scenarios',       why: 'a workshop, not a task' }
  ],
  /* Cynefin: the kind of situation chooses whether any technique helps */
  situations: [
    { id: 'clear',       name: 'Clear',       test: 'Everyone knows what causes what.',            method: 'Follow the procedure. No technique: it would only slow you.', tids: [] },
    { id: 'complicated', name: 'Complicated', test: 'Someone could work out what causes what.',    method: 'Analyse first. Explanations, assumptions and sources pay here.', tids: ['ach', 'kac', 'qic'] },
    { id: 'complex',     name: 'Complex',     test: 'Only trying tells you what causes what.',     method: 'Start from how it usually goes, try small, watch closely.', tids: ['outside', 'pre', 'against'] },
    { id: 'chaotic',     name: 'Chaotic',     test: 'Nothing holds still long enough to ask.',     method: 'Act first to make it stable. No technique now; review after.', tids: [] }
  ],

  /* ---------- the outside view: renewals like this one ---------- */
  outsideView: {
    question: 'If we renew, will missed collections be back under 15 a month by 30 Jun 2027?',
    inside: { who: 'Calder Waste', says: 'back to normal by January', from: 's5' },
    classes: [
      { id: 'all',   name: 'Service contracts renewed while the supplier was under a performance notice', n: 11, yes: 4, from: 's17' },
      { id: 'waste', name: 'Waste and cleaning contracts only', n: 5, yes: 2, from: 's17' },
      { id: 'short', name: 'Renewed for 12 months or less', n: 4, yes: 2, from: 's17' }
    ],
    /* the 11 past cases, from the contract outcomes register */
    cases: [
      { name: 'Street cleansing, East',     dept: 'Waste and Streets', year: 2019, months: 5,  out: 'yes' },
      { why: 'Supplier lost its contract manager', cl: 'staff', name: 'Grounds maintenance, South', dept: 'Parks and Leisure', year: 2019, months: null, out: 'ended' },
      { name: 'Office cleaning, Riverside', dept: 'Facilities',        year: 2020, months: 4,  out: 'yes' },
      { why: 'Too few vehicles, never fixed', cl: 'veh', name: 'Recycling round, West',      dept: 'Waste and Streets', year: 2020, months: 11, out: 'late' },
      { why: 'Price rose sharply at renewal', cl: 'price', name: 'Security, depots',           dept: 'Facilities',        year: 2021, months: null, out: 'ended' },
      { name: 'Bulky waste, all areas',     dept: 'Waste and Streets', year: 2021, months: 6,  out: 'yes' },
      { why: 'Service credit too small to matter', cl: 'credit', name: 'Catering, Market Street',    dept: 'Facilities',        year: 2022, months: 9,  out: 'late' },
      { why: 'Supplier moved its depot further away', cl: 'depot', name: 'Fleet servicing',            dept: 'Facilities',        year: 2023, months: null, out: 'ended' },
      { name: 'Trade waste, Centre',        dept: 'Waste and Streets', year: 2023, months: 3,  out: 'yes' },
      { why: 'Volumes grew faster than the plan', cl: 'homes', name: 'Window cleaning, all sites', dept: 'Facilities',        year: 2024, months: 14, out: 'late' },
      { why: 'Too few vehicles, never fixed', cl: 'veh', name: 'Garden waste, North',        dept: 'Waste and Streets', year: 2025, months: null, out: 'ended' }
    ],
    outWord: { yes: 'Back to target within 6 months', late: 'Back to target, but later', ended: 'Ended early or not renewed again' },
    /* each move away from the starting count is a separate, stated step */
    steps: [
      { by: 'sam', move: +1, why: 'The cause is known and countable: two vehicles short (competing explanations)' },
      { by: 'jo',  move: 0,  why: 'Low Moor phase 2 adds 300 homes from May: offsets part of it. Holds at 5 rather than 6' }
    ],
    forecast: { yes: 5, of: 11, by: 'jo', on: '10 Dec 2026' },
    tender: { question: 'If we end the contract, can a tender be done by 31 Mar 2027?', n: 6, min: 4, max: 7, haveMonths: 3, from: 's18' }
  },

  /* ---------- competing explanations for the fall ---------- */
  ach: {
    question: 'Why have missed collections on the North round more than doubled since July?',
    hyps: [
      { id: 'h1', short: 'Road closures',    say: 'Road closures blocked the round', by: 'Calder Waste, Q3 report' },
      { id: 'h2', short: 'Too few vehicles', say: 'Two vehicles short since May, covered by overtime until June', by: 'Marta Kowal' },
      { id: 'h3', short: 'More homes',       say: 'Low Moor’s 640 new homes made the Tuesday round too long', by: 'Sam Okafor' },
      { id: 'h4', short: 'Agency drivers',   say: 'New agency drivers don’t know the round', by: 'Marta Kowal' },
      { id: 'h5', short: 'Counting changed', say: 'The new online form records more complaints, not more misses', by: 'Ola Mensah' },
      { id: 'h6', short: 'Crews moved',      say: 'Calder moved crews to its new county contract', by: 'model', pencil: true }
    ],
    /* evidence rows: a Data Atlas fact each. Marks: C fits, I against, II rules it out, '' says nothing */
    rows: [
      { id: 'e1', fact: 'missed',    m: { h1: 'I',  h2: 'C', h3: 'C', h4: 'C', h5: 'I',  h6: 'C' } },
      { id: 'e2', fact: 'closures',  m: { h1: 'II', h2: '',  h3: '',  h4: '',  h5: '',   h6: '' } },
      { id: 'e3', fact: 'roadlog',   m: { h1: 'II', h2: 'C', h3: 'C', h4: 'C', h5: '',   h6: '' } },
      { id: 'e4', fact: 'tuesday',   m: { h1: '',   h2: 'C', h3: 'C', h4: 'I', h5: '',   h6: '' } },
      { id: 'e5', fact: 'depotrise', m: { h1: '',   h2: 'C', h3: 'C', h4: 'C', h5: 'II', h6: '' } },
      { id: 'e6', fact: 'overtime',  m: { h1: '',   h2: 'C', h3: '',  h4: '',  h5: '',   h6: 'C' } },
      { id: 'e7', fact: 'agency',    m: { h1: '',   h2: '',  h3: '',  h4: 'I', h5: '',   h6: '' } },
      { id: 'e8', fact: 'lowmoor',   m: { h1: '',   h2: 'C', h3: 'C', h4: '',  h5: '',   h6: '' } },
      { id: 'e9', fact: 'form',      m: { h1: '',   h2: '',  h3: '',  h4: '',  h5: 'I',  h6: '' } },
      { id: 'e10', fact: 'fleet',    m: { h1: '',   h2: 'C', h3: '',  h4: '',  h5: '',   h6: '' } }
    ],
    /* when the run is done: who marked, what the result says, what would split the survivors */
    markedBy: ['sam', 'marta'], minutes: 31,
    result: 'Too few vehicles for more homes: two vehicles short since May, and 640 more homes on the Tuesday round since July.',
    split: { fact: 'Missed collections by weekday, July to October', who: 'marta', why: 'If Tuesday carries most of the rise, more homes weighs more; if every day rose, too few vehicles does.' },
    /* what each explanation predicts month by month (Apr to Oct), sketched by the people who proposed it */
    shapes: {
      h1: { line: [16, 16, 15, 11, 11, 10, 11], says: 'Misses should follow closures, and closures fell after June' },
      h2: { line: [14, 14, 14, 31, 31, 31, 31], says: 'A step when overtime stopped at the end of June' },
      h3: { line: [14, 14, 14, 31, 31, 31, 31], says: 'A step when Low Moor joined on 1 July' },
      h4: { line: [14, 14, 14, 30, 30, 30, 30], says: 'A step when agency drivers started in July' },
      h5: { line: [14, 14, 14, 14, 31, 31, 31], says: 'A step when the online form started on 4 August' },
      h6: { line: [14, 14, 14, 31, 31, 31, 31], says: 'A step when the county contract started in July' }
    },
    events: [ { i: 1, w: 'two vehicles leave' }, { i: 2.9, w: 'overtime stops' }, { i: 3, w: 'Low Moor joins · agency drivers' }, { i: 4.1, w: 'online form' } ],
    /* facts nobody has yet, and which explanations each could tell apart */
    tests: [
      { id: 't1', fact: 'Missed collections by weekday, July to October', who: 'marta', from: 'the depot log', takes: 'about a day', splits: ['h2', 'h3'], tells: 'Every day up: too few vehicles. Tuesday only: more homes.' },
      { id: 't2', fact: 'Missed collections on Low Moor streets against the rest of Tuesday', who: 'marta', from: 'the depot log', takes: 'about a day', splits: ['h3'], tells: 'If Low Moor carries the rise, more homes holds.' },
      { id: 't3', fact: 'Which crews work Calder’s county contract', who: 'ola', from: 'Calder, by letter', takes: 'about a week', splits: ['h6'], tells: 'Tests the assistant’s explanation, which nothing tests yet.' },
      { id: 't4', fact: 'Road closures by street, July to October', who: 'ola', from: 'Highways', takes: 'two days', splits: ['h1'], tells: 'Could only add to what is against road closures, already set aside.' }
    ],
    pencilWhy: 'Calder started a county contract in July, the month the rise began. Nobody has asked which crews work it.'
  },

  /* ---------- the plan under test, and its assumptions ---------- */
  plan: {
    id: 'INT-208 · option C', title: 'Renew for 12 months, with a break at 6 months',
    text: [
      ['Renew CN-0412 with Calder Waste for 12 months from 1 Apr 2027, ', null],
      ['with the two missing vehicles back on the round from January', 'a1'],
      [', so that missed collections fall back under 15 a month ', 'a2'],
      ['at about today’s price', 'a3'],
      ['. Keep a break at 6 months; if we use it, ', null],
      ['another framework supplier takes over', 'a4'],
      [' after ', null], ['a tender run in the six months', 'a5'],
      ['. The round stays as it is, ', null], ['including Low Moor', 'a6'],
      [', and ', null], ['Calder keeps its North depot', 'a7'], ['.', null]
    ]
  },
  assumptions: [
    { id: 'a1', ch: { by: 'sam', q: 'How do we know they’ll be back in January?', a: 'Dan Reid said so on the phone. Nothing written, nothing graded.' }, not: 'Calder doesn’t put the vehicles back in January', say: 'Calder puts the two missing vehicles back on the round in January', fact: 'vehjan', load: 'high',
      sign: 'Fewer than 9 vehicles on the depot log in the week of 18 Jan', sees: true, event: 'depot log, daily', owner: 'marta',
      ifFalse: 'Use the service credit from February and start the tender in January, not April' },
    { id: 'a2', ch: { by: 'model', q: 'Would 9 vehicles be enough with 640 more homes on Tuesday?', a: 'Competing explanations left two causes standing. Vehicles fix one.' }, not: 'With 9 vehicles, missed collections stay above 15', say: 'With 9 vehicles, missed collections fall back under 15 a month', fact: null, from: 'ach', load: 'high', mark: 'caveats',
      why: 'Competing explanations leave two causes standing; vehicles fix one. 4 of 11 renewals like this recovered within 6 months.',
      sign: 'More than 20 missed in February, or more than 15 from April', sees: true, event: 'depot log, monthly', owner: 'sam',
      ifFalse: 'Re-open: the cause is more homes, so ask Calder for a 10th vehicle or split the Tuesday round' },
    { id: 'a3', ch: { by: 'sam', q: 'Has anyone seen Calder’s renewal price?', a: 'Finance has it. We can’t open it.' }, not: 'Calder’s price rises by more than 5%', say: 'Calder renews at about today’s price (within 5%)', fact: 'price', load: 'medium',
      sign: 'Calder’s renewal quote more than 5% up', sees: false, cant: 'the quote is a letter; nothing records it until Finance does', owner: 'priya',
      ifFalse: 'Compare with the framework rates before signing' },
    { id: 'a4', ch: { by: 'sam', q: 'Are both still on the framework?', a: 'Yes: the register was updated on 1 Nov.' }, not: 'No other supplier can take over', say: 'Another framework supplier could take over if we break', fact: 'bidders', load: 'medium',
      sign: 'A supplier leaves the waste framework', sees: true, event: 'framework register', owner: 'ola',
      ifFalse: 'Ask the framework to re-open, or extend for 3 months' },
    { id: 'a5', ch: { by: 'sam', q: 'Have we ever tendered waste in six months?', a: 'Four of six did; two took seven. Lowered from solid.' }, not: 'Six months isn’t enough to tender', say: 'Six months is enough to run a tender if we break', fact: 'tenders', load: 'high', mark: 'caveats',
      why: '6 past waste tenders took 4 to 7 months; 2 of the 6 took 7.',
      sign: 'Tender preparation not started by 30 Apr 2027', sees: false, cant: 'a date passing makes no event yet', owner: 'ola',
      ifFalse: 'Break later, or extend by 3 months' },
    { id: 'a6', ch: { by: 'model', q: 'Could the round be redrawn when phase 2 opens?', a: 'Possible. Round changes are agreed by phone, so we’d not see it.' }, not: 'Low Moor moves to another round', say: 'The Low Moor homes stay on the Tuesday round', fact: 'lowmoor', load: 'low',
      sign: 'A change to the round’s streets', sees: false, cant: 'round changes are agreed with Calder by phone; nothing is recorded', owner: 'marta',
      ifFalse: 'Re-count the round before the break' },
    { id: 'a7', ch: { by: 'sam', q: 'When was Calder’s depot last audited?', a: 'Nobody knows. Ola will ask.' }, not: 'Calder loses its North depot', say: 'Calder keeps its North depot (passes its safety audit)', fact: 'audit', load: 'high',
      sign: 'No audit report by 15 Jan', sees: false, cant: 'nobody has the report yet: a gap, not a sign', owner: 'ola',
      ifFalse: 'Break at once; the depot is where the round starts' }
  ],
  marks: {
    solid:      { word: 'Solid',                    rule: 'Its fact is almost certain or very likely.',  icon: 'square' },
    caveats:    { word: 'Supported, with caveats',  rule: 'Its fact is likely, or a technique leaves room for doubt.', icon: 'square-split-horizontal' },
    unsupported:{ word: 'Unsupported',              rule: 'Its fact is only possible, or nobody has checked it.', icon: 'square-dashed-bottom' },
    gap:        { word: 'Not known yet',            rule: 'Nobody has said. It can’t be marked until someone does.', icon: 'square-dashed' },
    hidden:     { word: 'Not yours to see',         rule: 'Its fact is on a floor you can’t open.', icon: 'lock' }
  },

  /* ---------- the premortem ---------- */
  premortem: {
    date: '1 Dec 2026', minutes: 22, said: 20, chair: 'jo', silentMinutes: 3,
    future: '1 Apr 2028',
    /* what the chair asks when a fixed bone of the fishbone stays empty */
    asks: { staff: 'Ask Ola Mensah whether Calder’s contract manager is staying.', material: 'Nobody named a supply: bins, fuel, spare parts. Ask the depot stores before signing.' },
    headline: 'The 12-month renewal failed: the North round is still missing collections and the tender is being rushed.',
    room: ['jo', 'sam', 'marta', 'ola', 'priya'],
    reasons: [
      { id: 'r1', by: 'marta', say: 'Calder never put the two vehicles back, and we waited until April to notice.', cl: 'veh' },
      { id: 'r2', by: 'priya', say: 'The service credit was too small for Calder to care about.', cl: 'credit' },
      { id: 'r3', by: 'ola',   say: 'Nobody started the tender in April, so the break was no use.', cl: 'tender' },
      { id: 'r4', by: 'sam',   say: 'The agency drivers stayed and the Thursday round got worse too.', cl: 'drivers' },
      { id: 'r5', by: 'sam',   say: 'Low Moor phase 2 added 300 more homes in May.', cl: 'homes' },
      { id: 'r6', by: 'jo',    say: 'I moved jobs and nobody owned watching the depot log.', cl: 'owner' },
      { id: 'r7', by: 'ola',   say: 'Calder failed its depot safety audit and lost the North depot.', cl: 'depot' },
      { id: 'r9', by: 'marta', say: 'Calder took the 9th vehicle from another of our rounds.', cl: 'veh' },
      { id: 'r8', by: 'model', say: 'Calder’s county contract kept first call on its crews.', cl: 'county', pencil: true }
    ],
    /* what each cluster became. change = fixed in the plan now; watch = a sign AUGUR watches; accept = known and left */
    clusters: [
      { id: 'veh',     name: 'Vehicles never came back',   to: 'watch',  watch: 'w1', owner: 'marta' },
      { id: 'credit',  name: 'Credit too small',           to: 'change', change: 'Service credit doubled, to £120 per missed collection over 15', owner: 'priya' },
      { id: 'tender',  name: 'Tender not started',         to: 'watch',  watch: 'w4', owner: 'ola' },
      { id: 'homes',   name: 'More homes again',           to: 'watch',  watch: 'w3', owner: 'sam' },
      { id: 'owner',   name: 'Nobody watching',            to: 'change', change: 'Marta Kowal watches, Sam Okafor stands in; named in the decision', owner: 'jo' },
      { id: 'depot',   name: 'Depot lost',                 to: 'watch',  watch: 'w6', owner: 'ola' },
      { id: 'drivers', name: 'Agency drivers stay',        to: 'accept', why: 'Thursday is within target; watch W2 would show it anyway', owner: 'jo' },
      { id: 'county',  name: 'County contract first',      to: 'watch',  watch: 'w5', owner: 'ola' }
    ]
  },

  /* ---------- watches the working created (feed the events service) ---------- */
  watches: [
    { id: 'w1', say: 'Vehicles on the round', line: 'fewer than 9 in the week of 18 Jan 2027', from: ['a1', 'veh'], sees: true,  listens: 'depot log, daily', owner: 'marta' },
    { id: 'w2', say: 'Missed collections',    line: 'over 20 in Feb, or over 15 from Apr 2027', from: ['a2'], sees: true,  listens: 'depot log, monthly', owner: 'sam' },
    { id: 'w3', say: 'Low Moor phase 2',      line: 'first homes occupied',                     from: ['homes'], sees: true,  listens: 'council tax register', owner: 'sam' },
    { id: 'w4', say: 'Tender preparation',    line: 'not started by 30 Apr 2027',               from: ['a5', 'tender'], sees: false, cant: 'a date passing makes no event yet', owner: 'ola' },
    { id: 'w5', say: 'Calder’s crews',        line: 'county contract takes North crews',        from: ['county'], sees: false, cant: 'Calder’s rota isn’t in AUGUR', owner: 'ola' },
    { id: 'w6', say: 'Depot safety audit',    line: 'no report by 15 Jan 2027',                 from: ['a7', 'depot'], sees: false, cant: 'a date passing makes no event yet', owner: 'ola' }
  ],

  /* ---------- the options, and the decision with its working ---------- */
  options: [
    { id: 'A', say: 'Renew for five years, as Calder offers', fate: 'Dropped', by: 'outside' , why: '7 of 11 renewals like this didn’t recover within 6 months; five years leaves no way out.' },
    { id: 'B', say: 'End the contract and tender now', fate: 'Dropped', by: 'outside', why: 'No waste tender here has taken under 4 months; notice leaves 3.' },
    { id: 'C', say: 'Renew for 12 months, with a break at 6 months', fate: 'Chosen', by: null, why: '' }
  ],
  decision: {
    id: 'D-142', on: '10 Dec 2026', body: 'Facilities leadership', chair: 'jo',
    words: 'Renew CN-0412 with Calder Waste for 12 months from 1 Apr 2027, with a service credit of £120 per missed collection over 15 a month and a break at 6 months. Start tender preparation by 30 Apr 2027.',
    draft: 'Renew CN-0412 with Calder Waste for five years from 1 Apr 2027, with a service credit of £60 per missed collection over 15 a month.',
    /* each change between draft and decision, and the technique that made it */
    changes: [
      { from: 'five years', to: '12 months', tid: 'outside', why: '4 of 11 renewals like this recovered within 6 months' },
      { from: '', to: 'a break at 6 months', tid: 'kac', why: 'a1 (vehicles back) is load-bearing and unsupported' },
      { from: '£60', to: '£120', tid: 'pre', why: 'reason r2: the credit was too small to matter' },
      { from: '', to: 'Start tender preparation by 30 Apr 2027', tid: 'pre', why: 'reason r3, and a5: tenders take 4 to 7 months' },
      { from: '', to: 'service credit', tid: 'ach', why: 'it counts every missed collection, road closures or not: competing explanations ruled road closures out' }
    ],
    notRun: [ { tid: 'qic', why: 'the sources were already graded, and only one was the supplier’s' }, { tid: 'against', why: 'the premortem played that part' } ],
    weakest: 'a1',
    hedge: 'If a1 fails: service credit from February, tender from January (watch W1)'
  },
  /* the working: each technique run, in order */
  working: [
    { tid: 'outside', on: '18 Nov 2026', by: ['sam'],                   said: 10, took: 12, result: '4 of 11 renewals like this recovered within 6 months; no waste tender here took under 4 months.', changed: 'Dropped five years, and dropped ending now' },
    { tid: 'ach',     on: '19 Nov 2026', by: ['sam', 'marta'],          said: 25, took: 31, result: 'Too few vehicles for more homes. Road closures fits least: two facts rule it out.', changed: 'The credit is tied to vehicles, not road closures' },
    { tid: 'kac',     on: '24 Nov 2026', by: ['ola', 'sam'],            said: 15, took: 16, result: '7 assumptions: 2 solid, 2 with caveats, 1 unsupported, 1 not known yet, 1 not yours to see.', changed: 'Added the break at 6 months, and watch W1' },
    { tid: 'pre',     on: '1 Dec 2026',  by: ['jo', 'sam', 'marta', 'ola', 'priya'], said: 20, took: 22, result: '9 reasons in 8 clusters: 5 watches, 2 changes, 1 accepted.', changed: 'Credit doubled; tender by 30 Apr; a named watcher' }
  ],

  /* ---------- earlier bench runs on decisions of the same kind (from the bench's result records) ---------- */
  precedent: {
    kind: 'Renew or end a contract', since: '2025',
    runs: [
      { q: 'Renew the office cleaning contract?',        floor: 'fac',   year: 2025, tid: 'pre',     took: 18, paid: true,  what: '2 reasons became watches; one fired in March' },
      { q: 'Renew the recycling round contract?',        floor: 'ws',    year: 2025, tid: 'kac',     took: 14, paid: true,  what: 'found the depot lease unsupported' },
      { q: 'End the security contract early?',           floor: 'fac',   year: 2025, tid: 'outside', took: 9,  paid: false, what: 'the count agreed with the plan; nothing moved' },
      { q: 'Renew grounds maintenance, South?',          floor: 'parks', year: 2026, tid: 'pre',     took: 24, paid: true,  what: 'added a break clause' },
      { q: 'Renew the catering contract?',               floor: 'fac',   year: 2026, tid: 'against', took: 15, paid: false, what: 'every point answered; the choice held' },
      { q: 'Renew the garden waste round?',              floor: 'ws',    year: 2026, tid: 'outside', took: 11, paid: true,  what: 'cut the term from 5 years to 2' },
      { q: 'Renew housing repairs, East?',               floor: 'hou',   year: 2026, tid: 'pre',     took: null, paid: null, what: null, hidden: true },
      { q: 'Renew fleet servicing?',                     floor: 'fac',   year: 2026, tid: 'kac',     took: 17, paid: true,  what: 'the parts price was unsupported; re-quoted' }
    ]
  },

  /* ---------- a year later: what happened, scored against the working ---------- */
  later: {
    today: '18 Nov 2027', reader: 'nadia',
    events: [
      { d: '19 Jan 2027', w: 'w1', say: 'Watch W1 crossed: 8 vehicles in the week of 18 Jan. D-142 marked worth revisiting; Jo Reyes asked Calder.' },
      { d: '20 Jan 2027', w: 'w6', closed: true, say: 'Calder sent its depot audit: passed. The gap closed.' },
      { d: '25 Jan 2027', w: null, say: 'The 9th vehicle joined the round, a week late.' },
      { d: '28 Feb 2027', w: 'w2', say: 'Watch W2 crossed: 22 missed in February. Jo Reyes kept D-142: the 9th vehicle had run for 4 weeks.' },
      { d: '12 May 2027', w: 'w4', say: 'Tender preparation started, 12 days after the line. Nobody was told: AUGUR couldn’t see the date pass.' },
      { d: '16 May 2027', w: 'w3', say: 'Watch W3 crossed: Low Moor phase 2 occupied. Calder added a 10th vehicle in June.' },
      { d: '31 May 2027', w: null, say: 'Missed collections at 13 for May: back under 15, in month 2 of the contract.' }
    ],
    assumptions: { a1: 'held, a week late', a2: 'held by May', a3: 'held (+3%)', a4: 'held', a5: 'not tested: the break wasn’t used', a6: 'held', a7: 'held: audit passed' },
    reasons: { r1: 'partly: a week late, caught by W1', r5: 'happened: W3 caught it', r3: 'partly: started 12 days late', r2: 'can’t tell: the credit was never triggered', r7: 'didn’t happen', r6: 'didn’t happen: the named watcher held', r4: 'didn’t happen', r9: 'didn’t happen', r8: 'can’t tell: AUGUR never saw Calder’s rota' },
    forecast: { said: '5 in 11', happened: true, note: 'Back under 15 by May' },
    ach: 'Tuesday’s misses fell to 3 a month once the 9th vehicle ran; every day had risen. Both causes held.',
    /* the same facts read a year on, for then-and-now */
    factsNow: { fleet: '10 vehicles since June 2027', missed: '13 a month in October 2027', vehjan: 'happened on 25 Jan 2027, a week late', price: 'renewed at +3%', audit: 'passed, report received 20 Jan 2027', lowmoor2: 'occupied from 16 May 2027' },
    record: { forecasts: 9, sameAsSaid: 'Of 6 we called “about half”, 3 happened' }
  }
};
