# Generates the shared sample data (one JS object) for the facets prototypes.
# Deterministic: same seed, same records. Output: _src/data.js
import random, json, os
R = random.Random(7)
here = os.path.dirname(os.path.abspath(__file__))

regions = ['north','south','east','west','coast']
services = ['water','waste','roads','care','buildings']
states = ['active','review','paused','closed']

N = {
 'site': (22, ['Riverside depot','Hillfoot pumping station','Market Street office','Elm Road yard','Harbour transfer station','Upton care home','Mill Lane works','Station Road library','Kingsmead salt barn','Brook Farm reservoir','Westgate offices','Fenside recycling centre','Bridge Street hub','Cliff Top day centre','Old Quay garage','Larch Hill tower','Greyfriars hall','Northfield landfill','Sandbank outfall','Ashby clinic','Moor End shelter','Copse Lane store']),
 'supplier': (26, ['Northgate Haulage','Pennine Pipe Co','Brightwater Labs','Ashdown Fleet Services','Carver & Lowe','Meridian Care Ltd','Holt Surfacing','Tidewell Marine Works','Greenbin Recycling','Oakfield Facilities','Stonebridge Plant Hire','Avon Valve','Clearway Signs','Kestrel Cleaning','Harrow Electrical','Bluewater Testing','Fairhaven Catering','Linden Security','Ridge Roofing','Portland Aggregates','Meadow Grounds','Saltmarsh Dredging','Vale Transport','Quarry Lane Concrete','Brandt Software','Elmstead Medical']),
}
contract_lots = {'water':['Mains repair','Meter reading','Reservoir inspection','Leak detection','Valve maintenance'],
 'waste':['Kerbside collection','Bulky waste','Recycling haulage','Landfill gas monitoring','Bin supply'],
 'roads':['Gritting','Pothole repair','Resurfacing','Street lighting','Road markings'],
 'care':['Home visits','Day centre meals','Respite beds','Transport to clinics','Night cover'],
 'buildings':['Cleaning','Security','Roof repair','Lift servicing','Grounds']}
people = ['Asha Patel','Tom Reid','Grace Mwangi','Owen Hughes','Lena Novak','Jamal Idris','Freya Lund','Kofi Mensah','Isla Grant','Mateo Ruiz','Nora Byrne','Hugo Lam','Priya Shah','Ben Carter','Yara Haddad','Leo Fitz','Maya Cohen','Sean Doyle']
vehicles = ['Gritter','Refuse truck','Tanker','Minibus','Van','Sweeper','Tipper','Crane lorry']
incidents = ['Burst main','Missed collection','Flooded underpass','Fall at home','Fly-tipping','Power cut','Roof leak','Pothole damage','Sewer odour','Lift failure','Vehicle collision','Lost key fob']
streets = ['Elm Road','Mill Lane','Quay Street','Hill Rise','Fen Way','Kings Road','Brook Close','Castle Walk','Rope Walk','Larch Hill']

recs = []
def add(kind, name, service, state, region, date, reach=0, triage=0, missing=None, used=(0,0)):
    recs.append([len(recs)+1, name, kind, service, state, region, date, reach, triage, used[0], used[1], missing or []])

def ym(y, m): return f'{y}-{m:02d}'
def rdate(lo, hi):
    y = R.randint(lo, hi); return ym(y, R.randint(1,12))

expected = {
 'site':['service','region','last inspected','manager','address'],
 'supplier':['service','region','last reviewed','company number','contact'],
 'contract':['service','region','ends','supplier','value','owner'],
 'person':['service','region','role','line manager'],
 'vehicle':['service','region','next service','registration','base site'],
 'incident':['service','region','happened','reported by','site'],
}
dated = {'site','supplier','contract','vehicle','incident'}

def extra_missing(kind, p=0.18):
    pool = expected[kind][3:]
    return [d for d in pool if R.random() < p]

for nm in N['site'][1]:
    reg = R.choice(regions); sv = R.choice(services)
    d = rdate(2024, 2026) if R.random() > .1 else None
    miss = extra_missing('site') + ([] if d else ['last inspected'])
    add('site', nm, sv, R.choices(states,[6,2,1,1])[0], reg, d, missing=miss, used=(R.randint(0,3), R.randint(0,6)))
