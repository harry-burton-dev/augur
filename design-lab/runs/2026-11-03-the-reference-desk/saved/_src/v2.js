/* V2: the register. Suppliers down the side, runs across the top, one mark per supplier per run. */
const S = { viewer: 'sam', cols: [], r: 0, c: 0, watch: 0, fillCol: -1 };
const owner = r => P(r.by).as || r.by;
const mine = r => owner(r) === S.viewer;
const WATCH = [
  { id: 'rows', plain: 'the suppliers in it change', test: (a, b) => diff(a, b).joined.length + diff(a, b).left.length > 0 },
  { id: 'grow', plain: 'it gets longer', test: (a, b) => b.rows.length > a.rows.length },
  { id: 'read', plain: 'anything it read changes, even if the answer doesn’t', test: (a, b) => JSON.stringify(lastMap(a)) !== JSON.stringify(lastMap(b)) }
];
function lastMap(a) { const m = {}; [...a.rows, ...a.heard].forEach(x => m[x.s.id] = x.last.on); a.never.forEach(x => m[x.s.id] = null); return m; }

function status(s, col) {
  if (!mine(col)) return { k: 'hid' };
  const a = col.a;
  const row = a.rows.find(x => x.s.id === s.id);
  if (row) return { k: 'in', row };
  if (a.never.find(x => x.s.id === s.id)) return { k: 'never' };
  const h = a.heard.find(x => x.s.id === s.id);
  if (h) return { k: 'heard', row: h };
  return { k: 'na', why: a.ended.find(x => x.s.id === s.id).why };
}
const mark = (st, col) => ({
  in: `<span class="m m-in ${col.kind === 'then' ? 'then' : ''} ${st.row && st.row.guess ? 'withguess' : ''}"></span>`,
  heard: '<span class="m m-heard"></span>',
  never: '<span class="m m-gap"></span>',
  na: '<span class="m m-na"></span>',
  hid: ''
}[st.k]);
const prevOwn = i => { for (let j = i - 1; j >= 0; j--) if (owner(S.cols[j]) === owner(S.cols[i]) && S.cols[j].kind !== 'then') return S.cols[j]; return null; };

