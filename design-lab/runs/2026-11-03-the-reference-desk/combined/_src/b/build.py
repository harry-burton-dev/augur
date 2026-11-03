# Builds designer b's two combined screens from one shared sample deployment.
#   v3-when-the-answer-is-i-dont-know.html  (a partial count, its gaps and their errands)
#   v4-more-like-this-one.html              (ask by example from a contract)
# 1. Makes the sample (fixed, no randomness) as one DATA object.
# 2. Inlines DATA, common.css and common.js into each *.src.html.
# Run: python3 combined/_src/b/build.py   (from anywhere)
import json, os

HERE = os.path.dirname(os.path.abspath(__file__))
OUT = os.path.normpath(os.path.join(HERE, '..', '..'))

# ---------------------------------------------------------------- people and floors
people = {
    'rosa': {'n': 'Rosa Lind', 'role': 'Facilities operator', 'floor': 'dept'},
    'priya': {'n': 'Priya Shah', 'role': 'Contracts lead', 'floor': 'dept'},
    'marcus': {'n': 'Marcus Bell', 'role': 'Contract manager', 'floor': 'dept'},
    'lena': {'n': 'Lena Novak', 'role': 'Contract manager', 'floor': 'dept'},
    'dev': {'n': 'Dev Okafor', 'role': 'Finance team lead', 'floor': 'finance'},
    'ola': {'n': 'Ola Brennan', 'role': 'Data Atlas admin', 'floor': 'org'},
}
floors = {
    'org': {'n': 'Halden Regional Services', 'word': 'Org'},
    'dept': {'n': 'Facilities', 'word': 'Department'},
    'finance': {'n': 'Finance', 'word': 'Team'},
}

# ---------------------------------------------------------------- suppliers (the count question)
# st: ok (the record answers), none (a person checked: nothing), gap (not known yet),
# stale (out of date), norecord (the window was lost), na (doesn't apply), hidden (not yours to see)
names = {
 'ok_heard': [
  ('Kestrel Cleaning', '2026-10-21', 'invoice', 'marcus'), ('Brightside Services', '2026-09-30', 'meeting note', 'marcus'),
  ('Corvane Facilities', '2026-10-28', 'invoice', 'priya'), ('Ridge Roofing', '2026-08-12', 'call log', 'lena'),
  ('Harrow Electrical', '2026-10-02', 'invoice', 'lena'), ('Greenbin Recycling', '2026-10-30', 'invoice', 'priya'),
  ('Northgate Haulage', '2026-07-19', 'invoice', 'priya'), ('Meadow Grounds', '2026-09-04', 'meeting note', 'lena'),
  ('Greenway Landscapes', '2026-06-22', 'invoice', 'lena'), ('Linden Security', '2026-10-15', 'call log', 'marcus'),
  ('Fairhaven Catering', '2026-10-09', 'invoice', 'marcus'), ('Vale Water', '2026-10-01', 'invoice', 'priya'),
  ('Southern Power', '2026-10-01', 'invoice', 'priya'), ('Belmont Lifts', '2026-05-18', 'meeting note', 'lena'),
  ('Calder Glazing', '2026-04-03', 'invoice', 'lena'), ('Elstow Pest Control', '2026-09-11', 'call log', 'marcus'),
  ('Fernhill Hygiene', '2026-08-27', 'invoice', 'marcus'), ('Glenrock Fire', '2026-07-07', 'meeting note', 'marcus'),
  ('Hartwell Locks', '2026-03-24', 'invoice', 'marcus'), ('Juniper Washrooms', '2026-06-05', 'invoice', 'marcus'),
  ('Kingfisher Gas', '2026-10-01', 'invoice', 'priya'), ('Lowther Skips', '2026-05-29', 'invoice', 'priya')],
 'ok_silent': [
  ('Marlow Gutters', '2026-02-11', 'invoice', 'lena'), ('Netherby Drainage', '2026-01-20', 'meeting note', 'lena'),
  ('Oakridge Trees', '2025-11-14', 'invoice', 'lena'), ('Pennine Gritting', '2026-02-26', 'invoice', 'lena'),
  ('Redwood Signs', '2025-10-03', 'call log', 'marcus'), ('Stanton Vending', '2026-01-08', 'invoice', 'marcus'),
  ('Tamar Clinical Waste', '2026-02-02', 'invoice', 'priya'), ('Wexcombe Paving', '2025-12-09', 'meeting note', 'lena')],
 'none': [('Yarrow Couriers', 'priya'), ('Ambleside Shredding', 'priya')],
 'gap': [('Ashdown Pest Control', 'marcus'), ('Brook Window Care', 'marcus'), ('Cobalt Alarms', 'marcus'),
         ('Drayton Lift Testing', 'lena'), ('Eastfield Mowing', 'lena'),
         ('Foxley Water Coolers', 'priya'), ('Granby Sharps', 'priya')],
 'stale': [('Holloway Scaffolding', '2026-02-17', 'lena', 'May'), ('Ivel Asbestos Survey', '2026-01-30', 'lena', 'May'),
           ('Kelso Deep Clean', '2026-02-09', 'lena', 'June')],
 'norecord': [('Merrow Roof Safety', '2025-12-15', 'lena'), ('Quarry Stone Masons', '2026-01-04', 'lena')],
 'na': [('Ullswater Boilers', '31 Jan'), ('Dunmore Removals', '28 Feb'), ('Ironbridge Rail', '15 Feb'), ('Granite Bins', '31 Jan')],
 'hidden': [('Payroll Bureau',), ('Audit Partners',), ('Card Services',)],
}
S = []
for n, d, via, k in names['ok_heard']:
    S.append({'n': n, 'st': 'ok', 'last': d, 'via': via, 'keeper': k})
