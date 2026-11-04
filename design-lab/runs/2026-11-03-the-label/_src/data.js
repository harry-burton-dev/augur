/* Sample data. Every name, label word, count, rule and floor below is deployment data:
   the marking scheme, uses and keep rules come from the deployment's own policy object,
   and nothing in the markup or scripts repeats any of it. S swaps in a second deployment's policy. */
const DATA = {
  org: 'Halden Estuary Ports',
  today: '3 Nov 2026',
  me: 'p1',
  /* floors: kept-on ids. A reader opens what is kept on their own floor and on the floors above it. */
  floors: {
    org:  { name: 'Halden Estuary Ports', word: 'Org',        tier: 'org',        parent: null,  people: 640 },
    mops: { name: 'Marine Operations',    word: 'Department', tier: 'department', parent: 'org', people: 86 },
    com:  { name: 'Commercial',           word: 'Department', tier: 'department', parent: 'org', people: 31 },
    pil:  { name: 'Pilotage',             word: 'Team',       tier: 'team',       parent: 'mops', people: 14 },
    vts:  { name: 'Vessel traffic services', word: 'Team',    tier: 'team',       parent: 'mops', people: 22 }
  },
  /* groups inside a floor, for need-to-know sharing */
  groups: {
    sc:  { name: 'Safety committee', floor: 'org', people: 9, chair: 'p6' },
    all: { name: 'All-staff news', floor: 'org', people: 640, chair: 'p8' },
    mca: { name: 'Maritime and Coastguard Agency', floor: null, outside: true, people: null, chair: null }
  },
  people: {
    p1: { name: 'Leah Morgan',    role: 'Marine safety officer',   floor: 'mops' },
    p2: { name: 'Kofi Mensah',    role: 'Pilotage manager',        floor: 'pil' },
    p3: { name: 'Dafydd Rees',    role: 'Harbour pilot',           floor: 'pil' },
    p4: { name: 'Anita Shah',     role: 'Data protection officer', floor: 'org' },
    p5: { name: 'Marcus Bell',    role: 'Commercial manager',      floor: 'com' },
    p6: { name: 'Ruth Okoye',     role: 'Harbour master',          floor: 'mops' },
    p7: { name: 'Sam Ito',        role: 'VTS officer',             floor: 'vts' },
    p8: { name: 'Nia Hughes',     role: 'Internal communications', floor: 'org' },
    p9: { name: 'Owen Clarke',    role: 'Commercial analyst',      floor: 'com' }
  },

  /* ---- the deployment's handling policy: the only place marking words live ---- */
  policies: [
    {
      id: 'gsc', name: 'Information handling policy', version: 'v3 · April 2026', owner: 'p4', basis: 'UK Government Security Classifications',
      markings: {
        off: { word: 'OFFICIAL',           short: 'OFF', rank: 0, plain: 'Everyday work. Anyone whose floor reaches it may see it.', handle: 'No special handling.' },
        os:  { word: 'OFFICIAL-SENSITIVE', short: 'O-S', rank: 1, plain: 'Would cause harm if it got out. Only the people who need it.', handle: 'Goes to named people or groups, never a whole floor. Not outside without approval.' },
        sec: { word: 'SECRET',             short: 'SEC', rank: 2, notHere: true, plain: 'Serious harm if it got out. Not kept in AUGUR: held in the port’s secure system.', handle: 'Ask the security officer.' }
      },
      descriptors: {
        personal:   { word: 'PERSONAL',      short: 'P', plain: 'About a named person.', owner: 'p4', icon: 'user-round' },
        commercial: { word: 'COMMERCIAL',    short: 'C', plain: 'Prices, contracts or bids.', owner: 'p5', icon: 'coins' },
        security:   { word: 'PORT SECURITY', short: 'PS', plain: 'Could help someone harm the port.', owner: 'p6', icon: 'shield', hideExistence: true }
      },
      uses: {
        ops:       { word: 'Operations',       long: 'Day-to-day operations',          icon: 'anchor' },
        safety:    { word: 'Safety review',    long: 'A safety investigation or review', icon: 'life-buoy' },
        report:    { word: 'Reporting',        long: 'Reports and papers',             icon: 'file-chart-column' },
        appraisal: { word: 'Appraisal',        long: 'Staff appraisal or discipline',  icon: 'user-check' },
        model:     { word: 'Model use',        long: 'Model gateway use (drafting, summaries, training)', icon: 'bot' },
        outside:   { word: 'Outside use',      long: 'Sharing outside the organisation',  icon: 'globe' }
      },
      useWords: { yes: 'may', no: 'may not', ask: 'ask first', count: 'as a count only' },
      keepRules: {
        'R-INC-10': '10 years after the incident',
        'R-SAF-6':  '6 years after the investigation closes',
        'R-CNS':    'until the investigation closes, or sooner if withdrawn',
        'R-CON-7':  '7 years after the contract ends',
        'R-SEC-1':  'reviewed every year',
        'R-PAP-25': '25 years, then the archive'
      },
      minGroup: 3,
      defaultMarking: 'os',
      clauses: {
        marking: '§2 Markings. OFFICIAL-SENSITIVE goes to named people or groups with a need to know, never to a whole floor.',
        personal: '§4.2 Personal data. A value that names or points at one person is PERSONAL; its owner is the data protection officer.',
        appraisal: '§6 Just culture. Safety reports, and anything drawn from them, are never used for appraisal or discipline.',
        model: '§8 Model gateway. PERSONAL and COMMERCIAL values are never sent to the model gateway.',
        outside: '§5 Outside. OFFICIAL-SENSITIVE leaves only with the descriptor owner’s approval and a recorded lawful basis.',
        count: '§4.4 Counts. A PERSONAL value said as a count over {minGroup} or more people, none picked out, is no longer PERSONAL.',
        keep: '§9 Keeping. Each value is kept by its own rule, wherever it was quoted, and then removed there too.',
        unlabelled: '§3.1 Unlabelled. Until someone labels it, a value is handled as OFFICIAL-SENSITIVE.'
      },
      rules: [
        'Anyone may make a label stricter. Only its descriptor’s owner may make it less strict, and says why.',
        'When values meet, the strictest marking wins, uses narrow to what every part allows, and each part keeps its own keep-until.',
        'A PERSONAL value said as a count over at least {minGroup} people, with none of them picked out, is no longer PERSONAL. It stays OFFICIAL-SENSITIVE.',
        'Some details are kept from you without a mark when even saying they exist would cause harm. This line is on every record so that no record gives it away.'
      ]
    },
    {
      id: 'alt', name: 'Data classification standard', version: 'v1.2 · sample second deployment', owner: 'p4', basis: 'ISO/IEC 27001 Annex A 5.12',
      markings: {
        off: { word: 'INTERNAL',     short: 'INT', rank: 0, plain: 'Anyone in the company whose floor reaches it.', handle: 'No special handling.' },
        os:  { word: 'CONFIDENTIAL', short: 'CONF', rank: 1, plain: 'Named people with a business need.', handle: 'Named people or groups only. External sharing needs the data owner.' },
        sec: { word: 'RESTRICTED',   short: 'RSTR', rank: 2, notHere: true, plain: 'Not kept in AUGUR.', handle: 'Ask the CISO.' }
      },
      descriptors: {
        personal:   { word: 'PERSONAL DATA', short: 'PD', plain: 'Identifies a person (GDPR).', owner: 'p4', icon: 'user-round' },
        commercial: { word: 'COMMERCIAL IN CONFIDENCE', short: 'CiC', plain: 'Prices and contracts.', owner: 'p5', icon: 'coins' },
        security:   { word: 'SECURITY',      short: 'SEC', plain: 'Security weakness.', owner: 'p6', icon: 'shield', hideExistence: true }
      },
      uses: {
        ops:       { word: 'Operations',  long: 'Running the business',   icon: 'anchor' },
        safety:    { word: 'Safety',      long: 'Health and safety',      icon: 'life-buoy' },
        report:    { word: 'Reporting',   long: 'Management reporting',   icon: 'file-chart-column' },
        appraisal: { word: 'HR',          long: 'Performance and HR cases', icon: 'user-check' },
        model:     { word: 'AI',          long: 'AI assistants and training', icon: 'bot' },
        outside:   { word: 'External',    long: 'Sharing with third parties',          icon: 'globe' }
      },
      useWords: { yes: 'allowed', no: 'not allowed', ask: 'needs approval', count: 'aggregated only' },
      keepRules: {
        'R-INC-10': '10 years', 'R-SAF-6': '6 years after closure', 'R-CNS': 'until consent ends', 'R-CON-7': '7 years after contract end', 'R-SEC-1': 'annual review', 'R-PAP-25': 'permanent'
      },
      minGroup: 5,
      defaultMarking: 'os',
      clauses: {
        marking: 'A.1 CONFIDENTIAL data is shared with named people with a business need.',
        personal: 'A.3 Personal data under GDPR; owner: the DPO.',
        appraisal: 'A.6 Safety data is not used in HR cases.',
        model: 'A.8 Personal and commercial data may not be sent to AI services.',
        outside: 'A.5 External sharing needs the data owner and a data sharing agreement.',
        count: 'A.4 Aggregates over {minGroup} or more people are not personal data.',
        keep: 'A.9 Retention follows the schedule for each item.',
        unlabelled: 'A.2 Unclassified data is treated as CONFIDENTIAL.'
      },
      rules: [
        'Labels may be raised by anyone and lowered only by the data owner, with a reason.',
        'Combined data takes the highest classification and the narrowest permitted use.',
        'Personal data aggregated over at least {minGroup} people is no longer personal data.',
        'Some items are withheld without notice where acknowledging them is itself a risk.'
      ]
    }
  ],

  /* ---- labels: each value points at one. uses: yes | no | ask | count. who: whom to ask ---- */
  labels: {
    lbOff:   { marking: 'off', desc: [], uses: { ops: 'yes', safety: 'yes', report: 'yes', appraisal: 'no', model: 'yes', outside: 'ask' }, ask: { outside: 'p6' },
               keep: 'R-INC-10', keepDate: '12 Oct 2036', setBy: 'p2', why: 'An event the whole of Marine Operations works from, drawn from a safety report.' },
    lbName:  { marking: 'os', desc: ['personal'], uses: { ops: 'yes', safety: 'yes', report: 'count', appraisal: 'no', model: 'no', outside: 'no' },
               keep: 'R-SAF-6', keepDate: 'investigation open', setBy: 'p2', why: 'Names the pilot on board.',
               caveat: { id: 'name-team', plain: 'The name stays in Pilotage. Elsewhere it reads “a pilot”.', inside: 'pil', other: 'a pilot' } },
    lbHours: { marking: 'os', desc: ['personal'], uses: { ops: 'yes', safety: 'yes', report: 'count', appraisal: 'no', model: 'no', outside: 'no' },
               keep: 'R-SAF-6', keepDate: 'investigation open', setBy: 'p2', why: 'A named person’s working hours, from the duty roster.',
               caveat: { id: 'count-team', plain: 'Shown in Pilotage. Elsewhere only as a count over {minGroup} or more groundings, naming none.', inside: 'pil', other: null } },
    lbDiary: { marking: 'os', desc: ['personal'], uses: { ops: 'no', safety: 'yes', report: 'no', appraisal: 'no', model: 'no', outside: 'no' },
               keep: 'R-CNS', keepDate: 'investigation open', setBy: 'p1', why: 'The pilot’s own fatigue diary, given by consent for this investigation only.', consent: 'CR-0042',
               caveat: { id: 'consent', plain: 'Only the investigator named in the consent may see it.', inside: 'p1', other: null } },
    lbComm:  { marking: 'os', desc: ['commercial'], uses: { ops: 'yes', safety: 'yes', report: 'yes', appraisal: 'no', model: 'no', outside: 'no' },
               keep: 'R-CON-7', keepDate: '31 Mar 2034', setBy: 'p5', why: 'A tug company’s quoted price, under contract terms.' },
    lbSec:   { marking: 'os', desc: ['security'], uses: { ops: 'yes', safety: 'yes', report: 'no', appraisal: 'yes', model: 'no', outside: 'no' },
               keep: 'R-SEC-1', keepDate: 'review Jan 2027', setBy: 'p6', why: 'Shows where VTS radar can’t see.' }
  },

  /* a value that arrived this morning with no label yet */
  fresh: { id: 'f9', k: 'Tide at Halden Bar, 04:50 on 12 Oct', v: '1.9 m above chart datum', from: 'Tide gauge feed, imported 3 Nov 08:00', keptOn: 'mops', keeper: 'p6', label: null, suggest: 'lbOff', suggestWhy: 'The record’s other conditions (§1, §2) are OFFICIAL, and nothing in it names a person.' },

  /* ---- the source document (Artifacts) ---- */
  doc: {
    id: 'D-1186', title: 'Marlow Star grounding: initial report', app: 'Artifacts', library: 'Pilotage incident reports', keptOn: 'pil', by: 'p2', on: '13 Oct 2026',
    sections: [
      { n: '§1', h: 'What happened', text: 'The Marlow Star touched bottom on the east edge of Halden Bar at 04:52 on 12 October, on a falling tide, and was refloated by two tugs at 07:30.', label: 'lbOff' },
      { n: '§2', h: 'Conditions', text: 'Draught 9.8 m against a charted 10.1 m; the bar was last surveyed in 2019.', label: 'lbOff' },
      { n: '§3', h: 'The pilot’s watch', text: 'Pilot Dafydd Rees boarded at 04:52 having been on duty for 13 h 40 min, after two back-to-back acts on the evening tide.', label: 'lbHours', quotes: ['f4', 'f5'] },
      { n: '§4', h: 'Refloat', text: 'Tug Ardent’s refloat charge was quoted at £18,400.', label: 'lbComm' }
    ]
  },

  /* ---- the record (Data Atlas): an event with facts, each fact a labelled value ---- */
  record: {
    id: 'E-2207', title: 'Marlow Star grounding', kind: 'Grounding', app: 'Data Atlas', keptOn: 'mops', keeper: 'p6',
    facts: [
      { id: 'f1', k: 'When and where', v: '12 Oct 2026, 04:52 · Halden Bar, east edge', label: 'lbOff', keptOn: 'mops', src: '§1' },
      { id: 'f2', k: 'Vessel', v: 'Marlow Star, bulk carrier, 31,000 t', label: 'lbOff', keptOn: 'mops', src: '§1' },
      { id: 'f3', k: 'Draught and charted depth', v: '9.8 m against 10.1 m charted', label: 'lbOff', keptOn: 'mops', src: '§2' },
      { id: 'f4', k: 'Pilot on board', v: 'Dafydd Rees', label: 'lbName', keptOn: 'pil', src: '§3', about: 'p3' },
      { id: 'f5', k: 'Pilot’s time on duty', v: '13 h 40 min', label: 'lbHours', keptOn: 'pil', src: '§3', about: 'p3' },
      { id: 'f6', k: 'Sleep in the 24 h before', v: 'about 4 h', label: 'lbDiary', keptOn: 'pil', src: 'fatigue diary', about: 'p3' },
      { id: 'f7', k: 'Refloat charge, tug Ardent', v: '£18,400', label: 'lbComm', keptOn: 'com', src: '§4' },
      { id: 'f8', k: 'Radar cover at the bar', v: 'blind sector 040°–052° from the VTS tower', label: 'lbSec', keptOn: 'vts', src: 'VTS log' }
    ]
  },

  /* shares and consents in force: what lets someone outside a floor see a value */
  shares: [
    { id: 'SR-0193', from: 'p2', to: 'p1', facts: ['f4', 'f5'], purpose: 'safety', until: '31 Dec 2026', on: '20 Oct 2026', note: 'For the Marlow Star investigation.' }
  ],
  consents: [
    { id: 'CR-0042', subject: 'p3', to: 'p1', what: 'Fatigue diary, 1–12 Oct 2026', facts: ['f6'], purpose: 'safety', purposeNote: 'the Marlow Star safety investigation, and nothing else', on: '14 Oct 2026',
      until: 'the investigation closes', controller: 'Halden Estuary Ports', contact: 'p4', not: ['appraisal', 'model', 'report', 'outside', 'ops'], reached: ['Data Atlas · Marlow Star grounding', 'Leah’s investigation notes'], notReached: ['Answer A-77', 'Briefing “Fatigue and groundings, 2026”'] }
  ],

  /* ---- the answer (Explorer) built partly from the duty hours ---- */
  answer: {
    id: 'A-77', q: 'In this year’s groundings, how long had the pilot been on duty?', by: 'p1', on: '28 Oct 2026', keptOn: 'mops',
    text: 'In {n} of {of} groundings this year, the pilot had been on duty for more than 12 hours.', n: 2, of: 5,
    rows: [
      { vessel: 'Corran Bay',   date: '9 Feb',  hours: 7.5,  pilot: 'p-a' },
      { vessel: 'Elsa Thorne',  date: '30 Mar', hours: 12.8, pilot: 'p-b' },
      { vessel: 'Kittiwake',    date: '2 Jun',  hours: 6.2,  pilot: 'p-c' },
      { vessel: 'Northgate',    date: '19 Aug', hours: 8.9,  pilot: 'p-d' },
      { vessel: 'Marlow Star',  date: '12 Oct', hours: 13.67, pilot: 'p3' }
    ],
    parts: [ { what: '5 groundings', label: 'lbOff', keptOn: 'mops' }, { what: '5 pilots’ time on duty', label: 'lbHours', keptOn: 'pil', said: 'counted, none named' } ]
  },

  /* ---- the briefing (Artifacts) the answer feeds ---- */
  briefing: {
    id: 'B-31', title: 'Fatigue and groundings, 2026', by: 'p1', keptOn: 'mops', keep: 'R-PAP-25',
    embargo: { until: '12 Nov 2026', why: 'The Safety committee reads it first, at its meeting on 12 Nov.' },
    paras: [
      { id: 'b1', text: 'Five vessels have grounded in the estuary this year, all on a falling tide at Halden Bar or the Narrows.', label: 'lbOff', from: 'record list' },
      { id: 'b2', text: 'The Marlow Star found 0.5 m less water than charted at Halden Bar, which was last surveyed in 2019.', label: 'lbOff', from: 'E-2207' },
      { id: 'b3', text: 'In 2 of the 5 groundings, the pilot had been on duty for more than 12 hours.', label: 'lbHours', said: true, from: 'A-77' },
      { id: 'b4', text: 'One of them was the Marlow Star.', label: 'lbHours', stop: 'Names which grounding, and so which pilot: each grounding had one pilot on board.', from: 'A-77 + E-2207' },
      { id: 'b5', text: 'Recommendation: no pilot boards after 12 hours on duty, and Halden Bar is resurveyed this winter.', label: 'lbOff', from: 'Leah Morgan' }
    ]
  },
  /* where a briefing can go */
  targets: [
    { id: 't1', kind: 'group', ref: 'sc',  floor: 'org', people: 9,   via: 'Safety committee papers' },
    { id: 't2', kind: 'floor', ref: 'mops', floor: 'mops', people: 86, via: 'Marine Operations library' },
    { id: 't3', kind: 'group', ref: 'all', floor: 'org', people: 640, via: 'All-staff news' },
    { id: 't4', kind: 'outside', ref: 'mca', floor: null, people: null, via: 'Email to the Maritime and Coastguard Agency', approval: 'p6' }
  ],

  /* ---- custody of one value: the pilot's time on duty ---- */
  custody: [
    { id: 'k1', on: '12 Oct', at: '23:10', hand: 'roster', act: 'recorded', what: 'Dafydd Rees on duty from 15:12 on 11 Oct', where: 'Pilot duty roster (imported nightly)', floor: 'pil', tech: 'atlas.import · source=roster · row 88412' },
    { id: 'k2', on: '13 Oct', at: '09:40', hand: 'p2', act: 'wrote', what: '“on duty for 13 h 40 min”', where: 'Initial report §3', floor: 'pil', label: 'lbHours', gap: 'Typed from the paper roster: no link to the roster row was kept.', tech: 'artifacts.document.saved · D-1186 rev 2' },
    { id: 'k3', on: '13 Oct', at: '16:02', hand: 'atlas', act: 'proposed', what: 'a fact: time on duty = 13 h 40 min', where: 'Data Atlas · Triage', floor: 'pil', repair: 'Data Atlas matched it to roster row 88412 (15:12 to 04:52 = 13 h 40 min), so the link is mended.', tech: 'atlas.proposal.created · from D-1186 §3' },
    { id: 'k4', on: '13 Oct', at: '16:20', hand: 'p2', act: 'accepted', what: 'the fact, keeping the report’s label', where: 'Data Atlas · Marlow Star grounding', floor: 'pil', tech: 'atlas.fact.accepted · f5 · label=lbHours' },
    { id: 'k5', on: '20 Oct', at: '11:05', hand: 'p2', act: 'shared', what: 'the name and the hours', to: 'p1', purpose: 'safety', until: '31 Dec 2026', receipt: 'SR-0193', floor: 'mops', tech: 'grant · SR-0193 · purpose=safety · exp=2026-12-31' },
    { id: 'k6', on: '21–31 Oct', hand: null, act: 'read', reads: 6, readFloor: 'pil', mine: 3, tech: 'reads aggregated · k ≥ 3' },
    { id: 'k7', on: '28 Oct', at: '14:30', hand: 'p1', act: 'counted', what: 'in “2 of 5 groundings over 12 hours”', where: 'Explorer · answer A-77', floor: 'mops', said: 'name dropped, counted with 4 other groundings', tech: 'explorer.answer · A-77 · transform=count(k=5)' },
    { id: 'k8', on: '2 Nov', at: '10:12', hand: 'p1', act: 'quoted', what: 'the count', where: 'Briefing “Fatigue and groundings, 2026” ¶3', floor: 'mops', tech: 'artifacts.quote · B-31 ¶3 ← A-77' },
    { id: 'k9', on: '3 Nov', at: '09:30', hand: 'p1', act: 'shared', what: 'the briefing', to: 'sc', purpose: 'safety', receipt: 'SR-0201', floor: 'org', tech: 'grant · SR-0201 · group=safety-committee' }
  ],
  hands: {
    roster: { name: 'Duty roster', kind: 'system', icon: 'calendar-clock' },
    atlas:  { name: 'Data Atlas', kind: 'app', icon: 'database' }
  },

  /* ---- a collection's own label (Data Atlas collection) ---- */
  dataset: {
    id: 'C-14', title: 'Pilotage safety records, 2021–2026', keeper: 'p2', keptOn: 'pil', checked: '1 Nov 2026', records: 312,
    why: 'Kept so Pilotage and Marine Operations can find patterns in groundings, near misses and fatigue, under the port’s just-culture policy: safety reports are never used to blame a person.',
    parts: [
      { id: 'ros', name: 'Duty roster entries',       n: 168, label: 'lbHours', origin: 'Imported nightly from the roster system', keptOn: 'pil', expected: 182, cover: 'Mar 2021 – Nov 2026', gap: 'No record 8 Feb – 1 Mar 2023: roster system change. These weeks can’t be recovered.', gapKind: 'none' },
      { id: 'nm',  name: 'Near-miss reports',         n: 58,  label: 'lbName',  origin: 'Confidential reporting form, pilots and VTS', keptOn: 'pil', expected: null, cover: '2021 – 2026', caution: 'Reports fell by a third after the 2024 rota change. That is a drop in reporting, not known to be a drop in near misses.' },
      { id: 'inc', name: 'Incident reports',          n: 41,  label: 'lbOff',   origin: 'Written by Pilotage and the harbour master', keptOn: 'mops', expected: 49, cover: '2021 – 2026', gap: '8 reports from 2021 are on paper and not yet entered. Kofi Mensah could enter them.', gapKind: 'gap' },
      { id: 'dia', name: 'Fatigue diaries',           n: 29,  label: 'lbDiary', origin: 'Given by pilots by consent, one consent each', keptOn: 'pil', expected: null, cover: 'Jan – Oct 2026', consent: { asked: 14, gave: 11, declined: 2, withdrew: 1 } },
      { id: 'ais', name: 'Vessel tracks (AIS)',       n: 16,  label: 'lbComm',  origin: 'Licensed from Coastal AIS Ltd: internal use, no redistribution', keptOn: 'org', expected: 16, cover: 'one track per grounding or near miss', licence: true }
    ],
    years: [2021, 2022, 2023, 2024, 2025, 2026],
    byYear: {
      ros: { n: [24, 33, 26, 31, 30, 24], marks: { 2021: { k: 'gap', t: 'Begins in March 2021, when the roster went digital.' }, 2023: { k: 'none', t: 'No record 8 Feb – 1 Mar: roster system change.' } } },
      nm:  { n: [12, 13, 12, 8, 7, 6],    marks: { 2024: { k: 'caution', t: 'Reporting fell after the rota change.' } } },
      inc: { n: [3, 9, 8, 7, 8, 6],       marks: { 2021: { k: 'gap', t: '8 reports on paper, not yet entered.' } } },
      dia: { n: [0, 0, 0, 0, 0, 29],      marks: { 2021: { k: 'na' }, 2022: { k: 'na' }, 2023: { k: 'na' }, 2024: { k: 'na' }, 2025: { k: 'na', t: 'Diaries began in January 2026.' } } },
      ais: { n: [2, 3, 3, 3, 2, 3],       marks: {} }
    },
    usesWhy: {
      ops: 'Rosters for running the day live in the roster system, not here.',
      safety: 'What it is kept for.',
      report: 'Counts over 3 or more pilots, naming none (rule 3). The fatigue diaries can’t be reported at all, so a report leaves them out.',
      appraisal: 'Just-culture policy §6: safety reports are never used for appraisal or discipline.',
      model: 'The fatigue diaries’ consents exclude it, and the AIS licence forbids it.',
      outside: 'The AIS licence forbids redistribution; the rest is PERSONAL.'
    },
    issues: [
      'Time on duty is worked out from the roster, not from boarding records. A pilot who swapped a shift by phone shows the roster’s hours.',
      'Near misses are under-reported at night (the 2025 survey: about 1 in 3 not filed).'
    ]
  }
};
