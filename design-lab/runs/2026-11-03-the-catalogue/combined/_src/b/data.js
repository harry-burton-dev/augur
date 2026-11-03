/* ======================================================================
   Sample data, shared by both b-screens (v3 placing, v4 structure change).
   Every name, word, count and question on the page comes from here. In
   AUGUR it comes from Data Atlas: the ontology (kinds, their details and
   links, each with a plain word and a technical word), counts per kind per
   floor, Triage, rounds, and the people who decide.
   A regional services deployment; nothing is drawn for one domain.
   ====================================================================== */
const DATA = {
  app: 'Data Atlas',
  floors: {
    org:     { kind: 'Org',        name: 'Northvale Regional Services', tier: 'org' },
    dept:    { kind: 'Department', name: 'Highways and Depots',         tier: 'department' },
    team:    { kind: 'Team',       name: 'Ashby Road Crew',             tier: 'team' },
    sibling: { kind: 'Team',       name: 'Retford Crew',                tier: 'team', ask: 'Jo Marsh' },
    finance: { kind: 'Department', name: 'Finance',                     tier: 'department', ask: 'Priya Nair' }
  },
  people: {
    operator: { name: 'Dee Okafor',      role: 'Crew coordinator',         floor: 'team' },
    steward:  { name: 'Priya Natarajan', role: 'Data steward',             floor: 'dept' },
    admin:    { name: 'Tom Rees',        role: 'looks after the kinds of thing', tech: 'Data Atlas admin', floor: 'org' },
    keeper:   { name: 'Sam Whitlock',    role: 'Depot manager, Ashby depot', floor: 'team' }
  },
  /* plain word first, technical word one step down (T) */
  words: {
    kind: ['kind of thing', 'class'], detail: ['detail', 'datatype property'], link: ['link', 'object property'],
    family: ['family', 'upper-level class (BFO / CCO)'], near: ['is it one of these?', 'candidate match (entity resolution)'],
    triage: ['Triage', 'proposal queue'], waiting: ['Waiting in Triage', 'unplaced individual · triage state "unplaced"'],
    predicted: ['a kind the table predicts', 'unpopulated class slot (family × shape)'], ask: ['ask', 'ontology change request'],
    expected: ['should have', 'sh:minCount 1 (advisory)'], round: ['round of small jobs', 'batch of triage proposals, grouped by keeper × site'],
    keeper: ['keeper', 'steward for a site'], seam: ['seam', 'structure-change event joined to this record']
  },
  /* the six ways to be empty: one mark, one sentence each (grammar sheet) */
  empty: [
    { id: 'gap',   plain: 'Not known yet', say: 'Should be here; nobody has said it yet. Names who could fill it. Can close.', tech: 'missing value · sh:minCount 1 not met' },
    { id: 'none',  plain: 'None',          say: 'Someone checked and there is none. Says who and when.', tech: 'stated absence (a fact whose value is none)' },
    { id: 'na',    plain: 'Doesn’t apply', say: 'Not expected for this kind of thing.', tech: 'property not in the class’s profile' },
    { id: 'stale', plain: 'Stale',         say: 'Known, but old. The hatch sits on the age, never on the value.', tech: 'review age exceeded' },
    { id: 'norec', plain: 'No record',     say: 'Time the system lost. Nobody can fill it; it can’t close.', tech: 'declared record gap (events)' },
    { id: 'unseen',plain: 'Not yours to see', say: 'It exists, kept where you can’t read it. Says whom to ask.', tech: '403 reason: kept elsewhere' }
  ],
  /* the families across the table (what a thing is: the genus) */
  families: [
    { id: 'someone',   word: 'Someone',   a: 'someone',                 tech: 'cco:Agent' },
    { id: 'place',     word: 'Place',     a: 'a place',                 tech: 'bfo:Site' },
    { id: 'thing',     word: 'Thing',     a: 'a thing',                 tech: 'bfo:MaterialEntity' },
    { id: 'agreement', word: 'Agreement', a: 'an agreement',            tech: 'cco:DirectiveICE' },
    { id: 'happening', word: 'Happening', a: 'an event',                tech: 'bfo:Process' }
  ],
  /* floors down the table: where each kind is looked after */
  rows: ['org', 'dept', 'team'],
  rowNote: { team: 'Ashby Road Crew keeps records of kinds looked after above. It has no kinds of its own, so this row is empty on purpose.' },
  kinds: [
    { id: 'person',    word: 'Person',    plural: 'People',    tech: 'cco:Person',           icon: 'user',           n: 1930, known: 81, family: 'someone',   floor: 'org',  diff: 'is one person' },
    { id: 'supplier',  word: 'Supplier',  plural: 'Suppliers', tech: 'cco:Organization',     icon: 'handshake',      n: 212,  known: 74, family: 'someone',   floor: 'org',  diff: 'is a company we buy or hire from' },
    { id: 'site',      word: 'Site',      plural: 'Sites',     tech: 'cco:Facility',         icon: 'building-2',     n: 38,   known: 91, family: 'place',     floor: 'org',  diff: 'has an address people go to' },
    { id: 'vehicle',   word: 'Vehicle',   plural: 'Vehicles',  tech: 'cco:GroundVehicle',    icon: 'truck',          n: 164,  known: 74, family: 'thing',     floor: 'dept', diff: 'moves under its own power' },
    { id: 'equipment', word: 'Equipment', plural: 'Equipment', tech: 'cco:MaterialArtifact', icon: 'package',        n: 702,  known: 68, family: 'thing',     floor: 'dept', diff: 'gets carried, towed or set up' },
    { id: 'contract',  word: 'Contract',  plural: 'Contracts', tech: 'cco:Agreement',        icon: 'file-signature', n: 446,  known: 83, family: 'agreement', floor: 'dept', diff: 'sets out who does what, and until when' },
    { id: 'incident',  word: 'Incident',  plural: 'Incidents', tech: 'cco:Act',              icon: 'siren',          n: 1105, known: 78, family: 'happening', floor: 'dept', diff: 'happened at a time and place' }
  ],
  /* the yes/no questions; each kind and predicted slot says which it answers yes to */
  questions: [
    { id: 'touch',   q: 'Could you touch it, stand on it or drive it?' },
    { id: 'stays',   q: 'Does it stay in one place?' },
    { id: 'self',    q: 'Does it move under its own power?' },
    { id: 'address', q: 'Does it have an address people go to?' },
    { id: 'line',    q: 'Does it run along a line, or cover an area, on the map?' }
  ],
  traits: {
    site: { touch: 1, stays: 1, address: 1, self: 0, line: 0 }, vehicle: { touch: 1, stays: 0, self: 1 }, equipment: { touch: 1, stays: 0, self: 0 },
    person: { touch: 0 }, supplier: { touch: 0 }, contract: { touch: 0 }, incident: { touch: 0 }
  },
  /* slots the table predicts, with the things waiting on them and how often each was asked for */
  predicted: [
    { id: 'route', family: 'place', word: 'Route or area', diff: 'runs along a line, or covers an area, on the map', traits: { touch: 1, stays: 1, address: 0, line: 1 }, asks: 4,
      details: [['Looked after by', 'link → Someone', 3], ['From and to', 'two places', 2], ['Length', 'a distance', 1], ['Worked on under', 'link → Contract', 1]],
      waiting: [
        { name: 'A614, Ollerton to Blyth', by: 'Dee Okafor', floor: 'team', on: 'today', said: 'runs along a line on the map', note: 'The 9 km stretch we resurface this winter.' },
        { name: 'Gritting route N3', by: 'Sam Whitlock', floor: 'team', on: '28 Oct', said: 'runs along roads we grit in order', note: 'Ashby to Ollerton, 14 stops.' },
        { name: 'A57 Worksop bypass verges', by: 'Lena Fry', floor: 'dept', on: '12 Sep', said: 'covers an area beside the road', note: 'Cut twice a year.' }
      ] },
    { id: 'estate', family: 'place', word: 'Estate', diff: 'is a group of places run together', asks: 0, waiting: [] },
    { id: 'network', family: 'thing', word: 'Network', diff: 'runs between places: drains, cables, pipes', asks: 1,
      waiting: [{ name: 'Ashby surface-water drains', by: 'the contract feed', floor: 'dept', on: '2 Oct', said: 'runs under the depot yard' }] },
    { id: 'fleet', family: 'thing', word: 'Fleet or set', diff: 'is many things looked after as one', asks: 2,
      waiting: [{ name: 'Gritter fleet North', by: 'Lena Fry', floor: 'dept', on: '20 Oct', said: 'is six gritters run as one' }] },
    { id: 'programme', family: 'happening', word: 'Programme of works', diff: 'goes on for weeks, in stages', asks: 1,
      waiting: [{ name: 'Winter resurfacing 2026/27', by: 'Lena Fry', floor: 'dept', on: '30 Oct', said: 'goes on all winter, in four phases' }] }
  ],
  /* waiting things that fall on no predicted slot */
  noSlot: [{ name: 'Salt stock, Ashby depot', by: 'Sam Whitlock', floor: 'team', on: '1 Nov', said: 'is an amount we keep topped up' }],
  hiddenWaiting: { floor: 'finance' },

  matching: 'Matched by name, spelling and keys. Matching by meaning is off on this deployment.',
  /* the two things the operator adds */
  things: {
    fits: {
      said: 'Welfare cabin WU-07', note: 'Towed cabin with a toilet and a kettle, hired for the A614 resurfacing.', from: 'From a hire confirmation email, typed in by Dee',
      answers: [['touch', 1], ['stays', 0], ['self', 0]], kind: 'equipment',
      record: [
        { d: 'Asset tag', v: 'WU-07', src: 'hire confirmation' },
        { d: 'Owned by', v: 'Hallam Plant Hire', link: 1, src: 'hire confirmation' },
        { d: 'Kept at', v: 'Ashby depot', link: 1, src: 'Dee Okafor' },
        { d: 'Serial number', gap: 'Hallam Plant Hire, on the hire contract' },
        { d: 'Last inspected', gap: 'Hallam Plant Hire, or Sam Whitlock at Ashby depot' },
        { d: 'Fuel store', none: ['Dee Okafor', 'today'] },
        { d: 'Registration', na: 'Equipment isn’t registered; that’s a Vehicle detail' }
      ],
      links: [['is kept at', 'Ashby depot'], ['is owned by', 'Hallam Plant Hire']]
    },
    misfit: {
      said: 'A614, Ollerton to Blyth', note: 'The 9 km stretch of road we are resurfacing this winter.', from: 'Typed in by Dee',
      answers: [['touch', 1], ['stays', 1], ['address', 0], ['line', 1]], kind: null, slot: 'route', closest: 'site',
      links: [['is looked after by', 'Ashby Road Crew'], ['is worked on under', 'Resurfacing 2026/09']]
    }
  },
  /* existing records the matcher finds; `rule` = answers that would set it apart */
  near: {
    fits: [
      { name: 'Welfare unit WU-7', kind: 'equipment', state: 'triage', where: 'Waiting in Triage since 14 Oct · proposed by the hire contract feed', dup: true,
        same: ['owned by Hallam Plant Hire', 'tag WU-7, one character from WU-07'], diff: 'kept at Retford depot, not Ashby' },
      { name: 'Welfare unit WU-03', kind: 'equipment', where: 'Kept on Highways and Depots · since March', same: ['owned by Hallam Plant Hire'], diff: 'tag WU-03' },
      { name: 'Trailer TR-12', kind: 'vehicle', where: 'Kept on Ashby Road Crew · since 2024', same: ['kept at Ashby depot'], diff: 'has a registration', out: ['self', 0] }
    ],
    misfit: [
      { name: 'Ashby depot', kind: 'site', where: 'Kept on Ashby Road Crew', same: ['stays in one place'], diff: 'has an address people go to', out: ['address', 0] },
      { name: 'A614 works, phase 1', kind: 'incident', where: 'Kept on Highways and Depots', same: ['names the A614'], diff: 'happened on one day', out: ['touch', 1] }
    ]
  },

  /* ---------------- v4: the structure changes ---------------- */
  change: {
    when: '17 Nov', kind: 'equipment',
    detail: { word: 'Next inspection date', type: 'a date', tech: 'vrs:nextInspectionDue · xsd:date', expected: 'Every piece of equipment should hold it. Missing ones show as Not known yet; nothing is blocked.' },
    why: 'The winter safety plan asks every piece of equipment to show when it is next inspected.',
    intent: 'Every hired welfare unit inspected before 1 December',
    byFloor: [{ floor: 'dept', n: 482 }, { floor: 'team', n: 120 }, { floor: 'sibling', n: 100 }],
    split: { known: 0, doc: 264, keeper: 417, nobody: 21 },
    keepers: 14, sites: 29, questions: 31,
    apps: [
      { app: 'Data Atlas', icon: 'map', what: 'Equipment list and every equipment record', change: 'Gain a row for the new detail, drawn as Not known yet until filled.' },
      { app: 'Mandate', icon: 'target', what: 'Intent “Every hired welfare unit inspected before 1 December”', change: 'Can now count against this detail. Today it counts by hand.' },
      { app: 'Artifacts', icon: 'file-text', what: 'Collection “Inspection certificates”', change: '264 documents become sources inside the rounds. Nothing in them changes.' },
      { app: 'Explorer', icon: 'compass', what: 'Saved view “Equipment by depot”', change: 'Unchanged. Its owner can add the new detail as a column.' }
    ],
    wont: ['No value is removed or rewritten.', '“Last inspected” stays; the new detail sits beside it, it doesn’t replace it.', 'An empty Next inspection date never stops anyone saving.'],
    similar: [['Vehicles', 'Next MOT'], ['Sites', 'Fire-safety check due']],
    rounds: [
      { name: 'Ashby round', who: 'Sam Whitlock', floor: 'team', q: 3, items: 15, mine: true },
      { name: 'Highways depots round', who: 'Lena Fry', floor: 'dept', q: 9, items: 214 },
      { name: 'Ollerton and Blyth round', who: 'Kofi Mensah', floor: 'dept', q: 6, items: 168 },
      { name: '10 more keepers’ rounds', who: 'site keepers', floor: 'dept', q: 9, items: 284 },
      { name: 'Retford round', who: 'Jo Marsh', floor: 'sibling', q: 2, items: 0, hidden: true },
      { name: 'Name a keeper', who: 'Priya Natarajan', floor: 'dept', q: 2, items: 21, lead: true }
    ],
    /* answers arriving from other rounds after the save (demo only): round index, documents confirmed, keeper-typed, nobody→keeper */
    arrivals: [{ r: 1, doc: 24, keeper: 7, q: 2 }, { r: 2, doc: 9, keeper: 3, q: 1 }, { r: 5, named: 11, q: 1 }],
    /* Sam's round: one question per site */
    myRound: [
      { site: 'Ashby depot', n: 9, rows: [
        { item: 'Welfare cabin WU-07', sug: '14 Jan 2027', src: 'Hallam hire pack, p. 3', rec: true },
        { item: 'Generator G-112', sug: '2 Feb 2027', src: 'Inspection certificate, Aug 2026' },
        { item: 'Generator G-118', sug: '2 Feb 2027', src: 'Inspection certificate, Aug 2026' },
        { item: 'Lighting tower LT-4', sug: '19 Dec 2026', src: 'Inspection certificate, Jun 2026' },
        { item: 'Pressure washer PW-2', sug: '5 Mar 2027', src: 'Inspection certificate, Sep 2026' },
        { item: 'Sign trailer ST-9', sug: '30 Nov 2026', src: 'Inspection certificate, May 2026' },
        { item: 'Road plate set RP-3', type: '11 Jan 2027' },
        { item: 'Compressor C-21', type: '24 Feb 2027' },
        { item: 'Barrier set B-40', cant: 'On loan to Retford; the hire company would know' }
      ] },
      { site: 'Ollerton yard', n: 4 },
      { site: 'Blyth compound', n: 2 }
    ],
    /* the operator's record (WU-07, now kept as Equipment on Ashby Road Crew) */
    record: {
      name: 'Welfare cabin WU-07', kind: 'equipment', floor: 'team', added: '3 Nov, by Dee Okafor',
      rows: [
        { d: 'Asset tag', v: 'WU-07' },
        { d: 'Owned by', v: 'Hallam Plant Hire', link: 1 },
        { d: 'Kept at', v: 'Ashby depot', link: 1 },
        { d: 'Serial number', gap: 'Hallam Plant Hire, on the hire contract' },
        { d: 'Last inspected', v: '2 Apr 2026', age: '7 months', stale: 'review after 6 months' },
        { d: 'Next inspection date', isNew: true },
        { d: 'Fuel store', none: ['Dee Okafor', '3 Nov'] },
        { d: 'Registration', na: 'Equipment isn’t registered' },
        { d: 'Hire cost', unseen: 'finance' }
      ],
      history: { from: '14 Oct', to: '29 Oct', why: 'the hire feed was down' }
    }
  }
};
