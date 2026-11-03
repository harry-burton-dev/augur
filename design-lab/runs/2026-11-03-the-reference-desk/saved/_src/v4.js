/* V4: the same question at two desks. Rows line up by supplier so a difference sits on one line, and the gutter says why. */
const WHO = ['sam', 'priya'];
const S = { focus: 'sam', shown: 0, marks: false };
const RUN = { sam: DATA.runs.find(r => r.by === 'watch' && r.at === DATA.today), priya: DATA.runs.find(r => r.by === 'priya') };

function header() {
  $('#brand').textContent = DATA.app;
  $('#crumb').innerHTML = `${ic('chevron-right', 14)}<span>Questions</span>${ic('chevron-right', 14)}<b>${esc(Q.id)}</b>${ic('chevron-right', 14)}<span>two desks</span>`;
  $('#where').innerHTML = `${ic('scan-eye', 13)}<b>design review view</b>`;
  $('#said').innerHTML = `Shared by ${esc(P(Q.asker).name)} to ${fl(Q.sharedTo)} on ${fmt(Q.sharedOn)}. What travelled: the words, the sentence, the steps and who chose each word. <b style="font-weight:400;color:var(--ink)">Not Sam’s rows.</b>`;
  $('#sent').innerHTML = sentenceHtml();
  $('#review').innerHTML = `${ic('info', 13)}<span><b>Nobody sees both desks.</b> This split is for us, to check that a rerun on another floor is honest. Each desk is exactly what that person sees.</span>`;
  const fl3 = ['org', 'facilities', 'finance'];
  $('#access').innerHTML = fl3.map(f => {
    const srcs = Object.values(DATA.sources).filter(s => s.floor === f).map(s => s.plain).join(', ');
    return `<div class="fbox" data-tier="${F(f).tier}"><b>${esc(F(f).name)}</b>${esc(srcs)}<span class="who">${WHO.map(w => P(w).sees.includes(f) ? `<span class="chip">${ic('check', 10)}${esc(P(w).first)}</span>` : `<span class="chip no">${ic('lock', 10)}${esc(P(w).first)}</span>`).join('')}</span><span class="tk">${esc(Object.values(DATA.sources).filter(s => s.floor === f).map(s => s.tech).join(' · '))}</span></div>`;
  }).join('');
  Icons.hydrate($('.band')); Icons.hydrate($('.carried'));
}

