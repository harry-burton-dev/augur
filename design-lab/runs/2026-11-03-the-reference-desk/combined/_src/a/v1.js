/* One question walked end to end: ask, sharpen (only what changes), the answer
   with its workings, save, share to a floor, and a colleague's rerun a week later. */
const Q = DATA.question, W = DATA.words;
const S = { stage: 0, typed: 0, spring: null, scope: null, gateway: true, hot: null, shareTo: Q.sharedTo, showHeard: false };
const app = document.getElementById('app');

/* the walk's moments: who is looking, on which day */
const viewerOf = st => st >= 6 ? Q.rerun.by : Q.asker;
const dayOf = st => st >= 6 ? Q.rerun.on : Q.asked;
const timeOf = st => (DATA.walk.find(w => w.id === Math.max(1, st)) || DATA.walk[0]).time;
function opts(st) {
  /* a rerun never asks the model: at step 6 the gateway switch changes nothing, and the stored provenance stays */
  return { viewer: viewerOf(st), asOf: dayOf(st), spring: S.spring || 'loose', scope: S.scope || 'loose', gateway: st >= 6 || S.gateway };
}

function rail() {
  const p = U.person(viewerOf(S.stage)), f = U.floor(p.floor);
  const keys = [['1–6', 'step of the walk'], ['← →', 'previous / next'], ['W', 'a week later'], ['G', 'model gateway on/off'], ['T', 'technical words'], ['R', 'replay']];
  return '<nav class="rail" aria-label="Data Atlas"><div class="an">' + U.esc(DATA.app) + '</div>' +
    '<a class="nav on">' + U.I('book-open') + 'Front page</a>' +
    '<a class="nav">' + U.I('shapes') + 'Kinds of thing<span class="n">9</span></a>' +
    '<a class="nav">' + U.I('inbox') + 'Triage<span class="n">' + 3 + '</span></a>' +
    '<a class="nav">' + U.I('bookmark') + 'Saved questions<span class="n">' + (S.stage >= 4 ? 4 : 3) + '</span></a>' +
    '<div class="who" data-tier="' + f.tier + '"><span class="bar"></span><b>' + U.esc(p.name) + '</b><br>' + U.esc(p.role) + ' on ' + U.esc(f.name) + ', a ' + U.esc(f.word) + '</div>' +
    '<div class="keys">' + keys.map(k => '<span>' + U.kbd(k[0]) + U.esc(k[1]) + '</span>').join('') + '</div></nav>';
}

function askBox() {
  const st = S.stage, words = Q.words;
  let q;
  if (st === 0) q = S.typed ? U.esc(words.slice(0, S.typed)) + '<span class="caret"></span>' : '<span class="ph">Ask in your own words. Nothing needs to be exact yet.</span>';
  else q = U.esc(words);
  let meta = '';
  if (st >= 6) meta = U.I('share-2', 14) + 'Shared with <b>' + U.esc(U.floor(Q.sharedTo).name) + '</b> by ' + U.esc(U.person(Q.asker).name) + ', ' + U.day(Q.asked);
  else if (st >= 4) meta = U.I('bookmark-check', 14) + 'Saved as <b>' + U.esc(Q.name) + '</b>';
  return '<div class="ask">' + U.I('search', 18) + '<div class="q' + (st === 0 && !S.typed ? ' ph' : '') + '">' + q + '</div><div class="meta">' + meta + '</div></div>';
}

function ctxLine() {
  const st = S.stage;
  if (st === 0) return '';
  if (st <= 2) return '<p class="said">' + U.I('quote', 12) + ' Your words stay as you typed them. The draft below answers them straight away; the right side asks only about words that would change it.</p>';
  if (st < 6) return '<p class="said">You asked <q>' + U.esc(Q.words) + '</q> on ' + U.day(Q.asked) + ' at ' + Q.askedTime + '. Every number below is from the record, in ink.</p>';
  return '<p class="said">' + U.esc(U.person('priya').first) + ' reran it with <b>her own access</b>. Sam’s rows never travelled with it; only his words, choices and steps did.</p>';
}

