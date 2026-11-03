/* ===== Sample data: every word, kind, count and name on this sheet comes from here.
   A different deployment brings its own ontology; nothing below is drawn for one trade. ===== */
const DATA = {
  deployment: 'Regional services (sample)',
  floors: {
    ops:     { name: 'Operations', tier: 'department' },
    fleet:   { name: 'Fleet', tier: 'team' },
    finance: { name: 'Finance', tier: 'team' },
    org:     { name: 'Whole organisation', tier: 'org' }
  },
  apps: { atlas: 'Data Atlas', artifacts: 'Artifacts', mandate: 'Mandate' },
  /* Kinds of thing. tech = the pack term one step down (illustrative). exp = should have; known = cards that hold it. */
  kinds: [
    { id: 'site', name: 'Site', plural: 'Sites', icon: 'building-2', count: 34, floor: 'ops', tech: 'cco:Facility',
      details: [
        { n: 'Site code', fam: 'key', exp: true, known: 34, key: true },
        { n: 'Address', fam: 'place', exp: true, known: 34 },
        { n: 'Opening hours', fam: 'time', exp: true, known: 21 },
        { n: 'Site manager', fam: 'people', exp: true, known: 30, link: true },
        { n: 'Fire inspection', fam: 'paper', exp: true, known: 26 },
        { n: 'Running cost', fam: 'money', exp: false, known: 9 },
        { n: 'Fuel store', fam: 'condition', exp: false, known: 19 } ] },
    { id: 'supplier', name: 'Supplier', plural: 'Suppliers', icon: 'handshake', count: 61, floor: 'org', tech: 'cco:Organization',
      details: [
        { n: 'Company number', fam: 'key', exp: true, known: 61, key: true },
        { n: 'Registered address', fam: 'place', exp: true, known: 58 },
        { n: 'Contact person', fam: 'people', exp: true, known: 40, link: true },
        { n: 'Insurance certificate', fam: 'paper', exp: true, known: 37 },
        { n: 'Credit limit', fam: 'money', exp: false, known: 12 } ] },
    { id: 'contract', name: 'Contract', plural: 'Contracts', icon: 'file-signature', count: 118, floor: 'ops', tech: 'own term (no pack match)',
      details: [
        { n: 'Contract number', fam: 'key', exp: true, known: 118, key: true },
        { n: 'Start and end', fam: 'time', exp: true, known: 109 },
        { n: 'Contract owner', fam: 'people', exp: true, known: 97, link: true },
        { n: 'Value', fam: 'money', exp: true, known: 88 },
        { n: 'Signed copy', fam: 'paper', exp: true, known: 71 } ] },
    { id: 'person', name: 'Person', plural: 'People', icon: 'user', count: 412, floor: 'org', tech: 'cco:Person',
      details: [
        { n: 'Staff number', fam: 'key', exp: true, known: 380, key: true },
        { n: 'Works at', fam: 'place', exp: true, known: 371, link: true },
        { n: 'Role', fam: 'people', exp: true, known: 402 },
        { n: 'First-aid certificate', fam: 'paper', exp: false, known: 96 } ] },
    { id: 'vehicle', name: 'Vehicle', plural: 'Vehicles', icon: 'truck', count: 87, floor: 'fleet', tech: 'cco:GroundVehicle',
      details: [
        { n: 'Registration', fam: 'key', exp: true, known: 87, key: true },
        { n: 'Based at', fam: 'place', exp: true, known: 81, link: true },
        { n: 'Next service', fam: 'time', exp: true, known: 74 },
        { n: 'Fuel', fam: 'condition', exp: true, known: 81 },
        { n: 'Lease cost', fam: 'money', exp: false, known: 40 } ] },
    { id: 'incident', name: 'Incident', plural: 'Incidents', icon: 'siren', count: 230, floor: 'ops', tech: 'own term, broader: Event',
      details: [
        { n: 'Reference', fam: 'key', exp: true, known: 230, key: true },
        { n: 'Happened at', fam: 'place', exp: true, known: 219, link: true },
        { n: 'When', fam: 'time', exp: true, known: 230 },
        { n: 'Reported by', fam: 'people', exp: true, known: 201, link: true },
        { n: 'Severity', fam: 'condition', exp: true, known: 188 } ] }
  ],
  /* Things kept by other apps that Data Atlas points at. */
  elsewhere: [
    { id: 'document', name: 'Document', plural: 'Documents', icon: 'file-text', count: 1904, app: 'artifacts', role: 'where details came from' },
    { id: 'intent', name: 'Intent', plural: 'Intents', icon: 'target', count: 52, app: 'mandate', role: 'what uses a card' }
  ],
  /* Detail families: the columns a periodic-style sheet groups details by. */
  families: [
    { id: 'key', name: 'Name and key' }, { id: 'place', name: 'Where' }, { id: 'time', name: 'When' },
    { id: 'people', name: 'Who' }, { id: 'condition', name: 'Condition' }, { id: 'money', name: 'Money' }, { id: 'paper', name: 'Paperwork' }
  ],
  /* Kinds of link, each read both ways. one/many in plain words. */
  links: [
    { from: 'contract', to: 'supplier', verb: 'is held by', back: 'holds', fromN: 'one', toN: 'any number of', tech: 'heldBy / inverse holds' },
    { from: 'contract', to: 'site', verb: 'covers', back: 'is covered by', fromN: 'any number of', toN: 'any number of', tech: 'covers / coveredBy' },
    { from: 'vehicle', to: 'site', verb: 'is based at', back: 'is the base for', fromN: 'one', toN: 'any number of', tech: 'basedAt / baseFor' },
    { from: 'incident', to: 'site', verb: 'happened at', back: 'was where', fromN: 'one', toN: 'any number of', tech: 'occursAt (cco)' },
    { from: 'incident', to: 'vehicle', verb: 'involved', back: 'was involved in', fromN: 'any number of', toN: 'any number of', tech: 'involves / involvedIn' },
    { from: 'site', to: 'person', verb: 'is managed by', back: 'manages', fromN: 'one', toN: 'any number of', tech: 'managedBy / manages' }
  ],
  /* One card, used as the specimen. */
  record: {
    kind: 'site', name: 'Kestrel Road Depot', other: 'KRD, North depot', key: { n: 'Site code', v: 'KRD-04' }, floor: 'ops',
    id: 'ent_01JB7Q4K2S9V3XGM8T0N5RWD6E',
    details: [
      { n: 'Address', v: '14 Kestrel Road, Hallam North', ref: 1, state: 'known' },
      { n: 'Opening hours', state: 'gap', who: 'Operations leads can add it', hint: 'Mara Okafor would know' },
      { n: 'Site manager', v: 'Mara Okafor', link: true, ref: 2, state: 'known' },
      { n: 'Fire inspection', v: '12 Mar 2025', ref: 3, state: 'stale', age: '19 months', who: 'Facilities can refresh it' },
      { n: 'Fuel store', v: 'None', ref: 4, state: 'none' }
    ],
    could: ['Running cost'],
    links: [
      { verb: 'is the base for', n: 9, kind: 'Vehicles' },
      { verb: 'is covered by', n: 3, kind: 'Contracts' },
      { verb: 'was where', n: 14, kind: 'Incidents' }
    ],
    hidden: { n: 'Lease', what: 'a contract', floor: 'finance', who: 'Ask Finance leads' },
    usedBy: { n: 2, what: 'intents in Mandate' },
    noRecord: { from: '2019', to: 'Mar 2021', why: 'moved from the old asset register' },
    sources: [
      { id: 1, kind: 'document', icon: 'file-text', what: 'Site register 2026', app: 'Artifacts', grade: 'B2', sure: 'usually reliable, probably true' },
      { id: 2, kind: 'person', icon: 'user', what: 'Dev Patel, 3 Oct 2026', app: 'a person', grade: 'A1', sure: 'reliable, confirmed' },
      { id: 3, kind: 'document', icon: 'file-text', what: 'Fire safety log', app: 'Artifacts', grade: 'B2', sure: 'usually reliable, probably true' },
      { id: 4, kind: 'document', icon: 'file-text', what: 'Fleet inspection, Jun 2026', app: 'Artifacts', grade: 'B1', sure: 'usually reliable, confirmed' }
    ]
  },
  /* The vocabulary of the run. plain first; tech one step down; never = the misreadings each word must not allow. */
  terms: [
    { id: 'kind', plain: 'Kind of thing', say: 'What something is: a site, a supplier, a vehicle. Every card has one kind; kinds can sit inside broader kinds.',
      tech: 'class · owl:Class · "type" in the API', studio: 'pack term by IRI, parent class',
      mark: 'Lucide icon in a --radius-key square, --hairline-strong edge · count in --font-mono · no hue',
      never: 'a folder, a floor, a team or a tag. A kind says what a thing is, never where it is kept.' },
    { id: 'detail', plain: 'Detail', say: 'One thing worth knowing about every thing of a kind: an address, a registration, an end date.',
      tech: 'property · owl:DatatypeProperty', studio: 'range (datatype), identity key flag',
      mark: 'name in --type-small --ink-muted, value in --ink below or beside it',
      never: 'a comment, a note, or a column you add for yourself. If its value is another thing, it is a link.' },
    { id: 'link', plain: 'Link', say: 'How two things connect, said as a verb both ways: a contract is held by a supplier; the supplier holds it.',
      tech: 'relation · owl:ObjectProperty + inverse', studio: 'domain, range, owl:inverseOf',
      mark: '1px --x-link line · verb at mid-line · backward reading below at --x-quiet',
      never: 'a web link, ownership, or "related to". A link without a verb is not a link.' },
    { id: 'facet', plain: 'Filter', say: 'A question you answer to narrow the list (what kind, where, when), each choice saying how many it leaves.',
      tech: 'facet · a detail or link used for browsing', studio: 'facet order per kind',
      mark: 'chip: name · value · count left, in --font-mono · chosen: --surface-raised, --hairline-strong',
      never: 'a saved search, a tag, a sort, or a hidden rule. A count is what the choice leaves, never a total.' },
    { id: 'card', plain: 'Card', say: 'One real thing, on one card. Every card of a kind has the same shape, so any of them reads the same way.',
      tech: 'entity · individual · ent_ + ULID', studio: 'owl:NamedIndividual, the id',
      mark: 'fixed zones: kind, name, key, details, links, where it came from · --radius-inset · 2px floor edge',
      never: 'a document (that is Artifacts), a copy, or the thing itself. Retiring a card never deletes it.' },
    { id: 'gap', plain: 'Not known yet', say: 'A detail this kind should have that this card does not: drawn where it would be, with who could fill it.',
      tech: 'missing value · expected property, no accepted fact', studio: 'sh:minCount 1 not met',
      mark: '--x-gap: four 1px corner ticks, --space-2 long · empty inside · words + who · Add if you may',
      never: 'none, zero, hidden, old or broken. Never blocks saving, never red.' },
    { id: 'source', plain: 'Where it came from', say: 'What every detail rests on: a document in Artifacts, a person, a register. How sure, in words.',
      tech: 'observation · provenance · grade (B2)', studio: 'prov:wasDerivedFrom, Admiralty grade',
      mark: 'numbered note in --font-mono · file-text or user icon · how sure in words, letters one step down',
      never: 'who typed it, or proof. A withdrawn source stays, struck, and stops counting.' },
    { id: 'floor', plain: 'Kept on', say: 'The floor that keeps a card and can change it. You see what is kept on your floor and the floors above.',
      tech: 'workspace · X-Workspace-Id', studio: 'floor fence, raise to a floor above',
      mark: '2px left edge in --floor-*-high · floor name',
      never: 'a kind, a category or importance. Floor hue never marks a kind or a state.' },
    { id: 'expected', plain: 'Should have', say: 'What a kind expects every card to hold. A missing "should have" is a gap; a missing "can have" is listed once, quietly.',
      tech: 'cardinality · min 1 (should) or min 0 (can)', studio: 'sh:minCount, owl:minCardinality',
      mark: '--x-expected: 2px tick before the detail name · "can have" details carry none',
      never: 'compulsory, a rule that stops work, or a score to hit.' }
  ],
  /* Six things that can look empty, and are not the same. */
  states: [
    { id: 'gap', plain: 'Not known yet', tech: 'missing value', from: 'this run', d: 'Should be on this card; nobody has recorded it.', never: 'none' },
    { id: 'none', plain: 'None', tech: 'stated absence', from: 'this run', d: 'Someone checked: there is none. A value, with its source.', never: 'a gap' },
    { id: 'stale', plain: 'Out of date', tech: 'stale · hatch 45°', from: 'wear and time', d: 'Known but old: says how old and who can refresh it.', never: 'unavailable' },
    { id: 'norecord', plain: 'No record', tech: 'record gap · unconformity', from: 'wear and time', d: 'A hole in time: we don’t know what happened, and why.', never: 'nothing happened' },
    { id: 'shadow', plain: 'Not yours to see', tech: 'unseen · shadow 135°', from: 'light language', d: 'It exists, kept elsewhere: which floor, who to ask.', never: 'missing' },
    { id: 'could', plain: 'Could also hold', tech: 'optional, min 0', from: 'this run', d: 'Not expected for this kind. Named once, never drawn as a slot.', never: 'a gap' }
  ]
};