for n, d, via, k in names['ok_silent']:
    S.append({'n': n, 'st': 'ok', 'last': d, 'via': via, 'keeper': k, 'silent': True})
for n, k in names['none']:
    S.append({'n': n, 'st': 'none', 'keeper': k, 'by': 'priya', 'on': '12 Oct', 'silent': True})
for n, k in names['gap']:
    S.append({'n': n, 'st': 'gap', 'keeper': k})
for n, d, k, read in names['stale']:
    S.append({'n': n, 'st': 'stale', 'last': d, 'via': 'contractor report', 'keeper': k, 'read': read})
for n, d, k in names['norecord']:
    S.append({'n': n, 'st': 'norecord', 'last': d, 'via': 'depot inbox', 'keeper': k})
for n, ended in names['na']:
    S.append({'n': n, 'st': 'na', 'ended': ended})
for (n,) in names['hidden']:
    S.append({'n': n, 'st': 'hidden', 'floor': 'finance'})

# the model's guesses: pencil, never counted, never saved as fact until a person agrees
guesses = {
    'Ashdown Pest Control': {'v': 'met in June?', 'from': 'Supplier review minutes, Q2', 'why': 'the minutes say “Ashdown Pest” was discussed with “their rep”'},
    'Eastfield Mowing': {'v': 'emailed in August?', 'from': 'Grounds season plan 2026', 'why': 'a line reads “confirmed with Eastfield, Aug”'},
    'Kelso Deep Clean': {'v': 'invoiced in July?', 'from': 'Payments export, July', 'why': 'a payee “Kelso DC Ltd” looks like the same company'},
}
for s in S:
    if s['n'] in guesses:
        s['guess'] = guesses[s['n']]

