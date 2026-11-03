/* V4 the detail dial: one control for height. The same eleven elements (one per
   inspection) move from a number, to one bar, to a lane each, to every visit. */
const STOPS = [
  { w: 'One number', s: 'the bottom line', tech: 'scalar' },
  { w: 'One bar', s: 'eleven cells, by state', tech: 'part-to-whole · count by state' },
  { w: 'A line each', s: 'due dates and lateness', tech: 'timeline per entity' },
  { w: 'Every visit', s: 'each record, with its source', tech: 'observations · prov' }
];
const SEQ = ORDER.flatMap(s => byState(s).sort((a, b) => (b.late || 0) - (a.late || 0)));
let STOP = 0, HOLD = oldest.id;
/* time domain for lanes: from the first visit, with room, to a month past today */
const firstVisit = D.visits.map(v => v.date).sort()[0];
const DOM0 = addMonths(firstVisit, -1), DOM1 = addMonths(D.today, 1);
const SPAN = days(DOM0, DOM1);
const pct = d => Math.max(0, Math.min(100, 100 * days(DOM0, d) / SPAN));

$('#band').innerHTML = bandHTML();
$('#stops').innerHTML = STOPS.map((s, i) => `<li><button data-stop="${i}">${esc(s.w)}<span>${esc(s.s)}</span><span class="tk">${esc(s.tech)}</span></button></li>`).join('');

