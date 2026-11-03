/* ======================================================================
   One sample deployment, shared by both combined screens (prefix a).
   Every name, date, count, sentence and reason on the page comes from
   here or is computed from it by run() in common.js. Nothing is typed in.
   In AUGUR: suppliers, contracts and contacts from Data Atlas (with the
   floor each is kept on and the day each arrived), meeting notes from
   Artifacts, people and floors from identity, words from the deployment's
   word list, the saved question from Data Atlas. Swap DATA and both
   screens redraw.
   ====================================================================== */
const DATA = {
  app: 'Data Atlas',
  org: 'Vale Regional Services',
  hiddenCount: 'some',                      /* records on floors you can't open: "some", never a number (catalogue) */
  floors: {
    you:        { name: 'Your own floor', tier: 'you', word: 'You' },
    depot:      { name: 'Depot operations', tier: 'team', word: 'Team floor', lead: 'Marta Kowal', people: 16 },
    facilities: { name: 'Facilities', tier: 'department', word: 'Department floor', lead: 'Ade Bello', people: 38 },
    finance:    { name: 'Finance', tier: 'department', word: 'Department floor', lead: 'Priya Nair', people: 22 },
    org:        { name: 'Vale Regional Services', tier: 'org', word: 'Org floor', people: 412 }
  },
  /* the floor stack for sharing, Org at the top (up is towards Org) */
  stack: ['org', 'finance', 'facilities', 'depot'],
  /* a floor shows what's kept on it and the floors above, never below or beside */
  people: {
    sam:   { name: 'Sam Okafor', first: 'Sam', initials: 'SO', role: 'Operator', floor: 'facilities', sees: ['you', 'facilities', 'org'] },
    priya: { name: 'Priya Nair', first: 'Priya', initials: 'PN', role: 'Finance lead', floor: 'finance', sees: ['you', 'finance', 'org'] }
  },
  keeper: { name: 'Joy Mensah', desk: 'the supplier desk', floor: 'org' },       /* fills "not known yet", accepts Triage proposals */
  admin:  { name: 'Ade Bello', role: 'Facilities admin' },                        /* turns the model gateway on */
  /* where "last contact" is read from, and the floor each is kept on */
  sources: {
    log:   { plain: 'Supplier contact log', what: 'emails and calls', floor: 'org', app: 'Data Atlas', tech: 'atlas · ContactEvent' },
    notes: { plain: 'Meeting notes', what: 'meetings', floor: 'facilities', app: 'Artifacts', tech: 'artifacts · Facilities library · names read from text' }
  },
  /* the deployment's own words, used without any model */
  words: {
    spring: { said: 'since spring', readings: [
      { id: 'mar', date: '2026-03-01', label: '1 March', why: 'spring, the season' },
      { id: 'apr', date: '2026-04-01', label: '1 April', why: 'our financial year' }] },
    contact: { said: 'heard from', kinds: ['email', 'call', 'meeting'], more: ['delivery note', 'invoice query'], listed: 'email, call or meeting' },
    suppliers: { said: 'suppliers', readings: [
      { id: 'running', label: 'with a contract running', why: 'on the day it runs' },
      { id: 'all', label: 'any supplier', why: 'running or ended' }] },
    we: { said: 'we', readings: [{ id: 'fac', label: 'Facilities' }, { id: 'all', label: 'everything you can see' }] }
  },
  /* the call log lost March and April 2026 at the phone switch-over: "no record", nobody can close it */
  lost: { source: 'log', via: 'call', from: '2026-03-01', to: '2026-04-30', why: 'the phone switch-over lost the call log for March and April' },
  /* The suppliers. keptOn = the floor the supplier and its contract are kept on.
     contacts: on = the day it happened, logged = the day it arrived (if later).
     meaning: a record that names the supplier only by meaning; the model gateway
     can propose the match, it is never counted. */
  suppliers: [
    { id: 'ashby',   name: 'Ashby Grounds Ltd',      keptOn: 'org', contract: ['2024-04-01', '2027-03-31'], contacts: [{ on: '2026-02-14', src: 'log', via: 'email' }] },
    { id: 'bright',  name: 'Brightwater Cleaning',   keptOn: 'org', contract: ['2025-01-01', '2027-12-31'], contacts: [{ on: '2025-12-11', src: 'log', via: 'email' }],
      meaning: { on: '2026-04-04', src: 'notes', via: 'meeting', said: '“the Brightwater team came about the deep clean”', clue: 'the word Brightwater, no company number' } },
    { id: 'dunmore', name: 'Dunmore Waste',          keptOn: 'facilities', contract: ['2025-06-01', '2028-05-31'], contacts: [{ on: '2026-02-20', src: 'notes', via: 'meeting' }] },
    { id: 'fenwick', name: 'Fenwick Lifts',          keptOn: 'org', contract: ['2024-09-01', '2027-08-31'], contacts: [{ on: '2025-12-03', src: 'log', via: 'email' }],
      meaning: { on: '2026-05-22', src: 'log', via: 'email', said: '“from the lift maintenance crew, re: Depot B”', clue: 'only lift supplier on record; no name in it' } },
    { id: 'kestrel', name: 'Kestrel Security',       keptOn: 'org', contract: ['2025-02-01', '2027-01-31'], contacts: [
      { on: '2026-02-26', src: 'log', via: 'email' },
      { on: '2026-10-30', src: 'log', via: 'email', logged: '2026-10-30', note: 'replied about the winter rota' }] },
    { id: 'northg',  name: 'Northgate Fuels',        keptOn: 'org', contract: ['2025-04-01', '2027-03-31'], contacts: [{ on: '2026-02-10', src: 'log', via: 'email' }] },
    { id: 'sefton',  name: 'Sefton Print',           keptOn: 'org', contract: ['2023-07-01', '2027-06-30'], contacts: [{ on: '2026-01-05', src: 'log', via: 'email' }],
      meaning: { on: '2026-04-07', src: 'log', via: 'email', said: '“accounts@sp-group: re the leaflet run”', clue: 'a print job, a sender name close to no supplier' } },
    { id: 'harrow',  name: 'Harrow Electrical',      keptOn: 'org', contract: ['2024-01-01', '2027-12-31'], contacts: [{ on: '2026-03-12', src: 'log', via: 'email' }] },
    { id: 'quarry',  name: 'Quarry Lane Plant Hire', keptOn: 'org', contract: ['2024-01-01', '2026-12-31'], contacts: [{ on: '2026-03-20', src: 'log', via: 'email' }] },
    { id: 'lindq',   name: 'Lindqvist Pumps',        keptOn: 'org', contract: ['2025-05-01', '2027-04-30'], contacts: [{ on: '2026-03-24', src: 'log', via: 'email' }] },
    { id: 'orchard', name: 'Orchard Catering',       keptOn: 'org', contract: ['2025-09-01', '2027-08-31'], contacts: [{ on: '2026-06-03', src: 'log', via: 'email' }] },
    { id: 'pell',    name: 'Pell & Rowe Surveyors',  keptOn: 'org', contract: ['2025-01-01', '2027-12-31'], contacts: [{ on: '2026-10-20', src: 'log', via: 'call' }] },
    { id: 'tarn',    name: 'Tarn Water Testing',     keptOn: 'org', contract: ['2025-03-01', '2027-02-28'], contacts: [{ on: '2026-09-15', src: 'log', via: 'email' }] },
    { id: 'upton',   name: 'Upton Hygiene',          keptOn: 'org', contract: ['2024-05-01', '2027-04-30'], contacts: [{ on: '2026-08-19', src: 'log', via: 'email' }] },
    { id: 'greyf',   name: 'Greyfriars Security',    keptOn: 'org', contract: ['2025-07-01', '2027-06-30'], contacts: [{ on: '2026-07-02', src: 'log', via: 'call' }] },
    { id: 'marsh',   name: 'Marsh & Pike Printing',  keptOn: 'org', contract: ['2025-02-01', '2027-01-31'], contacts: [{ on: '2026-10-01', src: 'log', via: 'email' }] },
    { id: 'redfern', name: 'Redfern Signs',          keptOn: 'org', contract: ['2025-11-01', '2027-10-31'], contacts: [] },
    { id: 'carrow',  name: 'Carrow Electrical',      keptOn: 'org', contract: ['2023-01-01', '2026-12-31'], contacts: [{ on: '2025-12-18', src: 'log', via: 'call' }], phones: true },
    { id: 'holm',    name: 'Holm Road Salt',         keptOn: 'org', contract: ['2024-04-01', '2026-03-31'], contacts: [{ on: '2026-02-02', src: 'log', via: 'email' }] },
    { id: 'calder',  name: 'Calder Waste',           keptOn: 'org', contract: ['2023-07-01', '2026-06-30'], contacts: [{ on: '2026-01-15', src: 'log', via: 'email' }] },
    { id: 'depotx',  name: 'Moor End Tyres',         keptOn: 'depot', contract: ['2025-01-01', '2027-12-31'], contacts: [{ on: '2026-01-20', src: 'log', via: 'call' }] }
  ],
  /* the one question this run follows */
  question: {
    id: 'Q-142',
    words: 'which suppliers have we not heard from since spring?',
    name: 'Suppliers not heard from since spring',
    asker: 'sam',
    asked: '2026-10-27', askedTime: '09:12',
    sharedTo: 'finance', sharedTime: '09:16',
    watch: 'every morning at 07:00, when the suppliers in it change',
    rerun: { by: 'priya', on: '2026-11-03', time: '08:40' }
  },
  /* the walk, for the timeline (v1) */
  walk: [
    { id: 1, label: 'Ask', day: '2026-10-27', time: '09:12', who: 'sam' },
    { id: 2, label: 'Sharpen', day: '2026-10-27', time: '09:13', who: 'sam' },
    { id: 3, label: 'Answer', day: '2026-10-27', time: '09:13', who: 'sam' },
    { id: 4, label: 'Save', day: '2026-10-27', time: '09:15', who: 'sam' },
    { id: 5, label: 'Share', day: '2026-10-27', time: '09:16', who: 'sam' },
    { id: 6, label: 'A week later', day: '2026-11-03', time: '08:40', who: 'priya' }
  ],
  /* why an answer can move: always all five (saved V6). Plain word on top, technical one step down. */
  reasons: {
    world:   { plain: 'Something happened', line: 'A supplier was heard from, or a contract started or ended.', icon: 'calendar-plus', tech: 'valid time moved: new fact in the period' },
    learned: { plain: 'We learned about the past', line: 'A record of an earlier contact arrived late.', icon: 'history', tech: 'transaction time moved: backdated fact' },
    access:  { plain: 'Different access', line: 'The person rerunning it can open different floors.', icon: 'lock', tech: 'reader’s floors differ · same question' },
    guess:   { plain: 'A guess was settled', line: 'Triage accepted or turned down a match the model proposed.', icon: 'pencil-line', tech: 'proposal accepted / rejected in Triage' },
    words:   { plain: 'A word changed meaning', line: 'An admin changed what a kind or word means.', icon: 'book-open-text', tech: 'ontology / word-list version differs' }
  },
  /* model gateway: what Data Atlas used today, and its daily allowance (the gateway enforces it) */
  gateway: { usedToday: 14, limit: 500 }
};
