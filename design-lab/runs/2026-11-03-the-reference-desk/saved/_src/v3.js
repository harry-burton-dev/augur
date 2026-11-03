/* V3: two clocks on one axis. Lavender: the question's own "since" (fixed by its words). Green: what we knew (the run's address). */
const RANGE = ['2025-11-15', '2026-11-12'];
const S = { viewer: 'sam', known: Q.asked };
const span = daysBetween(RANGE[0], RANGE[1]);
const X = d => Math.max(0, Math.min(100, daysBetween(RANGE[0], d) / span * 100));
const addDays = (d, n) => { const t = new Date(d + 'T12:00:00Z'); t.setUTCDate(t.getUTCDate() + n); return t.toISOString().slice(0, 10); };
const RUNSPAN = daysBetween(Q.asked, DATA.today);

function header() {
  $('#brand').textContent = DATA.app;
  $('#crumb').innerHTML = `${ic('chevron-right', 14)}<span>Questions</span>${ic('chevron-right', 14)}<b>${esc(Q.id)}</b>`;
  const p = P(S.viewer);
  $('#where').innerHTML = `${ic('user-round', 13)}<b>${esc(p.name)}</b> on ${fl(p.floor)}`;
  $('#said').innerHTML = `${esc(P(Q.asker).first)} asked <q>${esc(Q.words)}</q> on ${fmt(Q.asked)}, ${Q.askedTime}`;
  $('#sent').innerHTML = sentenceHtml();
  $('#clocks').innerHTML = `
    <div class="clock since">${ic('calendar-range', 14)}<span><b>When it happened: since ${fmt(Q.cutoff)}</b>Set by the words. “Since spring” was turned into a fixed date, so it never slides.<span class="tk">${esc(Q.clar.spring.tech)}</span></span></div>
    <div class="clock known">${ic('history', 14)}<span><b>What we knew: on <span id="kd">${fmt(S.known)}</span></b>The address of a run. Records that arrived after this day are left out, even when they are about earlier days.<span class="tk">transaction time ≤ ${S.known} · every record keeps the day it arrived</span></span></div>`;
  Icons.hydrate($('.band')); Icons.hydrate($('#clocks'));
}