function laneSVG(r) {
  if (r.state === 'gap') return `<div class="gapbox"></div><div class="say">Not known yet: none ever recorded. <b>${esc(r.fill)}</b>&nbsp;could fill it.</div>`;
  if (r.state === 'hidden') return `<div class="hidbox"></div><div class="say"><span class="unseen">${ico('lock', 12)} ${esc(floorOf(r.keptOn).name)}</span> Kept on a floor you can’t open. Ask ${esc(r.ask)}.</div>`;
  if (r.state === 'na') return `<div class="say">Doesn’t apply. ${esc(r.naWhy)}</div>`;
  const vs = r.visits.filter(v => !v.disputed);
  let s = '';
  if (!vs.length && r.last) {
    s += `<rect class="fine" x="0%" y="46%" width="${pct(D.today)}%" height="8%"/><text class="vl" x="0.5%" y="88%">last done ${esc(fmt(r.last))}, before this view; due ${esc(fmt(r.due))}</text>`;
    return `<svg aria-hidden="true">${s}</svg>`;
  }
  vs.forEach((v, i) => {
    const nx = vs[i + 1], due = addMonths(v.date, r.months), stop = nx ? nx.date : D.today;
    const fineEnd = due < stop ? due : stop;
    s += `<rect class="fine" x="${pct(v.date)}%" y="46%" width="${Math.max(0, pct(fineEnd) - pct(v.date))}%" height="8%"/>`;
    if (due < stop && !inLost(due)) s += `<rect class="late" x="${pct(due)}%" y="30%" width="${Math.max(0, pct(stop) - pct(due))}%" height="40%"/>`;
  });
  r.visits.forEach(v => {
    s += v.disputed ? `<circle class="vd" cx="${pct(v.date)}%" cy="50%" r="5"/>` : `<circle class="v" cx="${pct(v.date)}%" cy="50%" r="3.5"/>`;
    s += `<text class="vl ${v.disputed ? '' : 'd'}" x="${pct(v.date)}%" dx="6" y="22%">${esc(fmtS(v.date))}${v.disputed ? ', disputed' : ''}</text><text class="vl id" x="${pct(v.date)}%" dx="6" y="92%">${esc(v.id)}</text>`;
  });
  s += `<line class="due" x1="${pct(r.due)}%" x2="${pct(r.due)}%" y1="20%" y2="80%"/>`;
  return `<svg aria-hidden="true">${s}</svg>`;
}
function build() {
  const st = $('#stage');
  const n = COUNT.overdue, p = COUNT.disputed;
  const months = []; for (let m = 0; m <= 14; m += 2) { const d = addMonths(DOM0, m); if (d <= DOM1) months.push(d); }
  st.innerHTML = `<div class="num"><b>${n}</b><span>${esc(D.fact.noun[1])} overdue${p ? `, and <b>probably a ${ORD[n + 1]}</b>` : ''}, of ${word(D.regime.length)} at ${esc(D.entity.name)}. <span class="conf">Almost certain</span> for ${word(n)}, <span class="conf">${esc(byState('disputed')[0].confidence)}</span> for the ${ORD[n + 1]}.</span></div>
    <div class="furn" id="furn">${months.map(d => `<span class="ax" data-d="${d}">${esc(MON[dt(d).getMonth()])}${dt(d).getMonth() === 0 ? ' ' + dt(d).getFullYear() : ''}</span>`).join('')}
      <div class="lost" id="lost"><span>${BREAK} no record</span></div><div class="today" id="today"><span>today, ${esc(fmtS(D.today))}</span></div></div>
    ${ORDER.filter(s => COUNT[s]).map(s => `<div class="glab" data-g="${s}"><b>${COUNT[s]}</b>${esc(D.states[s].plain)}</div>`).join('')}
    ${SEQ.map(r => `<div class="it" data-id="${r.id}" data-state="${r.state}" role="button" tabindex="0" aria-label="${esc(itemLine(r))}"><div class="nm">${ico(r.icon, 14)}<span>${esc(r.name)}</span></div><div class="ln">${laneSVG(r)}</div></div>`).join('')}`;
  Icons.hydrate(st);
}
function layout() {
  const st = $('#stage'), W = st.clientWidth, H = st.clientHeight;
  const nameW = MS('--measure-rail') - MS('--space-4'), laneW = W - nameW, axH = MS('--space-5');
  st.dataset.stop = STOP;
  const N = SEQ.length;
  if (STOP <= 1) {
    const BW = Math.min(W, MS('--measure-wide') * 1.2), gap = MS('--space-1'), cw = (BW - gap * (N - 1)) / N, ch = MS('--space-7');
    SEQ.forEach((r, i) => Object.assign($(`.it[data-id="${r.id}"]`).style, STOP === 0
      ? { left: (i * MS('--space-2')) + 'px', top: (MS('--type-hero') * 1.6 * 16 + MS('--space-5')) + 'px', width: MS('--space-2') + 'px', height: MS('--space-2') + 'px' }
      : { left: i * (cw + gap) + 'px', top: '0px', width: cw + 'px', height: ch + 'px' }));
    /* group labels sit under the first cell of each group */
    ORDER.filter(s => COUNT[s]).forEach(s => { const i = SEQ.findIndex(r => r.state === s); const g = $(`.glab[data-g="${s}"]`); g.style.left = i * (cw + gap) + 'px'; g.style.top = ch + MS('--space-3') + 'px'; });
  } else {
    const rowH = Math.min(STOP === 2 ? MS('--space-6') : MS('--space-7'), (H - axH - MS('--space-5')) / N);
    SEQ.forEach((r, i) => Object.assign($(`.it[data-id="${r.id}"]`).style, { left: '0px', top: axH + i * rowH + 'px', width: W + 'px', height: rowH - 2 + 'px' }));
  }
  $$('#furn .ax').forEach(a => { a.style.left = nameW + laneW * pct(a.dataset.d) / 100 + 'px'; });
  const t = $('#today'); t.style.left = nameW + laneW * pct(D.today) / 100 + 'px';
  const lo = $('#lost'); lo.style.left = nameW + laneW * pct(D.noRecord.from) / 100 + 'px'; lo.style.width = laneW * (pct(D.noRecord.to) - pct(D.noRecord.from)) / 100 + 'px';
  const rowH = STOP <= 1 ? 0 : Math.min(STOP === 2 ? MS('--space-6') : MS('--space-7'), (H - axH - MS('--space-5')) / N);
  [lo, t].forEach(e => { e.style.top = axH + 'px'; e.style.bottom = 'auto'; e.style.height = N * rowH + 'px'; });
  st.classList.toggle('tight', rowH < MS('--space-6'));
}
function setStop(s) {
  STOP = Math.max(0, Math.min(3, s));
  const d = $('#dial'); d.value = STOP; d.setAttribute('aria-valuetext', STOPS[STOP].w);
  $$('.stops button').forEach(b => b.setAttribute('aria-current', +b.dataset.stop === STOP ? 'true' : 'false'));
  const bl = $('#bl');
  bl.classList.toggle('small', STOP > 0);
  bl.innerHTML = STOP === 0 ? partsHTML(headlineParts()) : partsHTML(headlineParts()) + ' ' + partsHTML(secondParts());
  layout(); light();
}
function light() {
  $$('.it').forEach(e => e.classList.toggle('lit', e.dataset.id === HOLD));
  const r = R(HOLD);
  $('#held').innerHTML = `<p class="eyebrow">Held</p><b>${esc(r.name)}</b>${esc(itemLine(r))}`;
  $$('.bl .ref').forEach(b => b.classList.toggle('lit', refItems(b.dataset.ref).includes(HOLD)));
}
function step(d) { const i = SEQ.findIndex(r => r.id === HOLD); HOLD = SEQ[(i + d + SEQ.length) % SEQ.length].id; light(); }

$('#dial').addEventListener('input', e => setStop(+e.target.value));
document.addEventListener('click', e => {
  const b = e.target.closest('.stops button'); if (b) { setStop(+b.dataset.stop); return; }
  const it = e.target.closest('.it'); if (it) { HOLD = it.dataset.id; light(); if (STOP < 3) setStop(STOP + 1); return; }
  const rf = e.target.closest('.bl .ref'); if (rf) { HOLD = refItems(rf.dataset.ref)[0]; light(); }
});
KEYS.ArrowDown = () => setStop(STOP + 1);
KEYS.ArrowUp = () => setStop(STOP - 1);
KEYS.ArrowRight = () => step(1); KEYS.ArrowLeft = () => step(-1);
['1','2','3','4'].forEach((k, i) => KEYS[k] = () => setStop(i));
addEventListener('resize', layout);

async function demo(id) {
  setStop(1); await wait('--motion-spin'); if (!demoAlive(id)) return;
  setStop(2); await wait('--motion-still'); if (!demoAlive(id)) return;
  setStop(3);
}
window.replay = () => { HOLD = oldest.id; setStop(0); startDemo(demo); };
build(); setStop(0);
requestAnimationFrame(() => requestAnimationFrame(() => $('#wrap').classList.remove('pre')));
startDemo(demo);
