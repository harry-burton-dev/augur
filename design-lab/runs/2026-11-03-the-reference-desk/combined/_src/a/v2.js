/* The same question answered twice: with the model gateway and without it.
   Both end on the same ink. Only the route differs, and only the difference is pencil. */
const Q = DATA.question, W = DATA.words, me = U.person(Q.asker);
const S = { gateway: true, shown: 999, decided: {}, hot: null, bad: false };
const app = document.getElementById('app');
const base = { viewer: Q.asker, asOf: Q.asked, spring: 'mar', scope: 'running' };
const RM = run(Object.assign({ gateway: true }, base)), RN = run(Object.assign({ gateway: false }, base));

const L = {
  you: t => '<div class="ln you"><span class="cue">' + U.I('user-round', 12) + U.esc(me.first) + '</span><q>' + t + '</q></div>',
  atlas: t => '<div class="ln atlas"><span class="cue">' + U.I('database', 12) + U.esc(DATA.app) + '</span>' + t + '</div>',
  model: t => '<div class="ln model"><span class="cue">' + U.I('pencil-line', 12) + 'The model · pencil · proposes, never counts</span>' + t + '</div>',
  dir: t => '<div class="ln dir">(' + t + ')</div>',
  n: v => '<span class="n">' + v + '</span>'
};
const opt = (label, c, on) => '<span class="opt' + (on ? ' on' : '') + '">' + (on ? U.I('check', 12) : '') + U.esc(label) + (c !== undefined ? ' <span class="c">' + c + '</span>' : '') + '</span>';

function phases() {
  const sp = W.spring.readings, su = W.suppliers.readings;
  const cnt = o => run(Object.assign({ gateway: true }, base, o)).count;
  const loose = run(Object.assign({ gateway: true }, base, { spring: 'loose', scope: 'loose' }));
  const sharpen = [
    L.atlas('Two words change the answer, biggest split first.<br>“' + U.esc(W.spring.said) + '”, ' + loose.splits.spring + ' rows: ' + sp.map(r => opt(r.label, cnt({ spring: r.id }), r.id === 'mar')).join('') + opt('keep it loose', cnt({ spring: 'mar' }) + '–' + cnt({ spring: 'apr' })) +
      '<br>“' + U.esc(W.suppliers.said) + '”, ' + loose.splits.suppliers + ' rows: ' + su.map(r => opt(r.label, cnt({ scope: r.id }), r.id === 'running')).join('')),
    L.you('From ' + sp[0].label + ', and only running ones.')
  ];
  const nm = RM.guesses.length;
  return [
    { lab: 'Reading your words', why: 'Your words are kept as typed; only the reading is proposed.', gut: '≈', gs: 'one more turn',
      m: [L.dir('your words, as typed above'),
          L.atlas('“' + U.esc(W.suppliers.said) + '” is a kind of thing (by name). “spring” is in the word list.'),
          L.model('Reads “' + U.esc(W.contact.said) + '” as <b>' + U.esc(W.contact.listed) + '</b>. “we” makes no difference here.'),
          L.you('Yes, that’s what I mean.'), L.dir('the dots stay on that reading for good, with ' + me.initials + ' beside them')],
      n: [L.dir('your words, as typed above'),
          L.atlas('“' + U.esc(W.suppliers.said) + '” is a kind of thing (by name). “spring” is in the word list. “' + U.esc(W.contact.said) + '” matches nothing it keeps: what counts?<br>' + W.contact.kinds.concat(W.contact.more).map(k => opt(k, undefined, false)).join('')),
          L.you('Emails, calls and meetings.'), L.dir('you tick ' + W.contact.kinds.length + ' kinds from the word list; adding the other ' + W.contact.more.length + ' changes no row')] },
    { lab: 'Sharpening', why: 'Asked only where the readings give different rows.', gut: '=', gs: 'same questions', m: sharpen, n: sharpen },
    { lab: 'Linking records', why: 'Company number, name and spelling first, on both sides.', gut: '≠', gs: 'different route',
      m: [L.atlas('Linked ' + L.n(RM.contacts) + ' contacts by company number, name and spelling. ' + L.n(nm) + ' records name no supplier.'),
          L.model('Matches the ' + nm + ' by meaning. Proposals only; not counted.').replace('class="ln model"', 'class="ln model intro"'), 'MATCHES'],
      n: [L.atlas('Linked ' + L.n(RN.contacts) + ' contacts by company number, name and spelling. ' + L.n(RN.unmatched.length) + ' records name no supplier: they wait in Triage.'),
          L.dir('nothing proposes a supplier; a short key lets you place them, or leave them'), 'KEY'] },
  ];
}

