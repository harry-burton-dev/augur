/* V6 the lead's questions: the heights are reached by the questions a lead asks
   after the bottom line. Each answer is drawn at the height that question needs,
   and the questions asked, in order, become the briefing. */
let GW = true; /* the model gateway */
const ASKED = [];
const COLS = monthEnds();
const late = cells => cells.filter(c => c === 'overdue' || c === 'disputed').length;

const QS = [
  { id: 'which', q: 'Which ones?', ht: 'picture', tech: 'aggregate · by state', a: ansWhich, line: () => `${byState('overdue').map(r => r.name).join(', ')}; hoists disputed` },
  { id: 'how', q: 'How do you know?', ht: 'records', tech: 'observations · sources', a: ansHow, line: () => `${D.visits.length} visits from reports in Artifacts; one dispute` },
  { id: 'since', q: 'Since when?', ht: 'picture over time', tech: 'count over time', a: ansSince, line: () => 'none at the end of August; rising since' },
  { id: 'usual', q: 'Is that unusual?', ht: 'one step up', tech: 'peer set', a: ansUsual, line: () => 'the most of the five sites you can see' },
  { id: 'why', q: 'Why?', ht: 'pencil', tech: 'model gateway · proposal', a: ansWhy, line: () => GW ? 'a proposed reason, not yet accepted' : 'records that may explain it', pencil: true },
  { id: 'now', q: 'What now?', ht: 'use it', tech: 'publish · bind · watch', a: ansNow, line: () => 'brief, feed the intent, or watch' }
];

