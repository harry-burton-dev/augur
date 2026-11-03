/* V2 the symbol unfolds: the picture is an Isotype count (one symbol = one overdue
   inspection at a month end). Any symbol opens into its record where it stands. */
const COLS = monthEnds();
const nowCol = COLS[COLS.length - 1];
const cnt = (c, st) => c.items.filter(x => x.s.st === st).length;
const lastZero = COLS.slice(0, -1).filter(c => !c.lost && cnt(c, 'overdue') + cnt(c, 'disputed') === 0).pop();
let SEL = null; /* {c: col index, k: symbol index} */
let OPEN = false;

$('#band').innerHTML = bandHTML();
$('#q').textContent = D.fact.question;
const n = cnt(nowCol, 'overdue'), p = cnt(nowCol, 'disputed');
/* the chart's title is its finding (template: from {zero month} to {n} now) */
$('#finding').innerHTML = `Overdue inspections went from <button class="ref" data-col="${COLS.indexOf(lastZero)}">none at the end of ${esc(MONTH[MON.indexOf(lastZero.m)])}</button> to <button class="ref ov" data-col="${COLS.length - 1}">${word(n)}${p ? ', and probably ' + word(n + p) : ''}, today</button>.`;
$('#sub').innerHTML = `One symbol is one inspection that was overdue at the end of that month. Counted from <b>${D.visits.length} visits</b> recorded against <b>${D.entity.name}</b>’s ${word(D.regime.length)} inspections; ${esc(D.noRecord.why)}, so part of February and March is <b>no record</b>, not zero.`;

function drawIso() {
  const cols = COLS.map((c, ci) => {
    if (c.lost) return `<div class="col lost" data-c="${ci}">${BREAK}<span class="why">No record</span><span class="tk">record.gap</span></div>`;
    const syms = c.items.map((x, k) => {
      const r = x.r, st = x.s.st;
      const label = st === 'norecord' ? `${r.name}: can’t say, its due date fell in the lost stretch` : `${r.name}: ${D.states[st].one} at ${c.today ? 'today' : 'the end of ' + c.m}`;
      return `<button class="sym" data-c="${ci}" data-k="${k}" aria-label="${esc(label)}"><span class="cell" data-state="${st}" data-id="${r.id}">${st === 'norecord' ? BREAK : ico(r.icon, 20)}</span></button>`;
    }).join('');
    return `<div class="col ${c.today ? 'today' : ''}" data-c="${ci}">${syms || '<span class="zero">none</span>'}</div>`;
  }).join('');
  const months = COLS.map(c => `<span class="${c.today ? 't' : ''}">${esc(c.m)}${c.m === 'Jan' ? ' ' + c.y : ''}</span>`).join('');
  $('#iso').innerHTML = `<div class="cols" id="cols">${cols}</div><div class="months">${months}</div><p class="ikey"><span><span class="cell s" data-state="overdue"></span>overdue at that month end</span><span><span class="cell s" data-state="disputed"></span>probably overdue: sources disagree</span><span>${BREAK}can’t say: it fell due in the stretch with no record</span></p>`;
  Icons.hydrate($('#iso'));
}
function drawNote() {
  const left = D.regime.filter(r => ['gap','hidden','na'].includes(r.state));
  const unit = { name: 'x', state: 'overdue', icon: 'clipboard-list', id: 'unit' };
  $('#tnote').innerHTML = `
  <section><h3>Why this picture</h3><p>The question was “is it getting worse?”, so the picture counts over time. A chart picker would have offered a pie; a pie can’t show a trend.</p><span class="tk">template: count-over-time · isotype · unit = 1 entity</span></section>
  <section><h3>One symbol is</h3><p class="one">${cellHTML(unit)} one inspection, overdue that month</p><p>Its picture says which inspection. Symbols are repeated, never made bigger, so you can count them.</p></section>
  <section><h3>Not in the picture</h3><ul class="left">${left.map(r => `<li>${cellHTML(r)}<span><b>${esc(r.name)}</b>: ${esc(D.states[r.state].one)}. ${esc(r.state === 'gap' ? r.fill + ' could fill it.' : r.state === 'hidden' ? 'Ask ' + r.ask + '.' : r.naWhy)}</span></li>`).join('')}</ul></section>
  <section><h3>Made by</h3><p>The picture is drawn by the “count over time” template from the records; nobody typed a number. <b>${esc(D.viewer.name)}</b> chose it for this question.</p></section>`;
  Icons.hydrate($('#tnote'));
}