/* ---------- the answer column ---------- */
function answerCol(R, o) {
  const st = S.stage, me = U.person(o.viewer);
  if (st === 0) return '<div class="ans"><p class="eyebrow">Answer</p><p class="lede" style="margin-top:var(--space-2)">A draft appears as soon as there are words. Nothing is asked first.</p></div>';
  const draft = st <= 2 && R.loose;
  let h = '<div class="ans"><div class="ahead"><p class="eyebrow">' + (draft ? 'Draft answer · straight away' : st >= 6 ? me.first + '’s answer · ' + U.day(o.asOf) + ' ' + Q.rerun.time : 'Answer · ' + U.day(o.asOf) + ' ' + timeOf(st)) + '</p>' +
    (draft ? '<span class="small">loose words in amber; rows that depend on them are marked</span>' : '<span class="small">said by template from the steps</span>') + '</div>';
  h += '<p class="sent">' + sentence(o, { initials: st >= 3 ? U.person(Q.asker).initials : '', agreedName: U.person(Q.asker).name, agreed: st >= 3 ? 'agreed by ' + U.person(Q.asker).name : 'not yet agreed', route: o.gateway ? 'on' : 'off' }) + '</p>';
  const cutL = U.dayY(R.cut);
  h += '<div class="count"><span class="n' + (R.loose ? ' loose' : '') + '">' + R.count + (R.loose ? '<span class="muted"> to </span>' + R.countHi : '') + '</span><span class="l"><b>suppliers not heard from' + (R.loose ? ' since spring' : ' since ' + cutL) + '</b>' + (R.loose ? R.depends.length + ' depend on how you read a word' : 'each with its last contact and source') + '</span></div>';
  const hid = R.hiddenOn.map(f => U.floor(f).name);
  h += '<p class="base">Covers <b class="mono">' + R.covered + '</b> of the <b class="mono">' + R.applies + '</b> it applies to.' + (R.depends.length ? ' ' + R.depends.length + ' depend on a loose word.' : '') + (R.cantSay ? ' For ' + R.cantSay + ' we can’t say yet.' : '') + (hid.length ? ' Some are kept on ' + U.list(hid.map(U.esc)) + ', where you can’t see.' : '') + '</p>';
  const parts = [[R.silent.length, 'not heard from']].concat(R.depends.length ? [[R.depends.length, 'depend']] : []).concat([[R.heard.length, 'heard from'], [R.notKnown.length, 'not known yet'], [R.noRecord.length, 'no record'], [R.dontApply.length, 'don’t apply']]);
  const sum = parts.reduce((a, p) => a + p[0], 0);
  h += '<div class="bal" title="Every supplier you can see is counted on exactly one line"><span><b>' + R.seen + '</b> you can see =</span>' + parts.map((p, i) => '<span>' + (i ? '+ ' : '') + '<b>' + p[0] + '</b> ' + p[1] + '</span>').join('') +
    '<span class="ok">' + (sum === R.seen ? U.I('check', 12) + 'balances' : U.I('x', 12) + 'does not balance') + '</span></div>';
  /* rows */
  h += '<div class="rh"><span class="micro">' + (draft ? 'In the draft' : 'Not heard from') + '</span><span class="micro">last contact</span><span class="micro lane">' + (o.gateway ? 'pencil · the model’s guesses · not counted' : 'records that matched nobody') + '</span></div><div class="scroll">';
  const rows = R.silent.concat(R.depends);
  h += rows.map((r, i) => {
    const lc = r.last ? r.last.via + ' ' + U.dayS(r.last.on) : '';
    const g = (o.gateway ? R.guesses : R.unmatched).find(x => x.row === r);
    let pl = '';
    if (r.on) pl = '<span class="um" style="color:var(--x-proposed-loose)">' + U.I('split', 12) + 'depends on “' + (r.on === 'spring' ? W.spring.said : r.on === 'suppliers' ? W.suppliers.said : 'both') + '”</span>';
    else if (g && o.gateway) pl = '<span class="pbox" title="' + U.esc(g.m.said) + '">' + U.I('pencil-line', 12) + ' ' + U.esc(g.m.via) + ' ' + U.day(g.m.on) + ' may be them</span>';
    else if (g) pl = '<span class="um">' + U.I('inbox', 12) + '1 ' + U.esc(g.m.via) + ' matched nobody · in Triage</span>';
    return '<div class="r' + (r.on ? ' dpd' : '') + '"><span class="nm">' + U.esc(r.s.name) + '</span><span class="lc">' + U.esc(lc) + '</span><span class="pl">' + pl + '</span><span class="tk rt">' + U.esc(DATA.sources[r.last.src].tech + ' · last = max(on) where logged ≤ run day') + '</span></div>';
  }).join('');
  /* group lines: every supplier on exactly one line */
  if (st >= 6) {
    const before = run({ viewer: Q.asker, asOf: Q.asked, spring: 'mar', scope: 'running', gateway: o.gateway });
    const left = before.silent.filter(r => R.heard.find(x => x.s.id === r.s.id));
    h += left.map(r => { const c = r.s.contacts.filter(c => c.on > Q.asked).pop(); return '<div class="r left"><span class="nm">' + U.esc(r.s.name) + '</span><span class="lc">' + U.esc(c.via + ' ' + U.dayS(c.on)) + '</span><span class="pl"><span class="um">' + U.I('calendar-plus', 12) + 'left since ' + U.day(Q.asked) + ': something happened</span></span></div>'; }).join('');
  }
  h += '<div class="grp"><span class="mk mk-quiet"></span><span><b>Heard from since ' + (R.loose ? '1 April' : U.day(R.cut)) + '</b> · ' + R.heard.length + ' with a dated contact after the cut</span><button class="act" id="sh">' + (S.showHeard ? 'hide' : 'show') + '</button></div>';
  if (S.showHeard) h += R.heard.map(r => '<div class="r"><span class="nm muted">' + U.esc(r.s.name) + '</span><span class="lc">' + U.esc(r.last.via + ' ' + U.dayS(r.last.on)) + '</span><span class="pl"></span></div>').join('');
  R.notKnown.forEach(r => h += '<div class="grp"><span class="mk mk-gap"></span><span><b>' + U.esc(r.s.name) + '</b> · not known yet: no contact of any kind recorded</span><button class="act">Triage job for ' + U.esc(DATA.keeper.name) + '</button></div>');
  R.noRecord.forEach(r => h += '<div class="grp"><span class="mk mk-wave"></span><span><b>' + U.esc(r.s.name) + '</b> · no record: they phone, and ' + U.esc(DATA.lost.why) + '</span><span class="small">nobody can close this</span></div>');
  if (R.dontApply.length) h += '<div class="grp quiet"><span class="mk mk-quiet"></span><span><b>Don’t apply</b> · ' + U.list(R.dontApply.map(r => U.esc(r.s.name))) + ': contract ended</span><span class="n">' + R.dontApply.length + '</span></div>';
  R.hiddenOn.forEach(f => h += '<div class="grp unseen"><span class="mk">' + U.I('lock', 14) + '</span><span><b>' + U.cap(DATA.hiddenCount) + '</b> kept on ' + U.fl(f) + ' · not yours to see</span><button class="act">ask ' + U.esc(U.floor(f).lead) + '</button></div>');
  h += '</div></div>';
  return h;
}

