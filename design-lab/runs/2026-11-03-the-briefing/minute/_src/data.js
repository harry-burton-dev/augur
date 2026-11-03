/* ===== Sample data. Every name, word, count, date and sentence template on these pages comes from here.
   A different deployment brings its own floors, people, kinds, documents, intents and templates;
   nothing below is drawn for one trade. ===== */
const DATA = {
  deployment: 'Regional services (sample)',
  today: '3 Nov 2026',
  readWpm: 200, /* reading speed used for "time to read"; an org setting, not a constant */
  budgetS: 60,  /* the one-minute budget; a deployment can set its own */
  floors: {
    waste: { name: 'Waste and Streets', tier: 'team' },
    ops:   { name: 'Operations', tier: 'department' },
    cs:    { name: 'Customer Services', tier: 'team' },
    fleet: { name: 'Fleet', tier: 'team' },
    org:   { name: 'Whole organisation', tier: 'org' }
  },
  people: {
    sam:    { name: 'Sam Achebe', short: 'Sam', role: 'contracts officer', floor: 'waste' },
    morgan: { name: 'Morgan Hale', short: 'Morgan', role: 'Head of Operations', floor: 'ops' },
    priya:  { name: 'Priya Nair', short: 'Priya', role: 'Customer Services lead', floor: 'cs' },
    lee:    { name: 'Lee Okafor', short: 'Lee', role: 'fleet inspector', floor: 'fleet' },
    jo:     { name: 'Jo Reyes', short: 'Jo', role: 'procurement lead', floor: 'ops' }
  },
  me: 'sam', reader: 'morgan',
  apps: { atlas: 'Data Atlas', artifacts: 'Artifacts', mandate: 'Mandate' },
  /* The model gateway, in both registers. on = the admin has turned it on. */
  gateway: { plain: 'the assistant', Plain: 'The assistant', tech: 'model gateway · draft()', on: true,
    offWhy: 'The assistant is off for this organisation. Admins turn it on in Admin.',
    offStill: 'Every fact, count and picture is the same: they come from the records by template. Only the drafted bottom line is missing, and the slot says you write it.' },

  /* The probability yardstick (after the UK intelligence yardstick). Plain word on top, the range one step down (T). */
  yardstick: [
    { w: 'almost certain', r: '95–100%' }, { w: 'highly likely', r: '80–90%' }, { w: 'likely', r: '55–75%' },
    { w: 'a realistic possibility', r: '40–50%' }, { w: 'unlikely', r: '25–35%' }, { w: 'highly unlikely', r: '10–20%' }, { w: 'remote', r: '0–5%' }
  ],
  /* How a confidence word is chosen: by rule from the sources, never by the model. The person can lower it, never raise it past the rule. */
  sureRules: [
    { if: 'two or more sources agree and none is out of date', gives: 'almost certain' },
    { if: 'one source, or sources agree but one has a hole', gives: 'highly likely' },
    { if: 'sources disagree but the larger figure is our own log', gives: 'likely' },
    { if: 'an estimate from a guide, not a record', gives: 'a realistic possibility' }
  ],

  /* The topic and the Mandate intent it answers. */
  topic: {
    title: 'North waste collection contract',
    question: 'Renew, extend or retender the North waste collection contract?',
    kind: 'Briefing', library: 'Waste and Streets briefings', floor: 'waste', author: 'sam', reader: 'morgan',
    written: '3 Nov 2026', minutes: 1
  },
  intent: { id: 'INT-0412', title: 'Decide the North waste collection contract', owner: 'morgan', floor: 'ops', due: '1 Dec 2026', daysLeft: 28,
    ask: 'a recommendation from Waste and Streets', askDue: '14 Nov 2026', askDays: 11 },

  /* Entities in Data Atlas the briefing is about. */
  contract: { id: 'CON-0087', name: 'North waste collection', supplier: 'Clearway Waste', value: 1.42, unit: '£m a year', ends: '31 Jan 2027', floor: 'ops',
    sites: [
      { name: 'Northgate depot', collects: true }, { name: 'Hillside', collects: true }, { name: 'Eastgate depot', collects: true, audited: 'Aug 2025', auditAge: 14 },
      { name: 'Riverside transfer station', collects: false }
    ] },
  offer: { doc: 'D-311', value: 1.53, rise: 8, years: 3 },

  /* Missed collections from the incident log (Data Atlas, kept on Waste and Streets). hole = weeks the log lost. */
  months: [
    { m: 'Jun', n: 11 }, { m: 'Jul', n: 9 }, { m: 'Aug', n: 14, hole: '8–21 Aug', holeWhy: 'the incident log was down for two weeks; nothing was recorded' },
    { m: 'Sep', n: 22 }, { m: 'Oct', n: 27 }
  ],
  theirs: { m: 'Oct', n: 14, doc: 'D-318', who: 'Clearway’s own monthly report' },
  streets: ['Hillside Rd', 'Mill Lane', 'Northgate St', 'Orchard Way', 'Cooper Close', 'Station Rd', 'Bank Top', 'Eastgate Row', 'Linden Ave', 'Quarry Hill'],

  /* Clearway's vehicles and October's inspections (Fleet). */
  vehicles: [
    { id: 'CW-01', r: 'pass' }, { id: 'CW-02', r: 'pass' }, { id: 'CW-03', r: 'fail', why: 'brakes' }, { id: 'CW-04', r: 'pass' },
    { id: 'CW-05', r: 'pass' }, { id: 'CW-06', r: 'pass' }, { id: 'CW-07', r: 'fail', why: 'bin lift' }, { id: 'CW-08', r: 'pass' },
    { id: 'CW-09', r: 'pass' }, { id: 'CW-10', r: 'pass' }, { id: 'CW-11', r: 'gap', who: 'lee', by: '10 Nov' }, { id: 'CW-12', r: 'pass' }
  ],
  safety: { n: 0, checkedBy: 'lee', on: '30 Oct 2026' },

  /* Documents in Artifacts the claims rest on. */
  docs: {
    'D-311': { title: 'Clearway renewal offer', from: 'Clearway Waste', date: '21 Oct 2026', floor: 'waste' },
    'D-318': { title: 'Clearway monthly report, October', from: 'Clearway Waste', date: '2 Nov 2026', floor: 'waste' },
    'D-205': { title: 'Procurement timetable guide', from: 'Jo Reyes', date: '4 Mar 2026', floor: 'ops' },
    'D-190': { title: 'Eastgate depot site audit', from: 'Operations', date: '14 Aug 2025', floor: 'ops' }
  },

  /* The claims. Each sentence is a template the briefing fills from records (ink); the model never writes these.
     src = where the records are; sure = the yardstick word given by rule; empties = what the claim can't see. */
  claims: [
    { id: 'k1', head: 'Missed collections more than doubled', tpl: 'Missed collections rose from {first} in {m0} to {last} in {m4}.',
      picture: 'spark', src: [{ k: 'incident log', n: 83, app: 'atlas', floor: 'waste' }, { k: 'Clearway’s monthly report', doc: 'D-318', n: 1, app: 'artifacts', floor: 'waste' }],
      sure: 'likely', sureWhy: 'two sources disagree about October (our log 27, Clearway 14), and the log lost two weeks in August',
      disagree: true, empties: ['noRecord'] },
    { id: 'k2', head: 'Two vehicles failed inspection', tpl: 'In October, {fail} of Clearway’s {all} vehicles failed inspection; {gap} has not been inspected yet.',
      picture: 'fleet', src: [{ k: 'inspections', n: 11, app: 'atlas', floor: 'fleet' }],
      sure: 'highly likely', sureWhy: 'one source, our own inspections; one vehicle not inspected yet', empties: ['gap', 'none'] },
    { id: 'k3', head: 'The offer is 8% dearer', tpl: 'Clearway’s renewal offer is {rise}% higher: £{offer}m a year, up from £{value}m.',
      picture: 'cost', src: [{ k: 'renewal offer', doc: 'D-311', n: 1, app: 'artifacts', floor: 'waste' }, { k: 'contract', n: 1, app: 'atlas', floor: 'ops' }],
      sure: 'almost certain', sureWhy: 'two records agree: their offer and our contract' },
    { id: 'k4', head: 'A retender can’t finish in time', tpl: 'A retender takes about {months} months, so it would not finish before the contract ends on {ends}.',
      picture: 'time', src: [{ k: 'procurement timetable', doc: 'D-205', n: 1, app: 'artifacts', floor: 'ops' }, { k: 'contract', n: 1, app: 'atlas', floor: 'ops' }],
      sure: 'a realistic possibility', sureWhy: 'the six months is the guide’s estimate, not a record of past retenders', months: 6 }
  ],

  /* What the briefing can't see, as the six ways to be empty. who = who could fill it or whom to ask. */
  empties: [
    { id: 'unseen', mark: 'unseen', says: 'Resident complaints about missed collections', is: 'some, kept on Customer Services', who: 'priya', for: 'k1' },
    { id: 'gap',    mark: 'gap',    says: 'Inspection of CW-11', is: 'not known yet', who: 'lee', by: '10 Nov', for: 'k2' },
    { id: 'ask',    mark: 'gap',    says: 'Whether Clearway would take a six-month extension', is: 'not known yet', who: 'jo', for: 'o2' },
    { id: 'stale',  mark: 'stale',  says: 'Eastgate depot site audit', is: '14 months old', who: 'jo', for: 'k1' },
    { id: 'noRecord', mark: 'break', says: 'Missed collections 8–21 Aug', is: 'no record: the log was down', who: null, for: 'k1' },
    { id: 'none',   mark: 'none',   says: 'Safety incidents involving Clearway vehicles', is: 'none, checked by Lee Okafor on 30 Oct', who: null, for: 'k2' },
    { id: 'na',     mark: 'na',     says: 'Riverside transfer station', is: 'doesn’t apply: no collections there', who: null, for: 'k1' }
  ],

  /* Courses open (for the appreciation). Every cell is ink from records or a stated estimate; the choice is the person's. */
  options: [
    { id: 'o1', name: 'Renew for 3 years', cost: '£1.53m a year', costD: '+£110k a year', inTime: 'yes', risk: 'keeps a supplier whose missed collections are rising', unknown: null },
    { id: 'o2', name: 'Extend 6 months, retender now', cost: '£765k for 6 months', costD: 'at the offered rate', inTime: 'yes', risk: 'two procurements’ work in one winter', unknown: 'ask' },
    { id: 'o3', name: 'Retender only', cost: 'not known until bids', costD: '', inTime: 'no', risk: 'about 3 months with no contract after 31 Jan', unknown: null }
  ],

  /* What a model may write here, in pencil. Phrases link to the claims that hold them up; a phrase with no claim behind it is flagged. */
  draft: {
    bottom: [
      { t: 'Extend Clearway for six months and retender now', claim: null, rec: true },
      { t: ': missed collections have ', claim: null },
      { t: 'more than doubled since June', claim: 'k1' },
      { t: ' and ', claim: null },
      { t: 'a retender can’t finish before the contract ends', claim: 'k4' },
      { t: '. ', claim: null },
      { t: 'Clearway has served us well for years.', claim: 'none', unsupported: true }
    ],
    /* G off: the bottom line from the template alone, with a blank the author fills. */
    template: 'Decision needed by {due}: the {contract} contract ends on {ends}.',
    ask: '{reader}, I need your yes by {askDue} to ask Clearway about a six-month extension.',
    /* A first draft that runs long (for the minute meter). by: tpl = a template filled from records (ink), own = the author's words (ink),
       pen = the assistant's words (pencil). cut = what the assistant proposes and why; keep = a rule says it can't be cut. */
    long: [
      { by: 'pen', sec: 'Bottom line', t: 'BOTTOM' },
      { by: 'tpl', sec: 'Background', t: 'The {contract} contract with Clearway Waste covers Northgate depot, Hillside and Eastgate depot, and ends on {ends}.' },
      { by: 'own', sec: 'Background', t: 'It is worth £1.42m a year and was let in February 2024 after an open tender that drew four bidders, of which Clearway was the cheapest.', cut: 'background Morgan already has' },
      { by: 'tpl', sec: 'What we know', claim: 'k1' },
      { by: 'tpl', sec: 'What we know', t: 'By month, missed collections were 11 in June, 9 in July, 14 in August, 22 in September and 27 in October.', cut: 'repeats fact 1; a word-sized picture says it', pic: true },
      { by: 'tpl', sec: 'What we know', t: 'Clearway’s own report counts 14 for October.', keep: 'sources disagree: a rule keeps both' },
      { by: 'tpl', sec: 'What we know', t: 'The incident log was down from 8 to 21 August, so August is undercounted.', keep: 'a gap is never cut' },
      { by: 'tpl', sec: 'What we know', claim: 'k2' },
      { by: 'tpl', sec: 'What we know', t: 'CW-03 failed on its brakes and CW-07 on its bin lift; Fleet has asked Clearway for repair dates on both vehicles.', cut: 'detail, not the decision' },
      { by: 'tpl', sec: 'What we know', claim: 'k3' },
      { by: 'own', sec: 'What we know', t: 'The offer letter also asks for a fuel surcharge clause, which our current contract does not have, and a longer notice period.', cut: 'detail; it is in the offer letter' },
      { by: 'tpl', sec: 'What we know', claim: 'k4' },
      { by: 'pen', sec: 'What we know', t: 'Other councils have extended similar contracts for six months without any trouble.', cut: 'nothing in the records says this', unbacked: true },
      { by: 'tpl', sec: 'What we don’t know', t: 'We don’t know yet what residents are saying (kept on Customer Services), how CW-11’s inspection turns out, or whether Clearway would take a six-month extension.', keep: 'a gap is never cut' },
      { by: 'tpl', sec: 'Decision needed', t: 'ASK' },
      { by: 'own', sec: 'Decision needed', t: 'I have attached the offer letter, the October report and the procurement guide for reference, and I am happy to talk it through.', cut: 'the records are already one step away' }
    ],
    questions: [
      { q: 'How do you know collections are worse?', a: 'k1', by: 'tpl' },
      { q: 'Why not just renew?', a: 'k3', by: 'tpl' },
      { q: 'Why not retender straight away?', a: 'k4', by: 'tpl' },
      { q: 'Are the trucks safe?', a: 'k2', by: 'tpl' },
      { q: 'What are residents saying?', a: 'unseen', by: 'model' },
      { q: 'What happens if we do nothing?', a: 'o3', by: 'model' },
      { q: 'Have other councils extended a contract like this?', a: null, by: 'model', who: 'jo' }
    ]
  }
};
