# Builds the six "when the data can't answer" prototypes.
# 1. Makes the sample deployment (fixed, no randomness) as one DATA object.
# 2. Inlines DATA, common.css and common.js into each vN.src.html.
# Run: python3 _src/build.py   (from anywhere)
import json, os

HERE = os.path.dirname(os.path.abspath(__file__))
OUT = os.path.normpath(os.path.join(HERE, '..'))

# ---- people: who keeps what, who could fill a gap, whom to ask ----
people = {
    'priya': {'n': 'Priya Shah', 'role': 'Contracts lead', 'floor': 'dept'},
    'marcus': {'n': 'Marcus Bell', 'role': 'Contract manager', 'floor': 'dept'},
    'lena': {'n': 'Lena Novak', 'role': 'Contract manager', 'floor': 'dept'},
    'dev': {'n': 'Dev Okafor', 'role': 'Finance team lead', 'floor': 'finance'},
    'sam': {'n': 'Sam Achebe', 'role': 'Fleet coordinator', 'floor': 'fleet'},
    'joy': {'n': 'Joy Mensah', 'role': 'Home manager', 'floor': 'upton'},
    'ola': {'n': 'Ola Brennan', 'role': 'Data Atlas admin', 'floor': 'org'},
    'tom': {'n': 'Tom Reyes', 'role': 'Head of Procurement', 'floor': 'dept'},
}
floors = {
    'org': {'n': 'Halden Regional Services', 'tier': 'org', 'word': 'Org'},
    'dept': {'n': 'Facilities', 'tier': 'department', 'word': 'Department'},
    'finance': {'n': 'Finance', 'tier': 'team', 'word': 'Team'},
    'fleet': {'n': 'Fleet', 'tier': 'team', 'word': 'Team'},
    'upton': {'n': 'Upton care home', 'tier': 'team', 'word': 'Team'},
}

