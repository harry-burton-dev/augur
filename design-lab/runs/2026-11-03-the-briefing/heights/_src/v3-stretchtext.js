/* V3 stretchtext: the bottom line is one paragraph. Any phrase stretches in place into
   word-size pictures, and those into records; nothing moves away, so you never lose your place. */
const OPEN = new Set();
let FRESH = null;
const LV = ['Said in a sentence', 'Word-size pictures', 'The records'];
const LVt = ['headline', 'sparklines · counts by item', 'entities · observations · sources'];

/* ---- word-size pictures (SVG for data) ---- */
const maxLate = Math.max(...byState('overdue').map(r => r.late));
function lateBar(r) {
  const w = Math.round(6 + 66 * r.late / maxLate);
  return `<svg class="spark" viewBox="0 0 ${w + 2} 12" width="${w + 2}" aria-label="${r.late} days late"><rect class="late" x="0" y="2" width="${w}" height="8" rx="1"/></svg>`;
}
function lifeline(r) {
  /* last done → due → today, on one scale: in date is quiet, late is lit */
  const W = 132, span = days(r.last, D.today), x = d => Math.round(1 + (W - 2) * days(r.last, d) / span);
  const due = Math.min(x(r.due), W - 1);
  return `<svg class="spark" viewBox="0 0 ${W} 12" width="${W}" aria-label="last done ${fmt(r.last)}, due ${fmt(r.due)}, today ${fmt(D.today)}">
    <line class="rail" x1="1" y1="6" x2="${W - 1}" y2="6"/><rect class="fine" x="1" y="4" width="${Math.max(0, due - 1)}" height="4"/>
    ${r.late > 0 ? `<rect class="late" x="${due}" y="2" width="${W - 1 - due}" height="8"/>` : ''}
    <line class="tick" x1="1" y1="1" x2="1" y2="11"/><line class="tick" x1="${due}" y1="0" x2="${due}" y2="12"/><line class="now" x1="${W - 1}" y1="0" x2="${W - 1}" y2="12"/></svg>`;
}
function soonStrip(r) {
  const W = 84, x = Math.round(1 + (W - 2) * r.togo / 14);
  return `<svg class="spark" viewBox="0 0 ${W} 12" width="${W}" aria-label="due in ${r.togo} of the next 14 days"><line class="rail" x1="1" y1="6" x2="${W - 1}" y2="6"/><line class="now" x1="1" y1="0" x2="1" y2="12"/><line class="tick" x1="${x}" y1="1" x2="${x}" y2="11"/></svg>`;
}
const chip = v => `<span class="rec">${ico(v.disputed ? 'git-fork' : 'file-text', 12)}${esc(v.id)}</span>`;