# what comes back, day by day, after the errands are sent (all facts; who said, and why it moved)
# reason ids are the five reasons a saved answer can move
returns = [
    {'day': '2026-11-03', 'label': 'Tue 3 Nov', 'note': 'Asked. Five errands sent at 10:51.', 'changes': []},
    {'day': '2026-11-04', 'label': 'Wed 4 Nov', 'who': 'marcus', 'note': 'Marcus Bell answered his three questions.', 'changes': [
        {'n': 'Ashdown Pest Control', 'to': 'ok', 'last': '2026-06-17', 'via': 'meeting', 'reason': 'guess', 'fromGuess': True},
        {'n': 'Brook Window Care', 'to': 'ok', 'silent': True, 'last': '2026-01-14', 'via': 'call', 'reason': 'past'},
        {'n': 'Cobalt Alarms', 'to': 'ok', 'last': '2026-09-12', 'via': 'call', 'reason': 'past'}]},
    {'day': '2026-11-05', 'label': 'Thu 5 Nov', 'who': 'priya', 'note': 'Priya Shah answered her two.', 'changes': [
        {'n': 'Foxley Water Coolers', 'to': 'none', 'silent': True, 'reason': 'past'},
        {'n': 'Granby Sharps', 'to': 'ok', 'last': '2026-10-02', 'via': 'invoice', 'reason': 'past'}]},
    {'day': '2026-11-06', 'label': 'Fri 6 Nov', 'who': 'lena', 'note': 'Lena Novak re-read the contractor reports and answered one of her two.', 'changes': [
        {'n': 'Holloway Scaffolding', 'to': 'ok', 'last': '2026-09-08', 'via': 'contractor report', 'reason': 'past'},
        {'n': 'Ivel Asbestos Survey', 'to': 'ok', 'silent': True, 'last': '2026-01-30', 'via': 'contractor report', 'reason': 'past'},
        {'n': 'Kelso Deep Clean', 'to': 'ok', 'last': '2026-07-22', 'via': 'invoice', 'reason': 'guess', 'fromGuess': True},
        {'n': 'Drayton Lift Testing', 'to': 'ok', 'last': '2026-08-19', 'via': 'site visit', 'reason': 'past'}]},
    {'day': '2026-11-09', 'label': 'Mon 9 Nov', 'who': 'dev', 'note': 'Dev Okafor let this question read Finance’s suppliers.', 'changes': [
        {'n': 'Payroll Bureau', 'to': 'ok', 'last': '2026-10-26', 'via': 'invoice', 'reason': 'access'},
        {'n': 'Audit Partners', 'to': 'ok', 'silent': True, 'last': '2026-02-04', 'via': 'meeting note', 'reason': 'access'},
        {'n': 'Card Services', 'to': 'ok', 'last': '2026-10-12', 'via': 'invoice', 'reason': 'access'}]},
    {'day': '2026-11-12', 'label': 'Thu 12 Nov', 'who': 'ola', 'note': 'Ola Brennan took the Mandate ask: “Keep supplier emails as contact”, due 31 Jan. No count moves until it lands.', 'changes': [], 'mandate': True},
]

reasons5 = {
    'happened': 'something happened',
    'past': 'we learned about the past',
    'access': 'different access',
    'guess': 'a guess was settled',
    'word': 'a word changed meaning',
}