function drawChart() {
  const a = answer(S.viewer, S.known);
  const sees = P(S.viewer).sees;
  const inIds = a.rows.map(r => r.s.id), never = a.never.map(r => r.s.id);
  const months = []; for (let m = 0; m < 12; m++) { const d = new Date(Date.UTC(2025, 11 + m, 1)).toISOString().slice(0, 10); if (d <= RANGE[1]) months.push(d); }
  const lines = DATA.suppliers.map(s => {
    const ctrKnown = (s.contractLogged || s.contract[0]) <= S.known;
    const c0 = s.contract[0] < RANGE[0] ? RANGE[0] : s.contract[0], c1 = s.contract[1] > RANGE[1] ? RANGE[1] : s.contract[1];
    const ctr = c0 <= RANGE[1] && c1 >= RANGE[0] ? `<span class="ctr ${ctrKnown ? '' : 'unknown'}" style="left:${X(c0)}%;width:${X(c1) - X(c0)}%"></span>` : '';
    const row = a.rows.find(r => r.s.id === s.id) || a.heard.find(r => r.s.id === s.id);
    const dots = s.contacts.filter(c => sees.includes(SRC(c.src).floor)).map(c => {
      const known = (c.logged || c.on) <= S.known;
      const isLast = row && row.last === c;
      const late = c.logged && c.logged !== c.on ? `<span class="late" style="left:${X(c.on)}%;width:${X(c.logged) - X(c.on)}%"><span class="lbl">logged ${fmtS(c.logged)}</span></span>` : '';
      return `${late}<span class="dot ${c.src} ${c.guess ? 'guess' : known ? '' : 'unknown'} ${isLast ? 'last' : ''}" style="left:${X(c.on)}%" title="${esc(c.via)} ${fmt(c.on)}${c.logged ? ', logged ' + fmt(c.logged) : ''}${c.guess ? ' (a guess)' : ''}"></span>`;
    }).join('');
    const cls = inIds.includes(s.id) ? 'in' : never.includes(s.id) ? 'never' : '';
    return `<div class="ln ${cls}" data-id="${s.id}"><span class="nm">${esc(s.name)}</span><span class="track">${ctr}${dots}</span></div>`;
  }).join('');
  const ticks = [];
  for (let i = 0; i <= RUNSPAN - 3; i += 7) ticks.push(addDays(Q.asked, i));
  $('#chart').innerHTML = `
    <div class="plot"><div class="axis">${months.map(m => `<span class="t" style="left:${X(m)}%">${MON[+m.slice(5, 7) - 1]}${m.slice(5, 7) === '01' ? ' ' + m.slice(0, 4) : ''}</span>`).join('')}</div>
    <div class="lines">${lines}</div>
    <div class="overlay">
      <span class="after" style="left:${X(S.known)}%"></span>
      <span class="vline since" style="left:${X(Q.cutoff)}%"></span><span class="vl since" style="left:${X(Q.cutoff)}%">since ${fmtS(Q.cutoff)}</span>
      <span class="zoom" style="left:${X(Q.asked)}%;width:${X(DATA.today) - X(Q.asked)}%"></span>
      <span class="vline known" style="left:${X(S.known)}%"></span><span class="vl known ${X(S.known) > 88 ? 'flip' : ''}" style="left:${X(S.known)}%">knew on ${fmtS(S.known)}</span>
    </div></div>
    <div class="scrub"><p class="sl">${ic('history', 11)} What we knew, ${fmtS(Q.asked)} to now (the green stretch above, opened out)</p><div class="sw"><input type="range" id="scrub" min="0" max="${RUNSPAN}" value="${daysBetween(Q.asked, S.known)}" aria-label="What we knew: day"><span class="rail"></span>
      ${ticks.map(d => `<span class="tick" style="left:${daysBetween(Q.asked, d) / RUNSPAN * 100}%"><span>${fmtS(d)}</span></span>`).join('')}
      <span class="tick end" style="left:100%"><span>now</span></span>
      ${events().map((e, i) => `<span class="ev" style="--lv:${i % 2};left:${daysBetween(Q.asked, e.d) / RUNSPAN * 100}%">${ic(DATA.reasons[e.r].icon, 10)}${esc(e.t)}</span>`).join('')}
      <span class="knob" style="left:${daysBetween(Q.asked, S.known) / RUNSPAN * 100}%"></span></div></div>`;
  Icons.hydrate($('.scrub'));
  $('#scrub').oninput = e => { S.known = addDays(Q.asked, +e.target.value); update(); };
  drawRight(a);
}
/* moments in the run window when something arrived that moves the answer */
function events() {
  const ev = [];
  DATA.suppliers.forEach(s => {
    if (s.contractLogged && s.contractLogged > Q.asked && s.contractLogged <= DATA.today) ev.push({ d: s.contractLogged, r: 'world', t: `${s.name.split(' ')[0]}: contract starts` });
    s.contacts.forEach(c => { if (c.logged && c.logged !== c.on && c.logged > Q.asked && P(S.viewer).sees.includes(SRC(c.src).floor)) ev.push({ d: c.logged, r: 'learned', t: `${s.name.split(' ')[0]}: late record` }); });
  });
  return ev;
}
function update() { clearTimers(); drawChart(); const kd = $('#kd'); if (kd) kd.textContent = fmt(S.known); }