function matches() {
  return RM.guesses.map((g, i) => {
    const d = S.decided[g.row.s.id];
    let st = '';
    if (d === 'yes') st = '<span class="st">' + U.I('inbox', 12) + '<span><b>In Triage</b> · proposed by the model, agreed by ' + U.esc(me.initials) + ' · waits for ' + U.esc(DATA.keeper.name) + '. Until she accepts, ' + U.esc(g.row.s.name) + ' stays in the ' + RM.count + ', in ink.</span></span>';
    if (d === 'no') st = '<span class="st">' + U.I('x', 12) + '<span>You said not them. The record stays unmatched in Triage; the model won’t propose it again.</span></span>';
    return '<div class="pm' + (S.hot === i ? ' hot' : '') + (d === 'no' ? ' no' : '') + '" data-i="' + i + '"><span class="q">' + U.esc(g.m.via) + ' ' + U.day(g.m.on) + ' ' + U.esc(g.m.said) + ' → <b>' + U.esc(g.row.s.name) + '</b>?</span>' +
      (d ? '' : '<span class="acts"><button class="btn xs" data-dec="yes" data-i="' + i + '">' + U.I('check', 12) + 'It’s them</button><button class="btn xs" data-dec="no" data-i="' + i + '">' + U.I('x', 12) + 'Not them</button></span>') + st + '</div>';
  }).join('');
}
function key() {
  return RN.unmatched.map((g, i) => '<div class="key"><span class="rec">' + (i + 1) + ' of ' + RN.unmatched.length + ' · ' + U.esc(g.m.via) + ' ' + U.day(g.m.on) + ' ' + U.esc(g.m.said) + '</span><span class="small">in Triage</span>' +
    '<span class="leads"><span><b>' + (i + 1) + 'a</b> one of the ' + RN.count + ' → pick it</span><span><b>' + (i + 1) + 'b</b> another supplier → name it</span><span><b>' + (i + 1) + 'c</b> not sure → leave it</span></span></div>').join('');
}
function ansM() {
  const n = RM.guesses.length;
  return '<div class="ans"><span class="n">' + RM.count + '</span><span class="l"><b>suppliers not heard from since ' + U.dayY(RM.cut) + '</b>covers ' + RM.covered + ' of ' + RM.applies + ' · each with its last contact</span></div>' +
    '<div class="ln model"><span class="cue">' + U.I('pencil-line', 12) + 'Beside the count, not in it</span>' + n + ' of the ' + RM.count + ' may have been heard from, if the model’s matches are right: ' + U.list(RM.guesses.map(g => U.esc(g.row.s.name))) + '.</div>';
}
function ansN() {
  const n = RN.unmatched.length;
  let h = '<div class="ans"><span class="n">' + RN.count + '</span><span class="l"><b>suppliers not heard from since ' + U.dayY(RN.cut) + '</b>covers ' + RN.covered + ' of ' + RN.applies + ' · each with its last contact</span></div>';
  if (S.bad) h += '<div class="bad"><span class="tag">' + U.I('triangle-alert', 12) + 'What not to build</span><br><s>' + RN.count + ' suppliers. Sure for all ' + RN.count + '.</s> Looks surer than it is: ' + n + ' records that may belong to these suppliers go unsaid.</div>';
  else h += '<div class="hon">' + U.I('inbox', 14) + '<span><b style="font-weight:400">' + n + ' records matched nobody</b> and wait in Triage. If any is from one of these ' + RN.count + ', the answer is smaller.</span></div>' +
    '<p class="risk">' + U.I('triangle-alert', 14) + '<span><b>This line must stay.</b> Without the model nothing proposes a match, so the answer can look surer than it is. ' + U.kbd('H') + ' shows it without.</span></p>';
  return h;
}
const fill = x => x === 'MATCHES' ? matches() : x === 'KEY' ? key() : x === 'ANS-M' ? ansM() : x === 'ANS-N' ? ansN() : x;

