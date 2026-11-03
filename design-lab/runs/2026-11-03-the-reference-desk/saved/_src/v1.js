/* V1: the card stays the same for every reader; each reader's slip shows only their own counts. */
const S = { viewer: 'sam', runs: [], sel: 0, mode: 'now', pressed: -1 };
const owner = r => P(r.by).as || r.by;
const mine = r => owner(r) === S.viewer;

function header() {
  $('#brand').textContent = DATA.app;
  $('#crumb').innerHTML = `${ic('chevron-right', 14)}<span>Questions</span>${ic('chevron-right', 14)}<b>${esc(Q.id)}</b>`;
  const p = P(S.viewer);
  $('#where').innerHTML = `<span class="viewer">${ic('user-round', 13)}<b>${esc(p.name)}</b></span> on ${fl(p.floor)}`;
  $('#bthen').innerHTML = `${ic('history', 12)}as it was when asked`;
  $('#bnow').innerHTML = `${ic('clock', 12)}as it is now`;
  $('#bthen').setAttribute('aria-pressed', S.mode === 'then'); $('#bnow').setAttribute('aria-pressed', S.mode === 'now');
  $('#bthen').onclick = () => { S.mode = 'then'; drawAns(); header(); };
  $('#bnow').onclick = () => { S.mode = 'now'; drawAns(); header(); };
  Icons.hydrate($('.band')); Icons.hydrate($('#bthen').parentNode);
}

function drawCard() {
  const c = Q.clar;
  const pencil = Object.keys(c).map(k => `<li><span><q>${esc(c[k].said)}</q> → <b>${esc(c[k].chose)}</b></span>${howTag(c[k].how)}<span class="fx">${esc(c[k].fixed)}<span class="tk">${esc(c[k].tech)}</span></span></li>`).join('');
  const steps = Q.steps.map(s => `<li>${esc(s.plain)} ${howTag(s.how)}${s.aside ? `<span class="aside">${esc(s.aside)}</span>` : ''}<span class="tk">${esc(s.tech)}</span></li>`).join('');
  $('#card').innerHTML = `
    <div class="callno"><span>${esc(Q.id)} · question</span><span>kept on ${fl(Q.sharedTo)}</span></div>
    <p class="words">“${esc(Q.words)}”</p>
    <p class="small">asked by <b>${esc(P(Q.asker).name)}</b> on ${fmt(Q.asked)}, ${Q.askedTime} · shared to the Org floor ${fmt(Q.sharedOn)}</p>
    <h4>Said in a sentence</h4>
    <p class="sent">${sentenceHtml()}</p>
    <h4>How the words were sharpened</h4>
    <ul class="pencil">${pencil}</ul>
    <h4>The steps it reruns</h4>
    <ol class="steps">${steps}</ol>
    <h4>Watching</h4>
    <dl class="facts"><dt>Tells ${esc(P(Q.asker).first)} when</dt><dd>${esc(Q.watch.when)}</dd><dt>Checks</dt><dd>${esc(Q.watch.cadence)}, with ${esc(P(Q.asker).first)}’s access</dd><dt>Says so with</dt><dd>${esc(Q.watch.tell)}</dd></dl><div class="hole" aria-hidden="true"></div>`;
  Icons.hydrate($('#card'));
}

