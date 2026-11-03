/* ======================================================================
   Sample data: every name, label, count, date and word on this page comes
   from here. In AUGUR it comes from Data Atlas: the ontology (kinds of thing,
   their details and kinds of link, each with the pack term it stands for),
   what's known (observations from sources, facts a floor's leads accepted,
   disputes), Used by (Mandate bindings, the documents read) and the floors.
   Nothing below is drawn for one deployment: swap this object and the page
   redraws for any org. Press K to switch to a record of another kind.
   ====================================================================== */
const DATA = {
  app: 'Data Atlas',
  org: 'Vale Regional Services',
  now: '2026-11-03',
  viewer: { name: 'Sam Okafor', floor: 'department', admin: false },
  admin: { name: 'Jo Reyes', role: 'Data Atlas admin' },
  floors: {
    you: { word: 'You' },
    team: { word: 'Depot operations' },
    department: { word: 'Facilities' },
    org: { word: 'Vale Regional Services' }
  },
  words: {                     /* plain word first, technical word one step down */
    kind: ['Kind of thing', 'class'],
    detail: ['Detail', 'datatype property'],
    link: ['Link', 'object property'],
    gap: ['Not known yet', 'expected, no assertion'],
    source: ['Where it came from', 'observation · prov:wasDerivedFrom'],
    disagree: ['Sources disagree', 'conflicting observations'],
    fact: ['Accepted', 'fact (accepted by floor leads)'],
    usedBy: ['Used by', 'Mandate bindings · source documents'],
    kept: ['Kept on', 'owning workspace']
  },
  /* sources: a document in Artifacts or a person. A withdrawn document's readings stay, marked, and stop counting. */
  sources: {
    register: { type: 'document', word: 'Asset register, Q3 2026', where: 'Estates records', floor: 'org', on: '2026-10-01' },
    lease:    { type: 'document', word: 'Lease agreement, Halden Road', where: 'Estates records', floor: 'department', on: '2019-04-02' },
    survey:   { type: 'document', word: 'Facilities survey 2025', where: 'Facilities library', floor: 'department', on: '2025-06-18' },
    fmdoc:    { type: 'document', word: 'Contract FM-2024-017', where: 'Contracts', floor: 'department', on: '2024-02-20' },
    handbook: { type: 'document', word: 'Depot handbook 2019', where: 'Facilities library', floor: 'department', on: '2019-05-01',
                withdrawn: { on: '2026-02-10', by: 'Facilities leads', why: 'Replaced by the 2026 handbook, which has not been read yet.' } },
    ir2291:   { type: 'document', word: 'Incident report IR-2291', where: 'Depot logs', floor: 'team', on: '2026-08-14' },
    priya:    { type: 'person', word: 'Priya Natarajan', role: 'Site manager', floor: 'department', on: '2026-09-30' },
    gmdoc:    { type: 'document', word: 'Grounds maintenance contract', where: 'Contracts', floor: 'department', on: '2023-03-10' },
    tender:   { type: 'document', word: 'Tender evaluation 2023', where: 'Procurement', floor: 'department', on: '2023-02-02' },
    tomasz:   { type: 'person', word: 'Tomasz Wilk', role: 'Contract manager', floor: 'department', on: '2026-07-11' }
  },
  /* the ontology: kinds of thing (only the two shown in full here, plus the kinds links point at) */
  kinds: {
    site: {
      word: 'Site', plural: 'Sites', icon: 'warehouse', count: 46,
      tech: { name: 'cco:Facility', pack: 'Common Core Ontologies 2.0', iri: 'http://www.ontologyrepository.com/CommonCoreOntologies/Facility' },
      says: 'A place the org runs or uses: a depot, office, yard or store.',
      groups: [
        { word: 'What it is', items: ['name', 'alias', 'purpose'] },
        { word: 'Where it is', items: ['address', 'inRegion'] },
        { word: 'Size and use', items: ['floorArea', 'spaces', 'opened'] },
        { word: 'Care and safety', items: ['fireCheck', 'hours', 'energy', 'security'] },
        { word: 'Who and what', items: ['runBy', 'managedBy', 'coveredBy', 'insuredBy', 'houses', 'incidents'] }
      ],
      details: {
        name:      { word: 'Name', tech: 'rdfs:label', type: 'text', key: true },
        alias:     { word: 'Also called', tech: 'skos:altLabel', type: 'text', many: true },
        purpose:   { word: 'Used for', tech: 'vrs:site_use', type: 'text' },
        address:   { word: 'Address', tech: 'cco:has_address', type: 'text' },
        floorArea: { word: 'Floor area', tech: 'vrs:floor_area', type: 'measure', unit: 'm²' },
        spaces:    { word: 'Vehicle spaces', tech: 'vrs:vehicle_capacity', type: 'count' },
        opened:    { word: 'Opened', tech: 'vrs:opened_on', type: 'date' },
        fireCheck: { word: 'Last fire risk check', tech: 'vrs:fire_risk_assessed_on', type: 'date',
                     fill: { who: 'Health and safety team', floor: 'department', hint: 'usually in a fire risk assessment' } },
        hours:     { word: 'Opening hours', tech: 'vrs:opening_hours', type: 'text',
                     fill: { who: 'Priya Natarajan, site manager', floor: 'department', hint: 'she can say it herself' } },
        energy:    { word: 'Energy rating', tech: 'vrs:epc_band', type: 'band' },
        security:  { word: 'Security grading', tech: 'vrs:security_grade', type: 'band',
                     reach: { floor: 'team', ask: 'Depot security leads', why: 'Kept on the Depot operations floor, below yours. Floors see their own and the floors above.' } }
      },
      links: {
        inRegion:  { word: 'In', back: 'has site', to: 'region', tech: 'cco:located_in' },
        runBy:     { word: 'Run by', back: 'runs', to: 'organisation', tech: 'vrs:operated_by' },
        managedBy: { word: 'Managed by', back: 'manages', to: 'person', tech: 'vrs:managed_by' },
        coveredBy: { word: 'Covered by', back: 'covers', to: 'contract', tech: 'vrs:subject_of_contract' },
        insuredBy: { word: 'Insured by', back: 'insures', to: 'organisation', tech: 'vrs:insured_by',
                     fill: { who: 'Finance, insurance desk', floor: 'org', hint: 'from the property schedule' } },
        houses:    { word: 'Home to', back: 'based at', to: 'vehicle', tech: 'vrs:base_of', many: true },
        incidents: { word: 'Incidents here', back: 'happened at', to: 'incident', tech: 'cco:is_site_of', many: true }
      }
    },
    contract: {
      word: 'Contract', plural: 'Contracts', icon: 'file-signature', count: 132,
      tech: { name: 'cco:Contract', pack: 'Common Core Ontologies 2.0', iri: 'http://www.ontologyrepository.com/CommonCoreOntologies/Contract' },
      says: 'An agreement with a supplier: what they do, for how long, for how much.',
      groups: [
        { word: 'What it is', items: ['name', 'ref', 'scope'] },
        { word: 'Money and time', items: ['value', 'starts', 'ends', 'notice'] },
        { word: 'Decisions', items: ['renewal', 'risk'] },
        { word: 'Who and what', items: ['withSupplier', 'managedBy', 'covers'] }
      ],
      details: {
        name:    { word: 'Name', tech: 'rdfs:label', type: 'text', key: true },
        ref:     { word: 'Reference', tech: 'vrs:contract_ref', type: 'text', key: true },
        scope:   { word: 'What it covers', tech: 'vrs:scope', type: 'text' },
        value:   { word: 'Value a year', tech: 'vrs:annual_value', type: 'money', unit: '£' },
        starts:  { word: 'Starts', tech: 'cco:has_start_date', type: 'date' },
        ends:    { word: 'Ends', tech: 'cco:has_end_date', type: 'date' },
        notice:  { word: 'Notice to end', tech: 'vrs:notice_period', type: 'text',
                   fill: { who: 'Procurement', floor: 'department', hint: 'clause 14 of the signed contract' } },
        renewal: { word: 'Renewal decision by', tech: 'vrs:renewal_decision_due', type: 'date',
                   fill: { who: 'Tomasz Wilk, contract manager', floor: 'department', hint: 'he set the timetable' } },
        risk:    { word: 'Supplier risk', tech: 'vrs:supplier_risk', type: 'band',
                   reach: { floor: 'org', ask: 'Commercial risk office', why: 'Kept on the Org floor in a restricted list. You can see that it exists, not its value.' } }
      },
      links: {
        withSupplier: { word: 'With', back: 'holds', to: 'organisation', tech: 'cco:has_party' },
        managedBy:    { word: 'Managed by', back: 'manages', to: 'person', tech: 'vrs:managed_by' },
        covers:       { word: 'Covers', back: 'covered by', to: 'site', tech: 'vrs:covers_site', many: true }
      }
    },
    region: { word: 'Region', plural: 'Regions', icon: 'map', count: 6 },
    organisation: { word: 'Organisation', plural: 'Organisations', icon: 'building-2', count: 318 },
    person: { word: 'Person', plural: 'People', icon: 'user-round', count: 1240 },
    vehicle: { word: 'Vehicle', plural: 'Vehicles', icon: 'truck', count: 410 },
    incident: { word: 'Incident', plural: 'Incidents', icon: 'siren', count: 922 }
  },
  /* records. Each detail holds observations: { v, src, on, note?, grade?, accepted? }.
     Two observations that differ with none accepted = sources disagree. None at all = a gap. */
  records: [
    {
      id: 'ent_01J8R4T', kind: 'site', name: 'Halden Road Depot', floor: 'department',
      since: '2019-05-13', changed: '2026-10-01',
      known: {
        name:      [{ v: 'Halden Road Depot', src: 'register', on: '2026-10-01', accepted: true }],
        alias:     [{ v: 'Depot 4', src: 'register', on: '2026-10-01', accepted: true }, { v: 'HRD', src: 'priya', on: '2026-09-30', accepted: true }],
        purpose:   [{ v: 'Vehicle depot and stores', src: 'register', on: '2026-10-01', accepted: true }],
        address:   [{ v: 'Unit 2, Halden Road, Marrow Bridge MB4 7QT', src: 'lease', on: '2019-04-02', note: 'page 1', accepted: true }],
        floorArea: [{ v: '2,400', src: 'lease', on: '2019-04-02', note: 'schedule 2' }, { v: '2,650', src: 'survey', on: '2025-06-18', note: 'counts the 2023 extension' }],
        spaces:    [{ v: '38', src: 'survey', on: '2025-06-18', accepted: true }],
        opened:    [{ v: '13 May 2019', src: 'handbook', on: '2019-05-01', note: 'foreword' }],
        energy:    [{ v: 'C', src: 'survey', on: '2025-06-18', accepted: true, grade: 'B2' }],
        inRegion:  [{ to: 'North Vale', src: 'register', on: '2026-10-01', accepted: true }],
        runBy:     [{ to: 'Corvane Facilities Ltd', src: 'fmdoc', on: '2024-02-20', note: 'since 1 April 2024', accepted: true }],
        managedBy: [{ to: 'Priya Natarajan', src: 'register', on: '2026-10-01', accepted: true }],
        coveredBy: [{ to: 'FM-2024-017 · Facilities management', src: 'fmdoc', on: '2024-02-20', accepted: true }],
        houses:    [{ to: '31 vehicles', count: 31, sample: ['VN-23 electric van', 'GR-07 gritter', 'TK-12 tipper'], src: 'register', on: '2026-10-01', accepted: true }],
        incidents: [{ to: '3 this year', count: 3, sample: ['IR-2291 roller door fault', 'IR-2240 forklift near miss', 'IR-2177 flooding, bay 3'], src: 'ir2291', on: '2026-08-14', accepted: true }]
      },
      usedBy: {
        intents: [
          { word: 'Cut depot energy use by 15% by 2027', owner: 'Estates', floor: 'org', uses: ['energy', 'floorArea'] },
          { word: 'Fleet electrification, phase 2', owner: 'Fleet', floor: 'department', uses: ['spaces', 'houses'] },
          { word: 'Close open fire safety actions by March', owner: 'Health and safety', floor: 'department', uses: ['fireCheck'], waits: true }
        ],
        documents: ['register', 'lease', 'survey', 'fmdoc', 'ir2291', 'handbook']
      },
      also: [ { name: 'Halden Rd depot', floor: 'team', why: 'Same address, spelt differently. In Triage as a possible match.' } ]
    },
    {
      id: 'ent_01J9C2M', kind: 'contract', name: 'Grounds maintenance, North Vale', floor: 'department',
      since: '2023-04-01', changed: '2026-07-11',
      known: {
        name:    [{ v: 'Grounds maintenance, North Vale', src: 'gmdoc', on: '2023-03-10', accepted: true }],
        ref:     [{ v: 'GM-2023-004', src: 'gmdoc', on: '2023-03-10', accepted: true }],
        scope:   [{ v: 'Mowing, hedges and winter gritting at 12 sites', src: 'gmdoc', on: '2023-03-10', note: 'schedule A', accepted: true }],
        value:   [{ v: '184,000', src: 'gmdoc', on: '2023-03-10', note: 'clause 6' }, { v: '196,500', src: 'tomasz', on: '2026-07-11', note: 'after the 2025 uplift' }],
        starts:  [{ v: '1 April 2023', src: 'gmdoc', on: '2023-03-10', accepted: true }],
        ends:    [{ v: '31 March 2027', src: 'gmdoc', on: '2023-03-10', accepted: true }],
        withSupplier: [{ to: 'Greenline Services', src: 'tender', on: '2023-02-02', accepted: true }],
        managedBy:    [{ to: 'Tomasz Wilk', src: 'tomasz', on: '2026-07-11', accepted: true }],
        covers:       [{ to: '12 sites', count: 12, sample: ['Halden Road Depot', 'Marrow Bridge offices', 'Fenwick salt store'], src: 'gmdoc', on: '2023-03-10', accepted: true }]
      },
      usedBy: {
        intents: [
          { word: 'Re-tender grounds maintenance before it ends', owner: 'Procurement', floor: 'department', uses: ['ends', 'renewal', 'notice'], waits: true },
          { word: 'Hold grounds spend flat in 2027', owner: 'Finance', floor: 'org', uses: ['value'] }
        ],
        documents: ['gmdoc', 'tender', 'tomasz']
      },
      also: []
    }
  ],
  demo: { detail: 'fireCheck', dispute: 'floorArea' }
};