for i, nm in enumerate(N['supplier'][1]):
    reg = None if i in (2,7,11,16,20,24) else R.choice(regions)
    sv = R.choice(services); d = rdate(2023, 2026) if R.random() > .15 else None
    miss = extra_missing('supplier') + ([] if reg else ['region']) + ([] if d else ['last reviewed'])
    add('supplier', nm, sv, R.choices(states,[6,2,1,1])[0], reg, d, missing=miss, used=(R.randint(0,2), R.randint(0,5)))
lot_n = {}
for i in range(44):
    sv = services[i % 5]; reg = R.choice(regions)
    lot = R.choice(contract_lots[sv]); lot_n[lot] = lot_n.get(lot, 0) + 1
    d = rdate(2025, 2029)
    if sv == 'roads' and reg == 'coast' and d.startswith('2026'): d = ym(2027, R.randint(1,12))
    if i in (9, 31): d = None
    st = 'closed' if d and d < '2026-01' else R.choices(states,[6,2,1,0])[0]
    miss = extra_missing('contract', .15) + ([] if d else ['ends'])
    add('contract', f'{lot} · lot {lot_n[lot]}', sv, st, reg, d, missing=miss, used=(R.randint(0,4), R.randint(1,8)))
# make sure the demo sentence has an answer: waste in the north ending this year
for nm, m in (('Kerbside collection · north lot', 3), ('Recycling haulage · north lot', 9)):
    add('contract', nm, 'waste', 'active', 'north', ym(2026, m+2 if m+2<=12 else 12), used=(2,4))
for nm in people:
    sv = R.choice(services); reg = R.choice(regions) if R.random() > .12 else None
    miss = extra_missing('person', .2) + ([] if reg else ['region'])
    add('person', nm, sv, R.choices(['active','review','paused','closed'],[8,0,1,1])[0], reg, None, missing=miss, used=(R.randint(0,5), R.randint(0,9)))
for i in range(20):
    v = vehicles[i % len(vehicles)]; sv = {'Gritter':'roads','Refuse truck':'waste','Tanker':'water','Minibus':'care','Van':R.choice(services),'Sweeper':'roads','Tipper':'roads','Crane lorry':'buildings'}[v]
    d = rdate(2026, 2027) if R.random() > .12 else None
    reg = R.choice(regions)
    miss = extra_missing('vehicle') + ([] if d else ['next service'])
    add('vehicle', f'{v} {R.randint(10,89)}', sv, R.choices(states,[7,1,2,1])[0], reg, d, missing=miss, used=(R.randint(0,2), R.randint(0,3)))
for i in range(30):
    inc = R.choice(incidents); sv = {'Burst main':'water','Missed collection':'waste','Flooded underpass':'roads','Fall at home':'care','Fly-tipping':'waste','Power cut':'buildings','Roof leak':'buildings','Pothole damage':'roads','Sewer odour':'water','Lift failure':'buildings','Vehicle collision':'roads','Lost key fob':'care'}[inc]
    reg = R.choice(regions) if R.random() > .08 else None
    d = rdate(2025, 2026)
    st = R.choices(['active','review','closed'],[3,2,5])[0]
    miss = extra_missing('incident', .25) + ([] if reg else ['region'])
    add('incident', f'{inc}, {R.choice(streets)}', sv, st, reg, d, missing=miss, used=(R.randint(0,1), R.randint(0,3)))
# kept on Team floors below: out of reach from the Department floor
add('contract', 'Pothole repair · coast lot', 'roads', 'active', 'coast', '2026-12', reach=1, used=(1,2))
add('incident', 'Flooded underpass, Rope Walk', 'roads', 'active', 'coast', '2026-10', reach=1)
add('incident', 'Fall at home, Castle Walk', 'care', 'review', 'coast', '2026-09', reach=2)
add('person', 'Rui Matos', 'care', 'active', 'coast', None, reach=2)
add('vehicle', 'Minibus 44', 'care', 'active', 'coast', '2027-02', reach=2)
add('incident', 'Burst main, Fen Way', 'water', 'active', 'north', '2026-10', reach=3)
add('site', 'Fen Way valve house', 'water', 'active', 'north', '2026-04', reach=3)
# waiting in Triage: proposed by a source, not accepted yet
add('supplier', 'Coastline Gritting Ltd', 'roads', 'active', 'coast', '2026-08', triage=1)
add('contract', 'Gritting · coast lot 2', 'roads', 'active', 'coast', '2026-12', triage=1)
add('incident', 'Missed collection, Quay Street', 'waste', 'active', 'coast', '2026-10', triage=1)

