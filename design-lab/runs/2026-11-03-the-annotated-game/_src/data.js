/* Sample data. Every name, label, count, date, code and floor below is deployment data:
   nothing in the markup or the scripts repeats any of it. One organisation; the story is
   the minute run's D-118 (a contract decision that went badly), now reviewed as a game:
   replayed move by move on 24 November 2026, its critical moments marked, the review agreed
   on 8 December, filed in the floor's book under a situation code, and met a year later by
   a new colleague who is drafting the same kind of decision. */
const DATA = {
  org: 'Ridgeway Regional Services',
  today: '2026-11-24',
  floors: {
    org:        { name: 'Ridgeway Regional Services', word: 'Org' },
    department: { name: 'Fleet and Facilities',       word: 'Department' },
    team:       { name: 'North depot crew',           word: 'Team' }
  },
  people: {
    p1:  { name: 'Marcus Hale',   role: 'Head of Fleet and Facilities', floor: 'department', initials: 'MH' },
    p2:  { name: 'Priya Nair',    role: 'Fleet lead',                   floor: 'department', initials: 'PN', left: '2027-03-31' },
    p3:  { name: 'Jo Barnes',     role: 'North depot keeper',           floor: 'team',       initials: 'JB' },
    p4:  { name: 'Dana Whitlock', role: 'Contracts manager',            floor: 'org',        initials: 'DW' },
    p5:  { name: 'Ade Bello',     role: 'Finance business partner',     floor: 'org',        initials: 'AB' },
    p8:  { name: 'Sam Okafor',    role: 'Depot coordinator',            floor: 'team',       initials: 'SO' },
    p9:  { name: 'Owen Pryce',    role: 'Improvement lead',             floor: 'org',        initials: 'OP' },
    p10: { name: 'Leah Grant',    role: 'Contracts officer',            floor: 'department', initials: 'LG', joined: '2027-09-06' },
    p11: { name: 'Nadia Kerr',    role: 'Head of Parks and Open Spaces', floor: 'department', initials: 'NK' }
  },
  body: { name: 'Fleet and Facilities leadership meeting', short: 'Leadership meeting', code: 'FFL', chair: 'p1', floor: 'department' },

  /* ---- the notation: a deployment may rename the words, never the marks ---- */
  marks: {
    '!!': { w: 'Won it',      say: 'A move that decided the outcome for the better. Rare.',            tone: 'good' },
    '!':  { w: 'Good move',   say: 'Helped, and is worth repeating.',                                  tone: 'good' },
    '!?': { w: 'Interesting', say: 'A risk taken knowingly. Worth discussing, not a mistake.',          tone: 'info' },
    '?!': { w: 'Dubious',     say: 'A weak step. Not yet a mistake.',                                  tone: 'soft' },
    '?':  { w: 'Mistake',     say: 'Made the outcome worse, and was avoidable with what was known then.', tone: 'bad' },
    '??': { w: 'Lost it',     say: 'Decided the outcome for the worse, with what was known then. Rare.',  tone: 'bad' }
  },
  markOrder: ['!!', '!', '!?', '?!', '?', '??'],
  signs: {
    '□': { w: 'Only move',      say: 'There was no real choice.' },
    '⊕': { w: 'Against a clock', say: 'Decided under a deadline.' },
    'N': { w: 'New to us',      say: 'The first time this body played this.' },
    '∆': { w: 'With the idea',  say: 'The intention behind a move, in a line of commentary.' }
  },
  /* the computed view: a position read from the decision's own lines, as at a date. Never typed */
  positions: [
    { s: '±', w: 'On course',          min: 0.5,  say: 'Every line it set has room.' },
    { s: '⩲', w: 'On course, narrowly', min: 0.2,  say: 'A line is getting close.' },
    { s: '=', w: 'At its lines',       min: -0.2, say: 'A line is reached, or nearly.' },
    { s: '⩱', w: 'Off course',         min: -0.5, say: 'A line is crossed.' },
    { s: '∓', w: 'Well off course',    min: -9,   say: 'Two lines crossed, or one far over.' }
  ],
  unclear: { s: '∞', w: 'The records can’t see this', say: 'A person’s mark on a position: what matters here is not in the records. It can only lower the computed view’s certainty, never raise it.' },

  /* ---- the decision under review ---- */
  decision: {
    id: 'D-118', title: 'Van inspections at the North depot move in-house', kind: 'Change a contract', floor: 'department',
    words: 'That van inspections at the North depot move in-house from 1 July 2026, as a six-month trial, and that Kestrel’s servicing contract is reduced to breakdown cover when it renews on 1 September 2026.',
    made: '2026-05-12', ended: '2026-11-03', result: 'reversed', reversedBy: 'D-131', days: 175,
    intended: 'Our own fitters inspect North depot vans from 1 July at £112 a van, saving about £16,000 a year, with no more vans overdue.',
    happened: 'No fitter until 9 September, and only one. Kestrel went to breakdown cover on 1 September. Overdue vans rose from 2 to 7 of 18 and our cost rose to £148 a van. £3,100 of the saving was counted. Reversed on 3 November by D-131.'
  },
  /* the lines the decision set for itself; the computed view reads only these */
  lines: [
    { id: 'L1', text: 'revisit if more than 4 North depot vans are overdue', series: 'overdue', at: 4, kind: 'max' },
    { id: 'L2', text: 'revisit if fewer than two fitters are in post on 1 August', series: 'fitters', need: 2, from: '2026-05-12', by: '2026-08-01', kind: 'by' },
    { id: 'L3', text: 'the saving: £186 a van down to £112', series: 'cost', was: 186, plan: 112, kind: 'aim' }
  ],
  series: {
    overdue: { label: 'North depot vans overdue', of: 18, pts: [['2026-05-01', 2], ['2026-06-01', 2], ['2026-07-01', 1], ['2026-08-01', 2], ['2026-09-01', 2], ['2026-09-15', 3], ['2026-10-01', 4], ['2026-10-06', 5], ['2026-11-01', 7]] },
    fitters: { label: 'Fitters in post at the North depot', pts: [['2026-05-01', 0], ['2026-09-09', 1]] },
    cost:    { label: 'Our cost per van inspection', unit: '£', pts: [['2026-05-01', 112], ['2026-07-31', 131], ['2026-08-31', 139], ['2026-09-30', 144], ['2026-10-31', 148]] }
  },

  /* ---- the game: every move on the record, ours and the world's ---- */
  moves: [
    { n: 1, on: '2026-05-05', side: 'us', by: 'p2', san: 'Paper: in-house at £112 a van', text: 'Priya circulates the costing: our own fitters at £112 a van against Kestrel’s £186. It has no figure for cover when a fitter is off.', refs: 'In-house inspection costing, v2' },
    { n: 2, on: '2026-05-12', side: 'us', by: 'p5', san: 'Amend: as a six-month trial', text: 'Ade asks for cover costs and proposes the change as a six-month trial. Accepted.' },
    { n: 3, on: '2026-05-12', side: 'us', by: 'p1', san: 'Line: more than 4 overdue', text: 'The chair sets a line at the table: revisit if more than 4 vans are overdue.' },
    { n: 4, on: '2026-05-12', side: 'us', by: 'p3', san: 'Assumed: two fitters by 30 June', text: 'Jo says in passing that two fitters by the end of June “should be fine”. It is recorded as an assumption, and a second line is set on it for 1 August.' },
    { n: 5, on: '2026-05-12', side: 'us', by: 'body', san: 'Decided: D-118, 4 for, 1 abstained', text: 'The meeting resolves D-118. Ade abstains: the costing has no figure for cover.', sign: 'N' },
    { n: 6, on: '2026-05-28', side: 'us', by: 'p4', san: 'Notice: Kestrel to breakdown cover', text: 'Dana gives Kestrel notice: from 1 September the contract covers breakdowns only. No fitter has been hired yet.', door: true, sign: '⊕', clock: 'Kestrel needs three months’ notice to change scope, so notice for 1 September had to go by 1 June.',
      opts: [
        { san: 'Give notice now for 1 September', played: true },
        { san: 'Renew for a year with the six-month break', text: 'Contract C-0412, clause 9, allowed a break at six months on three months’ notice. Notice could wait until both fitters were in post.', from: 'Contract C-0412' },
        { san: 'Ask the meeting to move the start', text: 'Put the start back to 1 December and give notice in August.', from: 'not on the record: proposed at review' }
      ] },
    { n: 7, on: '2026-06-23', side: 'world', san: 'No qualified applicants', text: 'The first hiring round closes with no qualified applicants.' },
    { n: 8, on: '2026-06-23', side: 'us', by: 'p1', san: 'Date moved: fitters by 31 August', text: 'The chair agrees to move the hiring action to 31 August. The line on 1 August is not moved.' },
    { n: 9, on: '2026-07-22', side: 'us', by: 'p8', san: 'Bay fitted out', text: 'Sam’s inspection bay is fitted out and signed off.' },
    { n: 10, on: '2026-08-01', side: 'world', san: 'Line crossed: no fitter on 1 August', text: 'The second line is crossed: no fitter is in post. The decision is marked worth revisiting and the chair is asked once.' },
    { n: 11, on: '2026-08-01', side: 'us', by: 'p1', san: 'Noted and kept, no reason', text: 'The chair notes the line and keeps the decision. No reason is recorded. The next meeting is on 8 September.',
      opts: [
        { san: 'Note it and keep it', played: true },
        { san: 'Bring the review forward', text: 'Call the meeting early, as was done in October.', from: 'the revisit item’s three choices' },
        { san: 'Put it on the next agenda with a reason', text: 'Keep it, and write down why.', from: 'the revisit item’s three choices' }
      ] },
    { n: 12, on: '2026-09-01', side: 'world', san: 'Kestrel to breakdown cover', text: 'Kestrel stops inspecting. Our own inspections start with no fitter in post.', door: true },
    { n: 13, on: '2026-09-08', side: 'us', by: 'body', san: 'D-128: keep the trial with one fitter', text: 'The meeting keeps the trial going with one fitter, who starts the next day, until the November review.',
      opts: [
        { san: 'Keep the trial with one fitter', played: true },
        { san: 'Buy Kestrel visits for the overdue vans', text: 'Dana’s note in the pack: Kestrel would inspect ad hoc at £210 a van.', from: 'D-128 pack' },
        { san: 'Reverse now', text: 'Go back to a contractor from 1 December.', from: 'raised by Ade at the meeting' }
      ] },
    { n: 14, on: '2026-09-09', side: 'world', san: 'One fitter starts', text: 'The first fitter starts. The second post is re-advertised at a higher grade.' },
    { n: 15, on: '2026-10-06', side: 'world', san: 'Line crossed: 5 vans overdue', text: 'October’s count is 5 of 18, over the line of 4. The decision is marked worth revisiting again.' },
    { n: 16, on: '2026-10-13', side: 'us', by: 'body', san: 'D-130: review brought forward', text: 'The meeting brings its November review forward to 3 November.' },
    { n: 17, on: '2026-11-03', side: 'us', by: 'body', san: 'D-131: reversed, bay and fitter kept', text: 'Before the vote the meeting sees everything that rests on D-118. It reverses it: a contractor inspects again from 1 December; the bay and the fitter stay, for repairs.' }
  ],

  /* the decision's actions, with every change dated (the minute run's A-301 to A-303) */
  actions: [
    { id: 'A-301', text: 'Give Kestrel notice of breakdown cover only', owner: 'p4', set: '2026-05-12', due: [['2026-05-12', '2026-05-31']], done: '2026-05-28' },
    { id: 'A-302', text: 'Hire two fitters for the North depot', owner: 'p3', set: '2026-05-12', due: [['2026-05-12', '2026-06-30'], ['2026-06-23', '2026-08-31'], ['2026-08-28', '2026-10-31']], part: ['2026-09-09', '1 of 2 in post'], overtaken: '2026-11-03' },
    { id: 'A-303', text: 'Fit out the inspection bay', owner: 'p8', set: '2026-05-12', due: [['2026-05-12', '2026-07-15']], done: '2026-07-22' }
  ],
  /* what had been circulated or recorded by each date: the board a reviewer replays on */
  record: [
    { on: '2026-02-02', w: 'Kestrel annual report 2025: 3 of 12 visits missed' },
    { on: '2026-05-05', w: 'In-house inspection costing, v2 (no figure for cover)' },
    { on: '2026-05-12', w: 'D-118 and its three actions; two revisit lines' },
    { on: '2026-05-28', w: 'Notice letter to Kestrel, acknowledged' },
    { on: '2026-06-23', w: 'Hiring round 1 closed: no qualified applicants' },
    { on: '2026-07-22', w: 'Bay sign-off by the health and safety adviser' },
    { on: '2026-08-01', w: 'Revisit item to the chair: line L2 crossed' },
    { on: '2026-09-08', w: 'D-128 pack, with Kestrel’s ad hoc price of £210 a van' },
    { on: '2026-10-06', w: 'Revisit item to the chair: line L1 crossed' },
    { on: '2026-10-28', w: 'Briefing: North depot vans overdue' },
    { on: '2026-11-03', w: 'D-131 and the wake of D-118' }
  ],
  /* the marks, by move. self: the person who made the move marks it first. Lines are one sentence */
  annotations: {
    1:  [ { g: '?!', by: 'p2', self: true, line: 'I had no figure for cover, so I left it out. The first page should have said so.' },
          { g: '?!', by: 'p9', line: 'A costing with no cover for sickness or leave. Ade asked for it at the table.' } ],
    2:  [ { g: '!',  by: 'p9', line: 'Turned a bet into a trial with an end date. It is why reversing cost so little.' } ],
    3:  [ { g: '!',  by: 'p9', line: 'A line anyone could read. It fired on time.' } ],
    4:  [ { g: '?!', by: 'p3', self: true, line: 'I said it to keep the meeting moving. I hadn’t checked the market.' },
          { g: '?',  by: 'p9', line: 'Everything rested on this, and nobody tested it before the one step that couldn’t be undone.', crit: true } ],
    6:  [ { g: '□',  by: 'p4', self: true, line: 'The decision said 1 September and the notice period set the date. I did what it asked.' },
          { g: '?',  by: 'p9', line: 'The one step that couldn’t be undone was taken before what it depended on. Clause 9 allowed a break instead.', crit: true },
          { g: '∞',  by: 'p9', pos: true, line: 'The records saw no change here. The options closed.' } ],
    8:  [ { g: '?!', by: 'p9', line: 'The action’s date moved; the line it depended on did not.' } ],
    9:  [ { g: '!',  by: 'p9' } ],
    11: [ { g: '?!', by: 'p1', self: true, line: 'I expected a fitter within weeks. I should have written that down.' },
          { g: '?',  by: 'p9', line: 'The line did its job. Noting it without a reason let 38 days pass.', crit: true } ],
    13: [ { g: '!?', by: 'p9', line: 'A risk taken knowingly: a fitter started the next day.', crit: true },
          { g: '?',  by: 'p5', line: 'One fitter can’t inspect 18 vans a month. We had the numbers.' } ],
    16: [ { g: '!',  by: 'p9', line: 'Acted within a week of the line.' } ],
    17: [ { g: '!',  by: 'p9', line: 'Saw the wake first, and kept what was worth keeping.' } ]
  },
  /* what the records now say about a move, with hindsight (shown only when asked) */
  hindsight: {
    4:  'Hiring took 120 days for one fitter; the second post is still open.',
    6:  'Undoing the notice cost a quick tender, and ad hoc visits at £210 a van meanwhile.',
    11: 'Overdue vans stayed at 2 until September, then rose every month.',
    13: 'Overdue rose from 2 to 7 in the eight weeks after.'
  },
  /* the review, as an after-action review (what was meant, what happened, why, what to keep) */
  review: {
    id: 'R-07', held: '2026-11-24', agreed: '2026-12-08', facilitator: 'p9', with: ['p1', 'p2', 'p3', 'p4', 'p5', 'p8'],
    why: [
      { text: 'The hiring assumption was said, not tested.', move: 4 },
      { text: 'The one step that couldn’t be undone was taken first, against a notice clock.', move: 6 },
      { text: 'A crossed line was noted without a reason; the meeting saw it 38 days later.', move: 11 }
    ],
    keep: [
      { text: 'Make a change a trial with an end date.', move: 2 },
      { text: 'Set lines anyone can read.', move: 3 },
      { text: 'Look at the wake before reversing.', move: 17 }
    ],
    change: [
      { text: 'Test what a decision assumes before its one-way step.', move: 6 },
      { text: 'Give a reason when a crossed line is noted and kept.', move: 11 },
      { text: 'Count cover for sickness and leave in any in-house costing.', move: 1 }
    ]
  },

  /* ---- the book: reviewed decisions filed by situation. Codes and words are this deployment's ---- */
  book: {
    families: { C: 'Contracts', S: 'Spending and pilots', P: 'People and posts' },
    codes: {
      C1: 'Renew a contract as it is', C2: 'Re-tender a contract', C3: 'Bring work in-house',
      'C3.1': 'Bring work in-house, staff already in post', 'C3.2': 'Bring work in-house, depending on hiring', 'C3.3': 'Bring work in-house, depending on equipment',
      C4: 'Cut a contract’s scope', C5: 'Move work out to a contractor',
      S1: 'Pilot before buying', S2: 'Spend to save', P1: 'Merge or restructure a team'
    },
    /* what makes two situations the same position, whatever their first moves */
    facets: [
      { k: 'kind',    w: 'What it changes', vals: { contract: 'a contract', spend: 'a budget', people: 'a team' } },
      { k: 'depends', w: 'Depends on',      vals: { hiring: 'hiring', equipment: 'equipment', none: 'nothing new' } },
      { k: 'door',    w: 'One-way step',    vals: { notice: 'a notice period', sale: 'a sale', none: 'none' } },
      { k: 'trial',   w: 'Trial',           vals: { yes: 'a trial with an end date', no: 'for good' } }
    ],
    motifs: {
      first:   { name: 'One-way step first', say: 'A step that can’t be undone is taken before what it depends on is in hand.', tone: 'bad' },
      depfirst:{ name: 'What it depends on, first', say: 'The dependency is secured, then the one-way step.', tone: 'good' },
      noted:   { name: 'Noted, no reason', say: 'A crossed line is noted and the decision kept, with no reason written.', tone: 'bad' },
      trial:   { name: 'A trial, not a bet', say: 'The change has an end date and a review, so undoing it is cheap.', tone: 'good' },
      cover:   { name: 'No cover in the costing', say: 'An in-house costing leaves out sickness, leave and vacancies.', tone: 'bad' },
      wake:    { name: 'The wake, before reversing', say: 'Everything that rests on it is seen before the vote.', tone: 'good' }
    },
    games: [
      { id: 'R-07', ref: 'D-118', code: 'C3.2', year: 2026, unit: 'Fleet and Facilities', floor: 'department', title: 'North depot van inspections move in-house', result: 'reversed', days: 175, facets: { kind: 'contract', depends: 'hiring', door: 'notice', trial: 'yes' }, motifs: ['first', 'noted', 'trial', 'cover', 'wake'], crit: 4, by: 'p9', key: 6 },
      { id: 'R-03', ref: 'PO-41', code: 'C3.2', year: 2025, unit: 'Parks and Open Spaces', floor: 'department', title: 'Grounds maintenance moves in-house', result: 'kept', days: 410, facets: { kind: 'contract', depends: 'hiring', door: 'notice', trial: 'no' }, motifs: ['depfirst', 'cover'], crit: 2, by: 'p11', key: 3, note: 'Waited until four gardeners were in post, then gave the contractor notice.' },
      { id: 'R-11', ref: 'LC-19', code: 'C3.2', year: 2027, unit: 'Libraries and Culture', floor: 'department', title: 'Mobile library drivers move in-house', result: 'amended', days: 140, facets: { kind: 'contract', depends: 'hiring', door: 'notice', trial: 'yes' }, motifs: ['depfirst', 'trial'], crit: 2, by: 'p9', key: 2, note: 'Counted cover from the start; amended to keep one agency driver.' },
      { id: 'R-01', ref: 'F-208', code: 'C3.1', year: 2024, unit: 'Finance', floor: 'org', title: 'Payroll moves in-house', result: 'kept', days: 690, facets: { kind: 'contract', depends: 'none', door: 'notice', trial: 'no' }, motifs: ['depfirst'], crit: 1, by: 'p5', key: 1 },
      { id: 'R-08', ref: 'PO-57', code: 'C3.3', year: 2026, unit: 'Parks and Open Spaces', floor: 'department', title: 'Tree surgery in-house with a new chipper', result: 'amended', days: 220, facets: { kind: 'contract', depends: 'equipment', door: 'notice', trial: 'no' }, motifs: ['first'], crit: 3, by: 'p11', key: 2 },
      { id: 'R-04', ref: 'CS-33', code: 'C5', year: 2025, unit: 'Customer Services', floor: 'org', title: 'Out-of-hours phone line moves to a contractor', result: 'reversed', days: 260, facets: { kind: 'contract', depends: 'hiring', door: 'notice', trial: 'yes' }, motifs: ['first', 'noted'], crit: 3, by: 'p9', key: 4, note: 'Our own night staff were given notice before the contractor had hired its night team.' },
      { id: 'R-02', ref: 'D-071', code: 'C2', year: 2024, unit: 'Fleet and Facilities', floor: 'department', title: 'Depot cleaning re-tendered', result: 'amended', days: 365, facets: { kind: 'contract', depends: 'none', door: 'notice', trial: 'no' }, motifs: ['cover'], crit: 2, by: 'p4', key: 2 },
      { id: 'R-06', ref: 'D-110', code: 'C1', year: 2026, unit: 'Fleet and Facilities', floor: 'department', title: 'Tyre supply renewed for two years', result: 'kept', days: 210, facets: { kind: 'contract', depends: 'none', door: 'none', trial: 'no' }, motifs: [], crit: 0, by: 'p4', key: 0 },
      { id: 'R-05', ref: 'D-104', code: 'S1', year: 2026, unit: 'Fleet and Facilities', floor: 'department', title: 'Telematics pilot on 12 vans', result: 'kept', days: 300, facets: { kind: 'spend', depends: 'equipment', door: 'none', trial: 'yes' }, motifs: ['trial', 'noted'], crit: 2, by: 'p9', key: 1 },
      { id: 'R-09', ref: 'D-149', code: 'C4', year: 2027, unit: 'Fleet and Facilities', floor: 'department', title: 'Depot security cut to nights only', result: 'kept', days: 120, facets: { kind: 'contract', depends: 'none', door: 'notice', trial: 'yes' }, motifs: ['trial'], crit: 1, by: 'p4', key: 1 },
      { id: 'R-10', ref: 'HR-12', code: 'P1', year: 2027, unit: 'People Services', floor: 'org', title: 'Two business support teams merge', result: 'amended', restricted: { who: 'p9', why: 'It names people whose posts changed. Its body keeps it to those who took part.' } },
      { id: 'R-12', ref: 'HR-15', code: 'C3.2', year: 2027, unit: 'People Services', floor: 'org', title: 'Occupational health moves in-house', result: 'kept', restricted: { who: 'p9', why: 'Its body has not agreed the review yet. Drafts stay with those who took part.' } }
    ]
  },
  results: { kept: 'Kept', amended: 'Amended', reversed: 'Reversed' },

  /* ---- a year later: a new colleague drafts the same kind of decision ---- */
  later: {
    today: '2027-11-09', who: 'p10', manager: 'p4',
    draft: {
      id: 'D-163', title: 'South depot van inspections move to the North bay', code: 'C3.2', meeting: 'FFL 27/12', meets: '2027-12-14',
      contractor: 'Brackley Fleet Services', vans: 14, price: 192, ours: 118, noticeBy: '2027-12-31', ends: '2028-03-31',
      facets: { kind: 'contract', depends: 'hiring', door: 'notice', trial: 'no' },
      moves: [
        { n: 1, san: 'Paper: the North bay at £118 a van', text: 'The North bay inspects the south depot’s 14 vans at £118 a van; Brackley charges £192.', like: 1 },
        { n: 2, san: 'Depends on: two more fitters by 1 March', text: 'The bay needs two more fitters before it can take 14 more vans.', like: 4 },
        { n: 3, san: 'Plan: notice to Brackley by 31 December', text: 'Brackley needs three months’ notice, so the contract ends on 31 March.', like: 6, door: true }
      ]
    },
    /* the precedent's critical moment, put as a question */
    puzzle: {
      move: 6, asAt: '2026-05-28',
      known: ['D-118 says inspections move in-house; Kestrel drops to breakdown cover on 1 September.', 'No fitter has been hired yet. Jo expects two by 30 June.', 'Kestrel needs three months’ notice to change scope.', 'Contract C-0412, clause 9: a renewal may include a break at six months.'],
      choices: [
        { k: 'a', san: 'Give notice now for 1 September', played: true },
        { k: 'b', san: 'Renew with the six-month break; give notice when both fitters are in post', best: true },
        { k: 'c', san: 'Ask the meeting to move the start to December' }
      ]
    },
    /* what she can ask, and of whom */
    people: [
      { id: 'p4', about: [6], here: true },
      { id: 'p3', about: [4], here: true },
      { id: 'p5', about: [2, 13], here: true },
      { id: 'p2', about: [1], here: false },
      { id: 'p11', about: ['R-03'], here: true }
    ]
  }
};