function header() {
  $('#brand').textContent = DATA.app;
  $('#crumb').innerHTML = `${ic('chevron-right', 14)}<span>Questions</span>${ic('chevron-right', 14)}<b>${esc(Q.id)}</b>`;
  const p = P(S.viewer);
  $('#where').innerHTML = `${ic('user-round', 13)}<b>${esc(p.name)}</b> on ${fl(p.floor)}`;
  $('#said').innerHTML = `${esc(P(Q.asker).first)} asked <q>${esc(Q.words)}</q> on ${fmt(Q.asked)} · kept on ${fl(Q.sharedTo)}`;
  $('#sent').innerHTML = sentenceHtml();
  Icons.hydrate($('.band'));
}
function drawReg() {
  const cols = S.cols;
  const head = `<thead><tr><th class="sup">Supplier, as the register reads it</th>${cols.map((c, i) => {
    const p = prevOwn(i), ch = p && mine(c) && c.kind !== 'then' ? WATCH[0].test(p.a, c.a) : false;
    const who = c.by === 'watch' ? 'watch' : P(c.by).first;
    const cls = c.kind === 'then' ? 'then' : !mine(c) ? 'theirs' : '';
    return `<th><button class="colh ${cls}" data-c="${i}" aria-pressed="${i === S.c}"><span class="d">${fmtS(c.at)}</span><span>${c.time}</span><span class="w">${ic(c.by === 'watch' ? 'eye' : !mine(c) ? 'lock' : 'user-round', 10)}${esc(who)}</span>${c.kind === 'then' ? `<span>data ${fmtS(c.asOf)}</span>` : ch ? `<span class="chg">${ic('git-compare', 10)}changed</span>` : `<span>&nbsp;</span>`}</button></th>`;
  }).join('')}</tr></thead>`;
  const groups = [['With a contract running today', s => s.contract[0] <= DATA.today && DATA.today <= s.contract[1]], ['No contract running today', s => !(s.contract[0] <= DATA.today && DATA.today <= s.contract[1])]];
  let body = '<tbody>'; let ri = 0; S.order = [];
  groups.forEach(([g, f]) => {
    const list = DATA.suppliers.filter(f); if (!list.length) return;
    body += `<tr class="grp"><td colspan="${cols.length + 1}">${esc(g)}</td></tr>`;
    list.forEach(s => {
      S.order.push(s.id);
      body += `<tr class="${ri === S.r ? 'sel' : ''}" data-r="${ri}"><th class="sup" scope="row">${esc(s.name)}</th>${cols.map((c, i) => {
        const st = status(s, c);
        const p = prevOwn(i); const joined = p && mine(c) && st.k === 'in' && status(s, p).k !== 'in';
        return `<td><button class="cell ${st.k === 'hid' ? 'hid' : ''} ${joined ? 'join' : ''} ${i === S.fillCol ? 'fill' : ''}" style="--i:${ri}" data-r="${ri}" data-c="${i}" aria-pressed="${ri === S.r && i === S.c}" aria-label="${esc(s.name)}, ${fmtS(c.at)}: ${st.k}">${mark(st, c)}</button></td>`;
      }).join('')}</tr>`;
      ri++;
    });
  });
  body += '</tbody>';
  const foot = `<tfoot><tr><td class="sup">Found</td>${cols.map(c => mine(c) ? `<td class="tot ${c.kind === 'then' ? 'then' : ''}">${c.a.rows.length}</td>` : `<td class="tot hid">theirs</td>`).join('')}</tr></tfoot>`;
  $('#reg').innerHTML = head + body + foot;
  $$('#reg .cell').forEach(b => b.onclick = () => { S.r = +b.dataset.r; S.c = +b.dataset.c; S.fillCol = -1; drawReg(); explain(); });
  $$('#reg .colh').forEach(b => b.onclick = () => { S.c = +b.dataset.c; S.fillCol = -1; drawReg(); explain(); });
  Icons.hydrate($('#reg'));
  const lc = [...S.cols].map((c, i) => [c, i]).filter(([c, i]) => mine(c) && c.kind !== 'then' && prevOwn(i) && WATCH[0].test(prevOwn(i).a, c.a)).pop();
  $('#lastchg').innerHTML = lc ? `${ic('git-compare', 12)} answer last changed <b>${fmt(lc[0].at)}</b>` : '';
  Icons.hydrate($('#lastchg'));
  $('#key').innerHTML = `<span><span class="m m-in"></span>in the answer</span><span><span class="m m-in withguess"></span>in it, but a guess could take it out</span><span><span class="m m-heard"></span>heard from since ${fmtS(Q.cutoff)}</span><span><span class="m m-gap"></span>no contact logged (not known yet)</span><span><span class="m m-na"></span>no contract running that day (doesn’t apply)</span><span><span class="m m-in then"></span>the data as it was when asked</span><span><span class="m" style="width:var(--space-4);height:var(--space-3);background:var(--x-proposed-unseen);border:1px solid var(--hairline)"></span>someone else’s run: not yours to see</span><span>The watch checks every morning; mornings when nothing it read changed are folded away.</span>`;
}