/* ---------- the side: sharpen, workings, save, share, why it changed ---------- */
function sharpen(o) {
  const asked = [
    { k: 'spring', said: W.spring.said, q: 'When should spring start?', split: run(Object.assign({}, o, { scope: S.scope || 'loose' })).splits.spring,
      ch: W.spring.readings.map(r => ({ id: r.id, label: r.label, why: r.why })), by: 'words' },
    { k: 'scope', said: W.suppliers.said, q: 'All suppliers, or only those with a contract running?', split: run(Object.assign({}, o, { spring: S.spring || 'loose' })).splits.suppliers,
      ch: W.suppliers.readings.map(r => ({ id: r.id, label: r.label, why: r.why })), by: 'rule' }
  ].sort((a, b) => b.split - a.split);
  const firstOpen = asked.find(a => !S[a.k]);
  let h = '<h2>Ask only what changes</h2><p class="lede">Four words are loose. <b>' + asked.length + ' change who is in the answer</b>, biggest split first. ' + (S.gateway ? 'The model found the loose words; ' : 'Words that matched nothing by name are loose; ') + 'every count is from the record.</p><div class="scroll">';
  asked.forEach(a => {
    const v = S[a.k];
    if (v) {
      const lab = v === 'loose' ? 'kept loose' : a.ch.find(c => c.id === v).label + (a.k === 'spring' ? ' 2026' : '');
      h += '<div class="w done"><div class="wh">' + U.I('check', 14) + '<span class="word">“' + U.esc(a.said) + '”</span><span class="muted">→</span><b style="font-weight:400;color:var(--light)">' + U.esc(lab) + '</b><span class="sp">' + U.by('you') + '</span></div></div>';
      return;
    }
    const open = a === firstOpen;
    h += '<div class="w' + (open ? ' open' : '') + '"><div class="wh"><span class="word">“' + U.esc(a.said) + '”</span><span class="sp">' + a.split + ' rows change</span></div>';
    if (open) {
      h += '<p class="ask2">' + U.esc(a.q) + '</p>';
      a.ch.forEach((c, i) => { const R2 = run(Object.assign({}, o, { [a.k]: c.id })); h += '<button class="ch' + (S.hot === a.k + c.id ? ' hot' : '') + '" data-k="' + a.k + '" data-v="' + c.id + '">' + U.kbd(i + 1) + '<span>' + U.esc(c.label) + '<small>' + U.esc(c.why) + '</small></span><span class="c">' + (R2.loose ? R2.count + '–' + R2.countHi : R2.count) + '</span></button>'; });
      const RL = run(Object.assign({}, o, { [a.k]: 'loose' }));
      h += '<button class="ch loose' + (S.hot === a.k + 'loose' ? ' hot' : '') + '" data-k="' + a.k + '" data-v="loose">' + U.kbd('K') + '<span>Keep it loose<small>both readings stay; saved with the question</small></span><span class="c">' + RL.count + '–' + RL.countHi + '</span></button>';
      h += '<p class="small why">' + (a.k === 'spring' ? 'In calendar order, from the deployment’s word list.' : 'In the record’s order.') + ' None is ticked for you. The number is what the answer would be.</p>';
    } else h += '<p class="small" style="margin-top:var(--space-1)">Asked next.</p>';
    h += '</div>';
  });
  h += '<p class="micro" style="margin-top:var(--space-4)">Settled for you · no row changes</p>';
  h += '<div class="w flat"><div class="wh"><span class="word">“' + U.esc(W.contact.said) + '”</span><span class="sp">0 rows change</span></div><p class="small" style="margin-top:var(--space-1)">' +
    (S.gateway ? '<span class="pencil">The model read it as ' + U.esc(W.contact.listed) + '.</span> ' : 'The deployment’s word list reads it as ' + U.esc(W.contact.listed) + '. ') +
    'Adding ' + U.list(W.contact.more, 'or') + ' changes no row here, so it isn’t asked.</p>' + (S.gateway ? '<p style="margin-top:var(--space-1)">' + U.by('model', 'model’s reading · ' + (S.stage >= 3 ? 'agreed' : 'agree it on the answer')) + '</p>' : '') + '</div>';
  h += '<div class="w flat"><div class="wh"><span class="word">“' + U.esc(W.we.said) + '”</span><span class="sp">0 rows change</span></div><p class="small" style="margin-top:var(--space-1)">Contact with ' + U.esc(W.we.readings[0].label) + ' or with ' + U.esc(W.we.readings[1].label) + ' leaves the same rows.</p></div>';
  return h + '</div>';
}