/* ====================================================================== shared helpers */
const $ = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => [...r.querySelectorAll(s)];
const esc = s => String(s ?? '').replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const RM = matchMedia('(prefers-reduced-motion: reduce)').matches;
const ms = t => { const v = getComputedStyle(document.documentElement).getPropertyValue(t).trim(); return RM ? 0 : (parseFloat(v) || 0); };
const ic = (n, s = 16) => Icons.svg(n, { size: s, stroke: 1.5 });
const FV = { org: '--floor-org-high', department: '--floor-department-high', team: '--floor-team-high', you: '--floor-you-high' };
const floorC = f => `var(${FV[f] || '--ink-muted'})`;
const floorW = f => DATA.floors[f]?.word || f;
const W = k => DATA.words[k][0];
const T = k => DATA.words[k][1];
const fmtDate = s => { const d = new Date(s + 'T00:00:00Z'); return d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' }); };
const ORDER = { org: 3, department: 2, team: 1, you: 0 };
const seesFloor = f => ORDER[f] >= ORDER[DATA.viewer.floor];

let REC = 0;
const rec = () => DATA.records[REC];
const kindOf = r => DATA.kinds[r.kind];
const defOf = (r, k) => kindOf(r).details[k] || kindOf(r).links[k];
const isLink = (r, k) => !!kindOf(r).links[k];
const src = id => DATA.sources[id];
const srcIcon = id => src(id)?.type === 'person' ? 'user-round' : 'file-text';
const srcWhere = id => { const s = src(id); return s.type === 'person' ? `${s.role}, said ${fmtDate(s.on)}` : `Artifacts · ${s.where}`; };

/* the state of one detail on one record: filled, disagree, gap, reach (kept out of view), withdrawn (known only from a withdrawn source) */
function stateOf(r, k) {
  const d = defOf(r, k), obs = r.known[k] || [];
  if (d.reach && !seesFloor(d.reach.floor)) return { s: 'reach', obs: [], d };
  if (!obs.length) return { s: 'gap', obs, d };
  const live = obs.filter(o => !src(o.src).withdrawn);
  if (!live.length) return { s: 'withdrawn', obs, d };
  const vals = new Set(live.map(o => o.v ?? o.to));
  if (vals.size > 1 && !live.some(o => o.accepted)) return { s: 'disagree', obs: live, d };
  return { s: 'filled', obs, d };
}
const valOf = (o, d) => esc(o.v ?? o.to) + (d.unit && d.type !== 'money' ? ` <small>${esc(d.unit)}</small>` : '');
const moneyOf = (o, d) => d.type === 'money' ? `${esc(d.unit)}${esc(o.v)}` : null;
const show = (o, d) => moneyOf(o, d) ?? valOf(o, d);
const allKeys = r => kindOf(r).groups.flatMap(g => g.items);
function tally(r) {
  const t = { filled: 0, disagree: 0, gap: 0, reach: 0, withdrawn: 0 };
  allKeys(r).forEach(k => t[stateOf(r, k).s]++);
  t.total = allKeys(r).length; return t;
}
/* who could fill a gap: the kind's own hint, or the floor's leads */
const filler = (r, d) => d.fill || { who: `${floorW(r.floor)} leads`, floor: r.floor, hint: 'anyone with access can propose a value' };
const usedFor = (r, k) => r.usedBy.intents.filter(i => i.uses.includes(k));

/* keys bar + tip */
function keys(list) {
  $('#keys').innerHTML = list.map(([a, b]) => `<span>${a.split(' ').map(x => `<span class="kbd">${esc(x)}</span>`).join(' ')} ${esc(b)}</span>`).join('');
}
const timers = []; const later = (f, t) => timers.push(setTimeout(f, t));
const clearTimers = () => { while (timers.length) clearTimeout(timers.pop()); };
