/* Sample data for one deployment. build.js serialises this into ONE object,
   `const DATA = {...}`, at the top of every page's script. Swap it and every
   name, count, sentence and word on the sheets redraws. The incident records
   are generated from a fixed seed so every count on every sheet is real. */
function rng(seed){ let s = seed >>> 0; return () => { s = (s * 1664525 + 1013904223) >>> 0; return s / 4294967296; }; }
const R = rng(20261103);
const pick = a => a[Math.floor(R() * a.length)];

const weeks = [
  // [iso week, Monday, count of missed collections recorded, share on narrow streets]
  [31, '2026-07-27', 11, .27], [32, '2026-08-03', 12, .33], [33, '2026-08-10', 10, .30],
  [34, '2026-08-17', 13, .31], [35, '2026-08-24', 12, .25], [36, '2026-08-31', 19, .58],
  [37, '2026-09-07', 24, .63], [38, '2026-09-14', 27, .67], [39, '2026-09-21', 31, .68],
  [40, '2026-09-28', 29, .69], [41, '2026-10-05', null, 0], [42, '2026-10-12', 33, .70],
  [43, '2026-10-19', 30, .67], [44, '2026-10-26', 34, .71]
];
const narrow = ['Back Fold', 'Church Wynd', 'Tanner’s Yard', 'Low Gate', 'Quarry Bank'];
const wide = ['Hollins Lane', 'Mill Row', 'Kiln Street', 'Abbey Close', 'Moor View', 'Ferry Road', 'Station Terrace'];
const rounds = ['N1', 'N2', 'N3', 'N4'];
const records = [];
let n = 3101;
for (const [wk, mon, count, share] of weeks) {
  if (count == null) continue;
  const nNarrow = Math.round(count * share);
  const d0 = new Date(mon + 'T00:00:00Z');
  for (let i = 0; i < count; i++) {
    const d = new Date(d0.getTime() + Math.floor(R() * 5) * 86400000);
    const st = i < nNarrow ? pick(narrow) : pick(wide);
    const after = wk >= 36;
    const by = R() < .62 ? 'crew' : 'resident';
    records.push([`MC-${n++}`, d.toISOString().slice(0, 10), wk, st, narrow.includes(st) ? 1 : 0, pick(rounds), after ? pick(['GW-03', 'GW-07', 'GW-09']) : pick(['VX-12', 'VX-17', 'VX-21']), by]);
  }
}
records.sort((a, b) => a[1] < b[1] ? -1 : a[1] > b[1] ? 1 : 0);

