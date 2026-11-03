/* Shared sample for the b-screens (v2, v3). Every name, label, count, date and floor
   below is deployment data: the markup and scripts repeat none of it. Counts are worked
   out from `vans` and `groups`; nothing in the briefing is typed in by hand. */
const DATA = {
  org: 'Ridgeway Regional Services',
  me: 'p1',
  myFloor: 'team',
  myTeam: 'north',
  today: '2026-11-03',
  readWpm: 200,          /* reading speed, an org setting */
  pictureSec: 1,         /* a word-size picture costs about a second to read */
  floors: {
    org:        { name: 'Ridgeway Regional Services', word: 'Org',        reach: 1180 },
    department: { name: 'Fleet and Facilities',       word: 'Department', reach: 34 },
    team:       { name: 'North depot crew',           word: 'Team',       reach: 9 }
  },
  floorOrder: ['org', 'department', 'team'],
  teams: { north: 'North depot crew', west: 'Westfield crew' },
  people: {
    p1: { name: 'Sam Okafor',    role: 'Depot coordinator',  floor: 'team', team: 'north' },
    p2: { name: 'Priya Nair',    role: 'Fleet lead',         floor: 'department' },
    p3: { name: 'Jo Barnes',     role: 'North depot keeper', floor: 'team', team: 'north' },
    p4: { name: 'Dana Whitlock', role: 'Contracts manager',  floor: 'org' },
    p5: { name: 'Health and safety desk', role: 'Keeps incident reports', floor: 'org' },
    p6: { name: 'Ana Ruiz',      role: 'Westfield keeper',   floor: 'team', team: 'west' }
  },
  /* the lead the briefing is for */
  reader: 'p2',
  subject: 'North depot vans',
  /* the 18 vans; next inspection due. Overdue = due before today. Worked out, never stored. */
  vans: [
    ['NV-01', '2027-01-14'], ['NV-02', '2026-10-01'], ['NV-03', '2026-10-22', '2026-11-07'], ['NV-04', '2027-02-02'],
    ['NV-05', '2026-12-09'], ['NV-06', '2027-03-18'], ['NV-07', '2026-10-08'], ['NV-08', '2027-01-27'],
    ['NV-09', '2026-10-15'], ['NV-10', '2027-02-21'], ['NV-11', '2026-11-05'], ['NV-12', '2026-10-25'],
    ['NV-13', '2027-04-06'], ['NV-14', '2026-09-23'], ['NV-15', '2026-11-05'], ['NV-16', '2026-12-30'],
    ['NV-17', '2026-10-30'], ['NV-18', '2027-03-03']
  ].map(([id, due, inspected]) => ({ id, due, inspected })), /* inspected: the date an inspection will be recorded (used by the week jump) */
  /* month-end counts from the inspection records; Sep lost to the depot log outage */
  series: [ { m: 'Jun', v: 1 }, { m: 'Jul', v: 2 }, { m: 'Aug', v: 2 }, { m: 'Sep', v: null }, { m: 'Oct', v: 5 } ],
  noRecord: { from: '8 Sep', to: '21 Sep', what: 'the depot log', who: 'p3' },
  /* depots for "Where?": one equal tile each, placed roughly where they are */
  depots: [
    { id: 'north', name: 'North', of: 18, mine: true, col: 2, row: 1 },
    { id: 'west',  name: 'Westfield', hidden: true, keeper: 'p6', team: 'west', col: 1, row: 2 },
    { id: 'east',  name: 'East', n: 0, of: 9, col: 3, row: 2 },
    { id: 'south', name: 'South', n: 1, of: 12, col: 2, row: 3 },
    { id: 'harbour', name: 'Harbour store', none: 'keeps no vans', col: 3, row: 3 }
  ],
  /* sources with their Data Atlas grades (NATO letter + digit). derivedFrom = not independent */
  sources: {
    log:      { label: 'Depot inspection log',     grade: 'B2', app: 'Artifacts' },
    insp:     { label: 'inspection records',       grade: 'A2', app: 'Data Atlas', derivedFrom: 'log' },
    report:   { label: 'Kestrel report, October',  grade: 'C3', app: 'Artifacts' },
    contract: { label: 'Kestrel servicing contract', grade: 'B2', app: 'Data Atlas' },
    email:    { label: 'Kestrel email, 30 Oct',    grade: 'F6', app: 'Artifacts' }
  },
  kestrel: { name: 'Kestrel', says: 5, booked: 2 },
  /* judgements: each takes a word worked out from its observations; counts take none */
  claims: {
    cause:    { text: 'Kestrel cancelled its October visit and has not rebooked it', obs: [['contract', 'for'], ['report', 'for']] },
    forecast: { text: 'the vans falling due will be overdue unless a visit is booked', obs: [['insp', 'for'], ['email', 'against']] },
    count:    { text: 'the overdue count', obs: [['log', 'for'], ['insp', 'for'], ['report', 'against']], count: true }
  },
  gap: { what: 'whether Kestrel can come before {dueSoon}', who: 'p4' },
  /* the lead's questions, in order. Each picks its picture by the question; budget in seconds */
  budget: 60,
  /* lines are sentence templates (ink). keep = can never be cut; cut = moves into "if asked" under that question */
  questions: [
    { id: 'what',  q: 'What happened?',  asks: 'how many, out of how many', form: 'count', budget: 9,  never: 'scaled', lines: [
      { tpl: '{overdue} of {fleet} {subject} are overdue for inspection {pic}.' },
      { tpl: '{kestrelName}’s report says {kestrelSays} {dis}: it counts {booked} booked vans as done. {decider} decides.', keep: 'disagree' } ] },
    { id: 'big',   q: 'How big?',        asks: 'which is worst, and by how much', form: 'bars', budget: 6, never: 'cutbars', lines: [
      { tpl: 'The worst, {worstId}, is {worstDays} days late; {fortnightW} are over a fortnight late {pic}.' },
      { tpl: 'The other {restW} are {restMin} to {restMax} days late.', cut: 'And the others?' } ] },
    { id: 'worse', q: 'Getting worse?',  asks: 'a change over time', form: 'line', budget: 9, never: 'dual', lines: [
      { tpl: 'Yes: up from {aug} in August to {overdue} now {pic}.' },
      { tpl: '{nrWhatC} has no record from {nrFrom} to {nrTo} {brk}, so September is missing, not zero.', keep: 'norecord' },
      { tpl: 'It was {jun} in June and {jul} in July: the rise began after August.', cut: 'Since when?' } ] },
    { id: 'where', q: 'Where?',          asks: 'which places', form: 'tiles', budget: 9, never: 'choropleth', lines: [
      { tpl: 'Almost all of it is here {pic}: {southName} has {southN} of {southOf}, {eastName} {eastN} of {eastOf}.' },
      { tpl: '{westName}’s vans are kept by {westTeam}: {westUnseen}.', keep: 'unseen' },
      { tpl: '{harbourName} {harbourNone}.', cut: 'What about {harbourName}?' } ] },
    { id: 'sure',  q: 'How sure?',       asks: 'how good the sources are', form: 'none', budget: 10, never: 'gauge', lines: [
      { tpl: 'The cause below is {w:cause}; the forecast {w:forecast}, so the briefing is no surer than {weakest}.' },
      { tpl: 'Counts take no word: they are recorded, and cover all {fleet} vans except {nrFrom} to {nrTo}.', cut: 'Do the counts cover everything?' },
      { tpl: 'Not known yet {gap}: {gapWhat}. {gapWho} could find out.', keep: 'gap' } ] },
    { id: 'next',  q: 'What next?',      asks: 'what falls due, and when', form: 'records', budget: 9, never: 'pie', lines: [
      { tpl: '{kestrelName} cancelled its October visit and has not rebooked it {w:cause}.' },
      { tpl: '{dueSoonW} more fall due on {dueSoon} {pic}: {forecast} overdue unless a visit is booked {w:forecast}.' } ] }
  ],
  decider: 'p2',
  keepWhy: { disagree: 'a disagreement is never cut', norecord: 'no record is never cut', unseen: 'what readers can’t see is never cut', gap: 'a gap is never cut' },
  bottomBudget: 8,
  /* the six pictures, each answering one plain question, plus no picture and the records */
  forms: {
    count:   { name: 'Count with symbols', plain: 'one van symbol per van, the overdue ones lit; symbols repeat, they never grow', tech: 'isotype unit chart · 1 symbol = 1 Vehicle' },
    bars:    { name: 'Bars, longest first', plain: 'one bar per overdue van, from zero, longest first', tech: 'horizontal bar · sorted desc · x from 0' },
    line:    { name: 'A line over time', plain: 'month-end counts, from zero; a month with no record is a break, not a dip', tech: 'line · y from 0 · null → gap' },
    tiles:   { name: 'One tile per site', plain: 'every depot the same size, placed roughly where it is, so big places don’t win', tech: 'tile grid · equal area · coarse position' },
    small:   { name: 'Small multiples on one scale', plain: 'one small picture per place, all on the same scale', tech: 'facets · shared y' },
    before:  { name: 'Before and after', plain: 'two values either side of a known event; cause stays at “possible”', tech: 'slope · event from Artifacts/Mandate' },
    none:    { name: 'No picture', plain: 'the words are the answer; a picture would add nothing', tech: 'text only' },
    records: { name: 'The records', plain: 'the rows themselves, because the lead will act on them by name', tech: 'table · Vehicle where due ≤ +7d' }
  },
  never: {
    pie:        { name: 'A pie', why: 'nothing here is a part of a whole' },
    '3d':       { name: 'Anything in 3D', why: 'depth bends the sizes you compare' },
    dual:       { name: 'Two scales on one chart', why: 'the crossing point is made by whoever picks the scales' },
    gauge:      { name: 'A gauge or dial', why: 'it pretends to a precision the words don’t have' },
    scaled:     { name: 'A bigger van for a bigger number', why: 'the eye reads area, so 7 looks like 49' },
    cutbars:    { name: 'Bars that don’t start at zero', why: 'a cut axis turns a small difference into a big one' },
    stacked:    { name: 'Stacked areas', why: 'only the bottom layer has a straight floor to read from' },
    choropleth: { name: 'A map shaded by raw counts', why: 'the biggest depot always looks worst' }
  },
  /* the model's draft of the bottom line: pencil. Each phrase points at a part, or at nothing */
  draft: [
    { t: 'Book Kestrel’s missed October visit this week', ref: 'next', line: 0 },
    { t: ', or {forecast} of {fleet} vans will be overdue by {dueSoon}', ref: 'next', line: 1 },
    { t: '; the worst is already {worstDays} days late', ref: 'big', line: 0 },
    { t: ', and Kestrel has never missed a visit before', ref: null },
    { t: '.', ref: 'punct' }
  ],
  templateBottom: '{overdue} of {fleet} {subject} are overdue; {forecast} will be by {dueSoon} unless a visit is booked.',
  /* questions the model suggested a reader may ask: it may suggest, never answer */
  suggested: [ { q: 'Could another firm do the inspections sooner?', answer: 'gap', who: 'p4' } ],
  /* the five-word yardstick (confidence run): worked out by one rule, never typed */
  yardstick: ['Almost certain', 'Very likely', 'Likely', 'Possible', 'Unlikely'],

  /* ---- acting on it (v3) ---- */
  groups: [
    { id: 'vans',   label: 'North depot vans',           icon: 'truck',           kept: { department: 11, team: 7 },  keeper: 'p3' },
    { id: 'insp',   label: 'inspection records',         icon: 'clipboard-check', kept: { department: 16, team: 30 }, keeper: 'p3' },
    { id: 'log',    label: 'Depot inspection log',       icon: 'file-text',       kept: { team: 1 },                  keeper: 'p3' },
    { id: 'report', label: 'Kestrel report, October',    icon: 'file-text',       kept: { department: 1 },            keeper: 'p2' },
    { id: 'con',    label: 'Kestrel servicing contract', icon: 'scroll-text',     kept: { org: 1 },                   keeper: 'p4' },
    { id: 'inc',    label: 'Incident report on NV-14',   icon: 'triangle-alert',  kept: { org: 1 },                   keeper: 'p5', restricted: true }
  ],
  /* which records each part of the briefing rests on */
  basis: { what: ['vans', 'insp', 'log'], big: ['vans', 'insp'], worse: ['insp', 'log'], where: ['vans'], sure: ['report', 'con'], next: ['con', 'report', 'vans'] },
  libraries: [
    { id: 'L1', name: 'North depot notes', floor: 'team' },
    { id: 'L2', name: 'Fleet briefings',   floor: 'department' },
    { id: 'L3', name: 'Board papers',      floor: 'org', approval: 'p2' }
  ],
  intents: [
    { id: 'I1', ref: 'M-42', title: 'Keep every fleet vehicle roadworthy',    owner: 'p2', floor: 'department', followers: 6 },
    { id: 'I2', ref: 'M-17', title: 'Renew the Kestrel servicing contract',   owner: 'p4', floor: 'org', followers: 4 },
    { id: 'I3', ref: 'M-58', title: 'Monthly safety walk-round at each depot', owner: 'p3', floor: 'team', followers: 3 }
  ],
  /* one reader per floor the briefing reaches, for the proofs */
  proofReaders: { team: 'p3', department: 'p6', org: 'p4' },
  watchPresets: [ { id: 'any', plain: 'for any change' }, { id: 'above', plain: 'for more than', n: 8 }, { id: 'zero', plain: 'until it is back to', n: 0 } ],
  /* what would move the watched answer; reason = one of the five */
  triggers: [
    { icon: 'clipboard-check', plain: 'An inspection is recorded', reason: 'happened', has: true, tech: 'atlas.observation.recorded · kind=InspectionEvent' },
    { icon: 'history',         plain: 'A past inspection is entered late', reason: 'past', has: true, tech: 'atlas.observation.recorded · observedAt < now' },
    { icon: 'file-x',          plain: 'A source is withdrawn in Artifacts', reason: 'past', has: true, tech: 'artifacts.document.withdrawn → evidence marked' },
    { icon: 'calendar-clock',  plain: 'A due date passes', reason: null, has: false, needs: 'a clock in the events service: a date passing makes no event today', tech: 'events.schedule · nightly re-run of the recipe' },
    { icon: 'key-round',       plain: 'What you can open changes', reason: 'access', has: false, needs: 're-checking your access on every run', tech: 'identity.membership.changed → re-evaluate' },
    { icon: 'split',           plain: 'Someone settles 7 or 5', reason: 'settled', has: false, needs: 'Data Atlas to announce what Triage settles', tech: 'atlas.triage.resolved · detail=nextInspection' },
    { icon: 'book-a',          plain: 'An admin redefines “overdue”', reason: 'meaning', has: false, needs: 'the studio to announce changes to a definition', tech: 'atlas.ontology.changed · term=nextInspection' }
  ],
  /* the five reasons an answer moves (reference desk run) */
  reasons: {
    happened: 'Something happened',
    past:     'We learned about the past',
    access:   'What you can see changed',
    settled:  'A disagreement was settled',
    meaning:  'A word changed meaning'
  },
  recipe: { plain: 'vans at the North depot whose next inspection is past its date', tech: 'count(Vehicle ∩ basedAt=Site:north-depot ∩ nextInspection < today())' },
  /* who recorded the inspection the week jump finds */
  weekEvent: { van: 'NV-03', by: 'p3', on: '2026-11-07' }
};