/* each run's answer, computed */
function withAnswers(runs) { return runs.map(r => ({ ...r, a: answer(r.by, r.asOf) })); }
function prevMine(i) { for (let j = i - 1; j >= 0; j--) if (owner(S.runs[j]) === owner(S.runs[i]) && S.runs[j].kind !== 'then') return S.runs[j]; return null; }
function lastChanged() {
  let last = null;
  S.runs.forEach((r, i) => { if (!mine(r) || r.kind === 'then') return; const p = prevMine(i); if (p && (diff(p.a, r.a).joined.length || diff(p.a, r.a).left.length)) last = r; });
  return last;
}
function drawSlip() {
  const shown = S.runs;
  $('#slipwho').textContent = `${P(S.viewer).first}’s slip`;
  $('#stamps').innerHTML = shown.map((r, i) => {
    const p = prevMine(i);
    const d = p ? diff(p.a, r.a) : null;
    const ch = d && (d.joined.length || d.left.length);
    const who = r.by === 'watch' ? 'the watch' : P(r.by).first;
    if (!mine(r)) {
      return `<li><button class="stamp theirs ${i === S.pressed ? 'press' : ''}" data-i="${i}" aria-pressed="${i === S.sel}"><span class="d">${fmtS(r.at)} ${r.time}</span><span class="n">their answer is theirs</span><span class="st">${ic('lock', 10)}${esc(who)} · ${esc(F(P(r.by).floor).name)}</span></button></li>`;
    }
    const cls = r.kind === 'then' ? 'then' : ch ? 'changed' : '';
    const st = r.kind === 'then' ? `${ic('history', 10)}data as of ${fmtS(r.asOf)}` : r.kind === 'asked' ? `${ic('pen-line', 10)}asked · ${esc(who)}` : !p ? `${ic('play', 10)}first run · ${esc(who)}` : ch ? `${ic('git-compare', 10)}changed · ${esc(who)}` : `${ic('equal', 10)}same · ${esc(who)}`;
    return `<li><button class="stamp ${cls} ${i === S.pressed ? 'press' : ''}" data-i="${i}" aria-pressed="${i === S.sel}"><span class="d">${fmtS(r.at)} ${r.time}</span><span class="n">${r.a.rows.length}</span><span class="st">${st}</span></button></li>`;
  }).join('');
  $$('#stamps .stamp').forEach(b => b.onclick = () => { S.sel = +b.dataset.i; S.mode = S.runs[S.sel].kind === 'then' ? 'then' : 'now'; S.pressed = -1; drawSlip(); drawAns(); header(); });
  const lc = lastChanged();
  $('#lastchg').innerHTML = lc ? `${ic('git-compare', 13)} Its answer last changed on <b>${fmt(lc.at)}</b>, ${daysBetween(lc.at, DATA.today)} days ago. ${esc(Q.watch.cadence[0].toUpperCase() + Q.watch.cadence.slice(1))} it checks again; a stamp that says <i>same</i> means nothing moved.` : '';
  Icons.hydrate($('#stamps')); Icons.hydrate($('#lastchg'));
  const sel = $('#stamps [aria-pressed="true"]'); if (sel) sel.scrollIntoView({ block: 'nearest' });
}

function drawAns() {
  const r = S.runs[S.sel];
  const el = $('#ans');
  if (!mine(r)) {
    const them = P(r.by);
    el.innerHTML = `<p class="addr">${ic('lock', 13)} <b>${esc(them.name)}</b> reran it on ${fmt(r.at)}, ${r.time}, from ${fl(them.floor)}</p>
      <div class="theirsbox"><span>Each person reruns it with their own access, so <b>${esc(them.first)}’s answer is ${esc(them.first)}’s</b>. You see that ${esc(them.first)} reran it, not what ${esc(them.first)} got: ${esc(them.first)} can open floors you can’t, and the other way round.</span>
      <span>Want to compare? Ask ${esc(them.first)} to send you the rows ${esc(them.first)} is allowed to share, or press <span class="kbd">P</span> to see this prototype as ${esc(them.first)}.</span></div>
      ${unseenHtml(S.viewer)}`;
    Icons.hydrate(el); return;
  }
  /* the address: who, and the data as of when */
  const asked = S.runs.find(x => x.kind === 'asked');
  const askedA = answer(S.viewer === Q.asker ? Q.asker : S.viewer, Q.asked);
  const nowA = r.kind === 'then' ? answer(S.viewer, DATA.today) : r.a;
  const showThen = S.mode === 'then';
  const a = showThen ? askedA : nowA;
  const other = showThen ? nowA : askedA;
  const d = diff(askedA, nowA);
  const join = showThen ? [] : d.joined, left = showThen ? d.left : [];
  const label = showThen ? `<span class="tag-then">${ic('history', 10)}as it was</span> <span>the data as Data Atlas knew it on <b>${fmt(Q.asked)}</b>, ${Q.askedTime}</span>` : `<span class="tag-now">${ic('clock', 10)}as it is now</span> <span>the data as Data Atlas knows it on <b>${fmt(r.asOf)}</b></span>`;
  const rows = a.rows.map(x => rowHtml(x, (showThen ? left : join).includes(x.s.id) ? (showThen ? 'leave-then' : 'join') : '')).join('');
  const goneNow = showThen ? '' : d.left.map(id => { const w = why(id, askedA, nowA); return `<li class="row leave" data-id="${id}"><span class="nm">${esc(SUP(id).name)}</span><span class="lc">left</span><span class="why">${reasonTag(w.r)} ${esc(w.text)}</span></li>`; }).join('');
  const joinWhy = showThen ? '' : d.joined.map(id => { const w = why(id, askedA, nowA); return [id, w]; });
  el.innerHTML = `<p class="addr">${label}</p>
    <p class="count ${showThen ? 'then' : ''}"><b>${a.rows.length}</b><span class="small">suppliers not heard from since ${fmt(Q.cutoff)}, with ${esc(P(S.viewer).first)}’s access${showThen ? '' : `. When it was asked: ${askedA.rows.length}. ${askedA.rows.length === a.rows.length ? 'Same number, ' + (d.joined.length + d.left.length ? 'not the same suppliers.' : 'same suppliers.') : (d.joined.length + d.left.length) + ' changed places.'}`}</span></p>
    <div class="ansbody ${showThen ? 'then' : ''}">
      <ul class="rows">${rows}${goneNow}</ul>
      ${a.never.length ? `<p class="grp">Listed apart: no contact logged at all</p>${a.never.map(n => `<div class="neverrow"><span class="mk mk-gap"></span>${esc(n.s.name)} <small>not known yet · anyone who has dealt with them could add it</small></div>`).join('')}` : ''}
      <p class="grp">Can’t be checked from here</p>
      ${unseenHtml(S.viewer)}
    </div>
    <div class="actions"><button class="btn primary" id="rerun">${ic('refresh-cw', 13)}Rerun now</button><button class="btn" id="rethen">${ic('history', 13)}Rerun as it was on ${fmtS(Q.asked)}</button></div>`;
  /* annotate joined rows with why */
  if (!showThen) joinWhy.forEach(([id, w]) => { const li = $(`.row[data-id="${id}"]`, el); if (li) li.insertAdjacentHTML('beforeend', `<span class="why">${reasonTag(w.r)} ${esc(w.text)}</span>`); });
  if (showThen) d.left.forEach(id => { const li = $(`.row[data-id="${id}"]`, el); const w = why(id, askedA, nowA); if (li) li.insertAdjacentHTML('beforeend', `<span class="why">${ic('history', 11)} In this answer then. Since: ${esc(w.text)}</span>`); });
  if (showThen) el.insertAdjacentHTML('beforeend', '');
  $('#rerun').onclick = () => rerun('now');
  $('#rethen').onclick = () => rerun('then');
  Icons.hydrate(el);
}

