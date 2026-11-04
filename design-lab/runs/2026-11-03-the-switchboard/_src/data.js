/* Sample data: one week of one team's notices. Every name, label, count, time and
   rule below is deployment data. Nothing in the markup or scripts repeats any of it:
   routes, holds, receipts and escalations are worked out by lib.js from these rules. */
const DATA = {
  org: 'Westbrook District Council',
  me: 'p1',
  today: 'Tue 3 Nov 2026',
  week: { label: 'Week of 26 October 2026', days: ['Mon 26 Oct', 'Tue 27 Oct', 'Wed 28 Oct', 'Thu 29 Oct', 'Fri 30 Oct', 'Sat 31 Oct', 'Sun 1 Nov'], next: 'Mon 2 Nov' },
  floors: {
    org:        { name: 'Westbrook District Council', word: 'Org' },
    department: { name: 'Housing and Estates',        word: 'Department' },
    team:       { name: 'Estates repairs',            word: 'Team' }
  },
  teams: {
    repairs: { name: 'Estates repairs', floor: 'team', lead: 'p2', members: ['p1', 'p2', 'p3', 'p4', 'p5'], teamNotices: { on: true, by: 'p2', since: '12 Oct' } },
    department: { name: 'Housing and Estates', floor: 'department', lead: 'p6', members: ['p1', 'p2', 'p3', 'p4', 'p5', 'p6', 'p8', 'p9'], teamNotices: { on: true, by: 'p6', since: '1 Sep' } },
    planned: { name: 'Planned works',   floor: 'team', lead: 'p9', members: ['p9'], teamNotices: { on: false } }
  },
  /* hours: working days (0 = Mon) and the hours AUGUR may reach the person live.
     Outside them is quiet. digest: when the morning edition is made for them. */
  people: {
    p1: { name: 'Ana Ruiz',       role: 'Repairs coordinator',          floor: 'team',       team: 'repairs', hours: { days: [0, 1, 2, 3, 4], from: '08:00', to: '17:30' }, digest: '08:00', toasts: ['needs'], muted: [], letThrough: [], email: { digest: false, urgent: true } },
    p2: { name: 'Tom Ashby',      role: 'Team lead, Estates repairs',   floor: 'team',       team: 'repairs', hours: { days: [0, 1, 2, 3, 4], from: '08:30', to: '17:00' }, digest: '08:30', toasts: [], muted: ['artifacts'], letThrough: ['p6'], email: { digest: true, urgent: true } },
    p3: { name: 'Leila Haddad',   role: 'Surveyor',                     floor: 'team',       team: 'repairs', hours: { days: [0, 1, 2, 3, 4], from: '07:30', to: '16:00' }, digest: '07:30', toasts: [], muted: [], letThrough: [], email: { digest: false, urgent: true } },
    p4: { name: 'Owen Price',     role: 'Surveyor',                     floor: 'team',       team: 'repairs', hours: { days: [0, 1, 2, 3, 4], from: '08:00', to: '17:30' }, digest: '08:00', toasts: [], muted: [], letThrough: [],
          away: { from: 'Wed 00:00', to: 'next Mon 00:00', cover: 'p3', coverAccepted: 'Tue 17:12', note: 'Annual leave', set: 'Tue 17:05' }, email: { digest: false, urgent: false } },
    p5: { name: 'Mei Lin',        role: 'Scheduler (Mon to Thu)',       floor: 'team',       team: 'repairs', hours: { days: [0, 1, 2, 3], from: '09:00', to: '15:00' }, digest: '09:00', toasts: [], muted: ['atlas'], letThrough: [], email: { digest: false, urgent: false } },
    p6: { name: 'Dana Whitfield', role: 'Head of Housing and Estates',  floor: 'department', hours: { days: [0, 1, 2, 3, 4], from: '08:00', to: '18:00' }, digest: '08:00', toasts: [], muted: [], letThrough: [], email: { digest: true, urgent: true }, admin: 'department', roles: ['admin'] },
    p7: { name: 'Sam Okafor',     role: 'Deployment admin',             floor: 'org',        hours: { days: [0, 1, 2, 3, 4], from: '08:00', to: '17:30' }, digest: '08:00', toasts: ['needs', 'failed'], muted: [], letThrough: [], email: { digest: false, urgent: true }, roles: ['deployment-admin', 'admin'] },
    p8: { name: 'Rui Costa',      role: 'Owner of Repairs tracker',     floor: 'department', hours: { days: [0, 1, 2, 3, 4], from: '09:00', to: '17:30' }, digest: '09:00', toasts: [], muted: [], letThrough: [], email: { digest: false, urgent: false } },
    p9: { name: 'Grace Obi',      role: 'Team lead, Planned works',     floor: 'team',       team: 'planned', hours: { days: [0, 1, 2, 3, 4], from: '08:00', to: '17:00' }, digest: '08:00', toasts: [], muted: [], letThrough: [], email: { digest: false, urgent: true } }
  },
  /* apps that send. may = floors where an admin has allowed notifications:send.
     urgent = an urgency budget an admin granted (a proposal in this run; ADR 0044 D3/D4). */
  apps: {
    repairs:   { name: 'Repairs tracker', kind: 'app',      icon: 'wrench',       owner: 'p8', may: { team: true, department: false }, mayWhy: 'Dana Whitfield has not allowed it to send on the Housing and Estates floor (Admin, Apps).', urgent: { perWeek: 2, grantedBy: 'p6', for: 'Emergency repairs reported out of hours' },
                 kinds: { wo: 'Works order approvals', voids: 'Empty-homes list', handover: 'Hand-overs to Planned works', complaint: 'Tenant complaints', report: 'Weekly report', emergency: 'Emergency repairs', '': 'Contractor updates' } },
    artifacts: { name: 'Artifacts',       kind: 'pillar',   icon: 'file-text',    may: { team: true, department: true, org: true } },
    mandate:   { name: 'Mandate',         kind: 'pillar',   icon: 'flag',         may: { team: true, department: true, org: true } },
    atlas:     { name: 'Data Atlas',      kind: 'pillar',   icon: 'waypoints',    may: { team: true, department: true, org: true } },
    upgrades:  { name: 'Upgrade Centre',  kind: 'platform', icon: 'package-check', may: { global: true } }
  },
  /* the team's on-call rota, one person a day; the weekend person is reached only by urgent */
  rota: { name: 'Repairs on call', team: 'repairs', setBy: 'p2', handover: '08:00', byDay: ['p3', 'p3', 'p1', 'p1', 'p2', 'p2', 'p2'] },
  /* escalation policy for "needs" on the team, set by its lead. wait = working minutes */
  policy: {
    name: 'Estates repairs, needs', setBy: 'p2', clock: 'team',
    firstWait: 240,
    steps: [
      { who: 'cover', label: 'their cover, if they are away' },
      { who: 'rota',  label: 'whoever is on call',            wait: 120 },
      { who: 'lead',  label: 'the team lead',                 wait: 480 },
      { who: 'admin', label: 'the Department admin',          wait: null }
    ]
  },
  urgentPolicy: { name: 'Urgent, any floor', setBy: 'deployment', wait: 15, steps: ['rota', 'lead', 'admin'] },
  /* the team clock, for escalation waits */
  teamHours: { days: [0, 1, 2, 3, 4], from: '08:00', to: '17:30' },
  /* proposed limits (control room run asks for rate budgets) */
  limits: { perAppPerHour: 6 },
  /* the relay's sender (ADR 0035); editions and urgent email come from here */
  relay: { from: 'AUGUR at Westbrook District Council', address: 'augur@westbrook.example', readWpm: 200 },
  /* the notices of the week. out = what each person did (opened, took it on, acted).
     Everything else (who, which channel, when, held, escalated) is worked out. */
  notices: [
    { id: 'n01', at: 'Mon 08:05', app: 'atlas',     level: 'failed', title: 'Sync from the housing register failed', floor: 'department', to: { people: ['p1'] }, key: 'sync:hr:1026', out: { p1: { seen: 'Mon 08:10' } } },
    { id: 'n02', at: 'Mon 08:35', app: 'atlas',     level: 'failed', title: 'Sync from the housing register failed', floor: 'department', to: { people: ['p1'] }, key: 'sync:hr:1026' },
    { id: 'n03', at: 'Mon 09:12', app: 'repairs',   level: 'needs',  title: 'Approve works order WO-4471: £6,200 at 14 Alder Row', floor: 'team', to: { people: ['p2'] }, key: 'wo:4471:approve', limit: 'Mon 17:00', out: { p2: { seen: 'Mon 09:40', acted: 'Mon 11:40', act: 'Approved' } } },
    { id: 'n04', at: 'Mon 09:30', app: 'repairs',   level: 'info',   title: 'This week’s empty-homes list is ready', floor: 'department', to: { team: 'department' }, key: 'voids:1026' },
    { id: 'n05', at: 'Mon 10:02', app: 'artifacts', level: 'info',   title: 'Tom Ashby published “Damp and mould procedure v3”', floor: 'team', to: { team: 'repairs', except: 'p2' }, key: 'pub:d214:v3' },
    { id: 'n06', at: 'Mon 11:15', app: 'atlas',     level: 'needs',  title: 'Two sources disagree: the year Kingsway House was built', floor: 'team', to: { people: ['p3'] }, key: 'dispute:f9921', out: { p3: { seen: 'Mon 11:20', acted: 'Mon 14:05', act: 'Settled: 1964' } } },
    { id: 'n07', at: 'Mon 13:40', app: 'repairs',   level: 'done',   title: 'Contractor booked: boiler repair at 22 Elm Street', floor: 'team', to: { people: ['p1'] }, out: { p1: { seen: 'Mon 13:45' } } },
    { id: 'n08', at: 'Mon 14:30', app: 'repairs',   level: 'needs',  title: 'Three planned jobs need a surveyor', floor: 'team', to: { team: 'planned' }, key: 'handover:pw:1026' },
    { id: 'n09', at: 'Mon 16:20', app: 'mandate',   level: 'info',   title: '“Clear the empty-homes backlog by 30 Nov” is behind: 12 of 40', floor: 'department', to: { people: ['p2'] }, key: 'behind:m118:1026' },
    { id: 'n10', at: 'Mon 18:40', app: 'repairs',   level: 'done',   title: 'Contractor finished: 22 Elm Street', floor: 'team', to: { people: ['p1'] }, out: { p1: { seen: 'Tue 08:05' } } },

    { id: 'n11', at: 'Tue 07:10', app: 'upgrades',  level: 'info',   title: 'AUGUR 0.16 is available. Automatic will install it tonight', floor: null, to: { role: ['deployment-admin'] }, key: 'available:augur:0.16.0' },
    { id: 'n12', at: 'Tue 08:40', app: 'artifacts', level: 'needs',  title: 'Brightwater Ltd asks to see “Kingsway House survey”', floor: 'team', to: { people: ['p1'] }, key: 'share:d230:bw', out: { p1: { seen: 'Tue 08:50', acted: 'Tue 09:30', act: 'Declined, with a reason' } } },
    { id: 'n13', at: 'Tue 09:30', app: 'repairs',   level: 'info',   title: 'This week’s empty-homes list is ready', floor: 'department', to: { team: 'department' }, key: 'voids:1027' },
    { id: 'n14', at: 'Tue 10:15', app: 'atlas',     level: 'info',   title: '3 new facts about Kingsway House, from the survey', floor: 'team', to: { people: ['p3', 'p4'] }, key: 'facts:kh:1027' },
    { id: 'n15', at: 'Tue 11:00', app: 'repairs',   level: 'needs',  title: 'Approve works order WO-4479: £8,900 roof at 3 Birch Court', floor: 'team', to: { people: ['p2'] }, key: 'wo:4479:approve', limit: 'Wed 11:00', out: { p2: { seen: 'Tue 11:30', acted: 'Tue 15:10', act: 'Approved' } } },
    { id: 'n16', at: 'Tue 12:30', app: 'mandate',   level: 'needs',  title: 'Sign off the winter damp survey plan', floor: 'team', to: { people: ['p4'] }, key: 'signoff:m131', limit: 'Wed 12:00', story: true,
      out: { p4: { seen: 'Tue 12:45' }, p3: { seen: 'Wed 08:10' }, p1: { seen: 'Wed 12:20', passed: 'Wed 12:25', note: 'Needs a surveyor or Tom. I can’t sign survey plans.' }, p2: { seen: 'Wed 15:40', accepted: 'Thu 09:05', acted: 'Thu 10:30', act: 'Signed off', note: 'I have it. Owen’s draft is fine; signing tomorrow first thing.' } } },
    { id: 'n17', at: 'Tue 14:20', app: 'repairs',   level: 'done',   title: 'Works order WO-4471 sent to Kestrel Building', floor: 'team', to: { people: ['p2'] }, out: { p2: { seen: 'Tue 14:30' } } },
    { id: 'n18', at: 'Tue 16:45', app: 'atlas',     level: 'failed', title: 'Sync from the housing register failed again', floor: 'department', to: { people: ['p1'] }, key: 'sync:hr:1027', out: { p1: { seen: 'Tue 16:50' } } },
    { id: 'n19', at: 'Tue 19:30', app: 'artifacts', level: 'info',   title: 'Leila Haddad commented on “Kingsway House survey”', floor: 'team', to: { people: ['p1', 'p4'] }, key: 'comment:d230:c7' },

    { id: 'n20', at: 'Wed 08:15', app: 'atlas',     level: 'needs',  title: 'Check a proposed fact: Flat 6, Kingsway House has a gas supply', floor: 'team', to: { people: ['p4'] }, key: 'propose:f9930', limit: 'Wed 16:00', out: { p3: { seen: 'Wed 08:20', accepted: 'Wed 08:21', acted: 'Wed 15:20', act: 'Confirmed' } } },
    { id: 'n21', at: 'Wed 09:30', app: 'repairs',   level: 'info',   title: 'This week’s empty-homes list is ready', floor: 'department', to: { team: 'department' }, key: 'voids:1028' },
    { id: 'n22', at: 'Wed 10:40', app: 'repairs',   level: 'needs',  title: 'Approve works order WO-4483: £5,400 damp works at 9 Mill Lane', floor: 'team', to: { people: ['p2'] }, key: 'wo:4483:approve', limit: 'Thu 10:40', out: { p2: { seen: 'Wed 15:40', acted: 'Thu 09:15', act: 'Approved' } } },
    { id: 'n23', at: 'Wed 11:30', app: 'artifacts', level: 'info',   title: 'Ana Ruiz published “Out-of-hours repairs guide v2”', floor: 'team', to: { team: 'repairs', except: 'p1' }, key: 'pub:d240:v2' },
    { id: 'n24', at: 'Wed 13:00', app: 'mandate',   level: 'info',   title: '“Clear the empty-homes backlog by 30 Nov” is behind: 14 of 40', floor: 'department', to: { people: ['p2'] }, key: 'behind:m118:1028' },
    { id: 'n25', at: 'Wed 14:10', app: 'repairs',   level: 'done',   title: 'Contractor booked: survey at 9 Mill Lane', floor: 'team', to: { people: ['p4'] } },
    { id: 'n26', at: 'Wed 16:30', app: 'upgrades',  level: 'done',   title: 'AUGUR 0.16 is installed', floor: null, to: { role: ['deployment-admin', 'admin'] }, key: 'result:upgrade:u88', out: { p7: { seen: 'Wed 16:41' }, p6: { seen: 'Thu 08:12' } } },

    { id: 'n27', at: 'Thu 08:05', app: 'atlas',     level: 'needs',  title: 'The housing register hasn’t synced for 3 days', floor: 'department', to: { people: ['p1'] }, key: 'sync:hr:stuck', limit: 'Thu 12:05', out: { p1: { seen: 'Thu 08:09', acted: 'Thu 11:00', act: 'Fixed: the sync password was renewed' } } },
    { id: 'n28', at: 'Thu 09:30', app: 'repairs',   level: 'info',   title: 'This week’s empty-homes list is ready', floor: 'department', to: { team: 'department' }, key: 'voids:1029' },
    { id: 'n29', at: 'Thu 10:20', app: 'repairs',   level: 'needs',  title: 'No heating at 41 Ash Grove for 2 days', floor: 'team', to: { rota: true }, key: 'complaint:c5521', limit: 'Thu 14:20', out: { p1: { seen: 'Thu 10:22', acted: 'Thu 10:50', act: 'Contractor sent' } } },
    { id: 'n30', at: 'Thu 12:00', app: 'mandate',   level: 'needs',  title: '“Quarterly gas safety returns” is past its deadline', floor: 'team', to: { people: ['p2'] }, key: 'late:m102', limit: 'Thu 16:00',
      out: { p2: { seen: 'Thu 12:10' }, p1: { seen: 'Thu 16:04' }, p6: { seen: 'Fri 08:40', accepted: 'Fri 09:10', acted: 'Fri 11:30', act: 'New deadline 13 Nov, agreed with the gas contractor', note: 'Taking this: Tom is on the Kingsway lift all week.' } } },
    { id: 'n31', at: 'Thu 15:30', app: 'artifacts', level: 'info',   title: '“Damp and mould procedure v3” has been read by 4 of 5', floor: 'team', to: { people: ['p2'] }, key: 'reads:d214:v3' },
    { id: 'n32', at: 'Thu 18:10', app: 'repairs',   level: 'done',   title: 'Heating restored at 41 Ash Grove', floor: 'team', to: { people: ['p1'] }, out: { p1: { seen: 'Fri 08:02' } } },
    { id: 'n33', at: 'Thu 21:30', app: 'atlas',     level: 'info',   title: 'Nightly check: 2 facts about Birch Court went stale', floor: 'team', to: { people: ['p3'] }, key: 'stale:1029' },

    { id: 'n34', at: 'Fri 09:30', app: 'repairs',   level: 'info',   title: 'This week’s empty-homes list is ready', floor: 'department', to: { team: 'department' }, key: 'voids:1030' },
    { id: 'n35', at: 'Fri 10:00', app: 'repairs',   level: 'needs',  title: 'Approve works order WO-4490: £12,300 lift repair at Kingsway House', floor: 'team', to: { people: ['p2'] }, key: 'wo:4490:approve', limit: 'Fri 14:00', out: { p2: { seen: 'Fri 10:30', acted: 'Fri 13:20', act: 'Approved' } } },
    { id: 'n36', at: 'Fri 11:45', app: 'mandate',   level: 'needs',  title: 'Agree next week’s empty-home inspections', floor: 'team', to: { people: ['p5'] }, key: 'plan:m140' },
    { id: 'n37', at: 'Fri 14:30', app: 'artifacts', level: 'needs',  title: 'Review “Out-of-hours repairs guide v2” before it goes to the Department library', floor: 'team', to: { people: ['p2'] }, key: 'review:d240:v2', out: { p2: { seen: 'Fri 14:40', acted: 'Fri 16:10', act: 'Approved for the Department library' } } },
    { id: 'n38', at: 'Fri 16:55', app: 'repairs',   level: 'done',   title: 'This week’s repairs report is ready', floor: 'team', to: { team: 'repairs' }, key: 'report:wk44', out: { p1: { seen: 'Fri 17:01' } } },

    { id: 'n39', at: 'Sat 02:14', app: 'repairs',   level: 'needs',  urgent: true, title: 'Emergency repair: water coming through the ceiling at Flat 6, Kingsway House', floor: 'team', to: { rota: true }, key: 'emergency:c5560', out: { p2: { seen: 'Sat 02:31', accepted: 'Sat 02:31', acted: 'Sat 02:50', act: 'Contractor on the way; tenant told' } } },
    { id: 'n40', at: 'Sat 10:00', app: 'atlas',     level: 'info',   title: 'Weekend check: no facts went stale', floor: 'team', to: { people: ['p3'] }, key: 'stale:1031' },
    { id: 'n41', at: 'Sun 23:10', app: 'upgrades',  level: 'needs',  urgent: true, title: 'The publisher halted AUGUR 0.16, which this server runs', floor: null, to: { role: ['deployment-admin'] }, key: 'halted:augur:0.16.0' }
  ]
};
