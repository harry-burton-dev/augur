/* ---- Sample data: ONE object. Every name, label, count and date on the page comes from here. ---- */
const DATA = {
  app: 'Data Atlas',
  org: 'Vale Regional Services',
  floor: { name: 'Facilities', kind: 'Department floor', note: 'You read what is kept here and on the floors above.' },
  me: { name: 'Alex Moreno', role: 'Facilities operator' },
  now: '2026-11-03T10:42',
  model: {
    on: true,
    name: 'the model gateway',
    offWhy: 'The model gateway is off on this deployment.',
    whoCan: 'Dev Malik, an admin, turns it on in Admin.',
    callsLeft: 412
  },
  kind: { one: 'supplier', many: 'suppliers', tech: 'cco:Organization ⊓ vrs:Supplier', keepers: 'Procurement desk' },
  // details a supplier has, plain word first, admin word one step down (T)
  details: {
    kind:      { label: 'what they do',      tech: 'vrs:serviceCategory' },
    region:    { label: 'where',             tech: 'vrs:operatesIn → Region' },
    value:     { label: 'worth a year',      tech: 'vrs:annualValue (GBP)' },
    lastHeard: { label: 'last heard from',   tech: 'max(observation.date) where about=supplier' },
    contracts: { label: 'contracts',         tech: 'count(vrs:holds → Contract)' },
    incidents: { label: 'open incidents',    tech: 'count(Incident where involved & open)' },
    does:      { label: 'in their own words', tech: 'rdfs:comment' }
  },
  kinds: { waste: 'waste', grounds: 'grounds', fleet: 'fleet', catering: 'catering', fuel: 'fuel', cleaning: 'cleaning', it: 'IT support', equipment: 'equipment', security: 'security' },
  regions: ['North', 'South', 'East', 'West', 'Coast'],
  // what "since spring" could mean: the clarification the desk asks
  spring: [
    { id: 'season', label: 'since 1 March', long: 'spring as the season, from 1 March', date: '2026-03-01' },
    { id: 'fy', label: 'since 1 April', long: 'your financial year, from 1 April', date: '2026-04-01' }
  ],
  // meaning = how close "in their own words" is to the example's, from the model gateway (a guess, 0..1)
  suppliers: [
    { id: 's1',  name: 'Greenway Haulage',        does: 'Bin and skip collection',            kind: 'waste',     region: 'North', value: 140, lastHeard: '2026-02-12', src: 'Invoice query, Procurement letters', contracts: 2, incidents: 1, meaning: 1 },
    { id: 's2',  name: 'Northfield Recycling',    does: 'Recycling haulage and sorting',      kind: 'waste',     region: 'North', value: 210, lastHeard: '2026-01-30', src: 'Quarterly review notes', contracts: 1, incidents: 0, meaning: .86 },
    { id: 's3',  name: 'Coastline Waste Services',does: 'Commercial waste collection',        kind: 'waste',     region: 'Coast', value: 95,  lastHeard: '2026-03-20', src: 'Phone log, Procurement desk', contracts: 1, incidents: 0, meaning: .91 },
    { id: 's4',  name: 'Brackley Skips',          does: 'Skip hire',                          kind: 'waste',     region: 'South', value: 38,  lastHeard: '2026-02-03', src: 'Purchase order 4471', contracts: 1, incidents: 2, meaning: .78, staleRegion: true },
    { id: 's5',  name: 'Fenwick Environmental',   does: 'Clinical and hazardous waste',       kind: 'waste',     region: 'East',  value: 160, lastHeard: '2026-09-14', src: 'Site visit report', contracts: 2, incidents: 0, meaning: .64 },
    { id: 's12', name: 'Riverbank Compost',       does: 'Green waste collection and composting', kind: 'grounds', region: 'North', value: 44,  lastHeard: '2026-01-15', src: 'Invoice, Accounts payable', contracts: 1, incidents: 0, meaning: .82 },
    { id: 's6',  name: 'Moorside Grounds',        does: 'Grounds maintenance and gritting',   kind: 'grounds',   region: 'North', value: 120, lastHeard: '2026-02-25', src: 'Winter plan meeting', contracts: 1, incidents: 0, meaning: .31 },
    { id: 's13', name: 'Ashby Bins',              does: 'Wheelie bin supply and repair',      kind: 'equipment', region: 'North', value: 30,  lastHeard: '2026-02-28', src: 'Delivery note', contracts: 1, incidents: 0, meaning: .52 },
    { id: 's16', name: 'Holm Road Salt',          does: 'Road salt supply',                   kind: 'grounds',   region: 'North', value: 52,  lastHeard: '2026-03-12', src: 'Order confirmation', contracts: 1, incidents: 0, meaning: .18 },
    { id: 's7',  name: 'Tarn Fleet Hire',         does: 'Van and lorry hire',                 kind: 'fleet',     region: 'North', value: 260, lastHeard: '2026-10-02', src: 'Fleet desk email', contracts: 3, incidents: 1, meaning: .27 },
    { id: 's9',  name: 'Pennine Fuel Cards',      does: 'Fuel cards for the fleet',           kind: 'fuel',      region: 'North', value: 180, lastHeard: '2025-12-19', src: 'Statement, Accounts payable', contracts: 1, incidents: 0, meaning: .08 },
    { id: 's14', name: 'Wolds Drainage',          does: 'Drain and gully clearance',          kind: 'grounds',   region: 'East',  value: 70,  lastHeard: '2026-04-30', src: 'Job sheet', contracts: 1, incidents: 0, meaning: .44 },
    { id: 's10', name: 'Dale Cleaning Co',        does: 'Office and depot cleaning',          kind: 'cleaning',  region: 'West',  value: 64,  lastHeard: null, gapWho: 'Sam Ortiz, Procurement desk', contracts: 1, incidents: 0, meaning: .22 },
    { id: 's8',  name: 'Harrow & Lyle Catering',  does: 'Canteen and event catering',         kind: 'catering',  region: 'South', value: 75,  lastHeard: '2026-05-11', src: 'Menu review', contracts: 1, incidents: 0, meaning: .05 },
    { id: 's11', name: 'Kestrel IT Support',      does: 'Desktop and network support',        kind: 'it',        region: 'West',  value: 90,  lastHeard: '2026-10-28', src: 'Service desk ticket', contracts: 1, incidents: 0, incidentsChecked: 'Duty desk, 1 Nov', meaning: .02 },
    { id: 's15', name: 'Summit Security',         does: 'Guarding and alarm response',        kind: 'security',  region: 'South', value: 110, lastHeard: '2026-07-07', src: 'Contract variation', contracts: 1, incidents: 0, meaning: .06 },
    { id: 's17', name: 'Eastgate Waste Ltd',      does: 'Bulky waste collection',             kind: 'waste',     region: 'East',  value: 58,  lastHeard: null, gapWho: 'Sam Ortiz, Procurement desk', contracts: 1, incidents: 0, meaning: .88 }
  ],
  // suppliers kept on a floor this person can't open: counted as "some", never a number
  hidden: { floor: 'Finance', ask: 'Priya Nair, finance lead', what: 'suppliers paid only by Finance' },
  // where the example came from, and what uses it
  usedBy: {
    s1: { intents: ['Re-tender waste collection before April (Mandate, due 31 Jan 2027)'], docs: ['Greenway contract 2024', 'Invoice query, 12 Feb'] }
  },
  people: { procurement: 'Sam Ortiz, Procurement desk', admin: 'Dev Malik', triage: 'Jo Reyes' },
  saved: { count: 4 },
  // what the model gateway returns for words that are not a kind (sample; a guess until the person accepts it)
  modelWords: { 'bin lorries': 'waste', 'bins': 'waste', 'rubbish': 'waste', 'gritting': 'grounds' },
  question: 'which suppliers have we not heard from since spring?'
};