function workings(R, o) {
  const me = U.person(o.viewer), all = DATA.suppliers.filter(s => me.sees.includes(s.keptOn));
  const running = R.seen - R.dontApply.length;
  const ms = S.gateway ? R.guesses.length : R.unmatched.length;
  const steps = [
    { t: 'Start with the suppliers you can see', c: R.seen, by: U.by('rule'), d: R.hiddenOn.length ? U.cap(DATA.hiddenCount) + ' more on ' + U.list(R.hiddenOn.map(f => U.esc(U.floor(f).name))) + ', not yours to see' : '', tk: 'match (s:Supplier) where s.kept_on in reader.floors' },
    { t: 'Keep those with a contract running on the day', w: 'scope', c: running, by: U.by('you'), d: R.dontApply.length + ' left out: contract ended', tk: 's -holds-> c where c.start ≤ day ≤ c.end' },
    { t: 'Read “' + W.contact.said + '” as ' + W.contact.listed, c: '', by: S.gateway ? U.by('model', 'model’s reading · agreed ' + U.person(Q.asker).initials) : U.by('words'), model: S.gateway,
      d: 'from the ' + U.list(Object.values(DATA.sources).map(s => s.plain.toLowerCase() + ' (' + U.esc(U.floor(s.floor).name) + ')')), tk: 'event kinds: ' + W.contact.kinds.join(', ') + (S.gateway ? ' · proposed by model gateway, confirmed, stored as words' : ' · from word list') },
    { t: 'Link ' + R.contacts + ' contacts to suppliers by company number, name and spelling', c: '', by: U.by('match'),
      d: ms ? (S.gateway ? '<span class="pencil">' + ms + ' records name no supplier; the model proposes matches by meaning, in pencil, not counted</span>' : ms + ' records name no supplier: they matched nobody and wait in Triage') : '', tk: 'company_no = ?, then pg_trgm similarity ≥ 0.6' + (S.gateway ? ' · meaning: pgvector via model gateway, stored as proposals' : '') },
    { t: 'Keep those whose last contact was before ' + U.dayY(R.cut), w: 'spring', c: R.count, by: U.by('you'), d: R.heard.length + ' heard from since', tk: 'max(contact.on) < ' + R.cut },
    { t: 'Set apart what can’t be said', c: R.cantSay, by: U.by('rule'), d: R.notKnown.length + ' not known yet · ' + R.noRecord.length + ' no record', tk: 'last is null → not known yet · lost window overlaps → no record' }
  ];
  let h = '<h2>Workings</h2><p class="lede">How the <b>' + R.count + '</b> was found, step by step, in the order it ran. Steps you chose can be changed: click one and its question comes back.</p><div class="scroll">';
  h += steps.map((s, i) => '<div class="st dep' + (s.model ? ' model' : '') + '" style="--i:' + i + '"><span class="no">' + (i + 1) + '</span><span class="t' + (s.model ? ' pencil' : '') + '">' + s.t + '</span><span class="c">' + s.c + '</span><span class="d">' + s.by + (s.d ? '<span>' + s.d + '</span>' : '') + '</span><span class="tk">' + U.esc(s.tk) + '</span></div>').join('');
  h += '<p class="note">' + U.I('scroll-text', 14) + '<span>The sentence and the count come from these steps by template. <b>The model never writes the answer.</b> Step 3 keeps its dots after you agreed it, so anyone can see the model proposed it.</span></p>';
  h += '<div class="gwlog">' + (S.gateway ? 'Model gateway: this answer asked it <b>2 times</b> (reading “' + U.esc(W.contact.said) + '”, matching ' + ms + ' records), logged before each call · ' + DATA.gateway.usedToday + ' of ' + DATA.gateway.limit + ' today. <b>A rerun asks it 0 times.</b>' : 'Model gateway off: <b>0 calls</b>. ' + U.esc(DATA.admin.name) + ' can turn it on in Admin. The count is the same; ' + ms + ' records wait in Triage instead of carrying a guess.') + '</div>';
  return h + '</div>';
}