function drawRight(a) {
  const asked = answer(S.viewer, Q.asked);
  const d = diff(asked, a);
  const isThen = S.known === Q.asked, isNow = S.known === DATA.today;
  const items = [...d.joined.map(id => ['join', id]), ...d.left.map(id => ['left', id])].map(([k, id]) => {
    const w = why(id, asked, a);
    return `<li class="${k}"><b>${esc(SUP(id).name)}</b><span>${k === 'join' ? 'joined' : 'left'} · ${reasonTag(w.r)}</span><span>${esc(w.text)}</span></li>`;
  }).join('');
  $('#right').innerHTML = `
    <div class="addrbox"><p class="eyebrow">The address of this answer</p>
      <p class="ad">${esc(Q.id)} · as known on <span class="k">${fmt(S.known)}</span> · with ${esc(P(S.viewer).first)}’s access</p>
      <p class="tk">atlas/questions/${esc(Q.id)}?known=${S.known}&amp;access=${S.viewer}</p>
      <p class="big ${isThen ? 'then' : ''}"><b>${a.rows.length}</b><span class="small">suppliers not heard from since ${fmt(Q.cutoff)}${isThen ? ' — exactly as it read when asked' : ''}</span></p></div>
    <div class="seg"><button class="btn" id="bthen" aria-pressed="${isThen}">${ic('history', 13)}As it was when asked</button><button class="btn" id="bnow" aria-pressed="${isNow}">${ic('clock', 13)}As it is now</button><button class="btn" id="bcopy">${ic('link', 13)}Link to this moment</button></div>
    <h3 class="h3">Since it was asked</h3>
    ${items ? `<ul class="chg">${items}</ul>` : `<p class="small">Nothing moved between ${fmtS(Q.asked)} and ${fmtS(S.known)}. Drag the green line, or press <span class="kbd">N</span>.</p>`}
    <p class="small">Same count can hide different suppliers: compare the names, not only the number.</p>
    ${unseenHtml(S.viewer)}
    <p class="small">${ic('list-checks', 12)} Moving the line asks no model. Every record keeps the day it arrived, so any day can be rerun exactly.</p>`;
  $('#bthen').onclick = () => { S.known = Q.asked; update(); };
  $('#bnow').onclick = () => { S.known = DATA.today; update(); };
  $('#bcopy').onclick = () => toast(`${ic('link', 14)}<span><b>Link copied: ${esc(Q.id)} as known on ${fmt(S.known)}</b><br>Whoever opens it reruns it with their own access, on that day’s data.</span>`);
  Icons.hydrate($('#right'));
}
function legend() {
  $('#legend').innerHTML = `<span><span class="dot"></span>email or call (contact log)</span><span><span class="dot notes"></span>meeting (meeting notes)</span><span><span class="dot invoices"></span>invoice query</span><span><span class="dot last"></span>last contact the run counts</span><span><span class="dot unknown"></span>happened, not known yet that day</span><span><span class="dot guess"></span>a model’s guess, not counted</span><span><span class="ctr" style="position:static;display:inline-block;width:var(--space-5);margin:0"></span>contract running</span>`;
}
function glide(from, to, dur) {
  if (RM) { S.known = to; update(); return; }
  const n = daysBetween(from, to); const t0 = performance.now();
  const step = now => { const p = Math.min(1, (now - t0) / dur); const e = 1 - Math.pow(1 - p, 3); S.known = addDays(from, Math.round(n * e)); drawChart(); const kd = $('#kd'); if (kd) kd.textContent = fmt(S.known); if (p < 1) S.raf = requestAnimationFrame(step); };
  cancelAnimationFrame(S.raf); S.raf = requestAnimationFrame(step);
}
onKey = (k, e) => {
  if (k === 'arrowright' || k === 'arrowleft') { if (document.activeElement && document.activeElement.id === 'scrub') return false; cancelAnimationFrame(S.raf); const n = (e.shiftKey ? 7 : 1) * (k === 'arrowright' ? 1 : -1); const nd = addDays(S.known, n); S.known = nd < Q.asked ? Q.asked : nd > DATA.today ? DATA.today : nd; update(); return true; }
  if (k === 'a') { cancelAnimationFrame(S.raf); S.known = Q.asked; update(); return true; }
  if (k === 'n') { cancelAnimationFrame(S.raf); S.known = DATA.today; update(); return true; }
  if (k === 'p') { S.viewer = S.viewer === 'sam' ? 'priya' : 'sam'; header(); update(); return true; }
  return false;
};
function boot() {
  clearTimers(); cancelAnimationFrame(S.raf); setTech(false);
  S.viewer = 'sam'; S.known = Q.asked;
  const w = $('#wrap'); w.classList.add('pre');
  header(); drawChart(); legend();
  requestAnimationFrame(() => requestAnimationFrame(() => w.classList.remove('pre')));
  /* the moment: the green line glides from the day it was asked to today, and the answer moves with it */
  later(() => glide(Q.asked, DATA.today, tok('--motion-shimmer')), tok('--motion-run'));
}
Icons.hydrate();
boot();
