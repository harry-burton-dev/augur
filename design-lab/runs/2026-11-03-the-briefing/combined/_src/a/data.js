/* ======================================================================
   One sample deployment (Vale Regional Services), shared by both of
   designer a's round-2 screens. Every name, label, date, floor, sentence
   part and reason comes from here; every count is worked out from
   DATA.inspections by one query (q() in lib.js), so the heights can't
   differ. In AUGUR: inspections and visits from Data Atlas, briefings
   and sources from Artifacts, intents and decision kinds from Mandate.
   ====================================================================== */
const DATA = {
  org: 'Vale Regional Services',
  today: '2026-11-03',
  period: { from: '2026-10-01', plain: 'this quarter', span: '1 Oct to 3 Nov 2026' },
  readWpm: 200,            /* reading speed, a deployment setting */
  pictureSeconds: 8,       /* fixed reading time for one picture */
  author: { name: 'Sam Okafor', floor: 'sam' },

  /* floors: a floor shows what's kept on it and on the floors above (docs/atlas.md) */
  floors: {
    org:   { name: 'Vale Regional Services', tier: 'org', word: 'Org floor', people: 1180 },
    fac:   { name: 'Facilities', tier: 'department', parent: 'org', word: 'Department floor', who: 'Dana Whitfield, Head of Facilities', people: 34 },
    ws:    { name: 'Waste and Streets', tier: 'department', parent: 'org', word: 'Department floor', who: 'Morgan Hale, Head of Waste and Streets' },
    hou:   { name: 'Housing', tier: 'department', parent: 'org', word: 'Department floor', who: 'Leah Grant, Head of Housing' },
    parks: { name: 'Parks and Leisure', tier: 'department', parent: 'org', word: 'Department floor', who: 'Tom Ashby, Head of Parks' },
    sc:    { name: 'Site compliance', tier: 'team', parent: 'fac', word: 'Team floor', who: 'Priya Nair, team lead', people: 7 },
    depot: { name: 'Depot operations', tier: 'team', parent: 'fac', word: 'Team floor', who: 'Marta Kowal, depot lead' },
    sam:   { name: 'Sam Okafor', tier: 'you', parent: 'sc', word: 'own notes', who: 'Sam Okafor' }
  },

  /* the three readers of one briefing, each at its own height */
  readers: [
    { id: 'op',   key: '1', name: 'Sam Okafor',   role: 'operator, you',            floor: 'sam', height: 'The records',  heightTech: 'height 3 · rows', budget: null },
    { id: 'lead', key: '2', name: 'Priya Nair',   role: 'team lead, Site compliance', floor: 'sc',  height: 'The minute',   heightTech: 'height 2 · picture + bottom line', budget: 60 },
    { id: 'org',  key: '3', name: 'The Org floor', role: '1,180 people',             floor: 'org', height: 'The headline', heightTech: 'height 1 · headline + one picture', budget: 20 }
  ],

  sites: {
    ng: 'Northgate Depot', hl: 'Hilltop Recycling Centre', ef: 'Eastfield Yard',
    rv: 'Riverside Offices', ms: 'Market Street Hub', sm: 'Southmoor Depot'
  },

  /* where what's behind the briefing is kept; n = records */
  sources: {
    visits:  { plain: 'Inspection visit records', keptOn: 'fac', n: 13 },
    regime:  { plain: 'Site inspection register', keptOn: 'fac', n: 1 },
    ascent:  { plain: 'Ascent Lifting report, 28 Oct', keptOn: 'fac', n: 1 },
    sitelog: { plain: 'Northgate site log', keptOn: 'fac', n: 1 },
    note:    { plain: 'Sam’s site walk note, Eastfield, 31 Oct', keptOn: 'sam', n: 1 },
    lift:    { plain: 'Northgate lift records', keptOn: 'depot', n: 2 },
    southmoor: { plain: 'Southmoor inspection records', keptOn: 'depot', n: 9 },
    intent:  { plain: 'Intent M-118, keep every site’s inspections in date', keptOn: 'org', n: 1 },
    parks:   { plain: 'Parks and Leisure inspections briefing, 30 Oct', keptOn: 'org', n: 1 },
    ws:      { plain: 'Waste and Streets inspection records', keptOn: 'ws', n: 40 },
    hou:     { plain: 'Housing inspection records', keptOn: 'hou', n: 61 }
  },

  /* the one query's rows: inspections that fell due this quarter at Facilities sites */
  query: {
    plain: 'Inspections that fell due at Facilities sites since 1 Oct, and what has been recorded for each.',
    tech: 'atlas.query(kind=InspectionDue, site.keptOn⊆fac, due∈[2026-10-01, today]) → state per row; one query feeds all three heights'
  },
  inspections: [
    { id: 'ng-ext',   site: 'ng', name: 'Fire extinguishers', due: '2026-10-05', state: 'overdue', last: 'INS-2207', src: ['visits','regime'] },
    { id: 'ng-elt',   site: 'ng', name: 'Emergency lighting', due: '2026-10-02', state: 'overdue', last: 'INS-2410', src: ['visits','regime'] },
    { id: 'ng-door',  site: 'ng', name: 'Fire doors', due: '2026-10-25', state: 'overdue', last: 'INS-2384', src: ['visits','regime'] },
    { id: 'ng-hoist', site: 'ng', name: 'Workshop hoists', due: '2026-10-20', state: 'disputed', src: ['ascent','sitelog'],
      sides: [ { says: 'done 28 Oct', from: 'Ascent Lifting report' }, { says: 'no visit since 20 Apr', from: 'Lee Brennan, site log' } ], decides: 'Priya Nair' },
    { id: 'ng-roof',  site: 'ng', name: 'Roof anchors', due: null, state: 'gap', fill: 'Ade Bello, estates officer', why: 'the register expects one a year; none has ever been recorded', src: ['regime'] },
    { id: 'ng-lift',  site: 'ng', name: 'Passenger lift', state: 'hidden', keptOn: 'depot', ask: 'Marta Kowal', src: ['lift'] },
    { id: 'hl-leg',   site: 'hl', name: 'Water (legionella)', due: '2026-10-14', state: 'overdue', last: 'INS-2361', src: ['visits','regime'] },
    { id: 'hl-ext',   site: 'hl', name: 'Fire extinguishers', due: '2026-10-22', state: 'overdue', last: 'INS-2228', src: ['visits','regime'] },
    { id: 'hl-alarm', site: 'hl', name: 'Fire alarm', due: '2026-10-08', state: 'done', done: '2026-10-07', rec: 'INS-2452', src: ['visits'] },
    { id: 'ef-alarm', site: 'ef', name: 'Fire alarm', due: '2026-10-30', state: 'overdue', last: 'INS-2412', src: ['visits','regime','note'] },
    { id: 'ef-door',  site: 'ef', name: 'Fire doors', due: '2026-10-11', state: 'done', done: '2026-10-19', rec: 'INS-2458', src: ['visits'] },
    { id: 'rv-elt',   site: 'rv', name: 'Emergency lighting', due: '2026-10-03', state: 'done', done: '2026-10-01', rec: 'INS-2449', src: ['visits'] },
    { id: 'rv-alarm', site: 'rv', name: 'Fire alarm', due: '2026-10-15', state: 'norecord', fill: 'Lena Fry, Riverside site manager', why: 'the site log didn’t sync from 8 to 21 Oct; the paper log may hold it', src: ['regime'] },
    { id: 'ms-leg',   site: 'ms', name: 'Water (legionella)', due: '2026-10-20', state: 'done', done: '2026-10-20', rec: 'INS-2463', src: ['visits'] },
    { id: 'ms-door',  site: 'ms', name: 'Fire doors', due: '2026-10-28', state: 'done', done: '2026-10-27', rec: 'INS-2470', src: ['visits'] },
    { id: 'sm-all',   site: 'sm', name: 'All inspections', state: 'hidden', some: true, keptOn: 'depot', ask: 'Marta Kowal', src: ['southmoor'] }
  ],
  /* how other departments' counts reach the Org floor */
  departments: [
    { floor: 'fac', from: 'this briefing' },
    { floor: 'parks', none: true, checked: 'Tom Ashby', on: '2026-10-30', src: 'parks' },
    { floor: 'ws', some: true, src: 'ws' },
    { floor: 'hou', some: true, src: 'hou' }
  ],
  /* the Org copy published last week, used by D: a copy whose heights no longer agree */
  stale: { published: '2026-10-27', reason: 'A date passed', why: 'Eastfield’s fire alarm test fell due on 30 Oct. AUGUR can’t notice a date passing yet, so it showed when the query ran again today.' },
  lastQuarter: { asOf: '3 Aug', overdue: 2 },

  /* the model's one pencil slot: the bottom line. Each phrase points at a fact (ref) */
  bottomLine: {
    parts: [
      { t: 'Six inspections are overdue', ref: 'overdue' }, { t: ' at three of our five sites, ' },
      { t: 'half of them at Northgate', ref: 'ng' }, { t: '. ' },
      { t: 'One more there has two answers', ref: 'disputed' }, { t: ', and ' },
      { t: 'two we can’t say yet', ref: 'cantsay' }, { t: '.' }
    ],
    drafted: 'the assistant', inked: 'Sam Okafor', on: '3 Nov'
  },
  /* the yardstick: fixed words, chosen by rule, a person may only lower */
  yardstick: ['Remote', 'Highly unlikely', 'Unlikely', 'A realistic possibility', 'Likely', 'Highly likely', 'Almost certain'],
  yardTech: ['≤5%', '10–20%', '25–35%', '40–50%', '55–75%', '80–90%', '≥95%'],
  grades: { A: { w: 3, plain: 'a kept record' }, B: { w: 2, plain: 'checked' }, C: { w: 1, plain: 'reported' }, U: { w: 1, plain: 'not graded' } },

  /* v4: a briefing that feeds a decision in Mandate */
  decision: {
    intent: { id: 'M-361', title: 'Decide whether to close Northgate Depot', owner: 'Dana Whitfield', floor: 'fac', due: '2026-12-15' },
    question: 'Close Northgate Depot?',
    kind: 'Close or open a site',
    bar: 5,
    barProposed: 'Mandate has no standard of proof yet. Here it is set per kind of decision, and only the kind’s owner could change it. New: needs Harry’s decision.',
    claims: [
      { id: 'count', kind: 'count', say: 'At least {n} of Northgate’s inspections are overdue, the most of the five Facilities sites.', of: 'ng', ask: null },
      { id: 'contract', say: 'Brigade Fire’s servicing contract (C-0412) ended on 31 Aug and has not been renewed.',
        src: [ { g: 'A', from: 'Contract register, C-0412' }, { g: 'B', from: 'Brigade Fire’s letter, 2 Sep' } ] },
      { id: 'roof', say: 'Northgate’s workshop roof needs replacing within two years.',
        src: [ { g: 'B', from: 'Estates condition survey, Mar 2024' }, { g: 'C', from: 'Roofline Ltd quote, Sep 2026' } ] },
      { id: 'north', say: 'Most of Northgate’s rounds start in the north of the district.',
        src: [ { g: 'B', from: 'Route planner, Oct 2026' } ] },
      { id: 'room', say: 'Eastfield Yard has room for Northgate’s 14 vehicles.',
        src: [ { g: 'U', from: 'Sam’s phone note: Eastfield site manager, 29 Oct', keptOn: 'sam' } ] },
      { id: 'travel', say: 'From Eastfield, each morning run to the north takes longer by', kind: 'dispute',
        sides: [ { says: '12 minutes', from: 'Route planner estimate', g: 'B', alone: 4 }, { says: '35 minutes', from: 'Marta Kowal’s timed test runs', g: 'A', alone: 5 } ],
        who: 'Dana Whitfield', act: 'Ask to decide' },
      { id: 'cost', say: 'Northgate costs', blank: 'a sum', after: ' a year to run.', kind: 'gap', who: 'Jo Reyes, finance business partner', act: 'Ask', why: 'Nobody has recorded a running cost for the site.' },
      { id: 'lease', say: 'Northgate’s lease runs to March 2029.', kind: 'stale', was: 5, checked: 'Jun 2021', every: '2 years', who: 'Ade Bello, estates officer', act: 'Ask' },
      { id: 'southmoor', keptOnAll: 'depot', say: 'Southmoor Depot could take', blank: 'some vehicles', after: ' as well.', kind: 'hidden', keptOn: 'depot', who: 'Marta Kowal, depot lead', act: 'Ask' }
    ],
    /* the pencil bottom line: its word slot is filled by rule, from the weakest claim it points at */
    pencil: [
      { t: 'It is ' }, { slot: 'word' }, { t: ' that closing Northgate and moving its crews to Eastfield Yard is the better course: ' },
      { t: 'its roof needs replacing soon', ref: 'roof' }, { t: ', ' },
      { t: 'Eastfield has room', ref: 'room' }, { t: ', and ' },
      { t: 'the move would save money', ref: 'cost' }, { t: '.' }
    ],
    lower: { claim: 'roof', to: 4, by: 'Sam Okafor', on: '3 Nov',
      reason: 'The survey is from before the 2025 patch repairs, and the quote comes from a firm that wants the job.' },
    reach: { readers: 'Dana Whitfield and 4 people who follow the intent', floor: 'fac' }
  }
};