function render() {
  document.body.classList.toggle('gw-off', !S.gateway);
  const P = phases();
  let k = 0;
  /* only the newest line deposits; the rest stay still (calm) */
  const show = arr => arr.map(x => { const i = k++; return i < S.shown ? '<div' + (i === S.shown - 1 ? ' class="dep"' : '') + '>' + fill(x) + '</div>' : ''; }).join('');
  const turnsM = 2 + 1 + 0, turnsN = 2 + 1;
  let h = '<header class="hd"><div><p class="eyebrow">' + U.esc(DATA.app) + ' · Ask · worked twice · Admin and docs view</p><h1>Same ink, different route</h1></div>' +
    '<div class="tools"><span class="chip' + (S.gateway ? ' gw-on' : '') + '">' + U.I(S.gateway ? 'pencil-line' : 'power-off', 14) + 'Model gateway <b>' + (S.gateway ? 'on' : 'off') + '</b> ' + U.kbd('G') + '</span><span class="chip">' + U.I('code', 14) + 'Technical ' + U.kbd('T') + '</span><span class="chip">' + U.I('rotate-ccw', 14) + 'Replay ' + U.kbd('R') + '</span><span class="small" style="flex-basis:100%;text-align:right">' + U.kbd('↑↓') + ' a match ' + U.kbd('C') + ' it’s them ' + U.kbd('N') + ' not them ' + U.kbd('H') + ' hide the unmatched line</span></div>' +
    '<p class="asked">' + U.I('quote', 14) + '<q>' + U.esc(Q.words) + '</q><span>' + U.esc(me.name) + ', ' + U.esc(U.floor(me.floor).name) + ', ' + U.dayS(Q.asked) + '. Run twice on the same records: once with the model gateway, once without.</span></p></header>';
  h += '<section class="tx"><div class="cols"><span class="micro" style="align-self:end">Step</span>' +
    '<span class="side m">' + U.I('pencil-line', 18) + 'With the model<small>' + (S.gateway ? 'proposes readings and matches; you confirm' : 'nobody gets this now: the gateway is off. ' + U.esc(DATA.admin.name) + ' can turn it on in Admin') + '</small></span><span></span>' +
    '<span class="side n">' + U.I('database', 18) + 'Without it<small>' + (S.gateway ? 'names, keys, spelling and the word list' : 'what everyone gets now; nothing else changes') + '</small></span></div><div class="rows scroll">';
  P.forEach((p, i) => {
    const before = k;
    const m = show(p.m), n = show(p.n);
    const vis = before < S.shown;
    h += '<div class="ph"><span class="lab">' + (vis ? (i + 1) + ' · ' + U.esc(p.lab) + '<small>' + U.esc(p.why) + '</small>' : '') + '</span><div class="col m">' + m + '</div><span class="gut' + (p.gut === '=' ? ' same' : '') + '">' + (k <= S.shown ? p.gut + '<small>' + p.gs + '</small>' : '') + '</span><div class="col n">' + n + '</div></div>';
  });
  h += '</div>';
  const ansVis = k < S.shown;
  h += '<div class="ph fin"><span class="lab">' + (ansVis ? (P.length + 1) + ' · The answer<small>Built from the steps by template. Counts are ink, the same both ways.</small>' : '') + '</span><div class="col m">' + (ansVis ? '<div' + (k === S.shown - 1 ? ' class="dep"' : '') + '>' + ansM() + '</div>' : '') + '</div><span class="gut same">' + (ansVis ? '=<small>same rows</small>' : '') + '</span><div class="col n">' + (ansVis ? '<div' + (k === S.shown - 1 ? ' class="dep"' : '') + '>' + ansN() + '</div>' : '') + '</div></div>';
  const nm = RM.guesses.length;
  h += '<div class="cost"><span class="micro">What each route cost</span>' +
    '<div class="c"><span>count <b>' + RM.count + '</b> in ink</span><span>your turns <b>' + turnsM + '</b> + ' + nm + ' yes/no</span><span>model gateway calls <b>2</b>, logged before each · ' + DATA.gateway.usedToday + ' of ' + DATA.gateway.limit + ' today</span></div>' +
    '<span class="gut">=</span>' +
    '<div class="c"><span>count <b>' + RN.count + '</b> in ink</span><span>your turns <b>' + turnsN + '</b> + a tick list + up to ' + RN.unmatched.length + ' key questions</span><span>model gateway calls <b>0</b></span></div></div>';
  h += '<p class="tk" style="margin-top:var(--space-1)">same query both ways: suppliers s, contract running on 2026-10-27, max(contact.on where kind in (' + W.contact.kinds.join(', ') + ')) &lt; ' + RM.cut + ' · linking: company_no, then pg_trgm ≥ 0.6 · with gateway: pgvector meaning-match stored as Triage proposals, never joined into the count</p></section>';
  app.innerHTML = h;
  U.hydrate(app);
}

app.addEventListener('click', e => {
  const d = e.target.closest('[data-dec]'); if (d) { S.decided[RM.guesses[+d.dataset.i].row.s.id] = d.dataset.dec; S.hot = +d.dataset.i; render(); return; }
  const p = e.target.closest('.pm'); if (p) { S.hot = +p.dataset.i; render(); }
});
addEventListener('keydown', e => {
  if (e.metaKey || e.ctrlKey || e.altKey) return;
  const k = e.key.toLowerCase();
  if (k === 'r') demo();
  else if (k === 'g') { S.gateway = !S.gateway; render(); }
  else if (k === 't') document.body.classList.toggle('tech');
  else if (k === 'h') { S.bad = !S.bad; render(); }
  else if (k === 'arrowdown' || k === 'arrowup') { const n = RM.guesses.length; S.hot = S.hot == null ? 0 : (S.hot + (k === 'arrowdown' ? 1 : n - 1)) % n; render(); e.preventDefault(); }
  else if ((k === 'c' || k === 'n') && S.hot != null) { S.decided[RM.guesses[S.hot].row.s.id] = k === 'c' ? 'yes' : 'no'; render(); }
});
let runId = 0;
async function demo() {
  const me2 = ++runId;
  Object.assign(S, { shown: 0, decided: {}, hot: null, bad: false });
  render();
  await U.wait(U.ms('--motion-run')); if (me2 !== runId) return;
  const total = phases().reduce((a, p) => a + p.m.length + p.n.length, 0) + 1;
  if (U.reduced()) S.shown = total;
  else for (let i = 1; i <= total; i++) { S.shown = i; render(); await U.wait(U.ms('--motion-instant')); if (me2 !== runId) return; }
  S.shown = 999; S.hot = 0; render();
  await U.wait(U.ms('--motion-calm')); if (me2 !== runId) return;
  S.decided[RM.guesses[0].row.s.id] = 'yes'; S.hot = 1; render();
}
demo();