function saved() {
  const asker = U.person(Q.asker);
  const keeps = [
    ['message-square-quote', 'Your words', '“' + Q.words + '”'],
    ['list-checks', 'Each choice that sharpened them', '“since spring” = 1 March 2026, a fixed date (you) · “suppliers” = contract running <i>on the day</i>, moves with each run (you) · “heard from” = ' + W.contact.listed + ' <span class="pencil">(the model’s reading, ' + asker.initials + ' agreed; kept as words)</span>'],
    ['workflow', 'The six steps', 'as rules Data Atlas runs; no model on any rerun'],
    ['clock', 'When it was asked', U.dayS(Q.asked) + ', ' + Q.askedTime + ', and the word list as it was then'],
    ['key-round', 'Whose access', 'each run uses the access of whoever runs it']
  ];
  let h = '<h2>Saved question</h2><p class="nm-ttl">' + U.esc(Q.name) + '</p><p class="small" style="margin-top:var(--space-1)">' + Q.id + ' · named from your words · on your shelf in ' + U.esc(DATA.app) + ' and on Home</p><div class="scroll"><ul class="keep">';
  h += keeps.map((k, i) => '<li class="dep" style="--i:' + i + '">' + U.I(k[0], 14) + '<span><b>' + k[1] + '</b>' + k[2] + '</span></li>').join('');
  h += '<li class="never dep" style="--i:5">' + U.I('ban', 14) + '<span><b>The rows</b>never kept, never shared. Each rerun counts again from the record.</span></li></ul>';
  h += '<div class="w"><div class="wh">' + U.I('eye', 14) + '<span>Watch it</span><span class="sp">' + U.by('you') + '</span></div><p class="small" style="margin-top:var(--space-1)">' + U.esc(U.cap(Q.watch)) + ', not just the count. One quiet line on Home, once. Reruns never call the model.</p></div>';
  h += '<div class="acts"><button class="btn primary" data-go="5">' + U.I('share-2') + 'Share the question…</button></div>';
  return h + '</div>';
}