data = {
 'app': 'Data Atlas',
 'today': '2026-11-03', 'year': 2026,
 'floor': {'type':'department','name':'Regional Services','short':'Department'},
 'elsewhere': [None,
   {'name':'Coast works crew','type':'team','ask':'Dee Harper'},
   {'name':'Coast care team','type':'team','ask':'Rui Matos'},
   {'name':'North water crew','type':'team','ask':'Sam Okafor'}],
 'kinds': [
  {'id':'site','one':'site','many':'sites','icon':'map-pin','tech':'cco:Facility','date':'last inspected','verb':'were last inspected','keeper':'Estates desk','expects':expected['site']},
  {'id':'supplier','one':'supplier','many':'suppliers','icon':'factory','tech':'cco:Organization','date':'last reviewed','verb':'were last reviewed','keeper':'Procurement','expects':expected['supplier']},
  {'id':'contract','one':'contract','many':'contracts','icon':'file-signature','tech':'cco:Contract','date':'ends','verb':'end','keeper':'Contracts team','expects':expected['contract']},
  {'id':'person','one':'person','many':'people','icon':'user-round','tech':'cco:Person','date':None,'verb':None,'keeper':'HR partner','expects':expected['person']},
  {'id':'vehicle','one':'vehicle','many':'vehicles','icon':'truck','tech':'cco:GroundVehicle','date':'next service','verb':'are due a service','keeper':'Fleet desk','expects':expected['vehicle']},
  {'id':'incident','one':'incident','many':'incidents','icon':'siren','tech':'cco:Incident','date':'happened','verb':'happened','keeper':'Duty desk','expects':expected['incident']},
 ],
 'facets': [
  {'id':'kind','plain':'What kind','q':'What kind of thing','pmest':'P','pm':'Personality','tech':'rdf:type','icon':'shapes'},
  {'id':'service','plain':'About','q':'Which service is it part of','pmest':'M','pm':'Matter','tech':'ex:partOfService','icon':'layers',
   'values':[{'id':'water','label':'Water'},{'id':'waste','label':'Waste'},{'id':'roads','label':'Roads'},{'id':'care','label':'Care'},{'id':'buildings','label':'Buildings'}]},
  {'id':'state','plain':'Status','q':'What is happening to it','pmest':'E','pm':'Energy','tech':'ex:hasStatus','icon':'activity',
   'values':[{'id':'active','label':'Running'},{'id':'review','label':'Under review'},{'id':'paused','label':'Paused'},{'id':'closed','label':'Finished'}]},
  {'id':'region','plain':'Where','q':'Where is it','pmest':'S','pm':'Space','tech':'cco:located_in','icon':'map',
   'values':[{'id':'north','label':'North'},{'id':'south','label':'South'},{'id':'east','label':'East'},{'id':'west','label':'West'},{'id':'coast','label':'Coast'}]},
  {'id':'when','plain':'When','q':'When is its key date','pmest':'T','pm':'Time','tech':'cco:occurs_on (per kind)','icon':'calendar',
   'values':[{'id':'before','label':'Before this year'},{'id':'this','label':'This year'},{'id':'next','label':'Next year'},{'id':'later','label':'Later'}]},
 ],
 'records': recs,
}
with open(os.path.join(here, 'data.js'), 'w') as f:
    f.write('/* Sample data for one deployment: a regional services organisation. Swap this object and every label, count and reason follows. */\n')
    f.write('const DATA = ' + json.dumps(data, separators=(',', ':')) + ';\n')
print(len(recs), 'records')
