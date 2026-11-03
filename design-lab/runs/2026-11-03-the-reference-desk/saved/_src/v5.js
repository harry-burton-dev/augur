/* V5: choosing a floor previews what its people will get when they rerun the question, before anything is shared. */
const ME = 'sam';
const ORDER = ['org', 'finance', 'facilities', 'depot', 'you']; /* top of the building first: up is towards Org */
const S = { f: 'facilities', mode: 'question', shared: false };
const member = f => P(ME).sees.includes(f);
/* the floors a reader on floor f can open: f, the floors above it, and their own */
const chain = f => { const out = ['you']; let x = f; while (x && x !== 'you') { out.push(x); x = F(x).above; } return out; };
/* how many of floor t's people can open things kept on floor x */
function canOpen(x, t) {
  const aud = t === 'you' ? 1 : F(t).people;
  if (t === 'you') return 1;
  if (chain(t).includes(x)) return aud;
  /* x is below or beside t: only x's own people (and the teams under x) within t's audience */
  if (t === 'org') return F(x).people + Object.keys(DATA.floors).filter(k => F(k).above === x).reduce((n, k) => n + F(k).people, 0);
  return 0;
}
function header() {
  $('#brand').textContent = DATA.app;
  $('#crumb').innerHTML = `${ic('chevron-right', 14)}<span>Questions</span>${ic('chevron-right', 14)}<b>${esc(Q.id)}</b>${ic('chevron-right', 14)}<span>share</span>`;
  $('#where').innerHTML = `${ic('user-round', 13)}<b>${esc(P(ME).name)}</b> on ${fl(P(ME).floor)}`;
  Icons.hydrate($('.band'));
}
function drawQ() {
  const a = answer(ME, DATA.today);
  $('#qcol').innerHTML = `<p class="eyebrow">${esc(Q.id)} · your question</p>
    <p class="said">You asked <q>${esc(Q.words)}</q> on ${fmt(Q.asked)}</p>
    <p class="sent">${sentenceHtml()}</p>
    <p class="eyebrow">Steps that travel with it</p>
    <ol>${Q.steps.map(s => `<li>${esc(s.plain)} ${howTag(s.how)}<span class="tk">${esc(s.tech)}</span></li>`).join('')}</ol>
    <div class="mine"><span>Your answer today, with your access</span><span class="n">${a.rows.length}</span><ul>${a.rows.map(r => `<li>${esc(r.s.name)}</li>`).join('')}</ul></div>
    <p class="small">${ic('cpu', 12)} Sharing asks no model. The one step the model helped with (“heard from”) travels as the words you chose, not as a call.</p>`;
  Icons.hydrate($('#qcol'));
}
function drawFloors() {
  $('#upnote').innerHTML = `${ic('arrow-up', 11)}up is towards the Org floor`;
  $('#floors').innerHTML = ORDER.map(f => {
    const fo = F(f), ok = member(f);
    const sub = f === 'you' ? 'Keep it to yourself' : ok ? `${fo.people} people · ${esc(fo.word)}` : `You’re not on this floor. Ask ${esc(fo.lead)} to share it there, or to add you.`;
    return `<li><button class="fb ${f === P(ME).floor ? 'here' : ''}" role="radio" data-f="${f}" data-tier="${fo.tier}" aria-checked="${S.f === f}" ${ok ? '' : 'aria-disabled="true"'}><span class="r"></span><span class="nm">${esc(f === 'you' ? 'Only you' : fo.name)}</span>${ok ? `<span class="pp">${f === 'you' ? '1' : fo.people}</span>` : `<span class="pp">${ic('lock', 11)}</span>`}<span class="sb">${sub}</span></button></li>`;
  }).join('');
  $$('#floors .fb').forEach(b => b.onclick = () => { if (b.getAttribute('aria-disabled') === 'true') { toast(`${ic('lock', 14)}<span><b>You can’t place it on ${esc(F(b.dataset.f).name)}</b><br>Only people on a floor can share to it. ${esc(F(b.dataset.f).lead)} can.</span>`); return; } pick(b.dataset.f); });
  $('#bldnote').innerHTML = `Floors you’re not on stay listed, so you know they exist and whom to ask.`;
  Icons.hydrate($('#floors')); Icons.hydrate($('#upnote'));
}
function preview() {
  const f = S.f, aud = f === 'you' ? 1 : F(f).people;
  const mine = answer(ME, DATA.today);
  /* a typical reader there: that floor and the floors above it */
  const reader = f === 'org' ? 'orgmember' : ME;
  const theirs = answer(reader, DATA.today);
  const cat = (a, id) => a.rows.find(x => x.s.id === id) ? 'in the answer' : a.never.find(x => x.s.id === id) ? 'no contact logged' : a.heard.find(x => x.s.id === id) ? 'heard from' : 'no contract';
  const differ = DATA.suppliers.map(s => s.id).filter(id => cat(mine, id) !== cat(theirs, id));
  /* the sources behind your rows (and behind the ones it left out) */
  const used = new Set(); [...mine.rows, ...mine.heard].forEach(r => used.add(r.last.src)); mine.rows.forEach(r => r.guess && used.add(r.guess.src));
  const reach = Object.keys(DATA.sources).map(k => { const n = canOpen(SRC(k).floor, f); return { k, n, p: Math.round(n / aud * 100) }; });
  const fixedOk = [...used].every(k => canOpen(SRC(k).floor, f) === aud);
  const blocker = [...used].find(k => canOpen(SRC(k).floor, f) < aud);
  if (!fixedOk && S.mode === 'fixed') S.mode = 'question';
  const name = f === 'you' ? 'only you' : F(f).name;
  $('#pv').innerHTML = `
    <p class="eyebrow">Before you share · a preview</p>
    <h2>What people on ${esc(name)} get when they rerun it</h2>
    <p class="lede"><b>${aud} ${aud === 1 ? 'person' : 'people'}</b>. Each rerun uses the reader’s own access, so the answer is theirs, not yours. Here is how far each source reaches:</p>
    <div class="reach">${reach.map(r => `<div class="rs"><span><b>${esc(SRC(r.k).plain)}</b><br>kept on ${fl(SRC(r.k).floor)}</span><span class="bar"><i style="--p:${r.p}%"></i></span><span class="c">${r.n === aud ? 'all' : r.n === 0 ? 'none' : r.n + ' of ' + aud}</span></div>`).join('')}</div>
    ${f === 'you' ? '' : differ.length ? `<div class="differ"><b>${differ.length} of the suppliers you see will read differently</b> for anyone on ${esc(name)} who isn’t also on ${esc(F(P(ME).floor).name)}:<ul>${differ.map(id => `<li><span>${esc(SUP(id).name)}</span><span class="to">${esc(cat(mine, id))} → ${esc(cat(theirs, id))}</span></li>`).join('')}</ul><p class="tk">reader with floors [${chain(f).join(', ')}] vs yours [${P(ME).sees.join(', ')}]</p></div>` : `<div class="differ"><b>Everyone here reads it as you do.</b> Every source behind your answer is kept on this floor or above it.</div>`}
    <div class="modes" role="radiogroup" aria-label="What to share">
      <button class="mode" role="radio" data-m="question" aria-checked="${S.mode === 'question'}"><span class="r"></span><b>Share the question</b><span>They rerun it with their own access and their own watch. You stay its keeper: anyone may rerun it, only you change its words.</span><span class="tk">question + clarifications + steps + asked-at; no rows</span></button>
      <button class="mode fixed" role="radio" data-m="fixed" aria-checked="${S.mode === 'fixed'}" ${fixedOk ? '' : 'aria-disabled="true"'}><span class="r"></span><b>Share your answer as it is today</b><span>A fixed copy of your ${mine.rows.length} rows, marked “as it was on ${fmtS(DATA.today)}”. It never changes.</span>${fixedOk ? '' : `<span class="why">${ic('lock', 12)}<span>Not for this floor: ${esc(SRC(blocker).plain.toLowerCase())} behind your rows are kept on ${esc(F(SRC(blocker).floor).name)}, which ${aud - canOpen(SRC(blocker).floor, f)} people here can’t open. Share the question, or share the copy to ${esc(F(SRC(blocker).floor).name)}.</span></span>`}</button>
    </div>
    <div class="go"><button class="btn primary" id="share">${ic('share-2', 13)}${S.mode === 'fixed' ? 'Share the fixed copy' : 'Share the question'} to ${esc(name)}</button><span class="small">Nothing is shared until you press it.</span></div>`;
  $$('#pv .mode').forEach(b => b.onclick = () => { if (b.getAttribute('aria-disabled') === 'true') return; S.mode = b.dataset.m; preview(); });
  $('#share').onclick = share;
  Icons.hydrate($('#pv'));
}
function pick(f) {
  if (!member(f)) return;
  S.f = f; const pv = $('#pv'); pv.classList.add('swap');
  setTimeout(() => { pv.classList.remove('swap'); preview(); }, RM ? 0 : tok('--motion-quick'));
  drawFloors();
}
function share() {
  const name = S.f === 'you' ? 'only you' : F(S.f).name;
  toast(`${ic('share-2', 14)}<span><b>${S.mode === 'fixed' ? 'Fixed copy' : 'Question'} shared to ${esc(name)}</b><br>It sits under Questions on the floor’s page. ${S.mode === 'fixed' ? 'It reads “as it was on ' + fmt(DATA.today) + '”.' : 'Each person who reruns it gets their own answer.'}</span>`);
}
onKey = k => {
  if (k === 'arrowdown' || k === 'arrowup') {
    const ok = ORDER.filter(member); let i = ok.indexOf(S.f) + (k === 'arrowdown' ? 1 : -1);
    i = Math.max(0, Math.min(ok.length - 1, i)); pick(ok[i]); return true;
  }
  if (k === '1') { S.mode = 'question'; preview(); return true; }
  if (k === '2') { const b = $('.mode.fixed'); if (b && b.getAttribute('aria-disabled') !== 'true') { S.mode = 'fixed'; preview(); } else toast(`${ic('lock', 14)}<span><b>A fixed copy can’t go to this floor</b><br>The preview says why.</span>`); return true; }
  if (k === 'enter' && document.activeElement === document.body) { share(); return true; }
  return false;
};
function boot() {
  clearTimers(); setTech(false);
  S.f = 'facilities'; S.mode = 'fixed';
  const w = $('#wrap'); w.classList.add('pre');
  header(); drawQ(); drawFloors(); preview();
  requestAnimationFrame(() => requestAnimationFrame(() => w.classList.remove('pre')));
  /* the moment: Sam moves the share up a floor to the Org; the preview changes, and the fixed copy says why it can't go */
  later(() => pick('org'), tok('--motion-run'));
  later(() => { const b = $('#share'); if (b) b.classList.add('lit'); }, tok('--motion-run') + tok('--motion-calm'));
}
Icons.hydrate();
boot();
