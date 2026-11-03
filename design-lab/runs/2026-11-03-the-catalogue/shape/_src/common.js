/* ===== Sample data: every name, label, count and word on this page comes from here.
   A deployment's ontology (kinds, details, links) and its counts. Swap this object and the page redraws. ===== */
const DATA = {
  app: 'Data Atlas',
  viewer: { name: 'Mira Chen', memberOf: ['dept-ops'] },
  here: 'dept-ops',
  /* floors: kind = org | department | team, parent = the floor above */
  floors: [
    { id: 'org',        kind: 'org',        name: 'Northvale Regional Services' },
    { id: 'dept-ops',   kind: 'department', name: 'Operations',  parent: 'org' },
    { id: 'dept-fin',   kind: 'department', name: 'Finance',     parent: 'org' },
    { id: 'team-depot', kind: 'team',       name: 'Depot North', parent: 'dept-ops' }
  ],
  /* the big families every kind sits in (plain word, the ontology's word one step down) */
  groups: [
    { id: 'who',    plain: 'People and organisations', tech: 'cco:Agent' },
    { id: 'where',  plain: 'Places',                    tech: 'bfo:Site · cco:GeospatialRegion' },
    { id: 'things', plain: 'Things we run',             tech: 'cco:MaterialArtifact' },
    { id: 'happen', plain: 'Things that happen',        tech: 'bfo:Process · cco:Act' },
    { id: 'papers', plain: 'Agreements and papers',     tech: 'cco:InformationContentEntity' }
  ],
  /* kinds of thing. details: [plain name, % of records that have it, link target kind (if the detail is a link)]
     gapBy: who could fill what's missing. usedBy: intents in Mandate and documents in Artifacts that rely on this kind */
  kinds: [
    { id: 'person', sym: 'Pe', plain: 'People', one: 'person', tech: 'cco:Person', group: 'who', floor: 'org', count: 1942,
      about: 'Everyone who works for or with the organisation.', steward: 'People team', triage: 6,
      details: [['Name', 100], ['Role', 93], ['Works at', 81, 'site'], ['Phone', 64], ['Start date', 47]],
      gapBy: 'People team, or each person from Home', usedBy: { intents: 4, docs: 210 } },
    { id: 'supplier', sym: 'Su', plain: 'Suppliers', one: 'supplier', tech: 'cco:Organization', group: 'who', floor: 'org', count: 386,
      about: 'Companies we buy goods or services from.', steward: 'Procurement', triage: 11,
      details: [['Name', 100], ['Company number', 88], ['Address', 91], ['Contact person', 54, 'person'], ['Insurance expiry', 31]],
      gapBy: 'Procurement, from the supplier questionnaire', usedBy: { intents: 9, docs: 640 } },
    { id: 'site', sym: 'Si', plain: 'Sites', one: 'site', tech: 'cco:Facility', group: 'where', floor: 'org', count: 214,
      about: 'Buildings and yards we run services from.', steward: 'Estates', triage: 2,
      details: [['Name', 100], ['Address', 99], ['Service area', 97, 'area'], ['Opening hours', 58], ['Step-free entrance', 22]],
      gapBy: 'Estates, or the site lead', usedBy: { intents: 12, docs: 380 } },
    { id: 'area', sym: 'Ar', plain: 'Service areas', one: 'service area', tech: 'cco:GeospatialRegion', group: 'where', floor: 'org', count: 38,
      about: 'The districts we serve.', steward: 'Planning', triage: 0,
      details: [['Name', 100], ['Boundary', 100], ['Population', 74]],
      gapBy: 'Planning, from the census tables', usedBy: { intents: 3, docs: 44 } },
    { id: 'vehicle', sym: 'Ve', plain: 'Vehicles', one: 'vehicle', tech: 'cco:GroundVehicle', group: 'things', floor: 'dept-ops', count: 612,
      about: 'Every van, gritter and car the fleet runs.', steward: 'Fleet team', triage: 4,
      details: [['Registration', 100], ['Make and model', 98], ['Based at', 93, 'site'], ['Next service due', 71], ['Mileage', 44], ['Usual driver', 38, 'person']],
      gapBy: 'Fleet team, or the fleet register in Artifacts', usedBy: { intents: 7, docs: 290 } },
    { id: 'equipment', sym: 'Eq', plain: 'Equipment', one: 'piece of equipment', tech: 'cco:Artifact', group: 'things', floor: 'dept-ops', count: 2340,
      about: 'Plant, tools and machines that need checking.', steward: 'Maintenance', triage: 9,
      details: [['Name', 100], ['Serial number', 76], ['Installed at', 82, 'site'], ['Maintained by', 51, 'supplier'], ['Last checked', 29]],
      gapBy: 'Maintenance, or Depot North from inspections', usedBy: { intents: 5, docs: 520 } },
    { id: 'incident', sym: 'In', plain: 'Incidents', one: 'incident', tech: 'cco:Act', group: 'happen', floor: 'dept-ops', count: 1108,
      about: 'Things that went wrong and were reported.', steward: 'Operations control', triage: 14,
      details: [['When', 100], ['What happened', 100], ['Where', 87, 'site'], ['Severity', 79], ['Reported by', 66, 'person'], ['Vehicle involved', 34, 'vehicle']],
      gapBy: 'Operations control, or whoever reported it', usedBy: { intents: 11, docs: 930 } },
    { id: 'contract', sym: 'Co', plain: 'Contracts', one: 'contract', tech: 'cco:Contract', group: 'papers', floor: 'dept-ops', count: 274,
      about: 'What we agreed with suppliers, and for how long.', steward: 'Commercial team', triage: 3,
      details: [['Reference', 100], ['With', 96, 'supplier'], ['Starts', 92], ['Ends', 88], ['Value', 61], ['Covers', 58, 'site']],
      gapBy: 'Commercial team, from the signed copy in Artifacts', usedBy: { intents: 6, docs: 406 } },
    /* kept on a floor you can't see from here */
    { id: 'invoice', sym: 'Iv', plain: 'Invoices', one: 'invoice', tech: 'cco:Invoice', group: 'papers', floor: 'dept-fin',
      about: 'Bills from suppliers against contracts.', ask: 'Priya Nair', askRole: 'Finance data steward' },
    { id: 'inspection', sym: 'Is', plain: 'Inspections', one: 'inspection', tech: 'cco:Act', group: 'happen', floor: 'team-depot',
      about: 'Checks done on equipment at the depot.', ask: 'Dan Osei', askRole: 'Depot North lead' }
  ],
  /* in the ontology, but nobody keeps any yet; or a word sources asked for that admins haven't decided */
  unadopted: [
    { id: 'route', sym: 'Ro', plain: 'Routes', group: 'where', tech: 'cco:Route', why: 'In the ontology, nobody keeps any yet.' },
    { id: 'permit', sym: 'Pm', plain: 'Permits', group: 'papers', tech: 'cco:Permit', why: 'In the ontology, nobody keeps any yet.' },
    { id: 'depot', sym: 'De', plain: 'Depots', group: 'where', asked: 14, why: 'Sources used this word 14 times. Admins decide whether it means Sites.' },
    { id: 'skill', sym: 'Sk', plain: 'Qualifications', group: 'who', asked: 5, why: 'Sources used this word 5 times. Admins decide whether to add it.' }
  ],
  admins: 'Sam Okafor (Data Atlas admin)',
  /* kinds of link. cover = % of the "from" kind that have this link */
  links: [
    { from: 'vehicle',   verb: 'is based at',     to: 'site',     count: 569,  cover: 93, tech: 'cco:located_in' },
    { from: 'vehicle',   verb: 'is usually driven by', to: 'person', count: 233, cover: 38, tech: 'cco:has_operator' },
    { from: 'equipment', verb: 'is installed at', to: 'site',     count: 1919, cover: 82, tech: 'cco:located_in' },
    { from: 'equipment', verb: 'is maintained by', to: 'supplier', count: 1193, cover: 51, tech: 'cco:maintained_by' },
    { from: 'incident',  verb: 'happened at',     to: 'site',     count: 964,  cover: 87, tech: 'cco:occurs_at' },
    { from: 'incident',  verb: 'involved',        to: 'vehicle',  count: 377,  cover: 34, tech: 'cco:has_participant' },
    { from: 'incident',  verb: 'was reported by', to: 'person',   count: 731,  cover: 66, tech: 'cco:has_agent' },
    { from: 'contract',  verb: 'is with',         to: 'supplier', count: 263,  cover: 96, tech: 'cco:has_party' },
    { from: 'contract',  verb: 'covers',          to: 'site',     count: 159,  cover: 58, tech: 'cco:is_about' },
    { from: 'person',    verb: 'works at',        to: 'site',     count: 1573, cover: 81, tech: 'cco:has_workplace' },
    { from: 'supplier',  verb: 'has a contact',   to: 'person',   count: 208,  cover: 54, tech: 'cco:has_member' },
    { from: 'site',      verb: 'is in',           to: 'area',     count: 208,  cover: 97, tech: 'cco:located_in' },
    { from: 'invoice',   verb: 'is against',      to: 'contract', tech: 'cco:is_about' },
    { from: 'inspection', verb: 'checked',        to: 'equipment', tech: 'cco:has_participant' }
  ],
  /* where what's known came from, and what relies on it (other pillar apps) */
  sources: { docs: 3420, docsApp: 'Artifacts', intents: 57, intentsApp: 'Mandate' },
  thin: 70 /* below this % known, a kind or detail reads as "thin" */
};