/* ---- the tree: every node is a phrase; its kids are what it stretches into ---- */
function itemNode(r, lvl = 3) {
  const last = r.visits.filter(v => !v.disputed).pop();
  let kids;
  if (r.state === 'disputed') kids = [
    `due ${fmt(r.due)}. `, `<span class="fork">${r.sides.map(s => `<span class="alt"><b>${esc(s.says)}</b><span>${esc(s.from)}</span><span>${esc(s.gradeWord)}<span class="tk"> · grade ${s.grade}</span></span></span>`).join('')}</span> `,
    `<span class="conf">${esc(r.confidence)}</span> ${esc(r.confidenceOf)}, because the person on site outranks the supplier’s own report. `, chip(r.visits[r.visits.length - 1])];
  else if (last) kids = [lifeline(r), ` last done <b>${esc(fmt(last.date))}</b> by ${esc(last.by)}, read from <span class="doc">${esc(last.src)}</span> in Artifacts `, chip(last), `; due ${esc(fmt(r.due))}`,
    `<span class="tk"> observation · prov:wasDerivedFrom</span>`];
  else kids = [esc(itemLine(r))];
  return { k: 'i-' + r.id, t: r.name.toLowerCase(), lvl, kids };
}
function listJoin(nodes) { const out = []; nodes.forEach((n, i) => { if (i) out.push(i === nodes.length - 1 ? ' and ' : ', '); out.push(...[].concat(n)); }); return out; }
function TREE() {
  const ov = overdueSorted, hoist = byState('disputed')[0], soon = byState('soon').sort((a, b) => a.togo - b.togo);
  const gap = byState('gap')[0], hid = byState('hidden')[0];
  return [
    esc(D.entity.name) + ' has ',
    { k: 'ov', t: word(ov.length) + ' inspections overdue', cls: 'ov', lvl: 2,
      kids: listJoin(ov.map(r => [itemNode(r), ' ', lateBar(r), ` ${r.late} days`])) },
    hoist ? ', and ' : '',
    hoist ? { k: 'dis', t: 'probably a ' + ORD[ov.length + 1], lvl: 2,
      kids: [itemNode(hoist), `, where two sources disagree `, `<span class="cell" data-state="disputed"></span>`] } : '',
    '. The oldest is ',
    itemNode(oldest),
    ', ',
    { k: 'late', t: oldest.late + ' days late', lvl: 2, kids: [lifeline(oldest), ` due ${fmtS(oldest.due)}, and today is ${fmtS(D.today)}`] },
    '. ',
    { k: 'soon', t: cap(word(soon.length)) + ' more are due in the next fortnight', lvl: 2,
      kids: listJoin(soon.map(r => [itemNode(r), ` on ${fmtS(r.due)} `, soonStrip(r), ` in ${r.togo} days`])) },
    '; ',
    { k: 'gap', t: 'one is not known yet', lvl: 3, kids: [`<span class="cell" data-state="gap"></span> ${esc(gap.name.toLowerCase())}: the regime expects one ${esc(gap.every)}, and none has ever been recorded. <b>${esc(gap.fill)}</b> could fill it`] },
    ' and ',
    { k: 'hid', t: 'one is kept where you can’t see it', lvl: 3, kids: [`<span class="unseen">${ico('lock', 12)} ${esc(floorOf(hid.keptOn).name)}</span> the ${esc(hid.name.toLowerCase())}, kept on a team floor you can’t open. Ask <b>${esc(hid.ask)}</b>`] },
    '.'
  ];
}
function render(parts, path) {
  return parts.map(p => {
    if (typeof p === 'string') return p; /* trusted markup from this file; data is escaped where it enters */
    const key = path + '/' + p.k, open = OPEN.has(key);
    return `<span class="st ${open ? 'open' : ''}" data-lvl="${p.lvl}"><button class="ref ${p.cls || ''}" data-key="${key}" aria-expanded="${open}">${esc(p.t)}</button>${open ? `<span class="ins ${key === FRESH ? 'fresh' : ''}">${render(p.kids, key)}</span>` : ''}</span>`;
  }).join('');
}
/* plain strings in kids may carry trusted inline markup from this file; data is escaped where it enters */
function draw(focusKey) {
  $('#para').innerHTML = render(TREE(), '');
  Icons.hydrate($('#para'));
  const f = $$('.ins.fresh'); requestAnimationFrame(() => requestAnimationFrame(() => f.forEach(x => x.classList.remove('fresh'))));
  FRESH = null;
  if (focusKey) { const b = $(`[data-key="${CSS.escape(focusKey)}"]`); if (b) b.focus({ preventScroll: true }); }
  gauge();
}
function gauge() {
  const opened = $$('.st.open');
  const lv = new Set([1]); opened.forEach(s => lv.add(+s.dataset.lvl));
  const nOpen = opened.length;
  $('#gauge').innerHTML = `<p class="eyebrow">How far down</p>` + LV.map((w, i) => `<div class="lv ${lv.has(i + 1) ? 'on' : ''}"><span class="bar"></span><span><b>${w}</b>${i === 0 ? '2 sentences, from a template' : i === 1 ? 'counted, then drawn at word size' : D.visits.length + ' visits, each from a document'}<span class="tk">${LVt[i]}</span></span></div>`).join('')
    + `<p class="muted">${nOpen ? nOpen + ' phrase' + (nOpen > 1 ? 's' : '') + ' stretched' : 'Nothing stretched yet'}</p>`;
}
function toggle(key, open) {
  const was = OPEN.has(key);
  if (open === undefined) open = !was;
  if (open && !was) { OPEN.add(key); FRESH = key; }
  if (!open) [...OPEN].forEach(k => { if (k === key || k.startsWith(key + '/')) OPEN.delete(k); });
  draw(key);
}
const parentKey = k => k.split('/').slice(0, -1).join('/');

$('#band').innerHTML = bandHTML();
$('#q').textContent = D.fact.question;
$('#how').innerHTML = `Every word here comes from a template filled from <b>${D.regime.length} inspections</b> and <b>${D.visits.length} visits</b> in Data Atlas; no model wrote it. What a stretch adds sits between ⟨ ⟩, one step quieter, so you can always see the sentence you started from. ${BREAK} <b>No record</b> from ${fmtS(D.noRecord.from)} to ${fmtS(D.noRecord.to)}: ${esc(D.noRecord.why)}.`;

document.addEventListener('click', e => { const b = e.target.closest('.para .ref'); if (b) toggle(b.dataset.key); });
const focusedKey = () => document.activeElement && document.activeElement.dataset && document.activeElement.dataset.key;
KEYS.ArrowDown = () => { const k = focusedKey(); if (k) toggle(k, true); else { const b = $('.para .ref'); b && b.focus(); } };
KEYS.Enter = () => { const k = focusedKey(); if (k) toggle(k); };
KEYS.ArrowUp = () => { const k = focusedKey(); if (!k) return; if (OPEN.has(k)) toggle(k, false); else if (parentKey(k)) toggle(parentKey(k), false); };
KEYS.e = () => { $$('.para .ref').forEach(b => { if (!OPEN.has(b.dataset.key)) OPEN.add(b.dataset.key); }); draw(); };
KEYS['0'] = () => { OPEN.clear(); draw(); };

async function demo(id) {
  toggle('/ov', true); await wait('--motion-run'); if (!demoAlive(id)) return;
  toggle('/ov/i-' + oldest.id, true);
}
window.replay = () => { OPEN.clear(); draw(); $('#wrap').classList.add('pre'); requestAnimationFrame(() => requestAnimationFrame(() => $('#wrap').classList.remove('pre'))); startDemo(demo); };
draw();
requestAnimationFrame(() => requestAnimationFrame(() => $('#wrap').classList.remove('pre')));
startDemo(demo);
