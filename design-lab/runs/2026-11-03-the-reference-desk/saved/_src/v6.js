/* V6: a watched question tells you once, then says which of five reasons moved its answer. */
const ME = 'sam';
const S = { sel: 'Q-118', seam: false, open: false, then: false };
const looked = answer(ME, DATA.lastLooked);
const now = answer(ME, DATA.today);
const D = diff(looked, now);
const CH = [...D.joined.map(id => ({ id, dir: 'joined', w: why(id, looked, now) })), ...D.left.map(id => ({ id, dir: 'left', w: why(id, looked, now) }))];
function lastChangedRun() {
  const own = DATA.runs.filter(r => (P(r.by).as || r.by) === ME).map(r => ({ ...r, a: answer(r.by, r.asOf) }));
  let last = null; own.forEach((r, i) => { if (i && (diff(own[i - 1].a, r.a).joined.length + diff(own[i - 1].a, r.a).left.length)) last = r; });
  return last;
}
const LC = lastChangedRun();

function header() {
  $('#crumb').innerHTML = `${ic('chevron-right', 14)}<b>Saved questions</b>`;
  $('#where').innerHTML = `${ic('user-round', 13)}<b>${esc(P(ME).name)}</b> on ${fl(P(ME).floor)}`;
  Icons.hydrate($('.band'));
}
function qrow(q, mineList) {
  const live = q.live;
  const count = live ? now.rows.length : q.count;
  const changed = live ? LC.at : q.changed;
  const r = live ? [...new Set(CH.map(c => c.w.r))] : [q.reason].filter(Boolean);
  const kept = mineList ? (q.floor ? `kept on ${fl(q.floor)}` : '') : `by ${esc(q.by)} · on ${fl(q.floor)}`;
  return `<li><button class="qr ${live && S.seam ? 'seamed' : ''}" data-q="${q.id}" aria-pressed="${S.open && S.sel === q.id}"><span class="seam"></span><span class="w">${esc(q.words)}</span><span class="n">${count}</span>
    <span class="m"><span>${ic('git-compare', 11)}answer last changed ${fmtS(changed)}</span>${r.map(x => `<span>${ic(DATA.reasons[x].icon, 11)}${esc(DATA.reasons[x].plain.toLowerCase())}</span>`).join('')}${kept ? `<span>${kept}</span>` : ''}</span></button></li>`;
}
function drawHome() {
  $('#mine').innerHTML = DATA.shelf.map(q => qrow(q.live ? { ...q, floor: Q.sharedTo } : q, true)).join('');
  $('#floor').innerHTML = DATA.floorShelf.filter(q => !q.live).map(q => qrow(q, false)).join('');
  $('#calm').innerHTML = `Dark when normal: a question that hasn’t changed shows no mark. One that has gets a thin seam, once, and the line at the top folds into it.`;
  $$('.qr').forEach(b => b.onclick = () => { S.sel = b.dataset.q; S.open = true; drawHome(); drawAcct(); });
  Icons.hydrate($('.home'));
}
function drawAcct() {
  const el = $('#acct');
  el.classList.toggle('shut', !S.open);
  if (!S.open) { el.innerHTML = `<p class="eyebrow">Why it changed</p><p class="lede">Open a question to see what moved its answer.</p>`; return; }
  if (S.sel !== Q.id) {
    const q = [...DATA.shelf, ...DATA.floorShelf].find(x => x.id === S.sel);
    el.innerHTML = `<p class="eyebrow">${esc(q.id)}</p><p class="sent">${esc(q.words)}</p><p class="lede">Last changed ${fmt(q.changed)}${q.reason ? ': ' + esc(DATA.reasons[q.reason].plain.toLowerCase()) : ''}. In this prototype only ${esc(Q.id)} opens fully.</p>`;
    return;
  }
  const count = r => CH.filter(c => c.w.r === r);
  const guesses = now.rows.filter(r => r.guess);
  const items = Object.keys(DATA.reasons).map((k, i) => {
    const R = DATA.reasons[k]; const hits = count(k);
    let body = '', cls = 'zero', c = '0';
    if (hits.length) {
      cls = 'hit'; c = String(hits.length);
      body = hits.map(h => `<div class="ev reveal"><span><b>${esc(SUP(h.id).name)}</b> · ${esc(h.w.text)}</span><span class="dir ${h.dir === 'joined' ? 'j' : ''}">${h.dir}</span><span class="acts">${k === 'learned' ? `<button class="btn" data-then>${ic('history', 12)}See it as it was on ${fmtS(Q.asked)}</button><button class="btn">${ic('file-text', 12)}Open the meeting note</button>` : `<button class="btn">${ic('file-signature', 12)}Open the contract</button>`}</span></div>`).join('');
    } else if (k === 'guess' && guesses.length) {
      cls = 'wait'; c = `${guesses.length} waiting`;
      body = guesses.map(g => `<div class="ev reveal"><span><span class="gtag">${ic('cpu', 10)}guess</span> <b>${esc(g.s.name)}</b>: a meeting note says ${esc(g.guess.guess.said)} on ${fmt(g.guess.on)}. If someone confirms it’s them, ${esc(g.s.name)} leaves the answer and this line will say so.</span><span class="dir">not counted</span><span class="acts"><button class="btn">${ic('check', 12)}It’s them</button><button class="btn">${ic('x', 12)}Not them</button></span></div>`).join('');
    } else {
      body = { world: 'No contract started or ended for these suppliers.', learned: 'No late records.', access: `Your access hasn’t changed since ${fmtS(DATA.lastLooked)}. When someone else reruns it, their answer can differ for this reason; that shows on their copy, not yours.`, guess: 'No guesses were made or settled.', words: `The words this question uses (supplier, contract, contact) mean what they meant on ${fmtS(Q.asked)}.` }[k];
    }
    return `<li class="rz ${cls}"><span class="ri">${ic(R.icon, 15)}</span><span><span class="rt">${esc(R.plain)}</span><br>${esc(R.line)}<span class="tk">${esc(R.tech)}</span></span><span class="rc">${c}</span><span class="rb">${body}</span></li>`;
  }).join('');
  el.innerHTML = `<p class="eyebrow">${esc(Q.id)} · why it changed</p>
    <p class="said">You asked <q>${esc(Q.words)}</q> on ${fmt(Q.asked)}</p>
    <p class="sent">${sentenceHtml()}</p>
    <div class="since"><span class="small">Since you last looked, on ${fmt(DATA.lastLooked)}</span><span class="then">${looked.rows.length}</span>${ic('arrow-right', 14)}<b>${now.rows.length}</b><span class="small">${D.joined.length} joined, ${D.left.length} left. ${looked.rows.length === now.rows.length ? 'The count alone would have hidden it.' : ''}</span></div>
    <p class="eyebrow">Five reasons an answer can move</p>
    <ul class="reasons">${items}</ul>
    <p class="small">${ic('bell', 12)} Told you once: ${esc(Q.watch.tell)}, at 07:00 on ${fmtS(LC.at)}. ${ic('list-checks', 12)} The watch reran stored steps; it asked no model.</p>`;
  $$('[data-then]', el).forEach(b => b.onclick = () => toast(`${ic('history', 14)}<span><b>Opened as it was on ${fmt(Q.asked)}</b><br>${esc(Q.id)} with the data Data Atlas had that day: ${answer(ME, Q.asked).rows.length} suppliers, ${esc(SUP(D.left[0]).name)} among them.</span>`));
  Icons.hydrate(el);
}
onKey = k => {
  const ids = $$('.qr').map(b => b.dataset.q);
  if (k === 'arrowdown' || k === 'arrowup') { let i = ids.indexOf(S.sel) + (k === 'arrowdown' ? 1 : -1); i = Math.max(0, Math.min(ids.length - 1, i)); S.sel = ids[i]; S.open = true; drawHome(); drawAcct(); return true; }
  if (k === 'enter' && document.activeElement === document.body) { S.open = true; drawHome(); drawAcct(); return true; }
  if (k === 'a') { const b = $('[data-then]'); if (b) b.click(); return true; }
  return false;
};
function boot() {
  clearTimers(); setTech(false);
  S.sel = Q.id; S.seam = false; S.open = false;
  const w = $('#wrap'); w.classList.add('pre');
  const l1 = $('#line1'); l1.className = 'line1 hide';
  l1.innerHTML = `${ic('git-compare', 14)}<span>1 of your questions changed since you last looked on ${fmt(DATA.lastLooked)}: <b style="font-weight:400;color:var(--light)">${esc(Q.words)}</b></span>`;
  Icons.hydrate(l1);
  header(); drawHome(); drawAcct();
  requestAnimationFrame(() => requestAnimationFrame(() => w.classList.remove('pre')));
  /* the moment: one line arrives, then folds into a seam on its question, and the account opens */
  later(() => l1.classList.remove('hide'), tok('--motion-run'));
  later(() => { l1.classList.add('fold'); S.seam = true; S.open = true; drawHome(); drawAcct(); }, tok('--motion-run') + tok('--motion-spin'));
}
Icons.hydrate();
boot();