function ansWhich() {
  const groups = ['overdue', 'disputed', 'soon'].map(s => byState(s).map(r => `<span class="u">${cellHTML(r)}<span>${esc(r.name)}<span>${esc(shortStatus(r))}</span></span></span>`).join('')).join('');
  const rest = D.regime.filter(r => !['overdue', 'disputed', 'soon'].includes(r.state));
  return `<p class="say">These ${word(COUNT.overdue)} are overdue, <b>workshop hoists</b> probably are, and ${word(COUNT.soon)} fall due within a fortnight.</p>
  <div class="rowc">${groups}</div>
  <p class="say" style="margin-top:var(--space-2);font-size:var(--type-small);color:var(--ink-muted)">The other ${word(rest.length)}: ${rest.map(r => `${cellHTML(r, 's')} ${esc(r.name.toLowerCase())} (${esc(shortStatus(r))})`).join(', ')}.</p>`;
}
function ansHow() {
  const ov = byState('overdue').concat(byState('disputed'));
  const docs = new Set(D.visits.map(v => v.src)).size;
  const hoist = byState('disputed')[0];
  return `<p class="say"><span class="conf">Almost certain</span> for ${word(COUNT.overdue)}: from <b>${D.visits.length} visits</b> read from <b>${docs} reports</b> in Artifacts, no visit is recorded after each due date. <span class="conf">${esc(hoist.confidence)}</span> for the hoists: two sources disagree.</p>
  <ul class="vis">${ov.filter(r => r.state === 'overdue').map(r => { const v = r.visits[r.visits.length - 1]; return `<li>${ico('file-text', 14)}<span><b>${esc(r.name)}: last visit ${esc(fmt(v.date))}</b> ${esc(v.by)} <span class="id">${esc(v.id)}</span> · from <i>${esc(v.src)}</i></span></li>`; }).join('')}</ul>
  <div class="fork" style="margin-top:var(--space-2)">${hoist.sides.map(s => `<div class="alt"><b>${esc(s.says)}</b><span>${esc(s.from)}</span><span>${esc(s.gradeWord)}<span class="tk"> · grade ${s.grade}</span></span></div>`).join('')}</div>`;
}
function ansSince() {
  const z = COLS.slice(0, -1).filter(c => !c.lost && !c.items.some(x => x.s.st === 'overdue' || x.s.st === 'disputed')).pop();
  return `<p class="say">None was overdue at the end of <b>${esc(MONTH[MON.indexOf(z.m)])}</b>. Since then, ${COLS.filter(c => c.d > z.d).map(c => `${c.today ? 'today' : c.m} ${c.items.filter(x => x.s.st === 'overdue').length}`).join(', ')}.</p>
  <div class="mini">${COLS.map(c => c.lost ? `<div class="c lost">${BREAK}</div>` : `<div class="c">${c.items.map(x => `<span class="cell" data-state="${x.s.st}"></span>`).join('')}</div>`).join('')}
  ${COLS.map(c => `<span class="m">${esc(c.today ? 'now' : c.m)}</span>`).join('')}</div>
  <p class="say" style="margin-top:var(--space-2);font-size:var(--type-small);color:var(--ink-muted)">${BREAK} No record ${esc(fmtS(D.noRecord.from))} to ${esc(fmtS(D.noRecord.to))}: ${esc(D.noRecord.why)}.</p>`;
}
function ansUsual() {
  const seen = D.peers.filter(p => !p.locked);
  return `<p class="say">Yes. Of the ${word(seen.length)} sites you can see, ${esc(D.entity.name)} has the most. One more site is kept where you can’t see it.</p>
  <div class="peers">${D.peers.map(p => p.locked
    ? `<span>${esc(p.name)}</span><span class="lockbar"></span><span class="say2"><span class="unseen">${ico('lock', 12)} ${esc(floorOf(p.keptOn).name)}</span> ask ${esc(p.ask)}</span>`
    : `<span class="${p.here ? 'here' : ''}">${esc(p.name)}</span><span class="row">${p.cells.map(c => `<span class="cell" data-state="${c}"></span>`).join('')}</span><span class="say2">${late(p.cells) ? word(late(p.cells)) : 'none'}</span>`).join('')}</div>`;
}
function linkFor(id) {
  if (id === D.contract.id) return `${ico('file-text', 12)} ${esc(D.contract.id)} ${esc(D.contract.name)} with ${esc(D.contract.with)}, ended ${esc(fmt(D.contract.ended))}${D.contract.renewed ? '' : ', not renewed'}`;
  const v = V(id); if (v) return `${ico('file-text', 12)} ${esc(v.id)} last extinguisher service, ${esc(fmt(v.date))}`;
  const m = D.intents.find(i => i.id === id); if (m) return `${ico('target', 12)} ${esc(m.id)} “${esc(m.title)}”, ${esc(m.owner)}${m.due ? ', due ' + esc(fmt(m.due)) + (m.due < D.today ? ', past its deadline' : '') : ''}`;
  return esc(id);
}
function ansWhy() {
  const links = D.pencil.links.map(l => `<button>${linkFor(l)}</button>`).join('');
  if (!GW) return `<div class="pencil off"><span class="pby">${ico('pen-line', 12)} model gateway is off: no proposed reason</span>These records may explain it. Nothing here was counted differently.<div class="plinks">${links}</div></div>`;
  return `<div class="pencil"><span class="pby">${ico('pencil', 12)} proposed by the ${esc(D.pencil.by)} · not yet accepted</span>${esc(D.pencil.text)}
  <div class="plinks">${links}</div>
  <div class="acc"><button>Accept as a note</button><button>Set aside</button></div></div>
  <p class="say" style="margin-top:var(--space-2);font-size:var(--type-small);color:var(--ink-muted)">A reason is the only thing a model may write here. It never changes a count, and it stays in pencil until a person accepts it.</p>`;
}
function ansNow() {
  const m = D.intents[0];
  return `<div class="acts">
    <button class="act"><b>${ico('book-open', 16)} Brief ${esc(D.lead.name.split(' ')[0])}</b>Publish these answers as a briefing in Artifacts.<span class="reach">Reach: ${esc(D.lead.name)} first, then ${esc(floorOf('facilities').name)} (${D.reach.department} people)</span></button>
    <button class="act"><b>${ico('target', 16)} Feed the intent</b>Attach the finding to “${esc(m.title)}”.<span class="reach">Reach: ${esc(m.owner)}, owner, on the ${esc(floorOf(m.floor).word)}</span></button>
    <button class="act"><b>${ico('bell-plus', 16)} Watch for change</b>Tell me when the count of overdue inspections here changes.<span class="reach">Reach: only you. Checked when a visit is recorded</span></button>
  </div>`;
}

