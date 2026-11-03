/* Sample data. Every name, label, count and floor below is deployment data:
   nothing in the markup or the scripts repeats any of it. */
const DATA = {
  org: 'Ridgeway Regional Services',
  me: 'p1',
  myFloor: 'team',
  today: '3 Nov 2026',
  /* floors, top first. reach = people who can read something kept on this floor
     (everyone on it and on the floors under it). */
  floors: {
    org:        { name: 'Ridgeway Regional Services', word: 'Org',        reach: 1180, under: '6 departments' },
    department: { name: 'Fleet and Facilities',       word: 'Department', reach: 34,   under: '3 teams' },
    team:       { name: 'North depot crew',           word: 'Team',       reach: 9,    under: '' }
  },
  floorOrder: ['org', 'department', 'team'],
  people: {
    p1: { name: 'Sam Okafor',    role: 'Depot coordinator',   floor: 'team' },
    p2: { name: 'Priya Nair',    role: 'Fleet lead',          floor: 'department' },
    p3: { name: 'Jo Barnes',     role: 'North depot keeper',  floor: 'team' },
    p4: { name: 'Dana Whitlock', role: 'Contracts manager',   floor: 'org' },
    p5: { name: 'Health and safety desk', role: 'Keeps incident reports', floor: 'org' }
  },
  /* the finding, as Data Atlas and the briefing builder hold it */
  finding: {
    id: 'F-0412',
    subject: 'North depot vans',
    /* the headline is built from a template and the counts: ink */
    headline: { tpl: '{n} of {of} {subject} are overdue for inspection, up from {was} in {wasWhen}.', n: 7, of: 18, was: 2, wasWhen: 'August' },
    /* the bottom line may be drafted by the model: pencil until a person accepts it */
    bottomLine: {
      model: 'Book Kestrel’s missed October visit this month, or about 9 vans may be off the road by December.',
      template: '{n} of {of} {subject} are overdue for inspection. Kestrel’s October visit has not been rebooked.'
    },
    series: [ { m: 'Jun', v: 1 }, { m: 'Jul', v: 2 }, { m: 'Aug', v: 2 }, { m: 'Sep', v: 4 }, { m: 'Oct', v: 5 }, { m: 'Nov', v: 7 } ],
    forecast: { m: 'Dec', v: 9 },
    checked: 'today 09:12',
    recipe: {
      plain: 'vans at the North depot whose next inspection is past its date',
      tech: 'count(Vehicle ∩ basedAt=Site:north-depot ∩ nextInspection < today())'
    }
  },
  /* records behind the finding, grouped. kept = how many are kept on each floor */
  groups: [
    { id: 'vans',   label: 'North depot vans',            icon: 'truck',           app: 'Data Atlas', kept: { department: 11, team: 7 },  keeper: 'p3', tech: 'Vehicle' },
    { id: 'insp',   label: 'inspection records',          icon: 'clipboard-check', app: 'Data Atlas', kept: { department: 16, team: 30 }, keeper: 'p3', tech: 'InspectionEvent' },
    { id: 'log',    label: 'Depot inspection log',        icon: 'file-text',       app: 'Artifacts',  kept: { team: 1 },                  keeper: 'p3', tech: 'document' },
    { id: 'report', label: 'Kestrel report, October',     icon: 'file-text',       app: 'Artifacts',  kept: { department: 1 },            keeper: 'p2', tech: 'document' },
    { id: 'con',    label: 'Kestrel servicing contract',  icon: 'scroll-text',     app: 'Data Atlas', kept: { org: 1 },                   keeper: 'p4', tech: 'Contract' },
    { id: 'inc',    label: 'Incident report on NV-14',    icon: 'triangle-alert',  app: 'Data Atlas', kept: { org: 1 },                   keeper: 'p5', restricted: true, tech: 'Incident (restricted)' }
  ],
  /* the claims of the briefing. kind count = ink fact; judge = a judgement with a yardstick word */
  claims: [
    { id: 'c1', kind: 'count', text: '7 of 18 North depot vans are overdue for inspection.', basis: ['vans', 'insp', 'log'],
      sources: 'Two sources agree on 7; Kestrel’s report says 5 (it counts two booked vans as done).', disagree: true },
    { id: 'c2', kind: 'count', text: 'That is up from 2 in August.', basis: ['insp'], sources: 'From 46 inspection records.' },
    { id: 'c3', kind: 'count', text: 'Kestrel’s October visit was cancelled and has not been rebooked.', basis: ['con', 'report'], sources: 'The contract and Kestrel’s own report agree.' },
    { id: 'c4', kind: 'judge', text: 'If no visit is booked, 9 vans will be overdue by December.', basis: ['vans'], word: 4,
      sources: 'From the due dates of 18 vans. Two more fall due on 21 Nov.' },
    { id: 'c5', kind: 'count', text: 'One of the overdue vans also has an open incident report.', basis: ['inc'], sources: 'Kept by the Health and safety desk.' }
  ],
  /* the probability yardstick (UK PHIA), plain word first */
  yardstick: [
    { w: 'Remote chance', r: '≤5%' }, { w: 'Highly unlikely', r: '10–20%' }, { w: 'Unlikely', r: '25–35%' },
    { w: 'Realistic possibility', r: '40–50%' }, { w: 'Likely', r: '55–75%' }, { w: 'Highly likely', r: '80–90%' }, { w: 'Almost certain', r: '≥95%' }
  ],
  /* where a briefing can go (Artifacts libraries) */
  libraries: [
    { id: 'L1', name: 'North depot notes',       floor: 'team' },
    { id: 'L2', name: 'Fleet briefings',         floor: 'department' },
    { id: 'L3', name: 'Board papers',            floor: 'org', approval: 'p2', approvalWhy: 'Board papers need the Department lead’s approval (set by your admin).' }
  ],
  /* what a finding can feed (Mandate intents) */
  intents: [
    { id: 'I1', title: 'Keep every fleet vehicle roadworthy', owner: 'p2', floor: 'department', due: '31 Mar 2027', followers: 6, bound: 'vans', state: 'On track' },
    { id: 'I2', title: 'Renew the Kestrel servicing contract', owner: 'p4', floor: 'org', due: '15 Jan 2027', followers: 4, bound: 'con', state: 'On track' },
    { id: 'I3', title: 'Monthly safety walk-round at each depot', owner: 'p3', floor: 'team', due: '30 Nov 2026', followers: 3, bound: 'vans', state: 'Due soon' }
  ],
  /* watching: what makes the count move, and how Data Atlas and the events service see it */
  watch: {
    now: 7, max: 18,
    presets: [ { id: 'any', plain: 'whenever the count changes' }, { id: 'above', plain: 'when it goes above', n: 8 }, { id: 'zero', plain: 'when it is back to', n: 0 } ],
    triggers: [
      { icon: 'clipboard-check', plain: 'A new inspection is recorded', who: 'Data Atlas', tech: 'atlas.observation.recorded · kind=InspectionEvent', has: true },
      { icon: 'clock',           plain: 'A due date passes overnight', who: 'events service clock', needs: 'a clock in the events service', tech: 'events.schedule · daily 00:05 · re-run recipe', has: false },
      { icon: 'file-text',       plain: 'A source is withdrawn in Artifacts', who: 'Artifacts', tech: 'document.withdrawn → evidence marked', has: true },
      { icon: 'split',           plain: 'The disagreement is settled in Triage', who: 'Data Atlas Triage', needs: 'Data Atlas to announce when Triage settles a disagreement', tech: 'atlas.triage.resolved · detail=nextInspection', has: false },
      { icon: 'history',         plain: 'Nothing new arrives for 21 days', who: 'events service clock', needs: 'the events service to notice when nothing arrives', tech: 'events.silence · window=21d', has: false }
    ]
  }
};