function share() {
  const me = U.person(Q.asker), mine = run({ viewer: Q.asker, asOf: Q.asked, spring: 'mar', scope: 'running', gateway: S.gateway });
  let h = '<h2>Share to a floor</h2><p class="lede">You share the <b>question</b>, not your answer. Each reader reruns it with their own access.</p><div class="scroll"><div class="stack">';
  DATA.stack.forEach(fid => {
    const f = U.floor(fid), canShare = me.sees.includes(fid) || fid === 'finance';
    const reach = fid === 'facilities' ? 'your floor: they open what you open' : fid === 'depot' ? 'not your floor: ask ' + f.lead + ' to share it there' : 'can open the contact log; not records kept on Facilities';
    h += '<button class="fr' + (S.shareTo === fid ? ' sel' : '') + (fid === 'depot' ? ' off' : '') + '" data-tier="' + f.tier + '" data-floor="' + fid + '"' + (fid === 'depot' ? ' aria-disabled="true"' : '') + '><span>' + (fid === 'depot' ? U.I('lock', 12) + ' ' : '') + U.esc(f.name) + ' <span class="muted">· ' + U.esc(f.word) + '</span></span><span class="pp">' + f.people + ' people</span><small>' + U.esc(reach) + '</small></button>';
  });
  h += '</div>';
  const to = U.floor(S.shareTo);
  const hiddenFor = mine.silent.filter(r => r.s.keptOn === 'facilities');
  if (S.shareTo !== 'facilities') {
    h += '<div class="reach"><p class="micro">What ' + U.esc(to.name) + '’s ' + to.people + ' people can open when they rerun it</p>';
    h += '<div class="rr">' + U.I('check', 14).replace('<svg', '<svg class="y"') + '<span><b>' + U.esc(DATA.sources.log.plain) + '</b> · kept on ' + U.esc(U.floor(DATA.sources.log.floor).name) + '</span><span class="mono small">all</span></div>';
    h += '<div class="rr">' + U.I('lock', 14) + '<span><b>' + U.esc(DATA.sources.notes.plain) + '</b> · kept on Facilities</span><span class="mono small">none</span></div>';
    h += '<div class="rr">' + U.I('lock', 14) + '<span><b>Suppliers kept on Facilities</b> · ' + hiddenFor.length + ' of your ' + mine.count + ' (' + U.list(hiddenFor.map(r => U.esc(r.s.name))) + '). They’ll see “some, not yours to see”, never the name.</span><span class="mono small">' + hiddenFor.length + '</span></div>';
    h += '<div class="rr">' + U.I('pencil-line', 14) + '<span>Guesses don’t travel in the question. They wait in Triage, and readers see the ones on records they can open.</span><span></span></div></div>';
    h += '<div class="refuse"><b>A fixed copy of your answer</b> isn’t offered for ' + U.esc(to.name) + ': ' + hiddenFor.length + ' of its rows rests on a record kept on Facilities. Share the question, or ask ' + U.esc(U.floor('facilities').lead) + ' to share that record.</div>';
  } else h += '<p class="small" style="margin-top:var(--space-3)">Everyone on Facilities opens what you open, so they get your count today.</p>';
  h += '<div class="acts"><button class="btn primary" data-go="6">' + U.I('share-2') + 'Share the question to ' + U.esc(to.name) + '</button><span class="small" style="align-self:center">Their floor lead sees it on Home, once.</span></div>';
  return h + '</div>';
}