function drawQs() {
  $('#qs').innerHTML = QS.map((q, i) => `<button data-q="${q.id}" class="${q.pencil ? 'pq' : ''}" aria-pressed="${ASKED.includes(q.id)}"><span class="kbd">${i + 1}</span>${esc(q.q)}<span class="h">${esc(q.ht)}</span></button>`).join('');
}
function drawBrief() {
  const items = ASKED.map(id => QS.find(q => q.id === id));
  $('#brief').innerHTML = `<h3>Your briefing, so far</h3>
  <p class="bluf"><b>Bottom line.</b> ${esc(headlineParts().map(p => typeof p === 'string' ? p : p.t).join(''))}</p>
  ${items.length ? `<ol>${items.map(q => `<li class="${q.pencil ? 'p' : ''}"><b>${esc(q.q)}</b> ${esc(q.line())}</li>`).join('')}</ol>` : `<p class="empty">Ask a question on the left. Each one you ask becomes a section here, in the order a lead reads it.</p>`}
  <button class="go">${ico('send', 16)} Make it a briefing in Artifacts</button>
  <p class="note">Ink sections are built from records by template. ${ASKED.includes('why') ? `The <b>Why?</b> section goes in as pencil unless you accept it.` : ''}</p>
  <p class="gw ${GW ? '' : 'off'}">${ico(GW ? 'sparkles' : 'pen-line', 12)} model gateway ${GW ? 'on' : 'off'} <span class="kbd">G</span></p>`;
  Icons.hydrate($('#brief'));
}
function ask(id, quiet) {
  const q = QS.find(x => x.id === id); if (!q) return;
  if (!ASKED.includes(id)) ASKED.push(id);
  let el = $(`.ans[data-q="${id}"]`);
  const html = `<div class="aq"><b>${esc(q.q)}</b><span class="ht">${esc(q.ht)}</span><span class="tk">${esc(q.tech)}</span></div><div class="aa">${q.a()}</div>`;
  if (el) el.innerHTML = html;
  else { el = document.createElement('section'); el.className = 'ans fresh'; el.dataset.q = id; el.innerHTML = html; $('#answers').appendChild(el); requestAnimationFrame(() => requestAnimationFrame(() => el.classList.remove('fresh'))); }
  Icons.hydrate(el);
  if (!quiet) el.scrollIntoView({ block: 'nearest', behavior: REDUCE ? 'auto' : 'smooth' });
  drawQs(); drawBrief();
}
function setGW(on) { GW = on; if (ASKED.includes('why')) ask('why', true); drawBrief(); }

$('#band').innerHTML = bandHTML();
$('#q').textContent = D.fact.question;
$('#bl').innerHTML = partsHTML(headlineParts());
document.addEventListener('click', e => {
  const b = e.target.closest('.qs button'); if (b) { ask(b.dataset.q); return; }
  const rf = e.target.closest('.bl .ref'); if (rf) ask(rf.dataset.ref === 'state:disputed' ? 'how' : 'which');
});
QS.forEach((q, i) => KEYS[String(i + 1)] = () => ask(q.id));
KEYS.g = () => setGW(!GW);

async function demo(id) {
  ask('which'); await wait('--motion-spin'); if (!demoAlive(id)) return;
  ask('how'); await wait('--motion-spin'); if (!demoAlive(id)) return;
  ask('why');
}
window.replay = () => { ASKED.length = 0; $('#answers').innerHTML = ''; drawQs(); drawBrief(); startDemo(demo); };
drawQs(); drawBrief();
requestAnimationFrame(() => requestAnimationFrame(() => $('#wrap').classList.remove('pre')));
startDemo(demo);