/* ===== helpers ===== */
const RM = matchMedia('(prefers-reduced-motion: reduce)').matches;
const css = getComputedStyle(document.documentElement);
const T = n => parseFloat(css.getPropertyValue('--motion-' + n)) || 0;
const PX = n => parseFloat(css.getPropertyValue('--' + n)) || 0;
const esc = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const nf = n => n.toLocaleString('en-GB');
const K = id => DATA.kinds.find(k => k.id === id) || DATA.unadopted.find(k => k.id === id);
const F = id => DATA.floors.find(f => f.id === id);
const HERE = F(DATA.here);
const floorWord = f => ({ org: 'Org', department: 'Department', team: 'Team' })[f.kind];
const floorColor = f => 'var(--floor-' + f.kind + '-high)';
/* which floors this floor can see: itself and every floor above */
const visibleFloors = (() => { const out = []; let f = HERE; while (f) { out.push(f.id); f = f.parent && F(f.parent); } return out; })();
/* reach: here | above | below | aside | none */
function reach(k){
  if (!k.floor) return 'none';
  if (k.floor === DATA.here) return 'here';
  if (visibleFloors.includes(k.floor)) return 'above';
  const f = F(k.floor); return f.parent === DATA.here ? 'below' : 'aside';
}
const seen = k => ['here', 'above'].includes(reach(k));
const SEEN = DATA.kinds.filter(seen);
const OUT = DATA.kinds.filter(k => !seen(k));
const known = k => k.details ? Math.round(k.details.reduce((a, d) => a + d[1], 0) / k.details.length) : 0;
const isThin = p => p < DATA.thin;
const linksOf = id => DATA.links.filter(l => l.from === id || l.to === id);
const visibleLink = l => seen(K(l.from)) && seen(K(l.to));
const missing = (k, d) => Math.round(k.count * (100 - d[1]) / 100);
const totalSeen = SEEN.reduce((a, k) => a + k.count, 0);
const art = w => (/^[aeiou]/i.test(w) ? 'an ' : 'a ') + w;
const techId = s => s.toLowerCase().replace(/[^a-z]+/g, '_').replace(/^_|_$/g, '');
const reachWords = k => {
  const f = F(k.floor), r = reach(k);
  if (r === 'here') return 'kept here on ' + f.name;
  if (r === 'above') return 'kept on ' + f.name + ' (' + floorWord(f) + '), above you';
  if (r === 'below') return 'kept on ' + f.name + ' (' + floorWord(f) + ' floor under ' + HERE.name + ')';
  if (r === 'aside') return 'kept on ' + f.name + ' (another ' + floorWord(f) + ')';
  return 'not kept yet';
};