function whyChanged(R) {
  const before = run({ viewer: Q.asker, asOf: Q.asked, spring: 'mar', scope: 'running', gateway: true });
  const me = U.person(Q.rerun.by), asker = U.person(Q.asker);
  /* classify each difference against Sam's run: computed, never typed */
  const out = { world: [], learned: [], access: [], guess: [], words: [] };
  before.silent.forEach(r => {
    if (!me.sees.includes(r.s.keptOn)) { out.access.push(r); return; }
    if (R.silent.find(x => x.s.id === r.s.id)) return;
    const c = r.s.contacts.filter(c => (c.logged || c.on) > Q.asked).pop();
    if (c) (c.on > Q.asked ? out.world : out.learned).push({ r, c });
  });
  let h = '<h2>Why it changed</h2><p class="lede">' + U.esc(asker.first) + '’s answer when he shared it travelled as a count only.</p>';
  h += '<div class="from"><span class="n then">' + before.count + '</span><span class="small">' + U.esc(asker.first) + ', ' + U.day(Q.asked) + '<br>his access</span>' + U.I('arrow-right', 16) + '<span class="n">' + R.count + '</span><span class="small">you, ' + U.day(Q.rerun.on) + '<br>your access</span></div>';
  h += '<p class="small" style="margin-top:var(--space-2)"><b>' + before.count + ' → ' + R.count + '</b>: ' + U.list(Object.keys(out).filter(k => out[k].length).map(k => out[k].length + ' ' + DATA.reasons[k].plain.toLowerCase())) + '. Always all five reasons, so you can see what didn’t move it.</p><div class="scroll">';
  Object.keys(DATA.reasons).forEach((k, i) => {
    const rs = DATA.reasons[k], n = out[k].length;
    let x = '';
    if (k === 'world') x = out.world.map(o => '<b>' + U.esc(o.r.s.name) + '</b> sent an ' + U.esc(o.c.via) + ' on ' + U.day(o.c.on) + (o.c.note ? ' (' + U.esc(o.c.note) + ')' : '') + '. It left the answer.').join(' ') + '<div class="acts"><button class="btn sm">' + U.I('mail', 14) + 'Open the email</button></div>';
    if (k === 'access') x = 'A supplier in ' + U.esc(asker.first) + '’s answer is kept on <b>Facilities</b>, which you can’t open. For you it is “some, not yours to see”. Its name never reaches you.<div class="acts"><button class="btn sm">' + U.I('key-round', 14) + 'Ask ' + U.esc(U.floor('facilities').lead) + ' for access</button></div>';
    if (k === 'guess') x = '';
    h += '<div class="rs dep' + (n ? '' : ' zero') + '" style="--i:' + i + '">' + U.I(rs.icon, 16) + '<span>' + U.esc(rs.plain) + (n ? '' : ' <span class="small">· ' + U.esc(rs.line) + '</span>') + '</span><span class="k">' + n + '</span><span class="x">' + x + '</span><span class="tk">' + U.esc(rs.tech) + '</span></div>';
  });
  h += '<p class="note">' + U.I('pencil-line', 14) + '<span>' + (true ? R.guesses.length + ' guesses on records you can open still wait in Triage. None was settled, and guesses never move a count.' : R.unmatched.length + ' records that matched nobody still wait in Triage.') + '</span></p>';
  h += '<div class="gwlog">This rerun asked the model gateway <b>0 times</b>. It used the words, choices and steps saved on ' + U.day(Q.asked) + ', and your access.' + (S.gateway ? '' : ' The gateway is off today; nothing on this rerun changes.') + '</div>';
  return h + '</div>';
}

function walk() {
  const st = S.stage;
  const w = DATA.walk;
  const kest = DATA.suppliers.find(s => s.contacts.some(c => c.logged && c.on > Q.asked && c.on < Q.rerun.on));
  const kc = kest && kest.contacts.find(c => c.logged && c.on > Q.asked);
  let h = '<div class="walk" role="list" aria-label="The walk">';
  w.slice(0, 5).forEach(x => h += '<button class="stn' + (st > x.id ? ' past' : '') + (st === x.id ? ' now' : '') + '" data-go="' + x.id + '" role="listitem"><span class="dot"></span><b>' + x.id + ' · ' + x.label + '</b><span class="tm">' + U.day(x.day) + ' ' + x.time + '</span></button>');
  h += '<div class="stn gapw' + (st >= 6 ? ' past' : '') + '"><b class="muted">a week</b><span class="ev"><span class="tm">' + U.I('calendar-plus', 12) + (kest ? U.day(kc.on) + ' ' + U.esc(kest.name) + ' emails' : '') + '</span><span class="tm">' + U.I('eye', 12) + 'Sam’s watch, 07:00 daily</span></span></div>';
  const x = w[5];
  h += '<button class="stn last' + (st === 6 ? ' now' : '') + '" data-go="6" role="listitem"><span class="dot"></span><b>6 · ' + x.label + '</b><span class="tm">' + U.day(x.day) + ' ' + x.time + ' · ' + U.esc(U.person(x.who).first) + ', ' + U.esc(U.floor(U.person(x.who).floor).name) + '</span></button>';
  return h + '</div>';
}