function explain() {
  const s = SUP(S.order[S.r]); const col = S.cols[S.c]; const el = $('#explain');
  if (!mine(col)) {
    const t = P(col.by);
    el.innerHTML = `<p class="eyebrow">${fmt(col.at)} · ${col.time}</p><h3>${esc(t.name)} reran it</h3>
      <p class="lede">From ${fl(t.floor)}, with ${esc(t.first)}’s own access. Each person’s register shows only their own marks: ${esc(t.first)} can open floors you can’t, and you can open floors ${esc(t.first)} can’t, so ${esc(t.first)}’s marks are ${esc(t.first)}’s.</p>
      <div class="src">${ic('info', 13)}<span>What travelled with the share: the question, its sentence, its steps and who chose each word. <b>Not your marks.</b></span></div>
      ${unseenHtml(S.viewer)}`;
    Icons.hydrate(el); return;
  }
  /* the supplier's story across this reader's runs */
  let prev = null; const items = [];
  S.cols.forEach((c, i) => {
    if (!mine(c)) return;
    const st = status(s, c);
    const lbl = `<b>${fmtS(c.at)} ${c.time}</b>${c.kind === 'then' ? ' <span class="tag-then">data as of ' + fmtS(c.asOf) + '</span>' : ''}`;
    const say = { in: st.row ? `in the answer: last heard ${fmt(st.row.last.on)} (${st.row.last.via}, ${SRC(st.row.last.src).plain.toLowerCase()})` : '', heard: st.row ? `not in it: heard from ${fmt(st.row.last.on)} (${st.row.last.via})` : '', never: 'listed apart: no contact logged at all', na: `not counted: ${st.why || ''}` }[st.k];
    let chg = '';
    if (prev && c.kind !== 'then' && status(s, prev).k !== st.k && (st.k === 'in' || status(s, prev).k === 'in')) {
      const w = why(s.id, prev.a, c.a); chg = `<span class="rs">${reasonTag(w.r)} ${esc(w.text)}</span>`;
    }
    if (c.kind === 'then') {
      const nowSt = status(s, S.cols.filter(x => mine(x) && x.kind !== 'then').at(-1));
      if (nowSt.k !== st.k) chg = `<span class="rs">${ic('history', 11)} Rerun with the data as it was on ${fmtS(c.asOf)}, so it reads as it did then.</span>`;
    }
    items.push(`<li class="${st.k === 'in' ? 'in' : ''} ${chg ? 'chg' : ''} ${i === S.c ? 'cur' : ''}"><span class="dot"></span><span>${lbl} · ${esc(say)}${chg}</span></li>`);
    if (c.kind !== 'then') prev = c;
  });
  const st = status(s, col);
  const c0 = st.row && st.row.last;
  const g = st.row && st.row.guess;
  el.innerHTML = `<p class="eyebrow">One line of the register</p><h3>${esc(s.name)}</h3><ol class="story">${items.join('')}</ol>
    ${c0 ? `<div class="src">${ic(SRC(c0.src).app === 'Artifacts' ? 'file-text' : 'database', 13)}<span>Last contact on this run: <b>${esc(c0.via)}, ${fmt(c0.on)}</b> · ${esc(SRC(c0.src).plain)} in ${esc(SRC(c0.src).app)}, kept on ${fl(SRC(c0.src).floor)}${c0.logged ? `<br>logged ${fmt(c0.logged)}${c0.by ? ' by ' + esc(c0.by) : ''}` : ''}<span class="tk">${esc(SRC(c0.src).tech)}</span></span></div>` : ''}
    ${g ? `<div class="src">${ic('cpu', 13)}<span><span class="gtag">guess</span> <span class="guess">${esc(g.via)}, ${fmt(g.on)}?</span> A meeting note says ${esc(g.guess.said)}. The model matched it ${esc(g.guess.why)}. It is not counted, so ${esc(s.name)} stays in the answer until someone settles it.<br><span class="actions" style="display:flex;gap:var(--space-2);margin-top:var(--space-2)"><button class="btn">${ic('check', 12)}It’s them</button><button class="btn">${ic('x', 12)}Not them</button></span><span class="tk">${esc(DATA.how.model.tech)}</span></span></div>` : ''}`;
  Icons.hydrate(el);
}