function lane(r, ci) {
  return `<div class="lane"><span>${esc(r.name)}, each month:</span>${COLS.map((c, i) => {
    if (c.lost) return `<span class="cell" data-state="norecord" title="no record"></span>`;
    const x = c.items.find(y => y.r.id === r.id);
    return `<span class="cell ${i === ci ? 'lit' : ''}" data-state="${x ? x.s.st : 'none'}" title="${esc(c.m)}"></span>`;
  }).join('')}</div>`;
}
function openCard(ci, k) {
  closeCard(true);
  const c = COLS[ci], x = c.items[k]; if (!x) return;
  SEL = { c: ci, k }; OPEN = true;
  const r = x.r, st = x.s.st;
  const iso = $('#iso'), sym = $(`.sym[data-c="${ci}"][data-k="${k}"]`);
  const ir = iso.getBoundingClientRect(), sr = sym.getBoundingClientRect();
  const when = c.today ? 'today' : 'at the end of ' + c.m + ' ' + c.y;
  let say;
  if (st === 'overdue') say = `${when === 'today' ? 'Today' : cap(when)}, <b>${esc(r.name.toLowerCase())}</b> ${c.today ? 'are' : 'were'} <b>${x.s.late} days overdue</b>. Due ${esc(fmt(x.s.due))}; no visit recorded since.`;
  else if (st === 'disputed') say = `${cap(when)}, <b>${esc(r.name.toLowerCase())}</b> were due on ${esc(fmt(x.s.due))}. Two sources disagree about whether the visit happened.`;
  else say = `${cap(when)}, we can’t say. <b>${esc(r.name)}</b> fell due on ${esc(fmt(x.s.due))}, inside the stretch with no record. It may have been done.`;
  const card = document.createElement('div');
  card.className = 'card from'; card.setAttribute('role', 'dialog'); card.setAttribute('aria-label', r.name + ', ' + when);
  /* place the card beside its symbol, inside the chart */
  const w = Math.min(ir.width, parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--measure-read')) - MS('--space-4'));
  let left = sr.left - ir.left + sr.width + MS('--space-4');
  if (left + w > ir.width) left = Math.max(0, sr.left - ir.left - w - MS('--space-4'));
  card.style.left = left + 'px'; card.style.top = '0px';
  card.style.setProperty('--ox', (sr.left - ir.left - left + sr.width / 2) + 'px');
  card.style.setProperty('--oy', (sr.top - ir.top + sr.height / 2) + 'px');
  card.innerHTML = `<button class="close" id="fold">${ico('chevrons-down-up', 14)} <span class="kbd">esc</span> fold</button>
    <div class="top">${cellHTML({ ...r, state: st === 'norecord' ? 'gap' : st })}<div><h2>${esc(r.name)}</h2><p class="when">${esc(cap(when))} · ${esc(r.every)} · by ${esc(r.by)}</p><span class="tk">${esc(r.id)} · statusAt(${esc(c.d)})</span></div></div>
    <p class="say">${say}</p>
    ${lane(r, ci)}
    <p class="eyebrow" style="margin-bottom:var(--space-2)">The records</p>
    ${visitsHTML(r)}`;
  iso.appendChild(card); Icons.hydrate(card);
  iso.classList.add('open');
  $$('.sym').forEach(b => b.setAttribute('tabindex', '-1'));
  requestAnimationFrame(() => requestAnimationFrame(() => card.classList.remove('from')));
  $('#fold').focus({ preventScroll: true });
}
function closeCard(quick) {
  const card = $('.card'); if (!card) return;
  OPEN = false; $('#iso').classList.remove('open');
  $$('.sym').forEach(b => b.removeAttribute('tabindex'));
  if (quick || REDUCE) card.remove();
  else { card.classList.add('from'); setTimeout(() => card.remove(), MS('--motion-slow')); }
  if (SEL && !quick) { const s = $(`.sym[data-c="${SEL.c}"][data-k="${SEL.k}"]`); if (s) s.focus({ preventScroll: true }); }
}
function focusSym(ci, k) {
  const s = $(`.sym[data-c="${ci}"][data-k="${k}"]`); if (s) { SEL = { c: ci, k }; s.focus({ preventScroll: true }); }
}
function move(dc, dk) {
  if (OPEN) closeCard(true);
  let { c, k } = SEL || { c: COLS.length - 1, k: 0 };
  if (dc) { let i = c; do { i = (i + dc + COLS.length) % COLS.length; } while (!COLS[i].items.length || COLS[i].lost); c = i; k = Math.min(k, COLS[c].items.length - 1); }
  if (dk) k = Math.max(0, Math.min(COLS[c].items.length - 1, k + dk));
  focusSym(c, k);
}
document.addEventListener('click', e => {
  if (e.target.closest('#fold')) { closeCard(); return; }
  const s = e.target.closest('.sym'); if (s) { openCard(+s.dataset.c, +s.dataset.k); return; }
  const rf = e.target.closest('.ref[data-col]'); if (rf) { const ci = +rf.dataset.col; COLS[ci].items.length ? focusSym(ci, 0) : null; return; }
  if (OPEN && !e.target.closest('.card')) closeCard();
});
KEYS.ArrowRight = () => move(1, 0); KEYS.ArrowLeft = () => move(-1, 0);
KEYS.ArrowUp = () => move(0, 1); KEYS.ArrowDown = () => move(0, -1);
KEYS.Enter = () => { if (SEL && !OPEN) openCard(SEL.c, SEL.k); };
KEYS.Escape = () => closeCard();

async function demo(id) {
  const ci = COLS.length - 1;
  const k = COLS[ci].items.findIndex(x => x.r.id === oldest.id);
  focusSym(ci, k); await wait('--motion-calm'); if (!demoAlive(id)) return;
  openCard(ci, k);
}
function boot() {
  closeCard(true); SEL = null;
  drawIso(); drawNote();
  $('#wrap').classList.add('pre');
  requestAnimationFrame(() => requestAnimationFrame(() => $('#wrap').classList.remove('pre')));
  startDemo(demo);
}
window.replay = boot;
boot();