let lastStage = -1;
function render() {
  const st = S.stage, o = opts(st), R = run(o);
  const p = U.person(o.viewer);
  let side = '';
  if (st >= 1 && st <= 2) side = sharpen(o);
  else if (st === 3) side = workings(R, o);
  else if (st === 4) side = saved();
  else if (st === 5) side = share();
  else if (st === 6) side = whyChanged(R);
  const gw = '<span class="chip' + (S.gateway ? ' gw-on' : '') + '">' + U.I(S.gateway ? 'pencil-line' : 'power-off', 14) + (S.gateway ? 'Model gateway <b>on</b>' : 'Model gateway <b>off</b> · ' + U.esc(DATA.admin.name) + ' can turn it on') + ' ' + U.kbd('G') + '</span>';
  const fresh = st !== lastStage; lastStage = st;
  app.innerHTML = rail() + '<main class="main' + (fresh ? '' : ' still') + '"><div class="top"><p class="eyebrow">' + U.esc(DATA.org) + ' · ' + U.esc(DATA.app) + ' · Front page · Ask</p><span class="when">' + U.dayS(o.asOf) + ' · ' + (st >= 1 ? timeOf(st) : '09:12') + '</span>' + gw + '</div>' +
    askBox() + '<div class="ctx">' + ctxLine() + '</div><div class="grid">' + answerCol(R, o) + '<aside class="side" aria-live="polite">' + side + '</aside></div>' + walk() + '</main>';
  U.hydrate(app);
}

function go(n) { n = Math.max(1, Math.min(6, n)); runId++; if (n >= 3) { S.spring = S.spring || 'mar'; S.scope = S.scope || 'running'; } if (n <= 1) { S.spring = null; S.scope = null; } S.typed = Q.words.length; S.stage = n; S.hot = null; render(); }
function choose(k, v) { S[k] = v; S.hot = null; if (S.spring && S.scope) S.stage = 3; else S.stage = 2; render(); }

app.addEventListener('click', e => {
  const c = e.target.closest('.ch'); if (c) { choose(c.dataset.k, c.dataset.v); return; }
  const g = e.target.closest('[data-go]'); if (g) { go(+g.dataset.go); return; }
  const f = e.target.closest('.fr'); if (f && f.dataset.floor !== 'depot') { S.shareTo = f.dataset.floor; render(); return; }
  if (e.target.closest('#sh')) { S.showHeard = !S.showHeard; render(); return; }
  const stp = e.target.closest('.st');
  if (stp) { const k = stp.dataset.word; if (k) { runId++; S[k] = null; S.stage = 2; S.hot = null; render(); } return; }
});
addEventListener('keydown', e => {
  if (e.metaKey || e.ctrlKey || e.altKey) return;
  const k = e.key.toLowerCase();
  if (k === 'enter' && document.activeElement && document.activeElement.matches('.st.can')) { document.activeElement.click(); return; }
  if (k === 'r') demo();
  else if (k === 'w') go(6);
  else if (k === 'g') { S.gateway = !S.gateway; render(); }
  else if (k === 't') document.body.classList.toggle('tech');
  else if (k === 'arrowright') go(S.stage + 1);
  else if (k === 'arrowleft') go(S.stage - 1);
  else if (S.stage >= 1 && S.stage <= 2 && /^[12k]$/.test(k)) {
    const open = document.querySelector('.w.open .ch' + (k === 'k' ? '.loose' : ':nth-of-type(' + k + ')'));
    if (open) choose(open.dataset.k, open.dataset.v);
  }
  else if (/^[1-6]$/.test(k)) go(+k);
});

let runId = 0;
async function demo() {
  const me = ++runId;
  Object.assign(S, { stage: 0, typed: 0, spring: null, scope: null, hot: null, shareTo: Q.sharedTo, showHeard: false });
  render();
  await U.wait(U.ms('--motion-run')); if (me !== runId) return;
  const n = Q.words.length, step = Math.max(4, U.ms('--motion-slow') / n);
  if (U.reduced()) S.typed = n; else for (let i = 1; i <= n; i += 2) { S.typed = i; render(); await U.wait(step); if (me !== runId) return; }
  S.typed = n; S.stage = 1; render();
  await U.wait(U.ms('--motion-calm')); if (me !== runId) return;
  S.hot = 'springmar'; render();
  await U.wait(U.ms('--motion-slow')); if (me !== runId) return;
  choose('spring', 'mar');
  await U.wait(U.ms('--motion-calm')); if (me !== runId) return;
  S.hot = 'scoperunning'; render();
  await U.wait(U.ms('--motion-slow')); if (me !== runId) return;
  choose('scope', 'running');
}
/* deep links for checking a step: #s=4, #w */
const hash = location.hash.slice(1);
if (hash === 'w') go(6);
else if (/^s=\d$/.test(hash)) go(+hash.slice(2));
else demo();