function rerun(kind) {
  const r = kind === 'then'
    ? { at: DATA.today, time: '09:31', by: S.viewer, asOf: Q.asked, kind: 'then' }
    : { at: DATA.today, time: '09:30', by: S.viewer, asOf: DATA.today, kind: 'rerun' };
  S.runs.push({ ...r, a: answer(r.by, r.asOf) });
  S.sel = S.pressed = S.runs.length - 1; S.mode = kind === 'then' ? 'then' : 'now';
  header(); drawSlip(); drawAns();
  toast(`${ic(kind === 'then' ? 'history' : 'refresh-cw', 14)}<span><b>${kind === 'then' ? 'Rerun with the data as it was on ' + fmt(Q.asked) : 'Rerun with the data as it is now'}</b><br>No model was asked: the steps are kept as rules. One meeting-note match is still a guess and stays uncounted.</span>`);
}

function setViewer(v) {
  S.viewer = v; S.mode = 'now';
  const idx = S.runs.map((r, i) => [r, i]).filter(([r]) => mine(r) && r.kind !== 'then').pop();
  S.sel = idx ? idx[1] : 0; S.pressed = -1;
  header(); drawSlip(); drawAns();
}

onKey = k => {
  if (k === 'enter' && document.activeElement === document.body) { rerun('now'); return true; }
  if (k === 'a') { S.mode = 'then'; header(); drawAns(); return true; }
  if (k === 'n') { S.mode = 'now'; header(); drawAns(); return true; }
  if (k === 'p') { setViewer(S.viewer === 'sam' ? 'priya' : 'sam'); return true; }
  if (k === 'arrowdown' || k === 'arrowup') {
    S.sel = Math.max(0, Math.min(S.runs.length - 1, S.sel + (k === 'arrowdown' ? 1 : -1)));
    S.mode = S.runs[S.sel].kind === 'then' ? 'then' : 'now'; S.pressed = -1; header(); drawSlip(); drawAns(); return true;
  }
  return false;
};

function boot() {
  clearTimers(); setTech(false);
  S.viewer = 'sam'; S.mode = 'now';
  S.runs = withAnswers(DATA.runs.slice(0, -2)); /* before this morning */
  S.sel = S.runs.length - 1; S.pressed = -1;
  const w = $('#wrap'); w.classList.add('pre');
  header(); drawCard(); drawSlip(); drawAns();
  requestAnimationFrame(() => requestAnimationFrame(() => w.classList.remove('pre')));
  /* the moment: this morning's watch stamps the slip, then Priya's rerun lands as a stamp Sam can't read */
  later(() => { S.runs.push({ ...DATA.runs.at(-2), a: answer(DATA.runs.at(-2).by, DATA.runs.at(-2).asOf) }); S.sel = S.pressed = S.runs.length - 1; drawSlip(); drawAns(); }, tok('--motion-run'));
  later(() => { S.runs.push({ ...DATA.runs.at(-1), a: answer(DATA.runs.at(-1).by, DATA.runs.at(-1).asOf) }); S.pressed = S.runs.length - 1; drawSlip(); }, tok('--motion-run') + tok('--motion-spin'));
  later(() => { S.mode = 'now'; header(); drawAns(); }, tok('--motion-run') + tok('--motion-spin') + tok('--motion-slow'));
}
Icons.hydrate();
boot();
