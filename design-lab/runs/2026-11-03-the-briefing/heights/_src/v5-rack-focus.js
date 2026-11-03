/* V5 rack focus: three planes on screen at once, a height each: sites like this one,
   this site, its records. Focus pulls between them; the far planes blur but never go. */
const PLANES = [
  { w: 'Sites like it', s: 'one step up: is this unusual?', tech: 'peer set · same kind, same floor' },
  { w: D.entity.name, s: 'the site: which ones?', tech: 'entity · aggregate' },
  { w: 'The records', s: 'one step down: how do we know?', tech: 'observations · sources' }
];
const SEQ = ORDER.flatMap(s => byState(s).sort((a, b) => (b.late || 0) - (a.late || 0)));
let P = 1, HOLD = oldest.id;

$('#band').innerHTML = bandHTML();
$('#pull').innerHTML = `<p class="eyebrow">In focus</p>` + PLANES.map((p, i) => `<button data-p="${i}"><span class="dot"></span><span class="w">${esc(p.w)}</span><span class="s">${esc(p.s)}</span><span class="tk">${esc(p.tech)}</span></button>`).join('');

const late = cells => cells.filter(c => c === 'overdue' || c === 'disputed').length;
function drawA() {
  const seen = D.peers.filter(p => !p.locked), locked = D.peers.filter(p => p.locked);
  const ranked = seen.slice().sort((a, b) => late(b.cells) - late(a.cells));
  const here = seen.find(p => p.here), others = ranked.filter(p => !p.here);
  const top = ranked[0] === here;
  const named = others.filter(p => late(p.cells)).map(p => `${p.name.split(' ')[0]} has ${word(late(p.cells))}`);
  const none = others.filter(p => !late(p.cells)).length;
  const title = `${esc(here.name)} has ${top ? 'the most overdue' : 'more overdue than most'} of the ${word(seen.length)} sites you can see. ${esc(named.join(', '))}${none ? `, and ${word(none)} ${none === 1 ? 'has' : 'have'} none` : ''}.`;
  const rows = D.peers.map(p => p.locked
    ? `<span class="nm">${esc(p.name)}</span><span class="lockrow"><span class="bar"></span></span><span class="say"><span class="unseen">${ico('lock', 12)} ${esc(floorOf(p.keptOn).name)}</span> ${esc(D.hiddenCount)} inspections, on a floor you can’t open. Ask ${esc(p.ask)}.</span>`
    : `<span class="nm ${p.here ? 'here' : ''}">${esc(p.name)}</span><span class="row">${p.cells.map(c => `<span class="cell" data-state="${c}"></span>`).join('')}</span><span class="say"><b>${late(p.cells) ? word(late(p.cells)) : 'none'}</b> overdue or probably overdue${p.cells.includes('gap') ? ', one not known yet' : ''}</span>`).join('');
  $('#pA').innerHTML = `<div class="ph"><h2>${title}</h2></div><div class="peers">${rows}</div><span class="tk">peers: kind = site, floor ≤ yours · counts per state, same template</span>`;
}
function drawB() {
  $('#pB').innerHTML = `<div class="ph"><h2>${partsHTML(headlineParts())}</h2></div>
  <div class="site">${SEQ.map(r => `<button class="u" data-id="${r.id}">${cellHTML(r)}<span class="nm">${esc(r.name)}</span><span class="st">${esc(shortStatus(r))}</span></button>`).join('')}</div>`;
}
function drawC() {
  const r = R(HOLD);
  const rows = SEQ.map(x => `<tr data-id="${x.id}" class="${x.id === HOLD ? 'lit' : ''}"><td>${cellHTML(x, 's')}${esc(x.name)}</td><td>${x.last ? esc(fmt(x.last)) : ''}</td><td>${x.due ? esc(fmt(x.due)) : ''}</td><td>${esc(shortStatus(x))}</td><td class="k">${x.visits.length || ''}</td></tr>`).join('');
  $('#pC').innerHTML = `<div class="ph"><h2>How we know: ${esc(r.name.toLowerCase())}</h2></div>
  <div class="recs"><div class="tw scroll"><table class="rt"><thead><tr><th>Inspection</th><th>Last done</th><th>Due</th><th>Now</th><th>Visits</th></tr></thead><tbody>${rows}</tbody></table></div>
  <aside class="scroll"><p class="say">${esc(itemLine(r))}</p>${visitsHTML(r)}</aside></div>`;
}
function draw() { drawA(); drawB(); drawC(); Icons.hydrate($('#planes')); focus(); }
function focus() {
  $$('.plane').forEach(p => { const far = +p.dataset.p !== P; p.classList.toggle('far', far); p.inert = false; p.setAttribute('aria-hidden', 'false'); });
  $$('#pull button').forEach(b => b.setAttribute('aria-current', +b.dataset.p === P ? 'true' : 'false'));
  $$('.site .cell').forEach(c => c.classList.toggle('lit', c.dataset.id === HOLD));
  $$('.ph .ref').forEach(b => b.classList.toggle('lit', refItems(b.dataset.ref).includes(HOLD)));
  $$('.peers .nm.here').forEach(n => { n.nextElementSibling.classList.toggle('hl', P === 0); });
}
function pull(p) { P = Math.max(0, Math.min(2, p)); focus(); }
function hold(id) { HOLD = id; drawC(); Icons.hydrate($('#pC')); focus(); }
function step(d) { const i = SEQ.findIndex(r => r.id === HOLD); hold(SEQ[(i + d + SEQ.length) % SEQ.length].id); }

document.addEventListener('click', e => {
  const b = e.target.closest('#pull button'); if (b) { pull(+b.dataset.p); return; }
  const u = e.target.closest('.u,[data-id]'); if (u && u.closest('.planes')) { hold(u.dataset.id); pull(u.closest('#pC') ? 2 : 2); return; }
  const rf = e.target.closest('.ph .ref'); if (rf) { hold(refItems(rf.dataset.ref)[0]); pull(1); return; }
  const pl = e.target.closest('.plane'); if (pl) pull(+pl.dataset.p);
});
KEYS.ArrowUp = () => pull(P - 1); KEYS.ArrowDown = () => pull(P + 1);
KEYS.ArrowRight = () => step(1); KEYS.ArrowLeft = () => step(-1);

async function demo(id) {
  pull(0); await wait('--motion-run'); if (!demoAlive(id)) return;
  pull(1); await wait('--motion-shimmer'); if (!demoAlive(id)) return;
  pull(2);
}
window.replay = () => { P = 1; HOLD = oldest.id; draw(); $('#wrap').classList.add('pre'); requestAnimationFrame(() => requestAnimationFrame(() => $('#wrap').classList.remove('pre'))); startDemo(demo); };
draw();
requestAnimationFrame(() => requestAnimationFrame(() => $('#wrap').classList.remove('pre')));
startDemo(demo);
