/* V1 the ladder: one height on the stage at a time; "your place" (one inspection)
   is carried between heights, so stepping up or down never loses it. */
const HEIGHTS = [
  { w: 'Said in a sentence', tech: 'headline', s: () => '2 sentences, from a template' },
  { w: 'As a picture', tech: 'aggregate · count by state', s: () => D.regime.length + ' symbols, one per inspection' },
  { w: 'The records', tech: 'entities · observations', s: () => D.regime.length + ' inspections, ' + D.visits.length + ' visits' }
];
/* reading order for moving your place: by state, then lateness */
const SEQ = ORDER.flatMap(s => byState(s).sort((a, b) => (b.late || 0) - (a.late || 0))).map(r => r.id);
let H = 0, HOLD = null;

$('#band').innerHTML = bandHTML();
$('#rungs').innerHTML = HEIGHTS.map((h, i) => `<li><button class="rung" data-h="${i}"><span class="dot"></span><span class="w">${esc(h.w)}</span><span class="s">${esc(h.s())}</span><span class="tk">${esc(h.tech)}</span></button></li>`).join('');

function holdRef() { return HOLD ? R(HOLD) : null; }
function phraseFor(id) {
  /* the phrase in the sentence that contains this item */
  const r = R(id);
  if (r.id === oldest.id) return 'item:' + r.id;
  return 'state:' + r.state;
}

function h1() {
  const r = holdRef();
  let hl = '';
  if (r) {
    const ph = headlineParts().concat(secondParts()).find(p => typeof p !== 'string' && p.ref === phraseFor(r.id));
    hl = `<p class="holdline">Your place: <b>${esc(r.name)}</b>${ph ? `, inside “${esc(ph.t)}”` : `, which the sentence doesn’t name (${esc(D.states[r.state].one)})`}.</p>`;
  }
  const hr = R('hoist');
  return `<h2>${esc(D.fact.question)}</h2>
  <p class="bl">${partsHTML(headlineParts())}</p>
  <p class="bl2">${partsHTML(secondParts())}</p>
  <div class="sure">
    <span><span class="conf">Almost certain</span> for <b>${word(COUNT.overdue)}</b>: no visit recorded after the due date, from ${D.visits.length} visits read from Artifacts</span>
    <span><span class="conf">${esc(hr.confidence)}</span> for the ${ORD[COUNT.overdue + 1]}: two sources disagree</span>
  </div>${hl}`;
}
function h2() {
  const groups = ORDER.filter(s => COUNT[s]).map(s => `<div class="grp"><p class="gh"><b>${COUNT[s]}</b>${esc(D.states[s].plain)}</p><div class="row">${
    byState(s).map(r => `<button class="unit" data-id="${r.id}">${cellHTML(r)}<span class="nm">${esc(r.name)}</span><span class="st">${esc(shortStatus(r))}</span></button>`).join('')}</div></div>`).join('');
  return `<h2>Every inspection at ${esc(D.entity.name)}, one symbol each</h2>
  <p class="pt">${esc(cap(word(COUNT.overdue)))} of ${word(D.regime.length)} are overdue, and one probably is.</p>
  <div class="groups">${groups}</div>
  <p class="made">One symbol is one inspection; symbols are counted, never scaled. Drawn from the counts below, by template.</p>
  <div class="key">${stateKey()}</div>`;
}
function h3() {
  const r = holdRef() || oldest;
  const rows = SEQ.map(id => { const x = R(id); return `<tr data-id="${x.id}" class="${x.id === r.id ? 'lit' : ''}">
    <td>${cellHTML(x, 's')}${esc(x.name)}</td><td>${esc(x.every || '')}</td><td>${x.last ? esc(fmt(x.last)) : ''}</td><td>${x.due ? esc(fmt(x.due)) : ''}</td><td>${esc(shortStatus(x))}</td><td class="k">${esc(x.id)}</td></tr>`; }).join('');
  return `<h2>The records behind the picture</h2>
  <div class="recs"><div class="tw scroll"><table class="rt"><thead><tr><th>Inspection</th><th>How often</th><th>Last done</th><th>Due</th><th>Now</th><th>Key</th></tr></thead><tbody>${rows}</tbody></table></div>
  <aside class="scroll" id="aside"><p class="eyebrow">Your place</p><h3>${esc(r.name)}</h3><p class="say">${esc(itemLine(r))}</p>${visitsHTML(r)}</aside></div>`;
}
const PAGES = [h1, h2, h3];