/* ===== shell: rail, floor strip ===== */
function mountShell(lit){
  const triage = SEEN.reduce((a, k) => a + (k.triage || 0), 0);
  document.querySelector('.rail').innerHTML =
    '<div class="appname">' + esc(DATA.app) + '</div>' +
    [['shapes', 'What we keep', '', 'shape'], ['list', 'Everything', nf(totalSeen)], ['inbox', 'Triage', triage], ['scale', 'Disputes', 3], ['file-text', 'Sources', nf(DATA.sources.docs)]]
      .map(([i, t, n, id]) => '<button class="nav' + (id === lit ? ' lit' : '') + '"><i data-lucide="' + i + '"></i>' + t + '<span class="n">' + n + '</span></button>').join('') +
    '<div class="rail-note">This page shows <b>kinds of thing</b>, not records. A floor shows what is kept on it and on the floors above. <span class="kbd">T</span> shows the ontology\'s words, for admins.</div>';
}
function floorStrip(){
  const up = visibleFloors.slice().reverse().map(id => F(id));
  const out = DATA.floors.filter(f => !visibleFloors.includes(f.id));
  return '<span>You are on</span>' +
    '<span class="fl here" style="--c:' + floorColor(HERE) + '"><i class="dot"></i>' + esc(HERE.name) + ' · ' + floorWord(HERE) + '</span>' +
    '<span>and can see</span>' + up.filter(f => f.id !== DATA.here).map(f => '<span class="fl" style="--c:' + floorColor(f) + '"><i class="dot"></i>' + esc(f.name) + ' · ' + floorWord(f) + '</span>').join('') +
    '<span>· out of reach</span>' + out.map(f => '<span class="fl out" style="--c:' + floorColor(f) + '"><i class="dot"></i>' + esc(f.name) + ' · ' + floorWord(f) + '</span>').join('');
}

