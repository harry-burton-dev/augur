/* Sample data. Every name, label, count, floor and time below is deployment data:
   nothing in the markup or the scripts repeats any of it. One object per page. */
const DATA = {
  org: 'Westmarch Housing Group',
  me: 'amara',
  myFloor: 'team',
  now: { day: 'Tue 3 Nov', time: '10:40' },
  floors: {
    org:        { name: 'Westmarch Housing Group', word: 'Org',        reach: 1240 },
    department: { name: 'Property Services',       word: 'Department', reach: 86 },
    team:       { name: 'Repairs North',           word: 'Team',       reach: 8 }
  },
  floorOrder: ['org', 'department', 'team'],
  people: {
    amara:  { name: 'Amara Osei',   ini: 'AO', role: 'Repairs coordinator',          floor: 'team',       in: 'in' },
    tom:    { name: 'Tom Reyes',    ini: 'TR', role: 'Repairs coordinator',          floor: 'team',       in: 'in',  away: 'off Wed 4 to Tue 10 Nov' },
    nkechi: { name: 'Nkechi Bello', ini: 'NB', role: 'Team lead',                    floor: 'team',       in: 'in' },
    rui:    { name: 'Rui Costa',    ini: 'RC', role: 'Surveyor',                     floor: 'team',       in: 'out', where: 'on site, Elm Court' },
    grace:  { name: 'Grace Ito',    ini: 'GI', role: 'Repairs officer',              floor: 'team',       in: 'off', away: 'off sick today' },
    sol:    { name: 'Sol Mendes',   ini: 'SM', role: 'Repairs officer',              floor: 'team',       in: 'in' },
    fran:   { name: 'Fran Doyle',   ini: 'FD', role: 'Gas safety officer',           floor: 'team',       in: 'out', where: 'on site, Block A' },
    kai:    { name: 'Kai Wren',     ini: 'KW', role: 'Repairs officer',              floor: 'team',       in: 'in' },
    dev:    { name: 'Dev Kapoor',   ini: 'DK', role: 'Compliance officer',           floor: 'department', in: 'in' },
    helen:  { name: 'Helen Marsh',  ini: 'HM', role: 'Head of Property Services',    floor: 'department', in: 'in' },
    joe:    { name: 'Joe Park',     ini: 'JP', role: 'Contracts manager',            floor: 'department', in: 'in' },
    lena:   { name: 'Lena Fischer', ini: 'LF', role: 'Data steward',                 floor: 'org',        in: 'in' },
    mo:     { name: 'Mo Haddad',    ini: 'MH', role: 'Admin',                        floor: 'org',        in: 'in' }
  },
  team: ['nkechi', 'amara', 'tom', 'rui', 'grace', 'sol', 'fran', 'kai'],

  /* kinds of thing that can need someone. icon by kind, never colour (colour is the floor's) */
  kinds: {
    intent:   { word: 'Intent',   icon: 'target',          app: 'Mandate' },
    fact:     { word: 'Disputed fact', short: 'Fact', icon: 'scale', app: 'Data Atlas' },
    approval: { word: 'Approval', icon: 'stamp',           app: 'Artifacts' },
    share:    { word: 'Share request', short: 'Share', icon: 'key-round', app: 'Artifacts' },
    sync:     { word: 'Failed sync', short: 'Sync', icon: 'refresh-cw-off', app: 'Admin' },
    upgrade:  { word: 'Upgrade',  icon: 'circle-arrow-up', app: 'Upgrade Centre' }
  },

  /* the strips: things that need a person. h = hours from now to its time (negative = past) */
  items: [
    { id: 'M-207', kind: 'intent', title: 'Clear the damp backlog at Elm Court', floor: 'department',
      holder: 'amara', from: 'helen', since: 'Mon 12 Oct', due: 'Fri 30 Oct', h: -94, state: 'past its deadline',
      line: '14 of 19 homes done · 5 left, all in Block C', cock: { by: 'amara', note: 'ring Helen before 14:00 about a new date' } },
    { id: 'F-3301', kind: 'fact', title: 'Elm Court Block C · boiler install year', floor: 'team',
      holder: 'amara', from: 'rule', since: 'Fri 30 Oct', due: 'today 16:00', h: 5.3, state: 'two sources disagree',
      line: 'Asset register 2014 · Contractor survey 2017', why: 'the gas safety schedule for Block C waits on it' },
    { id: 'A-118', kind: 'approval', title: 'Damp and mould response standard, v3', floor: 'department',
      holder: 'amara', from: 'nkechi', since: 'Mon 2 Nov 16:05', due: 'Wed 4 Nov 12:00', h: 25.3, state: 'your initial is next',
      line: '2 initialled · you · then Helen Marsh stamps it for 86 readers' },
    { id: 'S-44', kind: 'share', title: 'Rui Costa asks to open Elm Court survey photos', floor: 'team',
      holder: 'amara', from: 'rui', since: 'today 08:12', due: 'Thu 5 Nov', h: 48, state: 'asks you',
      line: 'Read only · the collection is kept on the Team floor' },
    /* offered by you, not yet accepted: you still hold it */
    { id: 'F-3290', kind: 'fact', title: 'Elm Court Block D · tenancy start dates', floor: 'org',
      holder: 'amara', to: 'lena', offered: 'today 09:20', since: 'Tue 27 Oct', due: 'Fri 6 Nov', h: 72, state: 'offered to Lena Fischer, not yet taken',
      line: '3 tenancies disagree with the rent account' },
    /* coming to you: offered by someone else, waits for your readback */
    { id: 'M-212', kind: 'intent', title: 'Renew 6 gas safety certificates, Elm Court Block A', floor: 'department',
      holder: 'tom', to: 'amara', offered: 'today 09:55', since: 'Mon 19 Oct', due: 'Fri 13 Nov', h: 238, state: 'Tom Reyes offers it to you',
      line: '4 of 6 renewed · Tom is off from tomorrow' },
    { id: 'A-121', kind: 'approval', title: 'Asbestos register update, v12', floor: 'department',
      holder: 'dev', next: 'amara', since: 'Mon 2 Nov', due: 'Fri 6 Nov', h: 72, state: 'comes to you after Dev Kapoor initials',
      line: 'Dev expects to pass it on Thu' },
    /* pointed out to you: someone else holds it, they wanted you to see it */
    { id: 'Y-09', kind: 'sync', title: 'Contractor portal sync failed at 06:10', floor: 'org',
      holder: 'mo', pointedBy: 'mo', pointed: 'today 07:02', since: 'today 06:10', due: 'today 12:00', h: 1.3, state: 'Mo Haddad holds it · pointed out to you',
      line: 'job updates from Calder Heating are 4 h behind' }
  ],

  /* the approval: publish a document to a Department library */
  approval: {
    id: 'A-118', doc: 'Damp and mould response standard', version: 'v3', was: 'v2', author: 'rui',
    library: 'Property Services standards', floor: 'department', readers: 86,
    sections: [
      { n: 1, t: 'Scope',               ch: 'same',    words: 'Every home Westmarch lets, and every report of damp or mould.' },
      { n: 2, t: 'Response times',      ch: 'changed', words: 'Emergency hazards made safe within 24 h', old: '48 h' },
      { n: 3, t: 'Inspection',          ch: 'changed', words: 'A dated photo of every affected room', old: 'a note of affected rooms' },
      { n: 4, t: 'Tenant contact',      ch: 'same',    words: 'Written update within 3 working days of each visit.' },
      { n: 5, t: 'Records',             ch: 'changed', words: 'Each case recorded against the home in Data Atlas', old: 'in the repairs spreadsheet' },
      { n: 6, t: 'Costs',               ch: 'new',     words: 'Up to £1,800 per home without further sign-off' }
    ],
    route: [
      { who: 'dev',    act: 'initial', in: 'Tue 27 Oct 10:00', hIn: -168.7, hOut: -91.5, at: 'Fri 30 Oct 15:12', held: '3 days', covers: [2, 3], says: 'Legal wording, against the Housing Ombudsman’s damp and mould report' },
      { who: 'nkechi', act: 'initial', in: 'Fri 30 Oct 15:12', hIn: -91.5, hOut: -18.6, at: 'Mon 2 Nov 16:05',  held: '1 working day',    covers: [2],    says: 'Response times are workable for Repairs North' },
      { who: 'amara',  act: 'initial', in: 'Mon 2 Nov 16:05', hIn: -18.6, at: null,               held: '18 h so far', covers: [3, 5], says: 'The inspection and records steps match how Repairs North works' },
      { who: 'helen',  act: 'stamp',   due: 'Wed 4 Nov 12:00', hDue: 25.3, at: null,               held: '',       covers: [1, 2, 3, 4, 5, 6], says: 'Publish to the Property Services standards library' }
    ],
    uncovered: [6],
    uncoveredWho: 'joe',
    /* your stamp book: the counterfoil of every mark you have put on something */
    book: [
      { no: 41, at: 'Thu 29 Oct', what: 'Void inspection checklist, v5', act: 'initial', covers: 'Steps 1 to 4', for: 'nkechi' },
      { no: 40, at: 'Tue 27 Oct', what: 'Elm Court Block D tenancy dates', act: 'offered', covers: 'Handed up for a data steward’s ruling', for: 'lena' },
      { no: 39, at: 'Fri 23 Oct', what: 'Out-of-hours rota, November', act: 'initial', covers: 'Repairs North rows', for: 'helen' },
      { no: 38, at: 'Wed 21 Oct', what: 'Contractor visit report, B-11', act: 'returned', covers: 'Photos missing for 2 rooms', for: 'rui' }
    ]
  },

  /* the handover: an intent from Amara to Tom, with an SBAR note */
  handover: {
    item: 'M-207', from: 'amara', to: 'tom', why: 'Amara is on a course Thu 5 and Fri 6 Nov',
    window: 'today 14:00', start: '10:44',
    sbar: {
      s: { src: 'records', text: 'Elm Court damp backlog is 3 d 22 h past its deadline of Fri 30 Oct: 14 of 19 homes done, 5 left.' },
      b: { src: 'records', text: 'Helen Marsh asked for it on 12 Oct. The 5 left are all in Block C: 3 wait on Calder Heating’s visit, booked Thu 5 Nov; 2 have no access agreed.' },
      a: { src: 'person',  text: 'Thursday’s visit should clear 3. The 2 without access are the real risk: the tenant at C-14 has asked twice for an evening.' },
      r: { src: 'person',  text: 'Ask Helen for a new date of Fri 13 Nov. Ring C-14 before Thursday and offer an evening slot.' }
    },
    readback: '5 left in Block C. 3 go on Thursday’s visit, 2 need access. I ask Helen for 13 Nov and ring C-14 for an evening.',
    question: 'Has Helen seen the 13 Nov date yet?',
    answer: 'Not yet. It is cocked on my desk to ring her before 14:00; I’ll add what she says here.',
    attached: ['5 homes in Block C', 'Calder Heating booking, Thu 5 Nov', 'C-14 contact log'],
    times: { offer: '10:44', read: '10:51', ask: '10:52', answer: '10:55', take: '10:58' }
  },

  /* before a course: everything Amara holds, handed out at once, one line of SBAR each */
  shift: {
    why: 'Amara is on a course Thu 5 and Fri 6 Nov', back: 'Mon 9 Nov',
    rows: [
      { item: 'M-207', to: 'tom',    s: '3 d 22 h over; 5 homes left in Block C', r: 'Ask Helen for 13 Nov; ring C-14', read: 'Ask Helen for 13 Nov, ring C-14 for an evening', at: '10:58' },
      { item: 'F-3301', to: 'lena',  s: 'Two sources: 2014 and 2017', r: 'Data plate photo says 06/2017; please rule', read: null, at: null },
      { item: 'S-44',   to: 'nkechi', s: 'Rui asks to open the survey photos', r: 'Read only is fine by me', read: 'Will grant read only today', at: '11:06' },
      { item: 'A-118',  to: null,    s: 'Your initial is next', r: 'Do it today, before you go', read: null, at: null, keep: 'Stays with you: only you were asked to sign for sections 3 and 5' }
    ]
  },

  /* the team board: Repairs North. 4 slots each, by the team's own rule */
  board: {
    slotsEach: 4,
    rule: 'Each of us holds at most 4 jobs at a time. Set by Nkechi Bello, 14 Sep.',
    stages: [ { id: 'asked', w: 'Asked', cap: 6 }, { id: 'survey', w: 'Surveying', cap: 4 }, { id: 'booked', w: 'Booked', cap: 6 }, { id: 'doing', w: 'On site', cap: 5 }, { id: 'check', w: 'Checking', cap: 3 } ],
    jobs: [
      { id: 'J-401', home: 'C-14', t: 'Damp survey',            kind: 'survey',  holder: 'rui',    stage: 'survey', due: 'Thu', h: 48 },
      { id: 'J-402', home: 'C-09', t: 'Mould wash and treat',   kind: 'repair',  holder: 'sol',    stage: 'doing',  due: 'today', h: 6 },
      { id: 'J-403', home: 'A-03', t: 'Gas safety certificate', kind: 'cert',    holder: 'fran',   stage: 'doing',  due: 'Wed', h: 26 },
      { id: 'J-404', home: 'A-07', t: 'Gas safety certificate', kind: 'cert',    holder: 'fran',   stage: 'booked', due: 'Fri', h: 74 },
      { id: 'J-405', home: 'B-11', t: 'Leak trace',             kind: 'repair',  holder: 'grace',  stage: 'booked', due: 'today', h: 4 },
      { id: 'J-406', home: 'B-02', t: 'Extractor fan',          kind: 'repair',  holder: 'grace',  stage: 'asked',  due: 'Mon', h: 140 },
      { id: 'J-407', home: 'C-12', t: 'Damp survey',            kind: 'survey',  holder: 'rui',    stage: 'check',  due: 'Wed', h: 28 },
      { id: 'J-408', home: 'C-14', t: 'Agree evening access',   kind: 'admin',   holder: 'amara',  stage: 'asked',  due: 'Thu', h: 46 },
      { id: 'J-409', home: 'D-04', t: 'Tenancy records check',  kind: 'admin',   holder: 'amara',  stage: 'doing',  due: 'Fri', h: 72 },
      { id: 'J-410', home: 'A-11', t: 'Gas safety certificate', kind: 'cert',    holder: 'tom',    stage: 'booked', due: 'Thu', h: 50 },
      { id: 'J-411', home: 'A-12', t: 'Gas safety certificate', kind: 'cert',    holder: 'tom',    stage: 'asked',  due: 'Mon', h: 142 },
      { id: 'J-412', home: 'C-03', t: 'Mould wash and treat',   kind: 'repair',  holder: 'kai',    stage: 'doing',  due: 'Wed', h: 27 },
      { id: 'J-413', home: 'C-05', t: 'Window seals',           kind: 'repair',  holder: 'kai',    stage: 'booked', due: 'Thu', h: 49 },
      { id: 'J-414', home: 'C-07', t: 'Window seals',           kind: 'repair',  holder: 'kai',    stage: 'booked', due: 'Thu', h: 51 },
      { id: 'J-415', home: 'C-14', t: 'Mould wash and treat',   kind: 'repair',  holder: 'sol',    stage: 'asked',  due: 'Fri', h: 74 },
      { id: 'J-416', home: 'B-08', t: 'Check completed works',  kind: 'admin',   holder: 'nkechi', stage: 'check',  due: 'Wed', h: 25 },
      { id: 'J-417', home: 'C-10', t: 'Damp survey',            kind: 'survey',  holder: null,     stage: 'asked',  due: 'Mon', h: 140, waiting: '3 days' }
    ],
    /* how many of each kind the team can do in a day, from who does that kind of work */
    perDay: { survey: 1, repair: 2, cert: 1, admin: 2 },
    days: [ { id: 'today', w: 'Tue 3', sub: 'today' }, { id: 'Wed', w: 'Wed 4' }, { id: 'Thu', w: 'Thu 5' }, { id: 'Fri', w: 'Fri 6' }, { id: 'Mon', w: 'Mon 9' } ],
    jobKinds: {
      survey: { w: 'Survey', icon: 'ruler' },
      repair: { w: 'Repair', icon: 'wrench' },
      cert:   { w: 'Certificate', icon: 'flame' },
      admin:  { w: 'Desk work', icon: 'clipboard-list' }
    }
  },

  /* the ledger: one fact, every change an entry, nothing erased */
  fact: {
    id: 'F-3301', subject: 'Elm Court Block C', field: 'boiler install year', floor: 'team', steward: 'lena',
    entries: [
      { n: 1, at: '12 Mar 2024', by: 'import', who: 'lena', act: 'set',     v: '2014', note: 'Asset register import, batch AR-2024-03', src: 'Asset register' },
      { n: 2, at: '18 Sep 2026', by: 'joe',   act: 'cited',   v: null, note: 'Cited by “Gas safety plan 2026-27”', src: 'Artifacts' },
      { n: 3, at: '29 Oct 2026', by: 'rui',   act: 'second',  v: '2017', note: 'Calder Heating survey says 2017', src: 'Contractor survey' },
      { n: 4, at: '30 Oct 2026', by: 'rule',  act: 'held',    v: null, note: 'Held by Amara Osei for triage, by the team’s rule for disputes', src: '' },
      { n: 5, at: 'today 09:20', by: 'rui',   act: 'note',    v: null, note: 'Photo of the data plate on boiler C-01: “06/2017”', src: 'photo' },
      { n: 6, at: 'today 10:41', by: 'amara', act: 'correct', v: '2017', was: '2014', note: '2014 was the year Block C was refurbished, not when its boilers went in. The data plate says 06/2017.', src: 'photo, entry 5', counter: 'lena' }
    ],
    foldAfterDays: 90, /* a deployment setting: when a struck value folds into a "corrected" tag */
    others: [ ['Homes', '12'], ['Heating', 'Gas, a boiler per home'], ['Last gas safety check', 'Mar 2026'] ],
    citedBy: [ { t: 'Gas safety plan 2026-27', owner: 'joe' }, { t: 'Block C asset summary', owner: 'dev' } ]
  },

  /* the day book: every mark anyone on the team made today, in order, each posted to the thing it is about */
  daybook: [
    { at: '06:10', by: 'rule',   act: 'failed',   on: 'Y-09',   w: 'The contractor portal sync failed' },
    { at: '07:02', by: 'mo',     act: 'pointed',  on: 'Y-09',   w: 'pointed it out to Amara Osei' },
    { at: '08:12', by: 'rui',    act: 'asked',    on: 'S-44',   w: 'asked to open the Elm Court survey photos' },
    { at: '08:30', by: 'kai',    act: 'offered',  on: 'J-409',  w: 'offered the D-04 tenancy records check to Amara Osei' },
    { at: '08:31', by: 'amara',  act: 'took',     on: 'J-409',  w: 'took the D-04 tenancy records check, read back' },
    { at: '09:20', by: 'rui',    act: 'noted',    on: 'F-3301', w: 'added a photo of the boiler data plate' },
    { at: '09:20', by: 'amara',  act: 'offered',  on: 'F-3290', w: 'offered Block D tenancy dates up to Lena Fischer' },
    { at: '09:55', by: 'tom',    act: 'offered',  on: 'M-212',  w: 'offered the Block A certificates to Amara Osei' },
    { at: '10:12', by: 'nkechi', act: 'turned',   on: 'board',  w: 'turned 11 cards in the round: 8 on track, 3 need help' },
    { at: '10:41', by: 'amara',  act: 'corrected', on: 'F-3301', w: 'corrected the boiler install year from 2014 to 2017', counter: 'lena' },
    { at: '10:41', by: 'rule',   act: 'posted',   on: 'F-3301', w: 'told the owners of the 2 documents that cite it' }
  ],

  /* custody: every handover recorded twice, given and taken, this week */
  custody: [
    { at: 'Mon 2 Nov 09:05', item: 'J-405 Leak trace, B-11',            from: 'nkechi', to: 'grace', taken: 'Mon 09:12' },
    { at: 'Mon 2 Nov 16:05', item: 'A-118 Damp and mould standard, v3', from: 'nkechi', to: 'amara', taken: 'Mon 16:40' },
    { at: 'Tue 3 Nov 08:30', item: 'J-409 Tenancy records check, D-04',  from: 'kai',    to: 'amara', taken: 'Tue 08:31' },
    { at: 'Tue 3 Nov 09:20', item: 'F-3290 Block D tenancy start dates',  from: 'amara',  to: 'lena',  taken: null },
    { at: 'Tue 3 Nov 09:55', item: 'M-212 Gas safety certificates, Block A', from: 'tom', to: 'amara', taken: null }
  ]
};