function paint() {
  const st = $('#stage');
  st.innerHTML = PAGES.map((f, i) => `<section class="ht ${i < H ? 'above' : i > H ? 'below' : ''}" data-h="${i}" ${i !== H ? 'aria-hidden="true" inert' : ''}>${f()}</section>`).join('');
  Icons.hydrate(st);
  light();
}
function light() {
  $$('.rung').forEach(b => b.setAttribute('aria-current', +b.dataset.h === H ? 'true' : 'false'));
  const r = holdRef();
  $$('.ref').forEach(b => b.classList.toggle('lit', !!r && b.dataset.ref === phraseFor(r.id)));
  $$('.unit .cell').forEach(c => c.classList.toggle('lit', !!r && c.dataset.id === r.id));
  $('#hold').innerHTML = r
    ? `<p class="eyebrow">Your place</p><p class="hn">${cellHTML(r)}${esc(r.name)}</p><span>${esc(D.states[r.state].plain)} · ${esc(shortStatus(r))}. It stays held as you change height.</span>`
    : `<p class="eyebrow">Your place</p><span>Nothing held. Pick a phrase, a symbol or a row, or press <span class="kbd">&rarr;</span>.</span>`;
  Icons.hydrate($('#hold'));
}
function go(h) {
  h = Math.max(0, Math.min(2, h));
  if (h === H) return;
  const prev = H; H = h;
  const secs = $$('.ht');
  secs.forEach((s, i) => { s.classList.remove('above', 'below'); if (i !== H) s.classList.add(i < H ? 'above' : 'below'); s.toggleAttribute('aria-hidden', i !== H); s.inert = i !== H; });
  /* re-render the height we arrive at, so it is drawn around your place */
  secs[H].innerHTML = PAGES[H](); Icons.hydrate(secs[H]);
  light();
  if (H === 2) { const tr = $('.rt tr.lit'); if (tr) tr.scrollIntoView({ block: 'nearest' }); }
}
function hold(id) { HOLD = id; if (H === 2) { const s = $$('.ht')[2]; s.innerHTML = h3(); Icons.hydrate(s); } light(); }
function step(d) { const i = HOLD ? SEQ.indexOf(HOLD) : -1; hold(SEQ[(i + d + SEQ.length) % SEQ.length]); }

document.addEventListener('click', e => {
  const rg = e.target.closest('.rung'); if (rg) { go(+rg.dataset.h); return; }
  const rf = e.target.closest('.ref'); if (rf) { hold(refItems(rf.dataset.ref)[0]); return; }
  const u = e.target.closest('.unit,[data-id]'); if (u && u.dataset.id && !u.closest('#hold')) { hold(u.dataset.id); }
});
KEYS.ArrowDown = () => go(H + 1);
KEYS.ArrowUp = () => go(H - 1);
KEYS.ArrowRight = () => step(1);
KEYS.ArrowLeft = () => step(-1);
KEYS['1'] = () => go(0); KEYS['2'] = () => go(1); KEYS['3'] = () => go(2);

async function demo(id) {
  const ok = () => demoAlive(id);
  hold(oldest.id); await wait('--motion-calm'); if (!ok()) return;
  go(1); await wait('--motion-run'); if (!ok()) return;
  go(2); await wait('--motion-still'); if (!ok()) return;
  step(1); await wait('--motion-run'); if (!ok()) return;
  go(1); await wait('--motion-run'); if (!ok()) return;
  go(0);
}
window.replay = () => { H = 0; HOLD = null; paint(); $('#wrap').classList.add('pre'); requestAnimationFrame(() => requestAnimationFrame(() => $('#wrap').classList.remove('pre'))); startDemo(demo); };
paint();
requestAnimationFrame(() => requestAnimationFrame(() => $('#wrap').classList.remove('pre')));
startDemo(demo);
