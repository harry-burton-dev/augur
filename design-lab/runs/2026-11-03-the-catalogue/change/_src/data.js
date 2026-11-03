/* ======================================================================
   Sample data: every name, label, count, floor and date on this page comes
   from here. In AUGUR it comes from Data Atlas (the ontology and its change
   log, counts per kind and floor, expected details per kind, triage),
   Artifacts (documents that could fill a gap), Mandate (intents bound to a
   detail) and Explorer (saved views). Nothing below is specific to one
   deployment: swap this object and the page redraws.
   ====================================================================== */
const DATA = {
  app: 'Data Atlas',
  org: 'Northfold Regional Services',
  today: '2026-11-03',
  viewer: { name: 'Priya Shah', floor: 'department', role: 'Operator', team: 'Estates bookings' },
  admin: { name: 'Harry Burton', role: 'Looks after the kinds of thing', tech: 'Ontology admin' },
  floors: {
    org: { label: 'Org', name: 'Northfold', tok: 'org' },
    department: { label: 'Department', name: 'Estates', tok: 'department' },
    team: { label: 'Team', name: 'Fleet', tok: 'team' },
    you: { label: 'You', name: 'You', tok: 'you' }
  },
  nav: [
    { label: 'What we keep', icon: 'library-big' },
    { label: 'Sites', icon: 'building-2', n: 142, on: true },
    { label: 'Triage', icon: 'inbox', n: 9 },
    { label: 'Sources', icon: 'database', n: 23 }
  ],
  /* the kinds of thing (classes, one step down) */
  kinds: [
    { id: 'site', word: 'Site', plural: 'Sites', icon: 'building-2', tech: 'cco:Facility', floor: 'org', count: 142 },
    { id: 'supplier', word: 'Supplier', plural: 'Suppliers', icon: 'handshake', tech: 'cco:Organization', floor: 'org', count: 86 },
    { id: 'contract', word: 'Contract', plural: 'Contracts', icon: 'file-text', tech: 'cco:Contract', floor: 'department', count: 211 },
    { id: 'person', word: 'Person', plural: 'People', icon: 'user-round', tech: 'cco:Person', floor: 'org', count: 1340 },
    { id: 'vehicle', word: 'Vehicle', plural: 'Vehicles', icon: 'car', tech: 'cco:GroundVehicle', floor: 'team', count: 96 },
    { id: 'workorder', word: 'Job', plural: 'Jobs', icon: 'hammer', tech: 'nf:WorkOrder', floor: 'department', count: 3120 },
    { id: 'incident', word: 'Incident', plural: 'Incidents', icon: 'siren', tech: 'cco:Event', floor: 'department', count: 418 }
  ],
  /* details each kind expects (properties, one step down); fill = share of records holding it */
  details: {
    site: [
      { word: 'Address', tech: 'cco:has_address', fill: 1 },
      { word: 'Opened', tech: 'nf:openedOn', fill: .82 },
      { word: 'Manager', tech: 'nf:managedBy', link: 'person', fill: .89 },
      { word: 'Floor area', tech: 'nf:floorArea', fill: .64 },
      { word: 'Runs from', tech: 'nf:heldUnder', link: 'contract', fill: .71 }
    ],
    supplier: [{ word: 'Registered number', fill: .97 }, { word: 'Main contact', link: 'person', fill: .8 }, { word: 'Insurance until', fill: .55 }],
    contract: [{ word: 'Value', fill: .99 }, { word: 'Ends', fill: .96 }, { word: 'Supplier', link: 'supplier', fill: 1 }, { word: 'Covers site', link: 'site', fill: .74 }],
    person: [{ word: 'Role', fill: .93 }, { word: 'Based at', link: 'site', fill: .86 }, { word: 'Phone', fill: .61 }],
    vehicle: [{ word: 'Registration', fill: 1 }, { word: 'Kept at', link: 'site', fill: .9 }, { word: 'MOT due', fill: .78 }, { word: 'How held', fill: .96 }],
    workorder: [{ word: 'Raised', fill: 1 }, { word: 'At site', link: 'site', fill: .94 }, { word: 'Done by', link: 'supplier', fill: .67 }, { word: 'Status', fill: 1 }],
    incident: [{ word: 'When', fill: 1 }, { word: 'Where', link: 'site', fill: .91 }, { word: 'Severity', fill: .88 }, { word: 'Reported by', link: 'person', fill: .7 }]
  },
  /* the structure changes, newest first. The demo plays changes[0]. */
  changes: [
    {
      id: 'c41', type: 'add-detail', when: '2026-11-03 09:40', by: 'Harry Burton',
      kind: 'site',
      detail: { word: 'Fire-safety check due', tech: 'nf:fireSafetyCheckDue', range: 'xsd:date', valueWord: 'a date', expected: true },
      why: 'The fire safety review asks every site to show when its next check is due.',
      asked: { by: 'Estates', intent: 'Every site shows its next fire-safety check by 31 March' },
      /* what happens to the 142 sites that don't have it yet */
      gaps: { total: 142, fromDocs: 38, keepers: 89, nobody: 15 },
      fillers: {
        fromDocs: { word: 'Can be read from a document', who: 'Fire risk assessments in Artifacts', how: 'Proposals wait in Triage; a keeper confirms each.' },
        keepers: { word: 'A keeper can fill it', who: 'The site’s manager, or Estates keepers', how: 'Each gets one small job per site.' },
        nobody: { word: 'Nobody can fill it yet', who: 'No manager on record', how: 'Estates keepers’ lead (Dana Okafor) is asked to name one.' }
      },
      byFloor: [ { floor: 'org', n: 24 }, { floor: 'department', n: 97 }, { floor: 'team', n: 21 } ],
      views: [
        { app: 'Data Atlas', icon: 'library-big', what: 'Sites list and every site record', effect: 'Gains a row for the new detail, drawn as a gap until filled.', n: 143 },
        { app: 'Mandate', icon: 'target', what: 'Intent “Every site shows its next fire-safety check by 31 March”', effect: 'Can bind to this detail and count progress.', n: 1 },
        { app: 'Artifacts', icon: 'files', what: 'Collection “Fire risk assessments”', effect: '38 documents become sources for proposals. Nothing in them changes.', n: 38 },
        { app: 'Explorer', icon: 'telescope', what: 'Saved views over Sites', effect: 'Unchanged. Their owners can add the new detail as a column.', n: 3 }
      ],
      noLoss: 'No record loses anything. Nothing is filled without a person confirming it.'
    },
    { id: 'c40', type: 'add-kind', when: '2026-10-28', by: 'Harry Burton', kind: 'site',
      newKind: { word: 'Depot', plural: 'Depots', tech: 'nf:Depot', parent: 'site', icon: 'warehouse', rule: 'A site where vehicles are kept overnight' },
      match: { sure: 9, ask: 2 }, why: 'Fleet asked to see depots on their own.' },
    { id: 'c39', type: 'split', when: '2026-10-14', by: 'Harry Burton', kind: 'vehicle',
      into: [ { word: 'Owned vehicle', tech: 'nf:OwnedVehicle', n: 61 }, { word: 'Hired vehicle', tech: 'nf:HiredVehicle', n: 31 } ],
      by_detail: 'How held', unsure: 4, why: 'Hired vehicles go back; owned ones need MOTs we book.' },
    { id: 'c38', type: 'rename', when: '2026-09-30', by: 'Harry Burton', kind: 'workorder',
      from: 'Job', to: 'Work order', toPlural: 'Work orders', n: 3120, why: 'Suppliers and the contracts already say work order.' }
  ],
  /* sample sites (records) and what each holds of the new detail */
  records: [
    { name: 'Harbour Road Depot', area: '1,840 m²', contract: 'Fleet depot lease', floor: 'department', addr: '2 Harbour Road', manager: 'Sam Ellery', opened: '1998', fill: { state: 'doc', value: '14 Mar 2027', src: 'FRA 2025 Harbour Road.pdf', srcFloor: 'department' } },
    { name: 'Kellmoor Library', area: '920 m²', contract: null, floor: 'org', addr: 'Market Square, Kellmoor', manager: 'Ruth Adeyemi', opened: '1961', fill: { state: 'keeper', who: 'Ruth Adeyemi' } },
    { name: 'Ashgate Leisure Centre', area: '3,400 m²', contract: 'Ashgate facilities contract', floor: 'department', addr: 'Ashgate Lane', manager: 'Tom Birch', opened: '2009', fill: { state: 'doc', value: '2 Dec 2026', src: 'Ashgate FRA review.docx', srcFloor: 'department' } },
    { name: 'Brindle Street Offices', area: null, contract: 'Brindle St lease', floor: 'department', addr: '40 Brindle Street', manager: null, opened: '1984', fill: { state: 'nobody', ask: 'Dana Okafor' } },
    { name: 'Old Quarry Recycling', area: '610 m²', contract: 'Waste services 2024', floor: 'team', addr: 'Quarry Road', manager: 'Lee Hart', opened: '2014', fill: { state: 'keeper', who: 'Lee Hart' } },
    { name: 'Fenwick Day Centre', area: '480 m²', contract: null, floor: 'department', addr: '7 Fenwick Close', manager: 'Amira Khan', opened: '2001', fill: { state: 'filled', value: '20 Jan 2027', src: 'Entered by Amira Khan', srcFloor: 'you', at: '10:12' } },
    { name: 'Northgate Clinic', area: null, contract: 'Health estates SLA', floor: 'org', addr: 'Northgate', manager: 'Joe Marsh', opened: '1993', fill: { state: 'keeper', who: 'Joe Marsh' } },
    { name: 'Calder Bridge Store', area: '260 m²', contract: null, floor: 'team', addr: 'Calder Bridge', manager: null, opened: '1977', fill: { state: 'nobody', ask: 'Dana Okafor' } }
  ],
  words: {
    kind: ['kind of thing', 'class'], detail: ['detail', 'property'], link: ['link', 'object property'],
    record: ['record', 'entity / individual'], gap: ['gap', 'missing expected value'], keeper: ['keeper', 'steward']
  }
};
