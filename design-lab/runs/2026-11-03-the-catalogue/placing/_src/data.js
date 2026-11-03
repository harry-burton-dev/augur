/* ======================================================================
   Sample data: every name, word, count and question on this page comes
   from here. In AUGUR it comes from Data Atlas: the ontology (kinds,
   their details and links, each with a plain word and a studio word),
   counts per kind, Triage, and the people who decide (steward, admin).
   A regional services deployment; nothing here is drawn for one domain.
   ====================================================================== */
const DATA = {
  app: 'Data Atlas',
  floor: { kind: 'Team', name: 'Ashby Road Crew', above: 'Highways and Depots' },
  viewer: { name: 'Dee Okafor', role: 'Crew coordinator' },
  steward: { name: 'Priya Natarajan', role: 'Data steward', floor: 'Highways and Depots' },
  admin: { name: 'Tom Rees', role: 'Data Atlas admin', floor: 'Org' },
  nav: [
    { label: 'Things we keep', icon: 'boxes', n: 4597 },
    { label: 'Kinds of thing', icon: 'shapes', n: 7 },
    { label: 'Add a thing', icon: 'message-square-plus', on: true },
    { label: 'Triage', icon: 'inbox', n: 7 }
  ],
  /* plain word first, studio word one step down */
  words: {
    kind: ['kind of thing', 'class'], detail: ['detail', 'data property'], link: ['link', 'object property'],
    near: ['is it one of these?', 'candidate match (entity resolution)'], triage: ['Triage', 'proposal queue'],
    ask: ['ask for a new kind', 'ontology change request'], gap: ['not known yet', 'expected property, no value'],
    key: ['the key', 'decision tree over class axioms'], genus: ['what it is', 'superclass'], diff: ['what sets it apart', 'differentia'],
    example: ['like this one', 'exemplar / type specimen']
  },
  matching: { byMeaning: false, note: 'Matched by name, spelling and keys. Matching by meaning is off on this deployment.' },
  steps: { fits: ['Say what it is', 'Find its kind', 'Is it one of these?', 'Triage'], misfit: ['Say what it is', 'Find its kind', 'Ask for a kind', 'Waits in Triage'] },

  /* what a thing is (genus) and its shape: the two axes the kinds sit on */
  genera: [
    { id: 'place', word: 'Place', a: 'a place', studio: 'Site (BFO)' },
    { id: 'thing', word: 'Thing', a: 'a thing', studio: 'Material Artifact' },
    { id: 'someone', word: 'Someone', a: 'someone', studio: 'Agent' },
    { id: 'agreement', word: 'Agreement', a: 'an agreement', studio: 'Directive Information Content Entity' },
    { id: 'happening', word: 'Happening', a: 'something that happened', studio: 'Process' }
  ],
  shapes: [
    { id: 'point', word: 'One, in one spot', studio: '0-dimensional / object' },
    { id: 'line', word: 'Along a line, or over an area', studio: '1- or 2-dimensional region' },
    { id: 'many', word: 'Many, counted as one', studio: 'Object aggregate' }
  ],
  kinds: [
    { id: 'site', word: 'Site', studio: 'Facility', icon: 'building-2', n: 38, genus: 'place', shape: 'point',
      diff: 'has an address people go to', says: 'A place with an address where people work: a depot, a yard, an office.',
      has: ['Address', 'Run by', 'Opening hours', 'Capacity'], is: ['touch', 'stays', 'address'], eg: 'Ashby depot' },
    { id: 'vehicle', word: 'Vehicle', studio: 'Ground Vehicle', icon: 'truck', n: 164, genus: 'thing', shape: 'point',
      diff: 'moves under its own power', says: 'Moves under its own power, with a registration: a gritter, a van, a sweeper.',
      has: ['Registration', 'Based at', 'Mileage', 'Next MOT'], is: ['touch', 'self'], eg: 'Gritter GR-04' },
    { id: 'equipment', word: 'Equipment', studio: 'Material Artifact', icon: 'package', n: 702, genus: 'thing', shape: 'point',
      diff: 'gets carried, towed or set up', says: 'Carried, towed or set up, with an asset tag: a generator, a cabin, a sign.',
      has: ['Asset tag', 'Owned by', 'Kept at', 'Serial number', 'Last inspected'], is: ['touch'], eg: 'Welfare unit WU-03' },
    { id: 'person', word: 'Person', studio: 'Person', icon: 'user', n: 1930, genus: 'someone', shape: 'point',
      diff: 'is one person', says: 'One person: staff, a contractor, a member of the public.',
      has: ['Name', 'Role', 'Works at', 'Phone'], is: ['someone', 'one'], eg: 'Sam Whitlock' },
    { id: 'supplier', word: 'Supplier', studio: 'Organization (supplier role)', icon: 'handshake', n: 212, genus: 'someone', shape: 'many',
      diff: 'is a company we buy or hire from', says: 'A company we buy from or hire from.',
      has: ['Company number', 'Address', 'Contact', 'Approved until'], is: ['someone'], eg: 'Hallam Plant Hire' },
    { id: 'contract', word: 'Contract', studio: 'Agreement', icon: 'file-signature', n: 446, genus: 'agreement', shape: 'point',
      diff: 'sets out who does what, and until when', says: 'Agreed between us and someone, with dates: a hire, a service deal.',
      has: ['Parties', 'Starts', 'Ends', 'Value'], is: ['agreed'], eg: 'Plant hire 2026/14' },
    { id: 'incident', word: 'Incident', studio: 'Act', icon: 'siren', n: 1105, genus: 'happening', shape: 'point',
      diff: 'happened at a time and place', says: 'Something that happened at a time and place: a collision, a spill, a near miss.',
      has: ['When', 'Where', 'Reported by', 'Severity'], is: ['happened'], eg: 'Spill at Blyth layby' }
  ],
  /* cells the two axes predict but nobody has made a kind for (Mendeleev's gaps) */
  predicted: [
    { genus: 'place', shape: 'line', word: 'Route or area', diff: 'runs along a line, or covers an area, on the map', asks: [{ by: 'Highways and Depots', on: '12 Sep' }] },
    { genus: 'thing', shape: 'line', word: 'Network', diff: 'runs between places: drains, cables, pipes', asks: [] },
    { genus: 'place', shape: 'many', word: 'Estate', diff: 'is a group of places run together', asks: [] },
    { genus: 'thing', shape: 'many', word: 'Fleet or set', diff: 'is many things looked after as one', asks: [] },
    { genus: 'happening', shape: 'line', word: 'Programme of works', diff: 'goes on for weeks, in stages', asks: [] }
  ],
  /* kept by other pillar apps: the honest redirect, never a dead end */
  elsewhere: [
    { id: 'document', word: 'Document', app: 'Artifacts', icon: 'file-text', says: 'Written down: a report, a letter, a form.', is: ['written'] },
    { id: 'intent', word: 'Something asked for', app: 'Mandate', icon: 'target', says: 'An ask, with someone responsible and a date.', is: ['asked'] }
  ],
  /* yes/no questions over what each kind "is" (twenty questions, trays) */
  questions: [
    { id: 'written', q: 'Is it written down, like a report, a letter or a form?' },
    { id: 'touch', q: 'Could you touch it, stand on it or drive it?' },
    { id: 'someone', q: 'Is it someone: a person or a company?' },
    { id: 'stays', q: 'Does it stay in one place?' },
    { id: 'self', q: 'Does it move under its own power?' },
    { id: 'address', q: 'Does it have an address people go to?' },
    { id: 'one', q: 'Is it one person?' },
    { id: 'agreed', q: 'Is it something agreed, with dates?' },
    { id: 'happened', q: 'Is it something that happened, at a time?' },
    { id: 'asked', q: 'Is it something someone has asked to be done?' }
  ],
  /* the dichotomous key, written by the admin from the same kinds */
  key: [
    { n: 1, a: ['You could touch it, stand on it or drive it', 2], b: ['You couldn’t: it’s someone, an agreement or a happening', 5] },
    { n: 2, a: ['It stays in one place', 3], b: ['It can be moved', 4] },
    { n: 3, a: ['It has an address people go to', 'site'], b: ['It runs along a line, or covers an area, on the map', null] },
    { n: 4, a: ['It moves under its own power, with a registration', 'vehicle'], b: ['It is carried, towed or set up', 'equipment'] },
    { n: 5, a: ['It’s someone', 6], b: ['It was agreed, or it happened', 7] },
    { n: 6, a: ['One person', 'person'], b: ['A company we buy or hire from', 'supplier'] },
    { n: 7, a: ['Agreed between people, with dates', 'contract'], b: ['Happened at a time and place', 'incident'] }
  ],
  things: {
    fits: {
      said: 'Welfare cabin WU-07', note: 'Towed cabin with a toilet and a kettle, hired for the A614 resurfacing.',
      from: 'From a hire confirmation email, typed in by Dee', kind: 'equipment', genus: 'thing', shape: 'point',
      is: ['touch'], keyPath: ['1a', '2b', '4b'],
      known: { 'Asset tag': 'WU-07', 'Owned by': 'Hallam Plant Hire', 'Kept at': 'Ashby depot' },
      gaps: { 'Serial number': 'Hallam Plant Hire, on the hire contract', 'Last inspected': 'Fleet team, Highways and Depots' },
      links: [['is kept at', 'Ashby depot', 'site'], ['is owned by', 'Hallam Plant Hire', 'supplier'], ['is hired under', 'Plant hire 2026/14', 'contract']],
      like: 'wu3',
      tryOn: { vehicle: { 'Registration': false, 'Based at': 'Ashby depot', 'Mileage': false, 'Next MOT': false } },
      route: ['vehicle', 'equipment']
    },
    misfit: {
      said: 'A614, Ollerton to Blyth', note: 'The 9 km stretch of road we are resurfacing this winter.',
      from: 'Typed in by Dee', kind: null, genus: 'place', shape: 'line', closest: 'site',
      is: ['touch', 'stays'], keyPath: ['1a', '2a', '3b'],
      words: 'like a Site, but along a line on the map', like: 'ashby',
      /* held up against a kind: a value, false = it can't have one, null = could have, not known */
      tryOn: { site: { 'Address': false, 'Run by': 'Ashby Road Crew', 'Opening hours': false, 'Capacity': false } },
      route: ['site', 'nofit'],
      links: [['is looked after by', 'Ashby Road Crew', null], ['is worked on under', 'Resurfacing 2026/09', 'contract']]
    }
  },
  /* existing entities the matcher found (matched by name, spelling, keys) */
  near: {
    fits: [
      { id: 'wu7', name: 'Welfare unit WU-7', kind: 'equipment', where: 'Proposed by the hire contract feed · in Triage since 14 Oct', lead: true,
        same: ['Owned by Hallam Plant Hire', 'Tag WU-7, one character from WU-07'], diff: ['Kept at Retford depot, not Ashby'] },
      { id: 'wu3', name: 'Welfare unit WU-03', kind: 'equipment', where: 'Kept on Highways and Depots · since March',
        same: ['Owned by Hallam Plant Hire'], diff: ['Tag WU-03', 'Kept at Ollerton yard'] },
      { id: 'tr12', name: 'Trailer TR-12', kind: 'vehicle', where: 'Kept on Ashby Road Crew · since 2024',
        same: ['Kept at Ashby depot', 'Towed'], diff: ['A Vehicle: has a registration'] }
    ],
    misfit: [
      { id: 'ashby', name: 'Ashby depot', kind: 'site', where: 'Kept on Ashby Road Crew',
        same: ['Stays in one place'], diff: ['Has an address', 'People work there'] },
      { id: 'a614w', name: 'A614 works, phase 1', kind: 'incident', where: 'Kept on Highways and Depots',
        same: ['Names the A614'], diff: ['An Incident: it happened on one day'] }
    ]
  },
  examples: ['wu3', 'tr12', 'ashby', 'sam', 'hire', 'spill'],
  entities: {
    wu3: { name: 'Welfare unit WU-03', kind: 'equipment', d: { 'Asset tag': 'WU-03', 'Owned by': 'Hallam Plant Hire', 'Kept at': 'Ollerton yard', 'Serial number': 'HPH-WC-2231', 'Last inspected': '2 Oct' } },
    tr12: { name: 'Trailer TR-12', kind: 'vehicle', d: { 'Registration': 'TR12 ARC', 'Based at': 'Ashby depot', 'Mileage': '—', 'Next MOT': 'Feb 2027' } },
    ashby: { name: 'Ashby depot', kind: 'site', d: { 'Address': 'Mansfield Rd, Ashby', 'Run by': 'Sam Whitlock', 'Opening hours': '06:00–18:00', 'Capacity': '40 vehicles' } },
    sam: { name: 'Sam Whitlock', kind: 'person', d: { 'Name': 'Sam Whitlock', 'Role': 'Depot manager', 'Works at': 'Ashby depot', 'Phone': '07700 900412' } },
    hire: { name: 'Plant hire 2026/14', kind: 'contract', d: { 'Parties': 'Us, Hallam Plant Hire', 'Starts': '1 Nov', 'Ends': '31 Mar', 'Value': '£18,400' } },
    spill: { name: 'Spill at Blyth layby', kind: 'incident', d: { 'When': '22 Oct, 14:10', 'Where': 'Blyth layby', 'Reported by': 'Sam Whitlock', 'Severity': 'Low' } }
  },
  /* the demo: which answers the operator gives, in order */
  demo: { fits: 'fits', misfit: 'misfit' }
};
