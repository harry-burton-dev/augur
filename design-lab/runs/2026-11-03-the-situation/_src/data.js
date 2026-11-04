/* Sample data. Every name, label, count, floor and date below is deployment data:
   nothing in the markup or the scripts repeats any of it. One object for the whole run. */
const DATA = {
  org: 'Westmere District Services',
  today: '3 Nov 2026',
  /* floors, top first. reach = people who can read something kept on this floor */
  floors: {
    org:        { name: 'Westmere District Services', word: 'Org',        reach: 1240 },
    department: { name: 'Environment and Streets',    word: 'Department', reach: 52 },
    team:       { name: 'Collections North',          word: 'Team',       reach: 11 }
  },
  floorOrder: ['org', 'department', 'team'],
  people: {
    tom:   { name: 'Tom Reyes',    role: 'Contracts officer',                 floor: 'department', moves: { on: '14 Nov', to: 'Housing' } },
    leah:  { name: 'Leah Morgan',  role: 'Contracts officer, from 17 Nov',    floor: 'department' },
    mira:  { name: 'Mira Haddad',  role: 'Team lead, Collections North',      floor: 'team' },
    grace: { name: 'Grace Obi',    role: 'Head of Environment and Streets',   floor: 'department' },
    owen:  { name: 'Owen Pryce',   role: 'Chief operating officer, chairs the Contracts board', floor: 'org' },
    cc:    { name: 'Contact centre', role: 'keeps resident cases',            floor: 'org' },
    kerry: { name: 'Kerry Lund',   role: 'Account manager at Brightwell Waste (the supplier)', floor: null, outside: true }
  },
  /* an agent, an app: it works under a person (the apprentice run) */
  agent: { id: 'cr', name: 'Contract reader', mark: 'CR', supervisor: 'tom', deputy: 'grace',
    errand: 'reads contract documents in Artifacts and proposes, in pencil, the clauses that bear on a decision' },

  /* the task the working set is made for */
  task: {
    id: 'WS-31', title: 'Renew the Brightwell collection contract?',
    question: 'Should we renew the Brightwell Waste collection contract when it ends on 31 Jan 2027, and on what terms?',
    supplier: 'Brightwell Waste', supplierShort: 'Brightwell', ends: '31 Jan 2027', value: '£2.4m over three years',
    intent: 'M-208', decider: 'grace', owner: 'tom', floor: 'department',
    assembled: '3 Nov 2026', assembledAt: '16:40', decideBy: '1 Dec 2026', version: 1
  },
  /* Mandate intents the pieces can serve (one per floor) */
  intents: [
    { id: 'M-114', title: 'Every scheduled bin collected on its day', owner: 'mira',  floor: 'team' },
    { id: 'M-208', title: 'Decide the Brightwell collection contract by 1 Dec', owner: 'grace', floor: 'department' },
    { id: 'M-031', title: 'Value for money across service contracts', owner: 'owen', floor: 'org' }
  ],

  /* the reading at the bottom of the ladder */
  reading: {
    label: 'Missed collections', unit: 'missed collections', place: 'Collections North',
    series: [ { m: 'Apr', v: 12 }, { m: 'May', v: 11 }, { m: 'Jun', v: 14 }, { m: 'Jul', v: 13 }, { m: 'Aug', v: 16 }, { m: 'Sep', v: 21 }, { m: 'Oct', v: 27 } ],
    nov: { soFar: 23, to: '23 Nov', passedOn: '21 Nov' },
    limit: 20, limitWhere: 'clause 7.2', limitRule: 'more than 20 missed in a month, three months running, is a service failure',
    scheduled: 30400,                 /* collections a month */
    supplierCount: 19, supplierRevised: 23, supplierRevisedOn: '20 Nov',
    noAccess: 8, noAccessWithPhotos: 4,
    complaints: { Oct: 41, Jul: 18 },
    rounds: 9, changedRounds: ['N4', 'N7'], changedOn: '2 Sep', revertedN7: '10 Nov',
    byRound: { Jul: { changed: 3, other: 10 }, Oct: { changed: 11, other: 16 }, Nov: { changed: 7, other: 16 } },
    otherContracts: 14
  },

  /* the lifts: what raises a piece one rung. Fixed list, plain word first, the admin word one step down */
  lifts: {
    comparison: { icon: 'git-compare',   word: 'a comparison', tech: 'compare(base)' },
    threshold:  { icon: 'ruler',         word: 'a threshold',  tech: 'threshold(rule)' },
    rate:       { icon: 'divide',        word: 'a rate',       tech: 'ratio(denominator)' },
    definition: { icon: 'book-a',        word: 'a definition', tech: 'reconcile(definitions)' },
    question:   { icon: 'circle-help',   word: 'a question',   tech: 'task.question' },
    intent:     { icon: 'target',        word: 'an intent',    tech: 'mandate.intent' },
    reader:     { icon: 'user-round',    word: 'a reader',     tech: 'reader(floor, role)' },
    situation:  { icon: 'layers',        word: 'what else is going on', tech: 'situation(refs)' },
    projection: { icon: 'telescope',     word: 'what happens next', tech: 'projection(rule)' }
  },

  /* the working set WS-31, as Tom assembled it on 3 Nov.
     rung: data | info | context. from = the pieces it was lifted from. src.kept = the floor it is kept on.
     reason = why it is here, in the words of the person who added it. holds = the condition it holds while. */
  pieces: [
    { id: 'd1', rung: 'data', text: '27 missed collections in October', by: 'tom', at: '3 Nov',
      src: { app: 'Data Atlas', title: 'Missed collection reports', kept: 'team', keeper: 'mira', tech: 'Observation · kind=MissedCollection · Oct · n=27' },
      reason: 'The count the contract measures.', holds: 'no October reports are added or withdrawn' },
    { id: 'd2', rung: 'data', text: '13 missed collections in July', by: 'tom', at: '3 Nov',
      src: { app: 'Data Atlas', title: 'Missed collection reports', kept: 'team', keeper: 'mira', tech: 'Observation · kind=MissedCollection · Jul · n=13' },
      reason: 'The last normal month, before the rounds changed.', holds: 'July is closed' },
    { id: 'd3', rung: 'data', text: 'Brightwell counts 19 for October', by: 'tom', at: '3 Nov',
      src: { app: 'Artifacts', title: 'Brightwell monthly report, October', kept: 'department', keeper: 'tom', tech: 'document · supplier-report-2026-10' },
      reason: 'They will bring this number to the meeting.', holds: 'Brightwell doesn’t revise its report' },
    { id: 'd4', rung: 'data', text: '41 resident complaints about missed bins in October', by: 'tom', at: '3 Nov',
      src: { app: 'Data Atlas', title: 'Resident cases', kept: 'org', keeper: 'cc', tech: 'Observation · kind=Complaint · topic=missed-bin · Oct · n=41' },
      reason: 'Residents noticed: 18 in July.', holds: 'October is closed' },
    { id: 'd5', rung: 'data', text: 'Rounds N4 and N7 changed on 2 Sep', by: 'mira', at: '3 Nov',
      src: { app: 'Artifacts', title: 'Round redesign note, September', kept: 'team', keeper: 'mira', tech: 'document · round-redesign-2026-09' },
      reason: 'Something else changed in September, on our side.', holds: 'N4 and N7 keep their new routes' },

    { id: 'i1', rung: 'info', text: 'Missed collections doubled since July, from 13 to 27', by: 'tom', at: '3 Nov', from: ['d1', 'd2'],
      lift: [{ k: 'comparison', w: 'compared with July' }],
      src: { app: 'Explorer', title: 'Missed collections by month', kept: 'department', keeper: 'tom', tech: 'query · missed-by-month · v3' },
      reason: 'It is getting worse, not one bad month.', holds: 'July and October stay as counted' },
    { id: 'i2', rung: 'info', text: 'Over the contract’s limit of 20 for two months running: 21 in September, 27 in October', by: 'tom', at: '3 Nov', from: ['d1'],
      lift: [{ k: 'threshold', w: 'against clause 7.2' }],
      src: { app: 'Explorer', title: 'Missed collections by month', kept: 'department', keeper: 'tom', tech: 'query · missed-by-month · v3 · limit=20' },
      reason: 'Two months over; the contract counts three.', holds: 'November’s count is not yet in' },
    { id: 'i3', rung: 'info', text: 'The two counts differ by 8: Brightwell leaves out “no access” calls, and we count them', by: 'tom', at: '3 Nov', from: ['d1', 'd3'],
      lift: [{ k: 'definition', w: 'two ways of counting' }],
      src: { app: 'Explorer', title: 'Our count against Brightwell’s', kept: 'department', keeper: 'tom', tech: 'query · reconcile-supplier · Oct' },
      reason: 'So nobody argues about the number instead of the decision.', holds: 'Brightwell keeps its definition', disagree: true },
    { id: 'i4', rung: 'info', text: '11 of the 27 were on N4 and N7, the two rounds changed on 2 Sep (3 in July)', by: 'mira', at: '3 Nov', from: ['d1', 'd5'],
      lift: [{ k: 'rate', w: 'split by round' }],
      src: { app: 'Explorer', title: 'Missed collections by round', kept: 'team', keeper: 'mira', tech: 'query · missed-by-round · Jul,Oct' },
      reason: 'Our route change, not only their crews, is behind part of the rise.', holds: 'N4 and N7 keep their new routes' },
    { id: 'i5', rung: 'info', text: 'Brightwell says it is three drivers short', by: 'tom', at: '3 Nov', said: 'kerry',
      src: { app: 'Artifacts', title: 'Meeting note, 29 Oct', kept: 'department', keeper: 'tom', tech: 'document · note-2026-10-29 · said, not checked' },
      reason: 'Their explanation, in their words. Nobody has checked it.', holds: 'someone can still ask about it' },

    { id: 'c1', rung: 'context', text: 'For the renewal: if November is also over 20, clause 7.2 calls it a service failure, and we can decline to renew without penalty. November decides it.', by: 'tom', at: '3 Nov', from: ['i2'],
      lift: [{ k: 'question', w: 'for the renewal decision' }, { k: 'projection', w: 'if November is over 20' }],
      src: { app: 'Artifacts', title: 'Brightwell collection contract', kept: 'org', keeper: 'owen', tech: 'document · contract-brightwell-2024 · §7.2' },
      reason: 'This is what makes the count matter for the decision.', holds: 'November’s count is not yet in', reader: 'grace' },
    { id: 'c2', rung: 'context', text: 'Brightwell offers to renew for three years at 6% a year more', by: 'tom', at: '3 Nov',
      lift: [{ k: 'situation', w: 'the offer on the table' }],
      src: { app: 'Artifacts', title: 'Renewal offer, 20 Oct', kept: 'department', keeper: 'tom', restricted: 'Commercial in confidence: contracts officers and the Head only', restrictedTo: ['tom', 'leah', 'grace'], tech: 'document · offer-2026-10-20 · restricted' },
      reason: 'What “renew” would actually cost.', holds: 'the offer of 20 Oct stands', reader: 'grace' },
    { id: 'c3', rung: 'context', text: 'Clause 7.4 lets us extend once, by up to 6 months at today’s prices, instead of renewing for three years', by: 'tom', at: '3 Nov', agent: true,
      lift: [{ k: 'question', w: 'a third option for the decision' }],
      src: { app: 'Artifacts', title: 'Brightwell collection contract', kept: 'org', keeper: 'owen', tech: 'document · contract-brightwell-2024 · §7.4' },
      reason: 'Buys time if we don’t want three more years.', holds: 'the contract is in force', reader: 'grace' },
    { id: 'c4', rung: 'context', text: 'A retender takes about 9 months, so it can’t replace the contract by 31 Jan', by: 'tom', at: '3 Nov',
      lift: [{ k: 'projection', w: 'how long the alternative takes' }],
      src: { app: 'Artifacts', title: 'Procurement policy', kept: 'org', keeper: 'owen', tech: 'document · procurement-policy · §4.1' },
      reason: 'Not renewing at all would leave a gap.', holds: 'the policy is unchanged', reader: 'grace' }
  ],
  /* pieces considered and set aside, with why. Kept, never deleted */
  setAside: [
    { id: 'x1', rung: 'info', text: '0.9 missed per 1,000 collections in October', by: 'tom', why: 'True, but the contract counts misses, not a rate.',
      src: { app: 'Explorer', title: 'Missed collections per 1,000', kept: 'department', keeper: 'tom', tech: 'query · missed-rate' } },
    { id: 'x2', rung: 'data', text: 'Collections South missed 9 in October', by: 'tom', why: 'A different contract.',
      src: { app: 'Data Atlas', title: 'Missed collection reports, South', kept: 'department', keeper: 'tom', tech: 'Observation · site=south' } },
    { id: 'x3', rung: 'context', text: 'The 2023 renewal paper', by: 'tom', why: 'Its terms are superseded. History only.',
      src: { app: 'Artifacts', title: 'Renewal paper, 2023', kept: 'department', keeper: 'tom', tech: 'document · renewal-2023 · superseded' } }
  ],

  /* three weeks later: what changed under each piece by 24 Nov. reason = one of the five reasons an answer moves */
  reopen: {
    on: '24 Nov 2026', by: 'leah', weeks: 3,
    changes: {
      i2: { state: 'changed', on: '21 Nov', reason: 'happened', now: 'Over the limit for three months running: 21, 27, and 23 so far in November', why: 'November passed 20 on 21 Nov.' },
      c1: { state: 'changed', on: '21 Nov', reason: 'settled', now: 'Clause 7.2’s service failure has happened: we can decline to renew without penalty.', why: 'What it said would happen next, happened.' },
      d3: { state: 'changed', on: '20 Nov', reason: 'learned', now: 'Brightwell revised its October count to 23', why: 'Brightwell accepted the 4 “no access” calls the crews had photos for.' },
      i3: { state: 'changed', on: '20 Nov', reason: 'learned', now: 'The two counts now differ by 4', why: 'Follows from Brightwell’s revised count.' },
      d5: { state: 'changed', on: '10 Nov', reason: 'happened', now: 'N4 and N7 changed on 2 Sep; N7 went back to its old route on 10 Nov', why: 'Its condition broke for N7 only.' },
      i4: { state: 'changed', on: '10 Nov', reason: 'happened', now: 'N7 went back to its old route on 10 Nov; N4 still runs the new one', why: 'Holds for N4 only.' },
      c2: { state: 'gone', on: '18 Nov', reason: 'happened', now: 'The offer of 20 Oct was withdrawn on 18 Nov. The new offer: two years at 4% a year more.', why: 'Its condition broke: the offer no longer stands.', replace: 'Renewal offer, 18 Nov' },
      i5: { state: 'orphan', on: '14 Nov', reason: 'access', now: 'Only Tom Reyes heard it, and he moved to Housing on 14 Nov. Still not checked.', why: 'Its one source has moved post; ask Kerry Lund to confirm.' }
    },
    /* what happened that no record holds: a gap the next owner can only fill by asking */
    unrecorded: [ { on: '7 Nov', what: 'Tom’s phone call with Kerry Lund about a recovery plan', who: 'tom', ask: 'Tom, now in Housing; reachable' } ],
    added: [
      { id: 'n1', rung: 'data', text: '23 missed collections in November so far, to 23 Nov', by: 'leah', at: '24 Nov',
        src: { app: 'Data Atlas', title: 'Missed collection reports', kept: 'team', keeper: 'mira', tech: 'Observation · kind=MissedCollection · Nov · n=23 · open month' },
        reason: 'The month the contract’s third strike depends on.', holds: 'November is still open' }
    ]
  },

  /* two frames over the same data (Klein's data/frame; Weick) */
  frames: [
    { id: 'A', who: 'tom',  name: 'Brightwell is failing the contract',
      cues: ['i2', 'd4', 'i5'], predicts: 'Misses spread across all nine rounds, and Brightwell’s own count rises too.',
      reading: 'Two months over the limit, complaints more than doubled, and they say they are short of drivers. Don’t renew as is.' },
    { id: 'B', who: 'mira', name: 'Our route change made two rounds unworkable',
      cues: ['i4', 'd5'], predicts: 'Misses gather on N4 and N7; the other seven rounds stay near July.',
      reading: 'Most of the rise is on the two rounds we redesigned. Fix the routes before blaming the crews.' }
  ],
  settle: {
    test: 'Split the rise since July by round: on the two changed rounds, or spread over the other seven?',
    rise: 14, onChanged: 8, onOther: 6,
    withoutChange: 19,
    verdict: 'Both hold in part. 8 of the 14 extra misses are on N4 and N7; 6 are spread over the other seven rounds. Without the route change, October would have been about 19: just under the limit.',
    next: 'November will tell: N7 is back on its old route from 10 Nov.'
  },

  /* three readers of the same information. Each sentence is a template over the pieces; none is written by a model */
  readers: [
    { id: 'mira', asks: 'What can my crews change this week?', intent: 'M-114', horizon: 'this week',
      nut: 'Collections North missed 27 in October, twice July. 11 were on N4 and N7 after the route change on 2 Sep: that part is yours to change. The other seven rounds rose from 10 to 16.',
      does: ['Review N4 and N7 routes', 'Send photos for the 4 “no access” calls without any'], uses: ['d1', 'i1', 'i4', 'd5', 'i3'] },
    { id: 'grace', asks: 'Do we renew, and on what terms?', intent: 'M-208', horizon: '1 Dec',
      nut: 'Over the limit two months running. If November is over 20 too, clause 7.2 calls it a service failure and you can decline to renew without penalty. Brightwell’s own count (19) disagrees.',
      does: ['Decide: renew, extend 6 months, or retender', 'Ask for the November count on 1 Dec'], uses: ['i2', 'c1', 'i3', 'c2', 'c3', 'c4'] },
    { id: 'owen', asks: 'Is any contract putting the service or the budget at risk?', intent: 'M-031', horizon: '15 Jan',
      nut: 'One of 14 service contracts is over its limit. The decision is the Department’s, due 1 Dec. It reaches the board only if it goes to retender: approval by 15 Jan.',
      does: ['Nothing yet', 'Hold 15 Jan on the board agenda'], uses: ['i2', 'c4'] }
  ],

  /* the agent's bundle: what Contract reader was given for WS-31, and what it proposed */
  bundle: {
    given: [
      { ref: 'c3', title: 'Brightwell collection contract', app: 'Artifacts', kept: 'org', direction: 'Find clauses that bear on renewing, extending or ending it.' },
      { ref: 'c2', title: 'Renewal offer, 20 Oct', app: 'Artifacts', kept: 'department', restricted: true, direction: 'Compare its terms with the contract. Granted for WS-31 only, until 1 Dec.' },
      { ref: 'c4', title: 'Procurement policy', app: 'Artifacts', kept: 'org', direction: 'Only for how long the alternatives take.' }
    ],
    notGiven: [
      { title: 'Missed collection reports', why: 'It isn’t asked to judge Brightwell’s performance.' },
      { title: 'Meeting note, 29 Oct', why: 'Said, not checked: a person weighs it.' },
      { title: 'Resident cases', why: 'Personal data; not needed for clauses.' }
    ],
    proposed: [
      { text: 'Clause 7.4 lets us extend once, by up to 6 months at today’s prices.', state: 'accepted', by: 'tom', at: '3 Nov 16:22', piece: 'c3' },
      { text: 'Clause 9.1 lets us end the contract on 3 months’ notice.', state: 'rejected', by: 'tom', at: '3 Nov 16:25', why: '9.1 applies only from year 2 of a renewal. Misread.' }
    ],
    calls: 14, limit: 200
  },

  /* the life of WS-31, for the end-to-end screens */
  timeline: [
    { on: '20 Oct', what: 'Brightwell sends its renewal offer' },
    { on: '29 Oct', what: 'Tom meets Brightwell; notes what they said' },
    { on: '3 Nov',  what: 'Tom assembles WS-31 for the renewal', key: 'assemble' },
    { on: '10 Nov', what: 'N7 goes back to its old route' },
    { on: '14 Nov', what: 'Tom hands WS-31 to Leah and moves to Housing', key: 'handover' },
    { on: '17 Nov', what: 'Leah reads it back and takes it' },
    { on: '18 Nov', what: 'Brightwell withdraws the offer of 20 Oct', key: 'stale' },
    { on: '21 Nov', what: 'November passes 20: three months running' },
    { on: '24 Nov', what: 'Leah reopens WS-31' },
    { on: '1 Dec',  what: 'Grace decides', key: 'decide' }
  ],
  decision: {
    on: '1 Dec 2026', by: 'grace', text: 'Extend for 6 months under clause 7.4, tell Brightwell it is in service failure under clause 7.2, and start a retender.',
    restsOn: 'WS-31 version 4, 28 Nov', board: 'The retender goes to the Contracts board by 15 Jan.'
  }
};