/* ===== the kind card: one explanation for every variant ===== */
let onDrawer = () => {};
function openKind(id){
  const k = K(id); if (!k) return;
  const app = document.querySelector('.app'), d = document.querySelector('.drawer-in');
  let h = '<button class="x" aria-label="Close" data-close><i data-lucide="x"></i></button>';
  const r = reach(k);
  if (r === 'none'){
    h += '<div class="eyebrow">Not kept yet</div><div class="kc-title"><h2>' + esc(k.plain) + '</h2></div>' +
      '<p class="kc-lede">' + esc(k.why) + '</p>' +
      '<div class="kc-out gaphatch"><p>This is a gap in what we keep, not in any one record. Nothing is lost: there was never a place for it.</p><p>Who decides: <b>' + esc(DATA.admins) + '</b>.</p></div>' +
      (k.tech ? '<p class="tech">class · ' + k.tech + ' · in the Common Core Ontologies profile, not adopted</p>' : '<p class="tech">no class yet · a term asked for by sources</p>') +
      '<div class="kc-act"><button class="btn"><i data-lucide="message-square"></i>Ask for it</button></div>';
  } else if (!seen(k)){
    const f = F(k.floor);
    h += '<div class="eyebrow">Out of reach from ' + esc(HERE.name) + '</div><div class="kc-title"><h2>' + esc(k.plain) + '</h2><span class="c">count not shown</span></div>' +
      '<p class="kc-lede">' + esc(k.about) + '</p>' +
      '<div class="kc-out" style="border-color:color-mix(in srgb,' + floorColor(f) + ' 50%,transparent)"><p><b>Where:</b> ' + esc(reachWords(k)) + '.</p>' +
      '<p><b>Why you can\'t see them:</b> ' + (r === 'below' ? 'a floor shows what is kept on it and above, never below. They show on ' + esc(f.name) + ' itself.' : 'they belong to another ' + floorWord(f) + ', and you are not a member.') + '</p>' +
      '<p><b>Who to ask:</b> ' + esc(k.ask) + ', ' + esc(k.askRole) + '.</p></div>' +
      '<p class="tech">class · ' + k.tech + ' · floor ' + esc(k.floor) + '</p>' +
      '<div class="kc-act"><button class="btn pri"><i data-lucide="message-square"></i>Ask ' + esc(k.ask.split(' ')[0]) + '</button></div>';
  } else {
    const f = F(k.floor), p = known(k);
    h += '<div class="eyebrow" style="color:' + floorColor(f) + '">Kind of thing · ' + esc(reachWords(k)) + '</div>' +
      '<div class="kc-title"><h2>' + esc(k.plain) + '</h2><span class="c">' + nf(k.count) + ' kept</span></div>' +
      '<p class="tech">class · ' + k.tech + '</p>' +
      '<p class="kc-lede">' + esc(k.about) + ' Looked after by <b>' + esc(k.steward) + '</b>. On average ' + p + '% of the details are known.</p>' +
      '<div class="kc-sec"><span class="eyebrow">Details each ' + esc(k.one) + ' can have</span></div>' +
      k.details.map(dd => { const m = missing(k, dd), th = isThin(dd[1]);
        return '<div class="kc-row' + (th ? ' thin' : '') + '"><span>' + esc(dd[0]) + (dd[2] ? ' <span class="tech">→ ' + esc(K(dd[2]).plain) + '</span>' : '') + ' <span class="tech">· ' + (dd[2] ? 'object' : 'data') + ' property · ' + techId(dd[0]) + '</span></span><span class="pc">' + dd[1] + '%</span>' +
          '<span class="kbar" style="--p:' + dd[1] + '"><i></i></span>' +
          (m ? '<span class="who"><i data-lucide="user-round-pen" data-size="12"></i><span>' + nf(m) + ' don\'t have it yet · ' + esc(k.gapBy) + ' could fill it</span></span>' : '') + '</div>'; }).join('') +
      '<div class="kc-sec"><span class="eyebrow">How ' + esc(k.plain.toLowerCase()) + ' connect</span></div>' +
      linksOf(k.id).map(l => { const a = K(l.from), b = K(l.to), vis = visibleLink(l);
        if (!vis){ const o = seen(a) ? b : a;
          return '<div class="kc-link" style="opacity:.75"><i data-lucide="lock"></i><span>' + esc(a.plain) + ' ' + esc(l.verb) + ' ' + esc(b.plain.toLowerCase()) + '<span class="sub">' + esc(o.plain) + ' are ' + esc(reachWords(o)) + '. Ask ' + esc(o.ask) + '.</span></span></div>'; }
        return '<div class="kc-link"><i data-lucide="' + (l.from === k.id ? 'arrow-right' : 'arrow-left') + '"></i><span>' + (l.from === k.id ? 'Each ' + esc(a.one) + ' <b>' + esc(l.verb) + '</b> ' + esc(art(b.one)) : esc(art(a.one)).replace(/^a/, 'A') + ' <b>' + esc(l.verb) + '</b> ' + esc(art(b.one))) +
          '<span class="sub">' + nf(l.count) + ' links · ' + l.cover + '% of ' + esc(a.plain.toLowerCase()) + ' say which' + (isThin(l.cover) ? ' · thin' : '') + '</span><span class="tech">object property · ' + l.tech + '</span></span></div>'; }).join('') +
      '<div class="kc-sec"><span class="eyebrow">Relied on by</span></div>' +
      '<div class="kc-link"><i data-lucide="target"></i><span>' + k.usedBy.intents + ' intents in ' + esc(DATA.sources.intentsApp) + '<span class="sub">' + nf(k.usedBy.docs) + ' documents in ' + esc(DATA.sources.docsApp) + ' are where what\'s known came from</span></span></div>' +
      '<div class="kc-act"><button class="btn pri"><i data-lucide="list"></i>Open the ' + nf(k.count) + ' ' + esc(k.plain.toLowerCase()) + '</button>' +
      (k.triage ? '<button class="btn"><i data-lucide="inbox"></i>' + k.triage + ' waiting in triage</button>' : '') + '</div>' +
      '<div class="kc-admin tech">For admins: kinds, details and links come from the Common Core Ontologies profile. Changed in the studio by ' + esc(DATA.admins) + '. Exports as OWL.</div>';
  }
  d.innerHTML = h; Icons.hydrate(d); d.scrollTop = 0;
  app.classList.add('open'); onDrawer(id);
}
function closeKind(){ document.querySelector('.app').classList.remove('open'); onDrawer(null); }