const A = {};
function union() {
  const ids = [];
  WHO.forEach(w => [...A[w].rows, ...A[w].never].forEach(r => { if (!ids.includes(r.s.id)) ids.push(r.s.id); }));
  return DATA.suppliers.filter(s => ids.includes(s.id)).map(s => s.id);
}
function cell(w, id) {
  const a = A[w];
  const r = a.rows.find(x => x.s.id === id); if (r) return { k: 'in', v: `${fmtS(r.last.on)} ${r.last.on.slice(2, 4)} · ${r.last.via}`, g: r.guess };
  if (a.never.find(x => x.s.id === id)) return { k: 'never', v: 'no contact logged' };
  const h = a.heard.find(x => x.s.id === id); if (h) return { k: 'heard', v: `heard ${fmtS(h.last.on)}` };
  return { k: 'na', v: 'no contract' };
}
function drawDesks() {
  WHO.forEach(w => A[w] = answer(w, DATA.today));
  const U = union();
  const desk = (w, i) => {
    const p = P(w), run = RUN[w];
    const rows = U.map((id, j) => {
      const c = cell(w, id), o = cell(WHO[1 - i], id);
      const wait = w === 'priya' && j >= S.shown ? 'wait' : (w === 'priya' && j === S.shown - 1 ? 'arrive' : '');
      return `<div class="dr ${c.k} ${c.k !== o.k ? 'differs' : ''} ${wait}"><span class="nm">${c.k === 'never' ? '<span class="mk mk-gap" style="margin-right:var(--space-2)"></span>' : ''}${esc(SUP(id).name)}</span><span class="v">${c.g ? `<span class="gtag">${ic('cpu', 10)}guess</span>` : ''}${esc(c.v)}</span></div>`;
    }).join('');
    const ready = w === 'sam' || S.shown >= U.length;
    return `<div class="desk ${w}" data-tier="${F(p.floor).tier}">
      <div class="dh"><span class="p">${ic('user-round', 14)}${esc(p.name)} · ${fl(p.floor)}</span><span class="s">${run.by === 'watch' ? 'the watch reran it for Sam' : esc(p.first) + ' reran it'} on ${fmt(run.at)}, ${run.time}, with ${esc(p.first)}’s own access</span><span class="n">${ready ? A[w].rows.length : '…'}</span></div>
      <div class="dlist">${rows}</div>
      <div class="dfoot">${unseenHtml(w)}</div></div>`;
  };
  const gut = `<div class="gut"><div class="gh">why they differ</div><div class="gl">${U.map(id => {
    const a = cell('sam', id), b = cell('priya', id);
    if (a.k === b.k) return `<div class="gr"><span class="eq">${ic('equal', 12)}</span></div>`;
    const inA = a.k === 'in';
    const w = inA ? why(id, A.sam, A.priya) : why(id, A.priya, A.sam);
    const holder = w.holder ? P(w.holder).first : '';
    const src = w.c ? SRC(w.c.src) : null;
    return `<div class="gr"><span class="dx ${S.marks ? 'on' : ''}" title="${esc(w.text)}">${ic(DATA.reasons[w.r].icon, 12)}<span>${src ? `${esc(src.plain)}: only ${esc(holder)}` : esc(DATA.reasons[w.r].plain)}</span></span></div>`;
  }).join('')}</div></div>`;
  $('#desks').innerHTML = desk('sam', 0) + gut + desk('priya', 1);
  $('#desks').dataset.focus = S.focus;
  Icons.hydrate($('#desks'));
  /* keep the gutter scrolled with the desks */
  const lists = $$('.dlist'); const gl = $('.gl');
  /* line the gutter up with the first desk row, and end it where the list ends */
  const d0 = $('.dlist .dr'), r0 = $('.gl .gr'), gh = $('.gh'), dl = $('.dlist');
  if (d0 && r0) { const off = d0.getBoundingClientRect().top - r0.getBoundingClientRect().top; gh.style.height = (gh.offsetHeight + off) + 'px'; gl.style.height = dl.clientHeight + 'px'; gl.style.flex = 'none'; }
  lists.forEach(l => l.onscroll = () => { lists.forEach(o => { if (o !== l) o.scrollTop = l.scrollTop; }); gl.scrollTop = l.scrollTop; });
}
function legend() {
  $('#legend').innerHTML = `<span><span class="m" style="display:inline-block;width:var(--space-2);height:var(--space-2);background:var(--light)"></span>in that person’s answer</span><span><span class="mk mk-gap"></span>no contact logged that they can see</span><span style="text-decoration:line-through">heard from since ${fmtS(Q.cutoff)}</span><span>${ic('lock', 12)}<span>the gutter only ever says <b style="font-weight:400;color:var(--ink)">different access</b>: same question, same day</span></span><span>Neither desk names rows the other can’t open: each says <i>${esc(DATA.hiddenCount)}</i> and whom to ask.</span>`;
  Icons.hydrate($('#legend'));
}
function focus(f) { S.focus = f; $('#desks').dataset.focus = f; }
onKey = k => {
  if (k === 's') { focus('sam'); return true; }
  if (k === 'p') { focus('priya'); return true; }
  if (k === 'c') { focus('both'); S.marks = true; $$('.dx').forEach(d => d.classList.add('on')); return true; }
  return false;
};
function boot() {
  clearTimers(); setTech(false);
  S.focus = 'sam'; S.shown = 0; S.marks = false;
  WHO.forEach(w => A[w] = answer(w, DATA.today));
  const w = $('#wrap'); w.classList.add('pre');
  header(); drawDesks(); legend();
  requestAnimationFrame(() => requestAnimationFrame(() => w.classList.remove('pre')));
  /* the moment: focus pulls to Priya's desk a week after the share; her rerun fills line by line; then both sharpen and the gutter says why */
  const n = union().length;
  later(() => focus('priya'), tok('--motion-run'));
  for (let j = 1; j <= n; j++) later(() => { S.shown = j; drawDesks(); }, tok('--motion-run') + tok('--motion-slow') + j * tok('--motion-instant'));
  later(() => { S.marks = true; S.focus = 'both'; drawDesks(); }, tok('--motion-run') + tok('--motion-slow') + n * tok('--motion-instant') + tok('--motion-calm'));
}
Icons.hydrate();
boot();