function drawWatch() {
  const own = S.cols.filter(c => mine(c) && c.kind !== 'then');
  $('#watch').innerHTML = `<h3 class="h3">Tell ${S.viewer === 'sam' ? 'me' : 'me'} when</h3><div class="opts" role="radiogroup" aria-label="Tell me when">${WATCH.map((w, i) => {
    const hits = own.slice(1).filter((c, j) => w.test(own[j].a, c.a));
    return `<button class="opt" role="radio" aria-checked="${i === S.watch}" data-w="${i}"><span class="r"></span><span>${esc(w.plain)}</span><span class="n">${hits.length}× since ${fmtS(own[0].at)}</span></button>`;
  }).join('')}</div>
  <p class="watchnote">Checked ${esc(Q.watch.cadence)} with ${esc(P(S.viewer).first)}’s own access. The count beside each choice is how often it would have told you since it was asked: a preview before you choose. It says so with ${esc(Q.watch.tell)}.</p>`;
  $$('#watch .opt').forEach(b => b.onclick = () => { S.watch = +b.dataset.w; drawWatch(); });
}

function addThen() {
  if (S.cols.some(c => c.kind === 'then' && owner(c) === S.viewer)) return;
  const c = { at: DATA.today, time: '09:30', by: S.viewer, asOf: Q.asked, kind: 'then' };
  S.cols.push({ ...c, a: answer(c.by, c.asOf) }); S.c = S.cols.length - 1; S.fillCol = S.c;
  drawReg(); explain();
  toast(`${ic('history', 14)}<span><b>Rerun with the data as it was on ${fmt(Q.asked)}</b><br>Records logged after that day are left out, even when they are about earlier days. No model was asked.</span>`);
}
function setViewer(v) {
  S.viewer = v; S.fillCol = -1;
  S.c = S.cols.map((c, i) => [c, i]).filter(([c]) => mine(c)).pop()[1];
  header(); drawReg(); explain(); drawWatch();
}
onKey = k => {
  const n = S.order ? S.order.length : 0;
  if (k === 'arrowdown') { S.r = Math.min(n - 1, S.r + 1); S.fillCol = -1; drawReg(); explain(); return true; }
  if (k === 'arrowup') { S.r = Math.max(0, S.r - 1); S.fillCol = -1; drawReg(); explain(); return true; }
  if (k === 'arrowright') { S.c = Math.min(S.cols.length - 1, S.c + 1); S.fillCol = -1; drawReg(); explain(); return true; }
  if (k === 'arrowleft') { S.c = Math.max(0, S.c - 1); S.fillCol = -1; drawReg(); explain(); return true; }
  if (k === 'a') { addThen(); return true; }
  if (k === 'w') { S.watch = (S.watch + 1) % WATCH.length; drawWatch(); return true; }
  if (k === 'p') { setViewer(S.viewer === 'sam' ? 'priya' : 'sam'); return true; }
  return false;
};
function boot() {
  clearTimers(); setTech(false);
  S.viewer = 'sam'; S.watch = 0; S.fillCol = -1;
  S.cols = DATA.runs.slice(0, -2).map(r => ({ ...r, a: answer(r.by, r.asOf) }));
  S.r = 0; S.c = S.cols.length - 1;
  const w = $('#wrap'); w.classList.add('pre');
  header(); drawReg(); explain(); drawWatch();
  requestAnimationFrame(() => requestAnimationFrame(() => w.classList.remove('pre')));
  /* the moment: this morning's column is taken like a register, then Priya's run arrives as a column Sam can't read */
  const add = r => { S.cols.push({ ...r, a: answer(r.by, r.asOf) }); S.fillCol = S.cols.length - 1; };
  later(() => { add(DATA.runs.at(-2)); S.c = S.fillCol; drawReg(); drawWatch(); }, tok('--motion-run'));
  later(() => { add(DATA.runs.at(-1)); drawReg(); }, tok('--motion-run') + tok('--motion-spin'));
  later(() => { S.r = S.order.indexOf('halden'); S.c = S.cols.length - 2; S.fillCol = -1; drawReg(); explain(); }, tok('--motion-run') + tok('--motion-spin') + tok('--motion-slow'));
}
Icons.hydrate();
boot();
