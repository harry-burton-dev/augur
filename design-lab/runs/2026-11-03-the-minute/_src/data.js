/* Sample data. Every name, label, count, date and floor below is deployment data:
   nothing in the markup or the scripts repeats any of it. One organisation, one
   Department floor's leadership meeting, one year of its decisions. The story the
   run follows: D-118 (12 May 2026) moved van inspections in-house as a trial, set
   three actions, and was reversed six months later by D-131 (3 Nov 2026). */
const DATA = {
  org: 'Ridgeway Regional Services',
  today: '2026-11-03',
  clock: '10:52',
  floors: {
    org:        { name: 'Ridgeway Regional Services', word: 'Org' },
    department: { name: 'Fleet and Facilities',       word: 'Department' },
    team:       { name: 'North depot crew',           word: 'Team' }
  },
  floorOrder: ['org', 'department', 'team'],
  people: {
    p1: { name: 'Marcus Hale',   role: 'Head of Fleet and Facilities', floor: 'department', initials: 'MH' },
    p2: { name: 'Priya Nair',    role: 'Fleet lead',                   floor: 'department', initials: 'PN' },
    p3: { name: 'Jo Barnes',     role: 'North depot keeper',           floor: 'team',       initials: 'JB' },
    p4: { name: 'Dana Whitlock', role: 'Contracts manager',            floor: 'org',        initials: 'DW' },
    p5: { name: 'Ade Bello',     role: 'Finance business partner',     floor: 'org',        initials: 'AB' },
    p6: { name: 'Ellen Shaw',    role: 'Business support officer',     floor: 'department', initials: 'ES' },
    p7: { name: 'Ruth Mensah',   role: 'Health and safety adviser',    floor: 'org',        initials: 'RM' },
    p8: { name: 'Sam Okafor',    role: 'Depot coordinator',            floor: 'team',       initials: 'SO' }
  },
  /* the body that decides. Its rules (quorum, who confirms minutes) are its own settings */
  body: {
    id: 'ffl', name: 'Fleet and Facilities leadership meeting', short: 'Leadership meeting', code: 'FFL',
    floor: 'department', chair: 'p1', secretary: 'p6', members: ['p1', 'p2', 'p3', 'p4', 'p5', 'p7'], quorum: 4,
    cadence: 'second Tuesday of each month', confirms: 'the next meeting confirms the minutes as a true record'
  },
  /* kinds of decision, each with the standard of proof it asks for (the decision sets the bar, briefing run) */
  kinds: {
    contract: { name: 'Change a contract',      bar: 'likely',        owner: 'p4' },
    spend:    { name: 'Spend over £10,000',     bar: 'highly likely', owner: 'p5' },
    rule:     { name: 'Set a working rule',     bar: 'likely',        owner: 'p1' },
    plan:     { name: 'Adopt a plan',           bar: 'likely',        owner: 'p1' },
    routine:  { name: 'Routine business',       bar: null,            owner: 'p1' }
  },
  yardstick: ['remote', 'highly unlikely', 'unlikely', 'a realistic possibility', 'likely', 'highly likely', 'almost certain'],
  meetings: [
    { id: 'm2511', no: 'FFL 25/11', date: '2025-11-11', present: ['p1', 'p2', 'p3', 'p4', 'p5'], apologies: ['p7'], confirmed: '2025-12-09' },
    { id: 'm2601', no: 'FFL 26/01', date: '2026-01-13', present: ['p1', 'p2', 'p3', 'p4', 'p7'], apologies: ['p5'], confirmed: '2026-02-10' },
    { id: 'm2602', no: 'FFL 26/02', date: '2026-02-10', present: ['p1', 'p2', 'p3', 'p5', 'p7'], apologies: ['p4'], confirmed: '2026-03-10' },
    { id: 'm2603', no: 'FFL 26/03', date: '2026-03-10', present: ['p1', 'p2', 'p4', 'p5', 'p7'], apologies: ['p3'], confirmed: '2026-04-14' },
    { id: 'm2604', no: 'FFL 26/04', date: '2026-04-14', present: ['p1', 'p2', 'p3', 'p4', 'p5', 'p7'], apologies: [], confirmed: '2026-05-12' },
    { id: 'm2605', no: 'FFL 26/05', date: '2026-05-12', present: ['p1', 'p2', 'p3', 'p4', 'p5'], apologies: ['p7'], confirmed: '2026-06-09', start: '10:00', end: '11:40',
      corrections: [{ item: 4, was: 'reduced to breakdown cover from 1 August', now: 'reduced to breakdown cover when it renews on 1 September 2026', by: 'p4', on: '2026-06-09', why: 'The draft gave the wrong date; the contract renews on 1 September.' }] },
    { id: 'm2606', no: 'FFL 26/06', date: '2026-06-09', present: ['p1', 'p2', 'p3', 'p4', 'p7'], apologies: ['p5'], confirmed: '2026-07-14' },
    { id: 'm2607', no: 'FFL 26/07', date: '2026-07-14', present: ['p1', 'p2', 'p3', 'p4', 'p5', 'p7'], apologies: [], confirmed: '2026-09-08' },
    { id: 'm2609', no: 'FFL 26/09', date: '2026-09-08', present: ['p1', 'p2', 'p3', 'p5', 'p7'], apologies: ['p4'], confirmed: '2026-10-13' },
    { id: 'm2610', no: 'FFL 26/10', date: '2026-10-13', present: ['p1', 'p2', 'p3', 'p4', 'p5'], apologies: ['p7'], confirmed: '2026-11-03' },
    { id: 'm2611', no: 'FFL 26/11', date: '2026-11-03', present: ['p1', 'p2', 'p3', 'p4', 'p5', 'p7'], apologies: [], confirmed: null, start: '10:00', note: 'brought forward from 10 Nov by D-130' }
  ],
  /* the agenda of the May meeting, minuted live in surface 2 */
  agenda: [
    { no: 1, title: 'Apologies and declarations', min: 2, done: true },
    { no: 2, title: 'Minutes of 14 April and matters arising', min: 10, done: true },
    { no: 3, title: 'Depot roof survey', min: 10, done: true, decision: 'D-117' },
    { no: 4, title: 'North depot van inspections', min: 25, decision: 'D-118', paper: 'doc-cost' },
    { no: 5, title: 'Telematics pilot: first month', min: 15 },
    { no: 6, title: 'Any other business', min: 5 }
  ],
  intents: {
    'M-42': { title: 'Cut fleet running costs by 8% this year', owner: 'p1', floor: 'department', due: '2026-12-31', state: 'on track until Nov', forecast: { with: '8.1%', without: '6.9%', rests: 'D-118' } },
    'M-57': { title: 'Every van inspected on its due date', owner: 'p2', floor: 'department', due: '2026-12-31', state: 'off track' }
  },
  docs: {
    'doc-cost':   { title: 'In-house inspection costing, v2', by: 'p2', app: 'Artifacts', date: '2026-05-05' },
    'doc-kreport':{ title: 'Kestrel annual report 2025',      by: 'p4', app: 'Artifacts', date: '2026-02-02' },
    'doc-proc':   { title: 'North depot procedures, v3',      by: 'p3', app: 'Artifacts', date: '2026-07-20', cites: ['D-118'], readers: 11 },
    'doc-budget': { title: 'Fleet budget monitor, Q3',         by: 'p5', app: 'Artifacts', date: '2026-10-05', cites: ['D-118'] },
    'doc-brief':  { title: 'Briefing F-0412: North depot vans overdue', by: 'p8', app: 'Artifacts', date: '2026-10-28' }
  },
  /* monthly series, read by the decision's tripwires */
  series: {
    overdue: { label: 'North depot vans overdue for inspection', of: 18, unit: 'vans',
      points: [['2026-04', 2], ['2026-05', 2], ['2026-06', 1], ['2026-07', 2], ['2026-08', 2], ['2026-09', 4], ['2026-10', 5], ['2026-11', 7]] },
    cost: { label: 'Cost per van inspection, in-house', unit: '£',
      points: [['2026-07', 131], ['2026-08', 139], ['2026-09', 144], ['2026-10', 148]] },
    fitters: { label: 'Fitters in post at North depot', unit: '',
      points: [['2026-06', 0], ['2026-07', 0], ['2026-08', 0], ['2026-09', 1], ['2026-10', 1], ['2026-11', 1]] }
  },
  decisions: {
    'D-097': { meeting: 'm2511', item: 5, kind: 'contract', title: 'Renew Kestrel’s servicing contract for a year',
      words: 'That Kestrel’s servicing contract, inspections included, is renewed for one year from 1 December 2025.',
      status: 'amended', amendedBy: 'D-118', amendedOn: '2026-05-12', subjects: ['Kestrel', 'contracts', 'inspections'] },
    'D-101': { meeting: 'm2601', item: 3, kind: 'plan', title: 'Adopt the 2026 fleet replacement plan', words: 'That the 2026 fleet replacement plan is adopted.', status: 'in force', subjects: ['fleet plan'] },
    'D-102': { meeting: 'm2601', item: 4, kind: 'routine', title: 'Close the Westbrook fuel card account', words: 'That the Westbrook fuel card account is closed by 31 January.', status: 'spent', spentOn: '2026-01-29', subjects: ['fuel cards'] },
    'D-104': { meeting: 'm2602', item: 3, kind: 'spend', title: 'Pilot telematics on 12 North depot vans', words: 'That telematics is piloted on 12 North depot vans for three months.', status: 'amended', amendedBy: 'D-112', amendedOn: '2026-04-14', subjects: ['telematics', 'North depot'] },
    'D-105': { meeting: 'm2602', item: 5, kind: 'rule', title: 'The south depot keeps the gritting rota this winter', words: 'That the south depot keeps the gritting rota until 31 March.', status: 'lapsed', lapsedOn: '2026-03-31', subjects: ['gritting', 'south depot'] },
    'D-107': { meeting: 'm2603', item: 3, kind: 'rule', title: 'Pool cars are booked through the shared calendar', words: 'That pool cars are booked only through the shared calendar from 1 April.', status: 'in force', subjects: ['pool cars'] },
    'D-108': { meeting: 'm2603', item: 4, kind: 'rule', title: 'Engines off after five minutes idling', words: 'That no fleet vehicle idles for more than five minutes.', status: 'in force', subjects: ['idling', 'fuel'] },
    'D-110': { meeting: 'm2604', item: 3, kind: 'contract', title: 'Renew the Halden Tyres contract for two years', words: 'That the tyre supply contract with Halden Tyres is renewed for two years.', status: 'in force', subjects: ['tyres', 'contracts'] },
    'D-112': { meeting: 'm2604', item: 4, kind: 'spend', title: 'Extend telematics to all 18 North depot vans', words: 'That the telematics pilot (D-104) is extended to all 18 North depot vans.', status: 'in force', amends: 'D-104', subjects: ['telematics', 'North depot'] },
    'D-117': { meeting: 'm2605', item: 3, kind: 'spend', title: 'Commission the depot roof survey', words: 'That a survey of the North depot roof is commissioned.', status: 'spent', spentOn: '2026-06-30', subjects: ['North depot', 'buildings'] },
    'D-118': { meeting: 'm2605', item: 4, kind: 'contract',
      title: 'Van inspections at the North depot move in-house',
      motion: { by: 'p2', seconded: 'p3', text: 'That van inspections at the North depot move in-house from 1 July 2026, and that Kestrel’s contract is reduced to breakdown cover.' },
      amendment: { by: 'p5', text: 'as a six-month trial', accepted: true },
      words: 'That van inspections at the North depot move in-house from 1 July 2026, as a six-month trial, and that Kestrel’s servicing contract is reduced to breakdown cover when it renews on 1 September 2026.',
      plain: 'Our own fitters inspect North depot vans from 1 July, for a six-month trial. Kestrel keeps breakdown cover only.',
      because: [
        { text: 'Kestrel charges £186 a van for each inspection; our own fitters would cost about £112.', on: ['e1', 'e2'] },
        { text: 'That saves about £16,000 a year towards cutting fleet costs by 8%.', on: ['e2', 'e5'] },
        { text: 'Kestrel missed 3 of 12 visits last year, and vans were overdue each time.', on: ['e6'] }
      ],
      /* what the decision rests on: as it was when decided, and now */
      evidence: [
        { id: 'e1', kind: 'fact',  label: 'Kestrel’s price per van inspection', then: '£186', now: '£186', app: 'Data Atlas', src: 'Contract C-0412', word: null, moved: false },
        { id: 'e2', kind: 'fact',  label: 'Our own cost per van inspection',   then: '£112', now: '£148', app: 'Artifacts', src: 'doc-cost', word: 'likely', moved: true, series: 'cost', note: 'actual cost, July to October' },
        { id: 'e3', kind: 'assume',label: 'Two fitters in post by 30 June',    then: 'assumed', now: '1 in post since 9 Sep', app: 'Mandate', src: 'A-302', word: null, moved: true, failed: true, series: 'fitters' },
        { id: 'e4', kind: 'fact',  label: 'North depot vans overdue',          then: '2 of 18', now: '7 of 18', app: 'Data Atlas', src: 'query', word: null, moved: true, series: 'overdue' },
        { id: 'e5', kind: 'intent',label: 'Cut fleet running costs by 8% this year', then: 'asked', now: 'saving counted: £3,100 of £16,000', app: 'Mandate', src: 'M-42', moved: true },
        { id: 'e6', kind: 'doc',   label: 'Kestrel missed 3 of 12 visits',     then: '3 of 12', now: '3 of 12', app: 'Artifacts', src: 'doc-kreport', word: 'almost certain', moved: false }
      ],
      /* stated at the table: what would reopen it */
      revisitIf: [
        { id: 't1', text: 'more than 4 North depot vans are overdue for inspection', series: 'overdue', op: '>', at: 4, tripped: '2026-10-06' },
        { id: 't2', text: 'fewer than two fitters are in post on 1 August', series: 'fitters', op: '<', at: 2, on: '2026-08', tripped: '2026-08-01' },
        { id: 't3', text: 'the trial ends: review at the November meeting', date: '2026-11-10', tripped: null }
      ],
      vote: { for: ['p1', 'p2', 'p3', 'p4'], against: [], abstain: ['p5'] },
      dissent: [{ by: 'p5', text: 'The costing has no figure for cover when a fitter is off sick or on leave.' }],
      obiter: [
        { by: 'p1', text: 'The bay could later take the south depot’s vans as well.' },
        { by: 'p3', text: 'Fitters could also do minor repairs between inspections.' },
        { by: 'p4', text: 'Kestrel will want three months’ notice for any change to the scope.' }
      ],
      actions: ['A-301', 'A-302', 'A-303'],
      cites: ['D-097'],
      status: 'reversed', inForce: '2026-05-12', reversedBy: 'D-131', reversedOn: '2026-11-03',
      affirmedBy: 'D-128', affirmedOn: '2026-09-08',
      subjects: ['Kestrel', 'inspections', 'North depot', 'fitters', 'contracts']
    },
    'D-120': { meeting: 'm2606', item: 3, kind: 'spend', title: 'Lease two electric vans for the south depot', words: 'That two electric vans are leased for the south depot for three years.', status: 'in force', subjects: ['electric vans', 'south depot'] },
    'D-121': { meeting: 'm2606', item: 4, kind: 'routine', title: 'Put the depot open day on hold', words: 'That the depot open day is held over until the roof survey is back.', status: 'lapsed', lapsedOn: '2026-09-30', subjects: ['open day'] },
    'D-124': { meeting: 'm2607', item: 3, kind: 'rule', title: 'Two signatures for fuel card spend over £500', words: 'That any fuel card spend over £500 needs two signatures.', status: 'in force', subjects: ['fuel cards'] },
    'D-125': { meeting: 'm2607', item: 4, kind: 'routine', title: 'Re-advertise the fitter post at a higher grade', words: 'That the second fitter post is re-advertised at grade 6.', status: 'spent', spentOn: '2026-08-14', relates: 'D-118', subjects: ['fitters', 'North depot'] },
    'D-127': { meeting: 'm2609', item: 3, kind: 'rule', title: 'Adopt the new pool car policy', words: 'That the pool car policy, v4, is adopted.', status: 'in force', subjects: ['pool cars'] },
    'D-128': { meeting: 'm2609', item: 4, kind: 'contract', title: 'Keep the inspection trial going with one fitter', words: 'That the trial under D-118 continues with one fitter until its review in November.', status: 'spent', spentOn: '2026-11-03', affirms: 'D-118', subjects: ['inspections', 'fitters', 'North depot'] },
    'D-129': { meeting: 'm2610', item: 3, kind: 'spend', title: 'Bid for the 2027 fleet budget', words: 'That the 2027 fleet budget bid goes to the Org finance panel as drafted.', status: 'in force', subjects: ['budget'] },
    'D-130': { meeting: 'm2610', item: 5, kind: 'routine', title: 'Bring the November meeting forward to 3 Nov', words: 'That the November meeting is brought forward to 3 November to review D-118 early.', status: 'spent', spentOn: '2026-11-03', relates: 'D-118', subjects: ['meetings', 'inspections'] },
    'D-131': { meeting: 'm2611', item: 3, kind: 'contract',
      title: 'Van inspections at the North depot go back to a contractor',
      words: 'That decision D-118 is reversed: van inspections at the North depot go back to an outside contractor from 1 December 2026, and the inspection bay and the fitter in post stay, for minor repairs.',
      plain: 'From 1 December an outside contractor inspects North depot vans again. The bay and our one fitter stay, for repairs.',
      because: [
        { text: '7 of 18 North depot vans are overdue for inspection, up from 2 in August.', on: ['f1'] },
        { text: 'Only one of the two fitters could be hired, and not until September.', on: ['f2'] },
        { text: 'Our own cost has risen to £148 a van, so the saving is small.', on: ['f3'] }
      ],
      evidence: [
        { id: 'f1', kind: 'fact', label: 'North depot vans overdue', then: '7 of 18', now: '7 of 18', app: 'Data Atlas', src: 'doc-brief' },
        { id: 'f2', kind: 'fact', label: 'Fitters in post', then: '1 of 2', now: '1 of 2', app: 'Mandate', src: 'A-302' },
        { id: 'f3', kind: 'fact', label: 'Our own cost per van inspection', then: '£148', now: '£148', app: 'Data Atlas', src: 'query' }
      ],
      revisitIf: [{ id: 'u1', text: 'the contractor misses a monthly visit', tripped: null }],
      vote: { for: ['p1', 'p2', 'p3', 'p4', 'p5', 'p7'], against: [], abstain: [] },
      dissent: [],
      obiter: [{ by: 'p3', text: 'The fitter in post has cleared most of the minor repairs backlog.' }],
      actions: ['A-311', 'A-312', 'A-313'],
      status: 'in force', inForce: '2026-11-03', reverses: 'D-118',
      subjects: ['Kestrel', 'inspections', 'North depot', 'fitters', 'contracts']
    },
    'D-132': { meeting: 'm2611', item: 4, kind: 'routine', title: 'Sell the two oldest pool cars', words: 'That the two oldest pool cars are sold at auction.', status: 'in force', subjects: ['pool cars'] }
  },
  /* actions: one owner, one date, one state. history = every change, never overwritten */
  actions: {
    'A-301': { from: 'D-118', text: 'Give Kestrel notice that the contract drops to breakdown cover on 1 September', owner: 'p4', setBy: 'p1', set: '2026-05-12', due: '2026-05-31',
      history: [ ['2026-05-12', 'given'], ['2026-05-13', 'accepted'], ['2026-05-28', 'done', 'Notice sent and acknowledged by Kestrel'], ['2026-06-09', 'discharged', 'Matters arising, June meeting'] ],
      after: 'spent: its effect is undone by A-311' },
    'A-302': { from: 'D-118', text: 'Hire two vehicle fitters for the North depot', owner: 'p3', setBy: 'p1', set: '2026-05-12', due: '2026-06-30',
      moves: [ { on: '2026-06-23', from: '2026-06-30', to: '2026-08-31', by: 'p1', why: 'No qualified applicants in the first round' },
               { on: '2026-08-28', from: '2026-08-31', to: '2026-10-31', by: 'p1', why: 'One fitter starts 9 Sep; the second post is re-advertised at grade 6 (D-125)' } ],
      history: [ ['2026-05-12', 'given'], ['2026-05-12', 'accepted'], ['2026-06-23', 'moved'], ['2026-08-28', 'moved'], ['2026-09-09', 'part', 'First fitter in post'], ['2026-11-01', 'overdue'], ['2026-11-03', 'overtaken', 'Withdrawn by D-131: the fitter in post stays for repairs'] ],
      progress: '1 of 2' },
    'A-303': { from: 'D-118', text: 'Fit out the inspection bay at the North depot', owner: 'p8', setBy: 'p1', set: '2026-05-12', due: '2026-07-15',
      history: [ ['2026-05-12', 'given'], ['2026-05-14', 'accepted'], ['2026-07-22', 'done', 'Bay signed off by Ruth Mensah'], ['2026-09-08', 'discharged', 'Matters arising, September meeting'] ],
      after: 'kept: the bay stays for minor repairs' },
    'A-311': { from: 'D-131', text: 'Ask Kestrel to restore monthly inspection visits from 1 December, or start a quick tender', owner: 'p4', setBy: 'p1', set: '2026-11-03', due: '2026-11-17', history: [ ['2026-11-03', 'given'] ] },
    'A-312': { from: 'D-131', text: 'Book the 7 overdue vans for inspection this month', owner: 'p2', setBy: 'p1', set: '2026-11-03', due: '2026-11-20', history: [ ['2026-11-03', 'given'], ['2026-11-03', 'accepted'] ] },
    'A-313': { from: 'D-131', text: 'Update the North depot procedures to say who inspects', owner: 'p3', setBy: 'p1', set: '2026-11-03', due: '2026-11-30', history: [ ['2026-11-03', 'given'] ] },
    /* other open actions on the floor, so the chair's view has company */
    'A-305': { from: 'D-117', text: 'Send the roof survey brief to three surveyors', owner: 'p2', setBy: 'p1', set: '2026-05-12', due: '2026-05-26', history: [ ['2026-05-12', 'given'], ['2026-05-12', 'accepted'], ['2026-05-22', 'done'], ['2026-06-09', 'discharged'] ] },
    'A-308': { from: 'D-120', text: 'Order two charge points for the south depot', owner: 'p8', setBy: 'p1', set: '2026-06-09', due: '2026-11-13', history: [ ['2026-06-09', 'given'], ['2026-06-10', 'accepted'] ] },
    'A-309': { from: 'D-124', text: 'Tell every fuel card holder about the two-signature rule', owner: 'p5', setBy: 'p1', set: '2026-07-14', due: '2026-07-31', history: [ ['2026-07-14', 'given'], ['2026-07-15', 'accepted'], ['2026-07-29', 'done', 'Sent to 41 card holders'] ] },
    'A-310': { from: 'D-129', text: 'Present the 2027 budget bid to the finance panel', owner: 'p1', setBy: 'p1', set: '2026-10-13', due: '2026-11-19', history: [ ['2026-10-13', 'given'], ['2026-10-13', 'accepted'] ] }
  },
  /* what else in AUGUR points at D-118 (its wake) */
  wake: [
    { kind: 'action', ref: 'A-301', effect: 'spent', say: 'Done in May. Its effect (Kestrel on breakdown cover only) is undone by a new action.' },
    { kind: 'action', ref: 'A-302', effect: 'overtaken', say: 'Still open. It is withdrawn; the fitter in post stays.' },
    { kind: 'action', ref: 'A-303', effect: 'kept', say: 'Done in July. The bay stays, for minor repairs.' },
    { kind: 'doc', ref: 'doc-proc', effect: 'cites', say: 'Section 4 says “our own fitters inspect vans”. It needs a new edition.' },
    { kind: 'doc', ref: 'doc-budget', effect: 'cites', say: 'Counts a £16,000 saving a year. It should count £3,100 so far, then nothing.' },
    { kind: 'intent', ref: 'M-42', effect: 'rests', say: 'Its forecast counts this saving. Without it, the forecast falls from 8.1% to 6.9%.' },
    { kind: 'decision', ref: 'D-128', effect: 'spent', say: 'Kept the trial going in September. It ends with the trial.' }
  ],
  /* the live minute's model draft (pencil) for item 4: what the room said, as heard */
  heard: [
    { t: '10:41', by: 'p2', text: 'So the proposal is we bring the inspections in-house from July. The costing’s in the pack, it’s about seventy pounds a van cheaper.' },
    { t: '10:43', by: 'p5', text: 'I’m not against it, but there’s nothing in there for cover when a fitter’s off. Could we call it a trial?' },
    { t: '10:44', by: 'p1', text: 'Six months? We look at it again in November.' },
    { t: '10:45', by: 'p4', text: 'Kestrel will want three months’ notice for any scope change, so I’d need to write this month.' },
    { t: '10:46', by: 'p3', text: 'I can get the adverts out next week. Two fitters by the end of June should be fine.' },
    { t: '10:47', by: 'p1', text: 'And if the overdue list goes over four, we bring it back here. Agreed?' }
  ]
};
