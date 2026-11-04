/* Sample data. Every name, label, count, file and floor below is deployment data:
   nothing in the markup or the scripts repeats any of it. Counts on every page are
   worked out by running the recipe over these lines (lib.js), never typed. */
const DATA = {
  org: 'Ridgeway Regional Services',
  app: 'Data Atlas',
  bench: 'Bring in',
  me: 'p1',
  myFloor: 'department',
  today: '3 Nov 2026',
  floors: {
    org:        { name: 'Ridgeway Regional Services', word: 'Org' },
    department: { name: 'Fleet and Facilities',       word: 'Department' },
    team:       { name: 'North depot crew',           word: 'Team' }
  },
  floorOrder: ['org', 'department', 'team'],
  people: {
    p1: { name: 'Ade Mensah',    role: 'Fleet administrator', floor: 'department' },
    p2: { name: 'Priya Nair',    role: 'Fleet lead, decides Triage for Fleet and Facilities', floor: 'department' },
    p3: { name: 'Jo Barnes',     role: 'North depot keeper', floor: 'team' },
    p4: { name: 'Dana Whitlock', role: 'Contracts manager', floor: 'org' },
    p5: { name: 'Lena Ortiz',    role: 'Data Atlas admin, decides new words', floor: 'org' },
    x1: { name: 'Mo Ridley',     role: 'Accounts, Kestrel Fleet Services', floor: null }
  },
  firm: { name: 'Kestrel Fleet Services', short: 'Kestrel', id: 'O-0031', keptOn: 'org' },

  /* what Data Atlas keeps. plain word first, the admin word under it (T) */
  kinds: {
    inspection: { word: 'inspection', tech: 'InspectionEvent', icon: 'clipboard-check',
      details: [
        { id: 'van',      word: 'van',           tech: 'ofVehicle',     links: 'van' },
        { id: 'depot',    word: 'depot',         tech: 'atSite',        links: 'depot' },
        { id: 'on',       word: 'inspected on',  tech: 'occurredOn' },
        { id: 'result',   word: 'result',        tech: 'outcome', words: ['passed', 'passed with advisory', 'failed'] },
        { id: 'odometer', word: 'odometer',      tech: 'odometerMiles', unit: 'miles' },
        { id: 'by',       word: 'inspected by',  tech: 'performedBy',   links: 'firm' },
        { id: 'note',     word: 'note',          tech: 'comment' }
      ],
      links: [ { id: 'follows', word: 'follows up', tech: 'followsUp' } ] },
    van:   { word: 'van',   tech: 'Vehicle',      icon: 'truck' },
    depot: { word: 'depot', tech: 'Site',         icon: 'warehouse' },
    firm:  { word: 'firm',  tech: 'Organisation', icon: 'building-2' }
  },
  /* a word sources asked for, waiting on an admin (the structure predicts its gaps) */
  asked: [
    { word: 'kind of visit', on: 'inspection', from: 'Type', values: ['Annual', 'Interim', 'Re-test'], by: 'p1', when: '3 Nov 2026', decides: 'p5' }
  ],
  depots: [
    { id: 'S-N', name: 'North depot',     keptOn: 'department' },
    { id: 'S-W', name: 'Westfield depot', keptOn: 'department' },
    { id: 'S-H', name: 'Harbour store',   keptOn: 'department' }
  ],
  /* where the vans' kept details came from before any recipe */
  register: { doc: 'D-1180', name: 'Fleet register 2026', by: 'p2', at: '3 Mar 2026' },
  /* vans Data Atlas already holds: id, depot, last odometer (miles), last inspected */
  vans: [
    ['NV-01','S-N',40310,'14 May 2026'],['NV-02','S-N',37950,'2 Mar 2026'],['NV-03','S-N',51200,'19 May 2026'],
    ['NV-04','S-N',60880,'28 Feb 2026'],['NV-05','S-N',11720,'22 May 2026'],['NV-06','S-N',11900,'3 Mar 2026'],
    ['NV-07','S-N',44010,'30 May 2026'],['NV-08','S-N',28700,'7 May 2026'],['NV-09','S-N',35980,'27 Feb 2026'],
    ['NV-10','S-N',46200,'12 May 2026'],['NV-11','S-N',39400,'1 Mar 2026'],['NV-12','S-N',33100,'15 May 2026'],
    ['NV-13','S-N',29400,'20 May 2026'],['NV-14','S-N',39050,'6 Mar 2026'],['NV-15','S-N',26600,'2 Jun 2026'],
    ['NV-16','S-N',44900,'9 Jun 2026'],['NV-17','S-N',31400,'4 Mar 2026'],['NV-18','S-N',52100,'11 Jun 2026'],
    ['WF-01','S-W',27050,'8 Apr 2026'],['WF-02','S-W',32400,'16 Apr 2026'],['WF-03','S-W',29600,'24 Apr 2026'],
    ['WF-04','S-W',22310,'5 May 2026'],['WF-05','S-W',23900,'13 May 2026'],['WF-06','S-W',25700,'21 May 2026'],
    ['WF-07','S-W',29200,'29 May 2026'],['WF-08','S-W',34800,'6 Jun 2026'],
    ['HB-01','S-H',18020,'10 Apr 2026'],['HB-02','S-H',20450,'18 Apr 2026'],['HB-03','S-H',25010,'26 Apr 2026'],
    ['HB-04','S-H',18700,'4 May 2026'],['HB-05','S-H',15400,'12 May 2026']
  ],
  /* what the model gateway proposes when it is on: always pencil, never counted until a person confirms */
  model: {
    links: [
      { from: 20, to: 7, link: 'follows', why: 'line 20 says “brakes re-test”; line 7 is the same van failing on brakes a week earlier' },
      { from: 23, to: 22, link: 'note', why: 'its note says “loan van while WF-04 off road”; line 22 is WF-04 failing the same day' }
    ],
    spellings: [ { raw: 'W\u2019field', to: 'S-W', why: 'reads as a short form of Westfield' } ]
  },
  /* a van is overdue when its last inspection is more than this many months before today */
  inspectEveryMonths: 6,
  /* what reading this file will move elsewhere (consequence preview); counts are worked out, not typed */
  downstream: [
    { app: 'Artifacts', icon: 'file-text', what: 'Briefing “North depot vans overdue”', owner: 'p3', depot: 'S-N', kind: 'overdue' },
    { app: 'Mandate', icon: 'target', what: 'Intent “Get North depot vans back in date”', owner: 'p2', depot: 'S-N', kind: 'intent', state: 'off track' },
    { app: 'Data Atlas', icon: 'binoculars', what: 'Jo Barnes’s watch on overdue vans', owner: 'p3', depot: 'S-N', kind: 'watch' }
  ],

  /* the files. lines are as the spreadsheet holds them, row 1 first */
  files: {
    oct: {
      name: 'Kestrel_Ridgeway_Oct26_FINAL v2.xlsx', from: 'x1', doc: { id: 'D-2291', library: 'Supplier files', floor: 'department' }, run: { n: 1, at: '3 Nov 2026, 10:44', triage: 'T-0583', decided: '3 Nov 2026, 11:20' }, received: '3 Nov 2026, 08:14', via: 'email to the Fleet and Facilities inbox',
      month: 'October 2026', sheet: 'Oct', merged: ['A1:G1'], hidden: { cols: 0, lines: 0 }, formulas: 0, comments: [ { cell: 'E32', text: 'excl. duplicates' } ], subject: 'Ridgeway October visits (final v2)',
      otherSheets: [ { name: 'Rates', lines: 14, what: 'prices per visit, not visits' }, { name: 'Sheet2', lines: 0, what: 'empty' } ],
      lines: [
        ['KESTREL FLEET SERVICES · RIDGEWAY ACCOUNT · OCTOBER 2026'],
        [],
        ['Reg','Depot','Date','Type','Result','Odometer','Notes'],
        ['NV-01','North Depot','01/10/2026','Annual','Pass','41,220',''],
        ['NV-02','North Depot','01/10/2026','Interim','Pass - advisory: tyres','38,904','front nearside 3mm'],
        ['nv 03','Nth Depot','2026-10-02','Interim','PASS','52,118',''],
        ['NV-04','North depot (Ridgeway)','02/10/2026','Annual','Fail - brakes','61,402','rear pads; rebooked 9/10'],
        ['NV05','NORTH','46297','Interim','Pass','12400 mi',''],
        ['NV-06','North Depot','3 Oct','Annual','pass','c.12k','odo not working'],
        ['WF-01','Westfield','03/10/2026','Annual','Pass','27,770',''],
        ['WF-02','W’field','2026-10-06','Interim','Pass (advisory: wipers)','33,050',''],
        ['wf 03','Westfield Depot','06/10/2026','Interim','Pass','30 112',''],
        ['NV-07','Ridgeway North','46302','Annual','FAIL','44,890','lights; fixed same day'],
        ['NV-08','North Depot','07/10/2026','Interim','Pass','29,341',''],
        [],
        ['HB-01','Harbour Store','08/10/2026','Annual','Pass','18,560',''],
        ['HB-02','Harbor store','2026-10-08','Interim','Pass - advisory: wipers','21,004',''],
        ['HB-02','Harbor store','2026-10-08','Interim','Pass - advisory: wipers','21,004',''],
        ['NV-09','Nth Depot','09/10/2026','Annual','Pass','36,700',''],
        ['NV-04','North Depot','9 Oct','Re-test','Pass','61,455','brakes re-test'],
        ['NV10','NORTH','13/10/2026','Interim','Pass','47,031',''],
        ['WF-04','Westfield','14/10/2026','Annual','Fail – lights','22,980',''],
        ['Spare/loan','Westfield','14/10/2026','Interim','Pass','—','loan van while WF-04 off road'],
        ['WF-09','Westfield','2026-10-15','Annual','Pass','8,412','new to fleet'],
        ['nv 11','North depot (Ridgeway)','16/10/2026','Interim','Pass','40,118',''],
        ['HB-03','Harbour Store','20/10/2026','Annual','Pass','25,604',''],
        ['NV-12','North Depot','21 Oct','Interim','pass','33,980',''],
        [],
        ['HB-04','Harbour Store','2026-10-22','Interim','Pass (advisory: tyres)','19,200',''],
        ['WF-05','W’field','23/10/2026','Annual','Pass','24,450',''],
        ['NV-13','North Depot','46320','Interim','Pass','30,016',''],
        ['TOTAL','','','','25 visits','','']
      ]
    },
    nov: {
      name: 'Kestrel_Ridgeway_Nov26.xlsx', from: 'x1', doc: { id: 'D-2417', library: 'Supplier files', floor: 'department' }, run: { n: 2, at: '2 Dec 2026, 08:20', triage: 'T-0671', decided: '2 Dec 2026, 09:05' }, received: '2 Dec 2026, 07:58', via: 'email to the Fleet and Facilities inbox',
      month: 'November 2026', sheet: 'Nov', merged: ['A1:H1'], hidden: { cols: 0, lines: 0 }, formulas: 1, comments: [], subject: 'Ridgeway November visits',
      otherSheets: [ { name: 'Rates', lines: 14, what: 'prices per visit, not visits' } ],
      lines: [
        ['KESTREL FLEET SERVICES · RIDGEWAY ACCOUNT · NOVEMBER 2026'],
        [],
        ['Technician','Vehicle','Depot','Date','Type','Result','Odometer','Notes'],
        ['A. Shah','NV-14','North Depot','03/11/2026','Annual','Pass','39,800',''],
        ['A. Shah','NV-15','Nth Depot','03/11/2026','Interim','Pass','27,115',''],
        ['R. Cole','nv 16','North Depot','2026-11-04','Annual','Pass - advisory: tyres','45,660',''],
        ['R. Cole','NV-17','Nrth depot','04/11/2026','Interim','Pass','31,990',''],
        ['A. Shah','NV-18','NORTH','46335','Annual','Deferred - parts on order','52,704','brake discs on order'],
        ['R. Cole','WF-06','Westfield','05/11/2026','Annual','Pass','26,300',''],
        ['R. Cole','WF-07','W’field','05/11/2026','Interim','Pass','29,881',''],
        ['R. Cole','WF-08','Westfield Depot','2026-11-06','Annual','Fail - lights','35,412',''],
        ['A. Shah','HB-05','Harbour Store','10/11/2026','Annual','Pass','16,050',''],
        ['A. Shah','NV-04','North Depot','10/11/2026','Interim','Pass','61,990',''],
        ['A. Shah','NV-01','North Depot','11 Nov','Interim','PASS','41,980',''],
        ['R. Cole','WF-09','Westfield','12/11/2026','Interim','Pass','9,960',''],
        ['R. Cole','WF-08','Westfield','2026-11-13','Re-test','Pass','35,430','lights re-test'],
        ['A. Shah','NV-02','Nrth depot','17/11/2026','Annual','Pass','39,700',''],
        ['A. Shah','HB-01','Harbor store','18/11/2026','Interim','Pass','19,104',''],
        ['A. Shah','NV-06','North Depot','46345','Interim','Pass','12,960','odo replaced Oct'],
        ['R. Cole','WF-01','Westfield','19/11/2026','Interim','Pass','28,410',''],
        ['A. Shah','NV-09','North depot (Ridgeway)','20/11/2026','Interim','Deferred - parts on order','37,350','wiper motor on order'],
        ['A. Shah','NV-03','Nth Depot','24/11/2026','Annual','Pass','53,002',''],
        ['R. Cole','HB-02','Harbour Store','2026-11-24','Annual','Pass (advisory: tyres)','21,880',''],
        ['A. Shah','NV-07','North Depot','25/11/2026','Interim','Pass','45,600',''],
        ['R. Cole','WF-03','Westfield','26/11/2026','Annual','Pass','31,005',''],
        ['A. Shah','NV-10','NORTH','27/11/2026','Annual','Pass','47,880',''],
        ['TOTAL','','','','','23 visits','','']
      ]
    }
  },

  /* the recipe as Ade saved it on 3 Nov. op names are the engine's; words are built from them */
  recipe: {
    id: 'R-0007', name: 'Kestrel monthly visits', owner: 'p1', saved: '3 Nov 2026, 10:42', version: 1, runs: 1,
    steps: [
      { id: 's1',  op: 'skipTop', n: 2 },
      { id: 's2',  op: 'header', line: 3 },
      { id: 's3',  op: 'total', first: 'TOTAL' },
      { id: 's4',  op: 'blank' },
      { id: 's5',  op: 'copies' },
      { id: 's6',  op: 'van', col: ['Reg'], example: ['nv 03', 'NV-03'], unreadable: 'aside', by: 'example' },
      { id: 's7',  op: 'date', col: ['Date'], order: 'day first', year: 2026, example: ['3 Oct', '3 Oct 2026'], by: 'example' },
      { id: 's8',  op: 'group', col: ['Depot'], near: true, by: 'confirmed',
        groups: [
          { to: 'S-N', from: ['North Depot', 'Nth Depot', 'North depot (Ridgeway)', 'NORTH', 'Ridgeway North'] },
          { to: 'S-W', from: ['Westfield', 'W’field', 'Westfield Depot'] },
          { to: 'S-H', from: ['Harbour Store', 'Harbor store'] }
        ] },
      { id: 's9',  op: 'result', col: ['Result'], example: ['Pass - advisory: tyres', 'passed with advisory · tyres'], by: 'example' },
      { id: 's10', op: 'miles', col: ['Odometer'], unreadable: 'value', by: 'example', example: ['12400 mi', '12,400'] },
      { id: 's11', op: 'match', col: ['Reg'], kind: 'van', newOk: true },
      { id: 's12', op: 'map', kind: 'inspection',
        cols: { Reg: 'van', Depot: 'depot', Date: 'on', Result: 'result', Odometer: 'odometer', Notes: 'note', Type: 'asked' },
        firm: true }
    ]
  },
  /* Ade's other saved recipes, for the December home view; each ran on its file's arrival and stopped at the pass */
  otherRuns: [
    { recipe: 'Fuel card statement', from: 'Fuelwise', file: 'ridgeway_fuel_2026-11.csv', arrived: '1 Dec 2026, 06:02', land: 212, aside: 0, kind: 'fuel purchase', lines: 12 },
    { recipe: 'Tyre fitting log', from: 'Roadgrip Tyres', file: 'Roadgrip fittings Nov.xlsx', arrived: '28 Nov 2026, 16:40', land: 9, aside: 1, kind: 'tyre fitting', lines: 9 }
  ],
  /* later answers to October's tray, with who and how (a visible repair on the record) */
  trayAnswers: [
    { line: 9, van: 'NV-06', detail: 'odometer', value: 12010, how: 'typed from the workshop job card JC-5512, read when the new odometer was fitted', by: 'p1', at: '6 Nov 2026, 14:02', triage: 'T-0601' },
    { line: 23, how: 'Mo Ridley replied: a hire van, not on our fleet; not a visit we keep', by: 'p1', at: '5 Nov 2026, 09:31', drop: true }
  ],
  /* what Priya says at Triage when she holds the new van */
  triageHold: { by: 'p2', what: 'new', note: 'Is WF-09 on the fleet list yet? Holding it until Dana confirms the lease.', at: '3 Nov 2026, 11:20' },
  /* the two answers Ade gives in December (next month's file) */
  december: {
    today: '2 Dec 2026',
    rename: { from: 'Reg', to: 'Vehicle' },
    newWord: { value: 'Deferred - parts on order', choice: 'aside', ask: 'deferred', decides: 'p5' },
    newCol: { name: 'Technician', choice: 'leave' }
  }
};
