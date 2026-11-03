/* ======================================================================
   Sample data for one deployment (Vale Regional Services). Every name,
   label, date, count, sentence and reason on the page comes from here or
   is computed from it by answer() below. In AUGUR it would come from
   Data Atlas (suppliers, contracts, contact events and the floor each is
   kept on), Artifacts (meeting notes), identity (who sees which floor)
   and the saved question itself. Swap this object and the page redraws.
   ====================================================================== */
const DATA = {
  app: 'Data Atlas',
  org: 'Vale Regional Services',
  today: '2026-11-03',
  /* Records on floors you can't open: say "some", never a number (catalogue decision, still Harry's call). */
  hiddenCount: 'some',
  floors: {
    you:        { name: 'Your own floor', tier: 'you', word: 'You' },
    depot:      { name: 'Depot operations', tier: 'team', word: 'Team floor', lead: 'Marta Kowal', people: 16, above: 'facilities' },
    facilities: { name: 'Facilities', tier: 'department', word: 'Department floor', lead: 'Ade Bello', people: 38, above: 'org' },
    finance:    { name: 'Finance', tier: 'department', word: 'Department floor', lead: 'Priya Nair', people: 22, above: 'org' },
    org:        { name: 'Vale Regional Services', tier: 'org', word: 'Org floor', people: 412 }
  },
  /* Who sees what: a floor shows what's kept on it and on the floors above, never below or beside. */
  people: {
    sam:   { name: 'Sam Okafor', first: 'Sam', role: 'Operator', floor: 'facilities', sees: ['you', 'facilities', 'org'] },
    priya: { name: 'Priya Nair', first: 'Priya', role: 'Finance lead', floor: 'finance', sees: ['you', 'finance', 'org'] },
    marta: { name: 'Marta Kowal', first: 'Marta', role: 'Depot lead', floor: 'depot', sees: ['you', 'depot', 'facilities', 'org'] },
    orgmember: { name: 'Someone on the Org floor only', first: 'they', role: 'any member', floor: 'org', sees: ['you', 'org'] },
    watch: { name: 'The watch', first: 'Watch', role: 'reruns it for Sam', floor: 'facilities', sees: ['you', 'facilities', 'org'], as: 'sam' }
  },
  /* Where "last contact" can be read from, and the floor each is kept on. */
  sources: {
    log:      { plain: 'Supplier contact log', what: 'emails and calls', floor: 'org', app: 'Data Atlas', tech: 'atlas · ContactEvent · kept on org' },
    notes:    { plain: 'Meeting notes', what: 'meetings', floor: 'facilities', app: 'Artifacts', tech: 'artifacts · Facilities library · names read from text' },
    invoices: { plain: 'Invoice queries', what: 'invoice queries', floor: 'finance', app: 'Data Atlas', tech: 'atlas · InvoiceQuery · kept on finance' }
  },
  /* How each step was worked out. Only "model" touches the model gateway. */
  how: {
    rule:  { plain: 'Worked out by a rule', short: 'rule', icon: 'list-checks', tech: 'Data Atlas query · no model' },
    match: { plain: 'Matched by key and spelling', short: 'key + spelling', icon: 'search-check', tech: 'company number, then pg_trgm similarity · no model' },
    model: { plain: 'Suggested by the model', short: 'model', icon: 'cpu', tech: 'model gateway · askModel · stored, never asked again on rerun' },
    you:   { plain: 'Chosen by a person', short: 'chosen', icon: 'user-round-check', tech: 'clarification · confirmed by asker' }
  },
  question: {
    id: 'Q-118',
    words: 'which suppliers have we not heard from since spring?',
    /* The sharpened question, said in a sentence. Each part is a blank someone filled. */
    sentence: [
      { t: 'Suppliers' },
      { t: 'with a contract running on the day', b: 'suppliers' },
      { t: 'whose last' },
      { t: 'email, call, meeting or invoice query', b: 'heard' },
      { t: 'was before' },
      { t: '1 March 2026', b: 'spring' }
    ],
    clar: {
      spring:    { said: 'since spring', asked: 'Spring from when?', chose: '1 March 2026', others: ['20 March (the equinox)', '1 April (our financial year)'], how: 'rule', by: 'sam',
                   fixed: 'A fixed date. Next spring it still means 1 March 2026.', tech: 'calendar word "spring" from this deployment’s word list · date literal' },
      heard:     { said: 'heard from', asked: 'What counts as hearing from them?', chose: 'email, call, meeting or invoice query', others: ['… or a delivery note'], how: 'model', by: 'sam',
                   fixed: 'The model suggested the kinds of contact. Sam chose them, so a rerun never asks it again.', tech: 'model gateway proposed 4 event kinds · confirmed' },
      suppliers: { said: 'suppliers', asked: 'All of them, or only those with a contract running?', chose: 'with a contract running on the day', others: ['all suppliers'], how: 'rule', by: 'sam',
                   fixed: '“On the day” is the day of the run, so it moves with each rerun.', tech: 'supplier -holds-> contract, start ≤ run date ≤ end' }
    },
    steps: [
      { plain: 'Start with every supplier', how: 'rule', tech: 'match (s:Supplier)' },
      { plain: 'Keep those with a contract running on the day', how: 'rule', tech: 's -holds-> c where c.start ≤ day ≤ c.end' },
      { plain: 'Find each one’s last contact in the contact log, meeting notes and invoice queries', how: 'match',
        aside: 'Names in meeting notes are matched by company number and spelling. One match by meaning is a guess: it is shown, and not counted, until someone confirms it.', tech: 'max(contact.on) over sources the reader can open' },
      { plain: 'Keep those whose last contact was before 1 March 2026', how: 'rule', tech: 'last_contact < 2026-03-01' },
      { plain: 'List apart those with no contact logged at all', how: 'rule', tech: 'last_contact is null → not known yet' }
    ],
    cutoff: '2026-03-01',
    asker: 'sam', asked: '2026-10-12', askedTime: '09:14',
    sharedTo: 'org', sharedOn: '2026-10-27',
    /* What a rerun needs to be honest. */
    keeps: [
      ['The words asked', 'which suppliers have we not heard from since spring?'],
      ['Each choice that sharpened them', 'who chose, when, and which used the model'],
      ['The steps', 'as a rule Data Atlas runs; no model on rerun'],
      ['The moment it was asked', '12 Oct 2026, 09:14, for “as it was then”'],
      ['The words’ meaning then', 'Data Atlas words as of 12 Oct (kinds, details)'],
      ['Whose access each run used', 'never the rows themselves, when shared']
    ],
    watch: { when: 'the suppliers in it change', other: ['only the count changes', 'anything in its workings changes'], cadence: 'every morning at 07:00', tell: 'one quiet line on Home, nothing else' }
  },
  /* The suppliers it reads. Dates are ISO; logged = the day the record arrived. */
  suppliers: [
    { id: 'ashby', name: 'Ashby Grounds Ltd', contract: ['2024-04-01', '2027-03-31'], contacts: [{ on: '2026-02-14', src: 'log', via: 'email' }] },
    { id: 'bright', name: 'Brightwater Cleaning', contract: ['2025-01-01', '2027-12-31'], contacts: [
      { on: '2026-01-11', src: 'log', via: 'call' },
      { on: '2026-04-04', src: 'notes', via: 'meeting', guess: { said: '“Brightwater team”', why: 'matched by meaning, not by name or number' } }] },
    { id: 'carrow', name: 'Carrow Electrical', contract: ['2023-01-01', '2026-12-31'], contacts: [{ on: '2026-01-28', src: 'log', via: 'call' }] },
    { id: 'dunmore', name: 'Dunmore Waste', contract: ['2025-06-01', '2028-05-31'], contacts: [{ on: '2026-02-20', src: 'notes', via: 'meeting' }] },
    { id: 'fenwick', name: 'Fenwick Lifts', contract: ['2024-09-01', '2027-08-31'], contacts: [{ on: '2025-12-03', src: 'log', via: 'email' }] },
    { id: 'halden', name: 'Halden Fleet Services', contract: ['2025-04-01', '2027-03-31'], contacts: [
      { on: '2026-02-02', src: 'log', via: 'email' },
      { on: '2026-09-09', src: 'notes', via: 'meeting', logged: '2026-10-22', by: 'Tom Reed' }] },
    { id: 'kestrel', name: 'Kestrel Security', contract: ['2025-02-01', '2027-01-31'], contacts: [{ on: '2026-02-26', src: 'log', via: 'call' }] },
    { id: 'north', name: 'Northgate Skips', contract: ['2026-10-27', '2028-10-26'], contractLogged: '2026-10-27', contacts: [{ on: '2026-02-10', src: 'log', via: 'email' }] },
    { id: 'orchard', name: 'Orchard Catering', contract: ['2025-09-01', '2027-08-31'], contacts: [
      { on: '2026-02-18', src: 'notes', via: 'meeting' },
      { on: '2026-06-03', src: 'invoices', via: 'invoice query' }] },
    { id: 'pell', name: 'Pell & Rowe Surveyors', contract: ['2025-01-01', '2027-12-31'], contacts: [{ on: '2026-05-12', src: 'log', via: 'email' }, { on: '2026-10-20', src: 'log', via: 'call' }] },
    { id: 'quarry', name: 'Quarry Lane Plant Hire', contract: ['2024-01-01', '2026-12-31'], contacts: [{ on: '2026-07-30', src: 'log', via: 'call' }] },
    { id: 'redfern', name: 'Redfern Signs', contract: ['2025-11-01', '2027-10-31'], contacts: [] },
    { id: 'sefton', name: 'Sefton Print', contract: ['2023-07-01', '2026-06-30'], contacts: [{ on: '2026-01-05', src: 'log', via: 'email' }] },
    { id: 'tarn', name: 'Tarn Water Testing', contract: ['2025-03-01', '2027-02-28'], contacts: [{ on: '2026-09-15', src: 'invoices', via: 'invoice query' }] },
    { id: 'upton', name: 'Upton Hygiene', contract: ['2024-05-01', '2027-04-30'], contacts: [{ on: '2026-08-19', src: 'log', via: 'email' }] }
  ],
  /* Every run of the question. The count and rows are computed, never typed. */
  runs: [
    { at: '2026-10-12', time: '09:14', by: 'sam', asOf: '2026-10-12', kind: 'asked' },
    { at: '2026-10-15', time: '11:02', by: 'sam', asOf: '2026-10-15', kind: 'rerun' },
    { at: '2026-10-21', time: '07:00', by: 'watch', asOf: '2026-10-21', kind: 'watch' },
    { at: '2026-10-23', time: '07:00', by: 'watch', asOf: '2026-10-23', kind: 'watch' },
    { at: '2026-10-28', time: '07:00', by: 'watch', asOf: '2026-10-28', kind: 'watch' },
    { at: '2026-11-03', time: '07:00', by: 'watch', asOf: '2026-11-03', kind: 'watch' },
    { at: '2026-11-03', time: '08:40', by: 'priya', asOf: '2026-11-03', kind: 'rerun' }
  ],
  /* Why an answer can change. Plain word on top, technical one step down. */
  reasons: {
    world:   { plain: 'Something happened', line: 'The world changed: a contract started or ended.', icon: 'calendar-plus', tech: 'valid time moved: new fact in the period' },
    learned: { plain: 'We learned about the past', line: 'A record of an earlier contact arrived late.', icon: 'history', tech: 'transaction time moved: backdated fact' },
    access:  { plain: 'Different access', line: 'The person rerunning it can open different floors.', icon: 'lock', tech: 'reader’s floors differ · same question, same moment' },
    guess:   { plain: 'A guess was settled', line: 'Someone confirmed or turned down a match the model made.', icon: 'cpu', tech: 'model match confirmed / rejected' },
    words:   { plain: 'A word changed meaning', line: 'Data Atlas changed what a kind or detail means.', icon: 'book-open-text', tech: 'ontology version differs' }
  },
  /* Other saved questions on Sam's shelf (V6). */
  lastLooked: '2026-10-15',
  floorShelf: [
    { id: 'Q-131', words: 'vans off the road this week', by: 'Ade Bello', floor: 'facilities', count: 4, changed: '2026-11-02' },
    { id: 'Q-118', words: 'which suppliers have we not heard from since spring?', by: 'Sam Okafor', floor: 'org', live: true },
    { id: 'Q-077', words: 'sites where the fire officer is not named', by: 'Estates desk', floor: 'org', count: 0, changed: '2026-07-14' }
  ],
  shelf: [
    { id: 'Q-118', words: 'which suppliers have we not heard from since spring?', live: true },
    { id: 'Q-104', words: 'vans due a service before Christmas', count: 12, changed: '2026-10-30', reason: 'world', floor: 'facilities' },
    { id: 'Q-097', words: 'sites with no fire check this year', count: 3, changed: '2026-09-18', reason: 'learned', floor: 'facilities' },
    { id: 'Q-090', words: 'contracts ending before April with no renewal decision', count: 5, changed: '2026-08-02', reason: 'world', floor: 'you' }
  ]
};
