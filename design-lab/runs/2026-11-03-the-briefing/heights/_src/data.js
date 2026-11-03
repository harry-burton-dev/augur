/* ======================================================================
   Sample data for one deployment (Vale Regional Services). Every name,
   label, count, date, sentence part and reason on the page comes from
   here. In AUGUR it would come from Data Atlas (the site, its inspection
   regime, each visit as an entity with observations from sources),
   Artifacts (the reports those observations were read from) and Mandate
   (intents bound to the site). Swap this object and the page redraws.
   Counts are never typed in: the page counts DATA.regime and DATA.visits.
   ====================================================================== */
const DATA = {
  app: 'Data Atlas',
  org: 'Vale Regional Services',
  today: '2026-11-03',
  viewer: { name: 'Sam Okafor', role: 'Operator', floor: 'facilities' },
  lead: { name: 'Dana Whitfield', role: 'Head of Facilities' },
  hiddenCount: 'some',
  floors: {
    org: { name: 'Vale Regional Services', tier: 'org', word: 'Org floor' },
    facilities: { name: 'Facilities', tier: 'department', word: 'Department floor', here: true },
    depot: { name: 'Depot operations', tier: 'team', word: 'Team floor below yours', ask: 'Marta Kowal, depot lead', locked: true }
  },
  /* the entity this page is about, and the fact chosen as its key fact */
  entity: { id: 'site-northgate', kind: 'site', kindPlain: 'Site', kindTech: 'cco:Facility', name: 'Northgate Depot', floor: 'facilities', icon: 'warehouse', place: 'North area' },
  fact: {
    noun: ['inspection', 'inspections'],
    plain: 'Inspections overdue',
    tech: 'count(regime where next_due < today and no completion observed)',
    question: 'Are Northgate’s inspections in date?'
  },
  /* the states one inspection can be in, in reading order. plain on top, tech one step down (T) */
  states: {
    overdue:  { plain: 'Overdue', one: 'overdue', line: 'Its due date has passed and nobody has recorded the visit.', tech: 'next_due < today · no completion' },
    disputed: { plain: 'Probably overdue', one: 'probably overdue', line: 'Two sources disagree about whether it was done.', tech: 'conflicting observations · no fact' },
    soon:     { plain: 'Due soon', one: 'due soon', line: 'Due in the next fourteen days.', tech: 'next_due − today ≤ 14 d' },
    ok:       { plain: 'In date', one: 'in date', line: 'Done, and not due again yet.', tech: 'next_due − today > 14 d' },
    gap:      { plain: 'Not known yet', one: 'not known yet', line: 'Expected here, but nobody has recorded one. Someone could fill it.', tech: 'expected detail, no fact · sh:minCount 1 not met' },
    hidden:   { plain: 'Not yours to see', one: 'not yours to see', line: 'Kept on a floor you can’t open. It says whom to ask.', tech: '403 · kept on team floor' },
    na:       { plain: 'Doesn’t apply', one: 'doesn’t apply', line: 'Not expected at this site.', tech: 'outside the regime for this site' }
  },
  /* the calibrated words (UK probability yardstick), fixed for every deployment's language pack */
  yardstick: [
    ['Remote', 0, 5], ['Highly unlikely', 10, 20], ['Unlikely', 25, 35], ['Realistic possibility', 40, 50],
    ['Likely', 55, 75], ['Highly likely', 80, 90], ['Almost certain', 95, 100]
  ],
  /* the inspection regime at this site: one row per thing that must be inspected */
  regime: [
    { id: 'ext',  name: 'Fire extinguishers', icon: 'fire-extinguisher', every: 'every year', months: 12, last: '2025-09-17', due: '2026-09-17', state: 'overdue', by: 'Brigade Fire Ltd', why: 'Brigade Fire’s servicing contract ended on 31 Aug 2026.' },
    { id: 'elt',  name: 'Emergency lighting', icon: 'lightbulb', every: 'every 3 months', months: 3, last: '2026-07-02', due: '2026-10-02', state: 'overdue', by: 'Facilities (in house)' },
    { id: 'door', name: 'Fire doors', icon: 'door-closed', every: 'every 6 months', months: 6, last: '2026-04-25', due: '2026-10-25', state: 'overdue', by: 'Facilities (in house)' },
    { id: 'hoist',name: 'Workshop hoists', icon: 'forklift', every: 'every 6 months', months: 6, last: '2026-04-20', due: '2026-10-20', state: 'disputed', by: 'Ascent Lifting Services',
      sides: [
        { says: 'Done on 28 Oct 2026', from: 'Ascent Lifting Services report, 28 Oct 2026', kind: 'document', grade: 'B', gradeWord: 'a supplier’s own report' },
        { says: 'No visit since 20 Apr 2026', from: 'Lee Brennan, workshop supervisor (site log)', kind: 'person', grade: 'A', gradeWord: 'a person on site' }
      ],
      confidence: 'Likely', confidenceOf: 'overdue' },
    { id: 'fuel', name: 'Fuel tank', icon: 'fuel', every: 'every year', months: 12, last: '2025-11-05', due: '2026-11-05', state: 'soon', by: 'Tankcare North' },
    { id: 'alarm',name: 'Fire alarm', icon: 'bell-ring', every: 'every 3 months', months: 3, last: '2026-08-12', due: '2026-11-12', state: 'soon', by: 'Facilities (in house)' },
    { id: 'leg',  name: 'Water (legionella)', icon: 'droplets', every: 'every 3 months', months: 3, last: '2026-09-09', due: '2026-12-09', state: 'ok', by: 'Clearwater Hygiene' },
    { id: 'elec', name: 'Electrics (fixed wiring)', icon: 'zap', every: 'every 5 years', months: 60, last: '2022-06-14', due: '2027-06-14', state: 'ok', by: 'Vale Electrical' },
    { id: 'roof', name: 'Roof anchors', icon: 'anchor', every: 'every year', months: 12, state: 'gap', fill: 'Ade Bello, estates officer', fillWhy: 'the regime expects one; no visit has ever been recorded' },
    { id: 'lift', name: 'Passenger lift', icon: 'arrow-up-down', every: 'every 6 months', months: 6, state: 'hidden', keptOn: 'depot', ask: 'Marta Kowal, depot lead' },
    { id: 'gas',  name: 'Gas safety', icon: 'flame', state: 'na', naWhy: 'Northgate has no gas supply (site register, 2024).' }
  ],
  /* each visit is a record in Data Atlas, read from a source */
  visits: [
    { id: 'INS-2207', of: 'ext',  date: '2025-09-17', by: 'Brigade Fire Ltd', result: 'Pass', src: 'Brigade Fire service report, Sep 2025' },
    { id: 'INS-2311', of: 'fuel', date: '2025-11-05', by: 'Tankcare North', result: 'Pass with actions', src: 'Tankcare inspection certificate, Nov 2025' },
    { id: 'INS-2318', of: 'alarm',date: '2025-11-11', by: 'Facilities', result: 'Pass', src: 'Fire alarm test log, Q4 2025' },
    { id: 'INS-2320', of: 'hoist',date: '2025-10-20', by: 'Ascent Lifting Services', result: 'Pass', src: 'Ascent LOLER report, Oct 2025' },
    { id: 'INS-2322', of: 'door', date: '2025-10-25', by: 'Facilities', result: 'Pass', src: 'Fire door survey, Oct 2025' },
    { id: 'INS-2340', of: 'elt',  date: '2026-01-02', by: 'Facilities', result: 'Pass', src: 'Emergency lighting log, Q1 2026' },
    { id: 'INS-2366', of: 'leg',  date: '2026-03-30', by: 'Clearwater Hygiene', result: 'Pass', src: 'Clearwater sampling report, Mar 2026' },
    { id: 'INS-2371', of: 'elt',  date: '2026-04-09', by: 'Facilities', result: 'Pass, 7 days late', src: 'Emergency lighting log, Q2 2026' },
    { id: 'INS-2380', of: 'hoist',date: '2026-04-20', by: 'Ascent Lifting Services', result: 'Pass', src: 'Ascent LOLER report, Apr 2026' },
    { id: 'INS-2384', of: 'door', date: '2026-04-25', by: 'Facilities', result: 'Pass with actions', src: 'Fire door survey, Apr 2026' },
    { id: 'INS-2392', of: 'alarm',date: '2026-05-14', by: 'Facilities', result: 'Pass', src: 'Fire alarm test log, Q2 2026' },
    { id: 'INS-2399', of: 'leg',  date: '2026-06-09', by: 'Clearwater Hygiene', result: 'Pass', src: 'Clearwater sampling report, Jun 2026' },
    { id: 'INS-2410', of: 'elt',  date: '2026-07-02', by: 'Facilities', result: 'Pass', src: 'Emergency lighting log, Q3 2026' },
    { id: 'INS-2423', of: 'alarm',date: '2026-08-12', by: 'Facilities', result: 'Pass', src: 'Fire alarm test log, Q3 2026' },
    { id: 'INS-2431', of: 'leg',  date: '2026-09-09', by: 'Clearwater Hygiene', result: 'Pass', src: 'Clearwater sampling report, Sep 2026' },
    { id: 'INS-2448', of: 'hoist',date: '2026-10-28', by: 'Ascent Lifting Services', result: 'Pass (disputed)', src: 'Ascent LOLER report, 28 Oct 2026', disputed: true }
  ],
  /* the stretch of time the system lost: a wavy break, never zero */
  noRecord: { from: '2026-02-10', to: '2026-03-22', why: 'the old facilities system’s export was never loaded' },
  /* sites like this one, for comparison (counted the same way) */
  peers: [
    { name: 'Northgate Depot', here: true, cells: ['overdue','overdue','overdue','disputed','soon','soon','ok','ok','gap','hidden','na'] },
    { name: 'Hilltop Recycling Centre', cells: ['overdue','overdue','soon','ok','ok','ok','ok','ok','ok','na','na'] },
    { name: 'Eastfield Yard', cells: ['overdue','soon','ok','ok','ok','ok','ok','ok','ok','ok','na'] },
    { name: 'Riverside Offices', cells: ['soon','ok','ok','ok','ok','ok','ok','ok','na','na','na'] },
    { name: 'Market Street Hub', cells: ['ok','ok','ok','ok','ok','ok','ok','gap','na','na','na'] },
    { name: 'Southmoor Depot', locked: true, keptOn: 'depot', ask: 'Marta Kowal, depot lead' }
  ],
  /* what this fact is used by, and where it could go */
  contract: { id: 'C-0412', name: 'Fire equipment servicing', with: 'Brigade Fire Ltd', ended: '2026-08-31', renewed: false },
  intents: [
    { id: 'M-118', title: 'Keep every site’s statutory inspections in date', owner: 'Dana Whitfield', floor: 'org', due: null },
    { id: 'M-342', title: 'Book the fire extinguisher service at Northgate', owner: 'Sam Okafor', floor: 'facilities', due: '2026-10-31' }
  ],
  reach: { team: 6, department: 23, lead: 'Dana Whitfield' },
  /* the only text a model may write here: a proposed reason, in pencil, tied to records */
  pencil: {
    text: 'The extinguisher service is probably late because Brigade Fire’s contract ended on 31 Aug and no new supplier has been booked.',
    links: ['C-0412', 'INS-2207', 'M-342'],
    by: 'model gateway'
  }
};