# ---- suppliers: one row each, state = how the question's answer stands for it ----
# ok: the record answers (last contact known). none: someone checked, no contact.
# gap: contact not recorded anywhere (not known yet). stale: last read too long ago.
# norecord: the window the answer needs was lost. na: contract ended before the date.
# hidden: kept on a floor you can't open (counted as "some").
names = {
 'ok_heard': [
  ('Kestrel Cleaning', 'Cleaning', '2026-10-21', 'invoice', 'marcus'),
  ('Brightside Services', 'Cleaning', '2026-09-30', 'meeting note', 'marcus'),
  ('Corvane Facilities', 'Repairs', '2026-10-28', 'invoice', 'priya'),
  ('Ridge Roofing', 'Repairs', '2026-08-12', 'call log', 'lena'),
  ('Harrow Electrical', 'Repairs', '2026-10-02', 'invoice', 'lena'),
  ('Greenbin Recycling', 'Waste', '2026-10-30', 'invoice', 'priya'),
  ('Northgate Haulage', 'Waste', '2026-07-19', 'invoice', 'priya'),
  ('Meadow Grounds', 'Grounds', '2026-09-04', 'meeting note', 'lena'),
  ('Greenway Landscapes', 'Grounds', '2026-06-22', 'invoice', 'lena'),
  ('Linden Security', 'Security', '2026-10-15', 'call log', 'marcus'),
  ('Fairhaven Catering', 'Catering', '2026-10-09', 'invoice', 'marcus'),
  ('Vale Water', 'Utilities', '2026-10-01', 'invoice', 'priya'),
  ('Southern Power', 'Utilities', '2026-10-01', 'invoice', 'priya'),
  ('Belmont Lifts', 'Repairs', '2026-05-18', 'meeting note', 'lena'),
  ('Calder Glazing', 'Repairs', '2026-04-03', 'invoice', 'lena'),
  ('Elstow Pest Control', 'Grounds', '2026-09-11', 'call log', 'marcus'),
  ('Fernhill Hygiene', 'Cleaning', '2026-08-27', 'invoice', 'marcus'),
  ('Glenrock Fire', 'Security', '2026-07-07', 'meeting note', 'marcus'),
  ('Hartwell Locks', 'Security', '2026-03-24', 'invoice', 'marcus'),
  ('Juniper Washrooms', 'Cleaning', '2026-06-05', 'invoice', 'marcus'),
  ('Kingfisher Gas', 'Utilities', '2026-10-01', 'invoice', 'priya'),
  ('Lowther Skips', 'Waste', '2026-05-29', 'invoice', 'priya')],
 'ok_silent': [
  ('Marlow Gutters', 'Repairs', '2026-02-11', 'invoice', 'lena'),
  ('Netherby Drainage', 'Repairs', '2026-01-20', 'meeting note', 'lena'),
  ('Oakridge Trees', 'Grounds', '2025-11-14', 'invoice', 'lena'),
  ('Pennine Gritting', 'Grounds', '2026-02-26', 'invoice', 'lena'),
  ('Redwood Signs', 'Repairs', '2025-10-03', 'call log', 'marcus'),
  ('Stanton Vending', 'Catering', '2026-01-08', 'invoice', 'marcus'),
  ('Tamar Clinical Waste', 'Waste', '2026-02-02', 'invoice', 'priya'),
  ('Wexcombe Paving', 'Repairs', '2025-12-09', 'meeting note', 'lena')],
 'none': [
  ('Yarrow Couriers', 'Waste', 'priya', '12 Oct'),
  ('Ambleside Shredding', 'Waste', 'priya', '12 Oct')],
 'gap': [
  ('Ashdown Pest Control', 'Grounds', 'marcus'),
  ('Brook Window Care', 'Cleaning', 'marcus'),
  ('Cobalt Alarms', 'Security', 'marcus'),
  ('Drayton Lift Testing', 'Repairs', 'lena'),
  ('Eastfield Mowing', 'Grounds', 'lena'),
  ('Foxley Water Coolers', 'Catering', 'priya'),
  ('Granby Sharps', 'Waste', 'priya')],
 'stale': [
  ('Holloway Scaffolding', 'Repairs', '2026-02-17', 'lena', 'May'),
  ('Ivel Asbestos Survey', 'Repairs', '2026-01-30', 'lena', 'May'),
  ('Kelso Deep Clean', 'Cleaning', '2026-02-09', 'marcus', 'June')],
 'norecord': [
  ('Merrow Roof Safety', 'Repairs', '2025-12-15', 'lena'),
  ('Quarry Stone Masons', 'Repairs', '2026-01-04', 'lena')],
 'na': [
  ('Ullswater Boilers', 'Utilities', '31 Jan'),
  ('Dunmore Removals', 'Repairs', '28 Feb'),
  ('Ironbridge Rail', 'Repairs', '15 Feb'),
  ('Granite Bins', 'Waste', '31 Jan')],
 'hidden': [('Payroll Bureau', 'Finance'), ('Audit Partners', 'Finance'), ('Card Services', 'Finance')],
}
S = []
for n, svc, d, via, k in names['ok_heard']:
    S.append({'n': n, 'svc': svc, 'st': 'ok', 'last': d, 'via': via, 'keeper': k})
for n, svc, d, via, k in names['ok_silent']:
    S.append({'n': n, 'svc': svc, 'st': 'ok', 'last': d, 'via': via, 'keeper': k, 'silent': True})
for n, svc, k, when in names['none']:
    S.append({'n': n, 'svc': svc, 'st': 'none', 'keeper': k, 'by': f"{people[k]['n']} checked on {when}: no contact since February", 'silent': True})
for n, svc, k in names['gap']:
    S.append({'n': n, 'svc': svc, 'st': 'gap', 'keeper': k})
for n, svc, d, k, read in names['stale']:
    S.append({'n': n, 'svc': svc, 'st': 'stale', 'last': d, 'via': 'contractor report', 'keeper': k, 'read': read})
for n, svc, d, k in names['norecord']:
    S.append({'n': n, 'svc': svc, 'st': 'norecord', 'last': d, 'via': 'Halden depot inbox', 'keeper': k})
for n, svc, ended in names['na']:
    S.append({'n': n, 'svc': svc, 'st': 'na', 'ended': ended})
for n, svc in names['hidden']:
    S.append({'n': n, 'svc': svc, 'st': 'hidden', 'floor': 'finance'})
# payments: the Org ledger holds one for every live supplier (a different question: paid, not heard from)
paid_cycle = ['2026-09-30', '2026-02-27', '2026-07-31', '2026-10-30', '2026-01-30', '2026-05-29', '2026-08-28']
for i, s in enumerate(S):
    if s['st'] in ('na', 'hidden'):
        continue
    if s['st'] == 'ok' and not s.get('silent'):
        # paid once a year: heard from since spring, but not paid since
        s['paid'] = '2026-02-20' if s['n'] in ('Ridge Roofing', 'Glenrock Fire', 'Elstow Pest Control') else (s['last'] if s['last'] > '2026-03-01' else '2026-06-30')
    else:
        s['paid'] = paid_cycle[i % len(paid_cycle)]