# ---------------------------------------------------------------- contracts (the example question)
# svc: what the contract is for; sub: which kind of waste; area: where; value: £k a year; ends: end date
# words: "in their own words" (the scope line) - only the model gateway reads it for meaning
# meaning: how close the model thinks those words are to the example's (a guess, 0..1)
contracts = [
 {'id': 'C-114', 'sup': 'Northgate Haulage', 'svc': 'waste', 'sub': 'general', 'area': 'North', 'value': 140, 'ends': '2026-11-30', 'words': 'Bin and skip collection from the northern depots', 'meaning': 1, 'keeper': 'priya'},
 {'id': 'C-207', 'sup': 'Lowther Skips', 'svc': 'waste', 'sub': 'general', 'area': 'North', 'value': 38, 'ends': '2026-12-31', 'words': 'Skip hire for depot clear-outs', 'meaning': .78, 'keeper': 'priya'},
 {'id': 'C-150', 'sup': 'Greenbin Recycling', 'svc': 'waste', 'sub': 'recycling', 'area': 'North', 'value': 210, 'ends': '2026-12-20', 'words': 'Recycling collection and sorting, northern sites', 'meaning': .86, 'keeper': 'priya'},
 {'id': 'C-131', 'sup': 'Tamar Clinical Waste', 'svc': 'waste', 'sub': 'clinical', 'area': 'North', 'value': 160, 'ends': '2026-12-15', 'words': 'Clinical waste from the care homes', 'meaning': .55, 'keeper': 'priya'},
 {'id': 'C-142', 'sup': 'Granby Sharps', 'svc': 'waste', 'sub': 'clinical', 'area': 'North', 'value': 22, 'ends': '2026-12-31', 'words': 'Sharps bins collected from clinics', 'meaning': .5, 'keeper': 'priya'},
 {'id': 'C-198', 'sup': 'Northgate Haulage', 'svc': 'waste', 'sub': 'general', 'area': 'North', 'value': 58, 'ends': None, 'words': 'Bulky waste collection on request', 'meaning': .8, 'keeper': 'priya'},
 {'id': 'C-163', 'sup': 'Ambleside Shredding', 'svc': 'waste', 'sub': 'paper', 'area': 'North', 'value': 18, 'ends': '2027-03-31', 'words': 'Confidential paper shredding', 'meaning': .4, 'keeper': 'priya'},
 {'id': 'C-171', 'sup': 'Northgate Haulage', 'svc': 'waste', 'sub': 'general', 'area': 'North', 'value': 126, 'ends': '2027-02-28', 'words': 'Bin and skip collection, Upton and Kelby sites', 'meaning': .93, 'keeper': 'priya'},
 {'id': 'C-119', 'sup': 'Granite Bins', 'svc': 'waste', 'sub': 'general', 'area': 'North', 'value': 95, 'ends': '2026-01-31', 'words': 'Wheelie bin emptying, north estates', 'meaning': .84, 'keeper': 'priya'},
 {'id': 'C-122', 'sup': 'Lowther Skips', 'svc': 'waste', 'sub': 'general', 'area': 'East', 'value': 64, 'ends': '2026-11-15', 'words': 'Skip hire, eastern depots', 'meaning': .8, 'keeper': 'priya'},
 {'id': 'C-176', 'sup': 'Greenbin Recycling', 'svc': 'waste', 'sub': 'recycling', 'area': 'South', 'value': 120, 'ends': '2026-12-31', 'words': 'Recycling collection, southern sites', 'meaning': .82, 'keeper': 'priya'},
 {'id': 'C-188', 'sup': 'Eastfield Mowing', 'svc': 'grounds', 'sub': None, 'area': 'North', 'value': 44, 'ends': '2026-12-31', 'words': 'Grass cuttings and green waste taken away', 'meaning': .82, 'keeper': 'lena'},
 {'id': 'C-138', 'sup': 'Fernhill Hygiene', 'svc': 'cleaning', 'sub': None, 'area': 'North', 'value': 28, 'ends': '2026-12-31', 'words': 'Sanitary bins emptied and replaced', 'meaning': .74, 'keeper': 'marcus'},
 {'id': 'C-190', 'sup': 'Meadow Grounds', 'svc': 'grounds', 'sub': None, 'area': 'North', 'value': 120, 'ends': '2026-12-31', 'words': 'Grounds maintenance at depots and homes', 'meaning': .3, 'keeper': 'lena'},
 {'id': 'C-125', 'sup': 'Pennine Gritting', 'svc': 'grounds', 'sub': None, 'area': 'North', 'value': 52, 'ends': '2027-03-31', 'words': 'Winter gritting of yards and paths', 'meaning': .12, 'keeper': 'lena'},
 {'id': 'C-133', 'sup': 'Kestrel Cleaning', 'svc': 'cleaning', 'sub': None, 'area': 'North', 'value': 75, 'ends': '2026-12-31', 'words': 'Office and depot cleaning', 'meaning': .22, 'keeper': 'marcus'},
 {'id': 'C-145', 'sup': 'Corvane Facilities', 'svc': 'repairs', 'sub': None, 'area': 'North', 'value': 300, 'ends': '2027-06-30', 'words': 'Planned and reactive repairs', 'meaning': .05, 'keeper': 'priya'},
 {'id': 'C-148', 'sup': 'Harrow Electrical', 'svc': 'repairs', 'sub': None, 'area': 'South', 'value': 90, 'ends': '2026-12-31', 'words': 'Electrical testing and repairs', 'meaning': .03, 'keeper': 'lena'},
 {'id': 'C-153', 'sup': 'Linden Security', 'svc': 'security', 'sub': None, 'area': 'North', 'value': 110, 'ends': '2027-01-31', 'words': 'Guarding and alarm response', 'meaning': .04, 'keeper': 'marcus'},
 {'id': 'C-157', 'sup': 'Fairhaven Catering', 'svc': 'catering', 'sub': None, 'area': 'East', 'value': 75, 'ends': '2026-12-31', 'words': 'Canteen and event catering', 'meaning': .06, 'keeper': 'marcus'},
 {'id': 'C-166', 'sup': 'Belmont Lifts', 'svc': 'repairs', 'sub': None, 'area': 'West', 'value': 60, 'ends': '2026-11-30', 'words': 'Lift servicing', 'meaning': .02, 'keeper': 'lena'},
 {'id': 'C-169', 'sup': 'Juniper Washrooms', 'svc': 'cleaning', 'sub': None, 'area': 'West', 'value': 40, 'ends': '2026-12-31', 'words': 'Washroom supplies and servicing', 'meaning': .35, 'keeper': 'marcus'},
 {'id': 'C-180', 'sup': 'Marlow Gutters', 'svc': 'repairs', 'sub': None, 'area': 'North', 'value': 26, 'ends': '2026-12-31', 'words': 'Gutter clearing', 'meaning': .2, 'keeper': 'lena'},
 {'id': 'C-160', 'sup': 'Vale Water', 'svc': 'utilities', 'sub': None, 'area': 'North', 'value': 400, 'ends': '2028-03-31', 'words': 'Water supply and sewerage', 'meaning': .1, 'keeper': 'priya'},
]