/* ===== toast, keys, demo + replay ===== */
let toastT;
function toast(html){ const t = document.querySelector('.toast'); t.innerHTML = html; t.classList.add('on'); clearTimeout(toastT); toastT = setTimeout(() => t.classList.remove('on'), T('toast')); }
function keys(rows){ document.querySelector('.keys').innerHTML = rows.map(r => '<div>' + r + '</div>').join(''); }
let demoT = [];
const later = (fn, ms) => demoT.push(setTimeout(fn, ms));
function boot(reset, demo){
  const go = () => { demoT.forEach(clearTimeout); demoT = []; closeKind(); reset(); later(demo, T('run')); };
  document.addEventListener('keydown', e => {
    if (e.target.closest && e.target.closest('input')) return;
    if (e.key === 'r' || e.key === 'R') go();
    else if (e.key === 't' || e.key === 'T'){ document.body.classList.toggle('show-tech'); toast(document.body.classList.contains('show-tech') ? 'Showing the ontology\'s words one step down (for admins). <span class="kbd">T</span> hides them.' : 'Plain words only.'); }
    else if (e.key === 'Escape') closeKind();
  });
  document.addEventListener('click', e => { if (e.target.closest('[data-close]')) closeKind(); });
  go();
}
const ICON = { person: 'users', supplier: 'building-2', site: 'map-pin', area: 'map', vehicle: 'truck', equipment: 'wrench', incident: 'siren', contract: 'file-signature', invoice: 'receipt', inspection: 'clipboard-check', route: 'route', permit: 'file-badge', depot: 'warehouse', skill: 'award' };
