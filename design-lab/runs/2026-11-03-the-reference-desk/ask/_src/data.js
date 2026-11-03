/* Sample data for ONE deployment: a regional services organisation.
   Swap this object and every name, date, count and reason on the page follows. */
const DATA = {
  app: 'Data Atlas',
  today: '2026-11-03',
  floor: { type: 'department', name: 'Regional Services', lead: 'Priya Shah' },
  me: { name: 'Sam Okafor', teams: ['North waters team'] },
  /* floors you can't open still say they exist and whom to ask */
  elsewhere: [{ name: 'Coast works crew', type: 'team', ask: 'Dee Harper' }],
  gateway: { on: true, used: 37, limit: 500, admin: 'Lena Brandt' },
  /* the deployment's calendar words; a model is not needed to read them */
  calendar: {
    fyStart: '04-01', fyName: 'financial year',
    seasons: { spring: ['03-01', '05-31'], summer: ['06-01', '08-31'] }
  },
  question: 'which suppliers have we not heard from since spring?',
  /* kinds on this floor (the front page's contents) */
  kinds: [
    { id: 'site', many: 'sites', n: 42 }, { id: 'supplier', many: 'suppliers', n: 20, one: 'supplier' },
    { id: 'contract', many: 'contracts', n: 64 }, { id: 'person', many: 'people', n: 118 },
    { id: 'vehicle', many: 'vehicles', n: 37 }, { id: 'incident', many: 'incidents', n: 211 }
  ],
  /* what in the record can count as "hearing from" a supplier.
     src: where it lives (Artifacts library or Data Atlas link); tech: the register one step down */
  contacts: [
    { id: 'invoice', word: 'invoice', label: 'an invoice', short: 'invoices', src: 'Artifacts · Accounts payable', tech: 'doc[type=invoice].issuer' },
    { id: 'delivery', word: 'delivery note', label: 'a delivery note', short: 'delivery notes', src: 'Artifacts · Stores', tech: 'doc[type=delivery-note].supplier' },
    { id: 'letter', word: 'filed letter', label: 'a filed letter or email', short: 'letters and emails filed', src: 'Artifacts · Correspondence', tech: 'doc[type=correspondence].from' },
    { id: 'incident', word: 'mention in an incident', label: 'being named in an incident', short: 'incidents naming them', src: 'Data Atlas · Incidents', tech: 'atlas:Incident.involves' },
    /* far: dated, but the model judged them not "hearing from" (shown, never dropped) */
    { id: 'contract', word: 'contract change', label: 'a contract change', short: 'contract changes', src: 'Data Atlas · Contracts', tech: 'atlas:Contract.amendedOn', far: true },
    { id: 'visit', word: 'site visit', label: 'a site visit logged', short: 'site visits', src: 'Data Atlas · Sites', tech: 'atlas:SiteVisit.by', far: true }
  ],
  /* what is NOT in the record at all: said, never skipped */
  notRecorded: [
    { what: 'Phone calls', why: 'No call log is kept in AUGUR.', who: 'Priya Shah', how: 'keeps the procurement call sheet and could load it as a source' },
    { what: 'Inboxes', why: 'Only emails someone files in Artifacts count.', who: 'anyone', how: 'can file an email to Correspondence' }
  ],
  /* dated things in the record whose NAME mentions a word in the question (found by name, no model) */
  named: [
    { word: 'spring', label: 'the Spring supplier review', date: '2026-04-14', where: 'Mandate · intent by Priya Shah' }
  ],
  /* suppliers. floor: here | org | team:<name>. contract: live | ended:<date> | none */
  suppliers: [
    ['Northgate Fuels', 'here', 'live', [['invoice', '2026-10-02']]],
    ['Harbour Tyres', 'here', 'live', [['invoice', '2026-02-14'], ['letter', '2026-03-20']]],
    ['Fenwick Grounds Care', 'here', 'live', [['delivery', '2026-03-28']]],
    ['Calder Waste Services', 'here', 'live', [['invoice', '2026-01-22'], ['incident', '2026-06-11']]],
    ['Brightwater Labs', 'here', 'live', [['invoice', '2026-01-30'], ['visit', '2026-05-12']]],
    ['Kestrel Uniforms', 'here', 'live', []],
    ['Marsh & Pike Printing', 'here', 'ended:2026-05-31', [['invoice', '2026-05-02']]],
    ['Oakline Plant Hire', 'here', 'live', [['delivery', '2026-09-19'], ['invoice', '2026-09-30']]],
    ['Tarn Valley Salt', 'here', 'live', [['letter', '2026-03-11']]],
    ['Pennant Software', 'org', 'live', [['invoice', '2026-10-20']]],
    ['Sefton Signs', 'here', 'live', [['invoice', '2025-11-30'], ['contract', '2026-06-01']]],
    ['Rowan Catering', 'here', 'none', [['invoice', '2026-02-02']]],
    ['Lindqvist Pumps', 'org', 'live', [['delivery', '2026-04-08']]],
    ['Greyfriars Security', 'here', 'live', [['letter', '2026-08-01']]],
    ['Ashby Electrical', 'team:Coast works crew', 'live', [['invoice', '2026-02-11']]],
    ['Dunmore Aggregates', 'team:Coast works crew', 'live', [['invoice', '2026-07-09']]],
    ['Moorland Couriers', 'here', 'live', [['invoice', '2026-01-10'], ['incident', '2026-07-03']]],
    ['Vale Office Supplies', 'org', 'live', []],
    ['Quayside Fencing', 'team:North waters team', 'live', [['invoice', '2026-03-05']]],
    ['Hollins Fleet Parts', 'here', 'live', [['invoice', '2026-04-02']]]
  ],
  /* who could fill a supplier with no contact recorded */
  filler: { who: 'Priya Shah', role: 'keeps Accounts payable' },
  saved: [
    { q: 'Contracts ending this year with no renewal intent', by: 'Priya Shah', changed: '2026-10-28' },
    { q: 'Sites with an incident since the last inspection', by: 'Ivo Rask', changed: '2026-11-01' }
  ]
};