DATA = {
    'app': 'Data Atlas',
    'today': '2026-11-03',
    'askedAt': 'Tue 3 Nov, 10:42',
    'me': 'rosa',
    'here': 'dept',
    'floors': floors,
    'people': people,
    'gateway': {'on': True, 'admin': 'ola', 'callsLeft': 412,
                'offWhy': 'The model gateway is off on this deployment. Ola Brennan, Data Atlas admin, can turn it on in Admin.'},
    'reasons5': reasons5,
    'empties': {
        'ok': {'plain': 'answered', 'line': 'The record answers it.'},
        'gap': {'plain': 'not known yet', 'line': 'Nobody has recorded it. Someone could.'},
        'none': {'plain': 'none', 'line': 'A person checked: there is nothing.'},
        'na': {'plain': 'doesn’t apply', 'line': 'The question doesn’t fit this one.'},
        'stale': {'plain': 'out of date', 'line': 'Recorded, but read too long ago to trust.'},
        'norecord': {'plain': 'no record', 'line': 'The time it would need was lost. Nobody can close this.'},
        'hidden': {'plain': 'not yours to see', 'line': 'Kept on a floor you can’t open.'},
        'noplace': {'plain': 'no place for it', 'line': 'Data Atlas has no detail an answer would need.'},
    },
    # ---- question 1: a count the data can only partly answer
    'q1': {
        'id': 'Q-231',
        'words': 'Which suppliers have we not heard from since spring?',
        'read': 'Suppliers with a live contract on Facilities and above, with no contact recorded since 1 March 2026.',
        'tech': 'Supplier ⟶ hasContract(status=live) · max(contact.date) < 2026-03-01 · floors: dept, org · template answer.partial/v1',
        'since': '1 March 2026', 'sinceWhy': 'spring, as the seasons count it (deployment calendar)',
        'heardKinds': 'an invoice, a meeting note or a logged call',
        'noPlace': {'what': 'an email', 'detail': 'last emailed', 'why': 'Data Atlas has no place for an email to or from a supplier, so “heard from” can’t include one.',
                    'to': 'ola', 'gain': 'every question about contact, from the day it is kept'},
        'hiddenFloor': 'finance', 'hiddenAsk': 'dev',
        'suppliers': S,
        'returns': returns,
        'lost': 'the depot inbox for January to April was lost when it moved',
    },
    # ---- question 2: ask by example
    'q2': {
        'id': 'Q-232',
        'kind': {'one': 'contract', 'many': 'contracts', 'tech': 'hrs:Contract'},
        'example': 'C-114',
        'counter': 'C-131',
        'contracts': contracts,
        'hiddenSome': {'floor': 'finance', 'what': 'contracts paid only by Finance', 'ask': 'dev'},
        'details': {
            'svc':   {'label': 'what it’s for', 'tech': 'hrs:serviceCategory'},
            'sub':   {'label': 'kind of waste', 'tech': 'hrs:wasteStream'},
            'area':  {'label': 'where', 'tech': 'hrs:servesArea → Area'},
            'ends':  {'label': 'ends', 'tech': 'hrs:endDate'},
            'value': {'label': 'worth a year', 'tech': 'hrs:annualValue (GBP)'},
            'sup':   {'label': 'with', 'tech': 'hrs:supplier → Supplier'},
            'words': {'label': 'in their own words', 'tech': 'rdfs:comment · pgvector cosine (model gateway)'},
        },
        # a week later: the example itself changes (a variation extends it)
        'later': {'day': 'Tue 10 Nov', 'ends': '2027-03-31', 'who': 'priya', 'what': 'a contract variation extended C-114 to 31 Mar 2027', 'reason': 'happened'},
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