# the model's guesses: pencil, never counted
guesses = {
    'Ashdown Pest Control': {'v': 'met in June', 'from': 'Supplier review minutes, Q2', 'why': 'the minutes say "Ashdown Pest" was discussed with "their rep"'},
    'Eastfield Mowing': {'v': 'emailed in August', 'from': 'Grounds season plan 2026', 'why': 'a line in the plan reads "confirmed with Eastfield, Aug"'},
    'Kelso Deep Clean': {'v': 'invoiced in July', 'from': 'Payments export, July', 'why': 'a payee called "Kelso DC Ltd" looks like the same company'},
}
for s in S:
    if s['n'] in guesses:
        s['guess'] = guesses[s['n']]

DATA = {
    'app': 'Data Atlas',
    'today': '2026-11-03',
    'askedAt': 'Tue 3 Nov, 10:42',
    'me': {'n': 'Rosa Lind', 'role': 'Facilities operator'},
    'here': 'dept',
    'floors': floors,
    'people': people,
    'gateway': {'on': True, 'admin': 'ola',
                'offWhy': 'The model gateway is off on this deployment. Ola Brennan, Data Atlas admin, can turn it on in Admin.'},
    'empties': {
        'ok': {'plain': 'answered', 'line': 'The record answers it.'},
        'gap': {'plain': 'not known yet', 'line': 'Nobody has recorded it. Someone could.'},
        'none': {'plain': 'none', 'line': 'Someone checked: there is nothing.'},
        'na': {'plain': 'doesn’t apply', 'line': 'The question doesn’t fit this one.'},
        'stale': {'plain': 'out of date', 'line': 'Recorded, but read too long ago to trust.'},
        'norecord': {'plain': 'no record', 'line': 'The time it would need was lost. Nobody can close this.'},
        'hidden': {'plain': 'not yours to see', 'line': 'Kept on a floor you can’t open. Ask who keeps it.'},
    },
    # question 1: the suppliers we haven't heard from
    'q1': {
        'words': 'Which suppliers have we not heard from since spring?',
        'read': 'Suppliers with a live contract on Facilities and above, with no contact recorded since 1 March 2026.',
        'tech': 'Supplier ⟶ hasContract(status=live) · max(contact.date) < 2026-03-01 · floors: dept, org',
        'since': {'pick': '1 March 2026', 'why': 'spring, as the seasons count it', 'alt': '1 April 2026', 'altWhy': 'your financial year'},
        'heard': {'kinds': ['invoice', 'meeting note', 'call log'], 'keptBy': 'ola',
                  'modelAdds': 'emails', 'modelWhy': 'Data Atlas doesn’t hold emails, so this can’t count yet'},
        'suppliers': S,
        'kinds': [
            {'id': 'invoice', 'w': 'an invoice from them', 'held': True, 'on': True},
            {'id': 'meeting note', 'w': 'a meeting note', 'held': True, 'on': True},
            {'id': 'call log', 'w': 'a logged call', 'held': True, 'on': True},
            {'id': 'payment', 'w': 'a payment to them', 'held': True, 'on': False, 'note': 'paying isn’t hearing from, but every live supplier has one'},
            {'id': 'email', 'w': 'an email', 'held': False, 'on': False, 'note': 'Data Atlas doesn’t hold emails'},
        ],
        'rephrase': [
            {'words': 'Which suppliers have we not paid since 1 March?', 'kinds': ['payment'], 'why': 'Payments are kept for every live supplier, so this answers in full. It asks about money, not contact.'},
            {'words': 'Which suppliers have we neither heard from nor paid since 1 March?', 'kinds': ['invoice', 'meeting note', 'call log', 'payment'], 'why': 'Gone quiet in every way we keep. Answers in full, and is narrower than yours: a supplier we paid counts as not quiet.'},
        ],
        'fixes': [
            {'id': 'ask', 'st': 'gap', 'title': 'Ask the contract managers', 'kind': 'Triage job',
             'what': 'one short question per supplier: “When did you last hear from them?”', 'gain': 7},
            {'id': 'reread', 'st': 'stale', 'title': 'Read the contractor reports again', 'kind': 'Triage job',
             'what': 'the three reports were last read in May and June; Lena Novak keeps them', 'gain': 3},
            {'id': 'keep', 'st': 'gap', 'title': 'Ask for contact to be kept for every supplier', 'kind': 'Mandate ask',
             'what': 'so the next question like this has no gaps', 'gain': 0, 'to': 'tom'},
            {'id': 'access', 'st': 'hidden', 'title': 'Ask Finance for access', 'kind': 'Share request',
             'what': 'some suppliers are kept on the Finance team floor', 'gain': None, 'to': 'dev'},
        ],
    },
    # question 2: a question nothing in the data can answer
    'q2': {
        'words': 'Which of our vans are due their MOT next month?',
        'read': 'Vehicles of kind “van” kept on Facilities and above, with an MOT due in December 2026.',
        'tech': 'Vehicle(type=van) · motDue ∈ [2026-12-01, 2026-12-31] · motDue: no such detail',
        'vans': 23, 'vansFloor': 'dept',
        'doc': {'n': 'Fleet register 2025.xlsx', 'lib': 'Fleet library', 'date': 'March 2025', 'rows': 19, 'col': 'Notes'},
        'nearest': 4, 'spelled': 2, 'keeper': 'sam', 'admin': 'ola', 'diary': 'MOT diary',
        'reasons': [
            {'st': 'ok', 'on': False, 't': 'Not found', 'say': 'The vans are there: 23 kept on Facilities.'},
            {'st': 'gap', 'on': True, 't': 'No place for it', 'say': 'Vans have no “MOT due” detail in Data Atlas. Nobody has asked for one.'},
            {'st': 'stale', 'on': True, 't': 'Only an old copy', 'say': 'Fleet register 2025.xlsx in the Fleet library mentions MOTs. It is from March 2025.'},
            {'st': 'hidden', 'on': True, 't': 'Kept elsewhere', 'say': 'The Fleet team keeps an MOT diary on its own floor, which you can’t open.'},
            {'st': 'norecord', 'on': False, 't': 'Lost', 'say': 'Nothing the answer needs was lost.'},
            {'st': 'na', 'on': False, 't': 'Doesn’t apply', 'say': 'Every van needs an MOT, so the question fits all 23.'},
        ],
    },
    # question 3: a search that finds nothing
    'q3': {
        'words': 'Has anyone reported damp at Upton care home this year?',
        'read': 'Reports of damp, mould or condensation at Upton care home from 1 January 2026 to today.',
        'tech': 'Observation ⟶ about(Site:upton) · text~"damp" · 2026-01-01..2026-11-03',
        'months': ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov'],
        'places': [
            {'n': 'Incidents', 'where': 'Data Atlas · Facilities', 'cells': 'sssssssssss', 'how': 'keys'},
            {'n': 'Repair requests', 'where': 'Data Atlas · Facilities', 'cells': 'sssssssssss', 'how': 'keys'},
            {'n': 'Inspection notes', 'where': 'Artifacts · Facilities library', 'cells': 'sssssssssss', 'how': 'meaning', 'found': {'5': 'condensation on the east windows'}},
            {'n': 'Corvane monthly reports', 'where': 'Artifacts · Contractor reports', 'cells': 'ssssstttttt', 'how': 'words', 'staleFrom': 'June', 'keeper': 'lena'},
            {'n': 'Depot phone log', 'where': 'Data Atlas · Facilities', 'cells': 'wwwssssssss', 'how': 'keys', 'lost': 'January to March, lost when the inbox moved'},
            {'n': 'Home’s own maintenance log', 'where': 'Upton care home · Team floor', 'cells': 'hhhhhhhhhhh', 'how': '-', 'ask': 'joy'},
            {'n': 'Site survey', 'where': 'Artifacts · Facilities library', 'cells': 'nnnnnnnnsnn', 'how': 'words', 'naWhy': 'done once a year, in September'},
        ],
    },
}

css = open(os.path.join(HERE, 'common.css')).read()
js = open(os.path.join(HERE, 'common.js')).read()
data = 'const DATA = ' + json.dumps(DATA, ensure_ascii=False, indent=1) + ';'
for f in sorted(os.listdir(HERE)):
    if not f.endswith('.src.html'):
        continue
    t = open(os.path.join(HERE, f)).read()
    t = t.replace('/*@COMMON_CSS@*/', css).replace('/*@DATA@*/', data).replace('/*@COMMON_JS@*/', js)
    out = f.replace('.src.html', '.html')
    open(os.path.join(OUT, out), 'w').write(t)
    print('wrote', out)