module.exports = {
  org: 'Vale Regional Services',
  app: { artifacts: 'Artifacts', mandate: 'Mandate', atlas: 'Data Atlas' },
  today: '3 Nov 2026',
  viewer: { name: 'Sam Okafor', role: 'Operator', floor: 'north' },
  floors: {
    org: { name: 'Vale Regional Services', tier: 'org', word: 'Org floor' },
    waste: { name: 'Waste and streets', tier: 'department', word: 'Department floor', lead: 'Ade Bello, head of Waste and streets' },
    north: { name: 'North depot', tier: 'team', word: 'Team floor', lead: 'Marta Kowal, North depot lead', here: true },
    finance: { name: 'Finance', tier: 'department', word: 'Department floor beside yours', ask: 'Priya Nair, finance lead', locked: true }
  },
  /* The briefing every sheet uses as its specimen. Sentences are templates;
     {slots} are filled from the numbers below, never typed. */
  topic: 'Missed collections, North district',
  area: 'the North',
  span: '27 Jul to 1 Nov',
  log: 'North depot crew logs',
  reader: 'Marta Kowal, North depot lead',
  event: { week: 36, date: '31 Aug', label: 'Greenway Waste took over the North rounds', doc: 'Greenway Waste contract C-114' },
  kind: { one: 'missed collection', many: 'missed collections', icon: 'trash-2', per: 'a week' },
  weeks: weeks.map(([wk, mon, count, share]) => ({ wk, mon, count, share })),
  narrowStreets: narrow,
  recordFields: ['Record', 'Date', 'Week', 'Street', 'Narrow', 'Round', 'Vehicle', 'Reported by'],
  records,
  /* Data Atlas grades, in plain words first, technical one step down (T). */
  grades: {
    A: { plain: 'From the system that keeps it', short: 'kept record', tech: 'grade A · system of record' },
    B: { plain: 'From a named person or document, checked', short: 'checked', tech: 'grade B · attributed, verified' },
    C: { plain: 'Reported, not checked', short: 'reported', tech: 'grade C · attributed, unverified' },
    P: { plain: 'A guess from the assistant: not graded, never counted', short: 'guess', tech: 'model gateway proposal · no grade · excluded from counts' }
  },
  /* How much the evidence weighs, from grades (the IPCC's "evidence" axis). */
  evidence: [
    { id: 'robust', plain: 'Strong', rule: 'two or more sources, one of them a kept record', tech: 'evidence: robust' },
    { id: 'medium', plain: 'Some', rule: 'one kept record, or two checked sources', tech: 'evidence: medium' },
    { id: 'limited', plain: 'Thin', rule: 'one checked source, or only reports', tech: 'evidence: limited' }
  ],
  agreement: [
    { id: 'agree', plain: 'All agree', tech: 'agreement: high' },
    { id: 'one', plain: 'One disagrees', tech: 'agreement: medium' },
    { id: 'split', plain: 'Sources split', tech: 'agreement: low' }
  ],
  /* The fixed yardstick (UK probability yardstick, PHIA 2019). The gaps between
     bands are deliberate: no word claims them. */
  yardstick: [
    { w: 'Remote chance', lo: 0, hi: 5 },
    { w: 'Highly unlikely', lo: 10, hi: 20 },
    { w: 'Unlikely', lo: 25, hi: 35 },
    { w: 'Realistic possibility', lo: 40, hi: 50 },
    { w: 'Likely', lo: 55, hi: 75 },
    { w: 'Highly likely', lo: 80, hi: 90 },
    { w: 'Almost certain', lo: 95, hi: 100 }
  ],
  /* evidence x agreement -> the strongest word allowed. A person may lower it,
     never raise it without adding a source. null = "we can't say yet". */
  grid: {
    robust: { agree: 'Highly likely', one: 'Likely', split: 'Realistic possibility' },
    medium: { agree: 'Likely', one: 'Realistic possibility', split: null },
    limited: { agree: 'Realistic possibility', one: null, split: null }
  },
  cantSay: 'We can’t say yet',
  gridNote: '“Almost certain” needs three kept records that agree. The words below the middle are the same grid read for the opposite claim.',
  /* The claims in the specimen briefing. kind: count (ink, no yardstick word), judgement (a word from the grid). */
  claims: [
    { id: 'rise', kind: 'count', text: 'Missed collections in the North rose from {before} to {after} a week after {eventDate}.',
      sources: [['A', 'Depot crew logs', 'agrees'], ['B', 'Resident calls, contact centre', 'agrees']],
      against: [['C', 'Greenway monthly report, October', 'says 18 a week']] },
    { id: 'cause', kind: 'judgement', text: 'The new rounds skip the narrow streets the old crews walked.',
      sources: [['A', 'Round maps, before and after', 'agrees'], ['B', 'Crew notes, North depot', 'agrees']],
      against: [['C', 'Greenway monthly report, October', 'blames bins put out late']], evidence: 'robust', agreement: 'one' },
    { id: 'target', kind: 'judgement', text: 'Without a change to the rounds, the North will meet the 15-a-week target by 31 Dec.',
      sources: [['C', 'Greenway recovery plan, draft', 'agrees']], against: [['A', 'Depot crew logs, trend since Sep', 'no fall in 8 weeks']], evidence: 'limited', agreement: 'one' }
  ],
  /* the cause claim gathering its sources, for the yardstick moment */
  build: [
    { add: ['A', 'Round maps, before and after', 'agrees'], evidence: 'medium', agreement: 'agree' },
    { add: ['B', 'Crew notes, North depot', 'agrees'], evidence: 'robust', agreement: 'agree' },
    { add: ['C', 'Greenway monthly report, October', 'disagrees'], evidence: 'robust', agreement: 'one' }
  ],
  /* the six ways to be empty, as they turn up in this briefing */
  empties: {
    norecord: { plain: 'No record', line: 'Depot logs were down {gapDates}. That week can’t be counted, and the average leaves it out.', tech: 'declared gap · record.gap event, week 41' },
    stale: { plain: 'Out of date', line: 'The North rounds plan was last checked 14 months ago.', tech: 'fact older than its review age (12 months)' },
    gap: { plain: 'Not known yet', line: 'How many homes each new round covers. Lee Hart, contracts officer, could fill it.', tech: 'expected detail, no fact · sh:minCount 1' },
    hidden: { plain: 'Not yours to see', line: 'Penalties charged to Greenway are kept on the Finance floor. Ask Priya Nair, finance lead.', tech: '403 · kept on finance' },
    none: { plain: 'None', line: 'Complaints raised by councillors: none. Sam Okafor checked on 2 Nov.', tech: 'stated absence' },
    na: { plain: 'Doesn’t apply', line: 'Garden waste rounds: not run in the North in winter.', tech: 'outside the domain this season' }
  },
  gapDates: '5 to 11 Oct',
  /* where a finding can go next: reach is shown first */
  actions: [
    { id: 'brief', icon: 'file-text', verb: 'Brief Marta', app: 'Artifacts', reach: 'North depot floor: 9 people', what: 'A briefing in the North depot library' },
    { id: 'intent', icon: 'target', verb: 'Feed the intent', app: 'Mandate', reach: 'Ade Bello and 3 owners', what: '“Keep missed collections under 15 a week”, due 31 Dec' },
    { id: 'watch', icon: 'eye', verb: 'Watch for change', app: 'Data Atlas', reach: 'only you', what: 'Tell me if the weekly count moves by 5 or more' }
  ],
  /* the reader's minute: reading speed and the time each part may take (a deployment setting) */
  minute: { wpm: 200, pictureSeconds: 6, budget: { bottom: 15, picture: 10, workings: 20, missing: 7, next: 8 } },
  intent: { name: 'Keep missed collections under 15 a week', owner: 'Ade Bello', due: '31 Dec 2026', floor: 'waste', target: 15 },
  /* the five parts of the grammar: drawn as, recipe, never claims */
  parts: [
    { id: 'bottom', name: 'Bottom line', icon: 'align-left',
      drawn: 'Two sentences at most, before anything else. The first says what changed and by how much; the second what it means for the reader.',
      recipe: '--type-heading / --leading-heading, weight 300, --light; max --measure-read; a 2px rule in the colour of the floor it is kept on',
      never: 'A number the records don’t hold, a word stronger than its claim allows, or a sentence with no claim behind it.' },
    { id: 'picture', name: 'Picture', icon: 'chart-column',
      drawn: 'One picture, one claim. Its title is the finding, in words. Counted with repeated symbols or plain bars, from zero.',
      recipe: 'data ink --ink-muted, the finding --light, events a dashed --hairline-strong rule; symbols are Lucide at --space-4, one per N records',
      never: 'A scale that starts above zero, a gap drawn as a dip, a symbol made bigger to mean more, or colour as the only way to tell.' },
    { id: 'workings', name: 'Workings', icon: 'list-ordered',
      drawn: 'Numbered steps in plain words: which records, which filter, what was left out, and how many each step left.',
      recipe: '--font-mono numerals in a --space-5 column, --type-meta text, counts right-aligned; left out in --ink-muted with its empty mark',
      never: 'To be complete beyond its sources, or to hide a step that changed the answer.' },
    { id: 'height', name: 'Height', icon: 'layers',
      drawn: 'The same fact as a headline, a picture or the records. Moving between them keeps the number in place.',
      recipe: 'three rungs in a --measure-rail column; the current rung --light with a --focus-ring edge; others --ink-muted; moves over --motion-slow',
      never: 'Different numbers at different heights. Every headline adds up from its records, to the digit.' },
    { id: 'confidence', name: 'Confidence word', icon: 'gauge',
      drawn: 'One word from a fixed yardstick, chosen by rule from the grades and agreement of the sources. Counts take no word: they are recorded.',
      recipe: 'the word in --ink, then a seven-cell yardstick at --space-1 per cell, filled --ink, empty --hairline-strong; never italic (italic is pencil)',
      never: 'A percentage, a word on a count, a word stronger than its grid cell, or a word a model chose.' }
  ]
};
