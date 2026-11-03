/* ---- helpers shared by every variant ---- */
const $ = (s, r = document) => r.querySelector(s), $$ = (s, r = document) => [...r.querySelectorAll(s)];
const RM = matchMedia('(prefers-reduced-motion: reduce)').matches;
const ms = t => { const v = getComputedStyle(document.documentElement).getPropertyValue(t).trim(); return v.endsWith('ms') ? parseFloat(v) : parseFloat(v) * 1000; };
let timers = [];
const later = (fn, d) => timers.push(setTimeout(fn, RM ? 0 : d));
const clearLater = () => { timers.forEach(clearTimeout); timers = []; };
const K = id => DATA.kinds.find(k => k.id === id);
const G = id => DATA.genera.find(g => g.id === id);
const ic = (n, s = 16) => Icons.svg(n, { size: s, stroke: 1.5 });
const st = w => `<span class="st">${w}</span>`;
const W = k => DATA.words[k];
const fmt = n => n.toLocaleString('en-GB');
let MODE = location.hash === '#misfit' ? 'misfit' : 'fits';
if (location.hash === '#studio') document.body.classList.add('studio');

function frame(V) {
  $('#rail').innerHTML = `<div class="an">${DATA.app}</div>
    <div class="floor"><span class="dot"></span>${DATA.floor.kind} · ${DATA.floor.name}</div>
    ${DATA.nav.map(n => `<div class="nav${n.on ? ' on' : ''}">${ic(n.icon)}<span>${n.label}</span>${n.n != null ? `<span class="n">${fmt(n.n)}</span>` : ''}</div>`).join('')}
    <div class="foot" id="railfoot"></div>`;
  $('#crumb').textContent = `${DATA.floor.name} · ${DATA.app} · Add a thing`;
  $('#h1').textContent = V.title;
  $('#sub').innerHTML = V.sub;
  studioFoot();
}
function studioFoot() {
  const on = document.body.classList.contains('studio');
  $('#railfoot').innerHTML = on
    ? `<b>Studio words are on.</b> Each plain word shows the name admins use, one step down. <span class="kbd">S</span> hides them.`
    : `Plain words only. Admins can show the <b>studio words</b> underneath with <span class="kbd">S</span>`;
}
function steps(at, waiting) {
  const L = DATA.steps[MODE];
  $('#steps').innerHTML = L.map((l, i) => {
    const c = i < at ? 'done' : i === at ? (waiting && i === L.length - 1 ? 'wait' : 'now') : '';
    const lock = i === L.length - 1 ? `<i data-lucide="${waiting ? 'hourglass' : 'shield-check'}"></i>` : '';
    return `${i ? '<span class="sep"></span>' : ''}<span class="s ${c}${lock ? ' lock' : ''}"><b>${i < at ? '✓' : i + 1}</b>${l}${lock}</span>`;
  }).join('');
  Icons.hydrate($('#steps'));
}
function thingCard(t = DATA.things[MODE]) {
  return `<div class="said"><div class="micro">The new thing, in your words</div><div class="w">${t.said}</div><p>${t.note}</p>
    <div class="from">${ic('pencil-line', 12)}${t.from}</div></div>`;
}
function kindChip(k, count = true) {
  return `<span class="kind">${ic(k.icon)}<span>${k.word}</span>${count ? `<span class="c">${fmt(k.n)}</span>` : ''}${st(k.studio)}</span>`;
}
function nearHTML(list = DATA.near[MODE], opt = {}) {
  const head = opt.head ?? (MODE === 'fits' ? 'Is it one of these?' : 'Closest we already keep');
  const why = opt.why ?? (MODE === 'fits'
    ? `If it is, what you know is added to that record instead of making a second one. ${DATA.matching.note}`
    : `None is the same kind of thing. Shown so you can check before asking for a new kind. ${DATA.matching.note}`);
  return `<div class="near"><h3>${head}${st(W('near')[1])}</h3><p class="why">${why}</p>
    ${list.map((n, i) => `<div class="nm${n.lead ? ' lead' : ''}" data-nm="${n.id}">
      <div class="t"><b>${n.name}</b>${kindChip(K(n.kind), false)}</div>
      <div class="where">${n.where}</div>
      <ul>${n.same.map(s => `<li class="same">${ic('check', 12)}${s}</li>`).join('')}${n.diff.map(s => `<li class="diff">${ic('x', 12)}${s}</li>`).join('')}</ul>
      ${MODE === 'fits' && !opt.noActs ? `<div class="acts"><button class="btn${n.lead ? ' go' : ' quiet'}" data-same="${n.id}">That’s it: add to it${n.lead ? ' <span class="kbd">Y</span>' : ''}</button></div>` : ''}
    </div>`).join('')}
    ${MODE === 'fits' && !opt.noActs ? `<button class="btn" data-new>None of these: it’s new <span class="kbd">Enter</span></button>` : ''}</div>`;
}
function detRows(k, t) {
  return k.has.map(h => {
    if (t.known && t.known[h]) return `<div class="k">${h}</div><div class="v">${t.known[h]}</div>`;
    const who = t.gaps && t.gaps[h];
    return `<div class="k">${h}</div><div class="v"><span class="gap"><span>Not known yet</span><span>${who ? `<b>${who}</b> could fill it` : 'Nobody named yet: Triage will ask'}</span></span></div>`;
  }).join('');
}
/* the last step of every path: what goes to Triage, who checks it, what is still missing */
function slipHTML(kind, same) {
  const t = DATA.things[MODE], s = DATA.steward, a = DATA.admin;
  if (MODE === 'misfit') {
    const p = DATA.predicted.find(x => x.genus === t.genus && x.shape === t.shape);
    const prior = p && p.asks.length ? p.asks.map(x => `${x.by} asked for this on ${x.on}`).join('; ') : '';
    return `<div class="slip waiting"><div class="stamp">${ic('hourglass', 12)}Waiting for a kind${st(W('ask')[1])}</div>
      <h3>${t.said}</h3>
      <p>No kind of thing we keep fits it, so it can’t be placed yet. It waits in <b>Triage</b>, under <b>Unplaced</b>, with everything you said kept.</p>
      <div class="who">${ic('user-round-check')}<span><b>${a.name}</b>, ${a.role} (${a.floor}), decides new kinds. Asked for: <b>“${p ? p.word : 'a new kind'}”</b>, ${t.words}.${prior ? ` ${prior}: yours is added to that ask (${p.asks.length + 1} asks).` : ''}</span>
        ${ic('clipboard-list')}<span>Your answers go with the ask, so ${a.name.split(' ')[0]} sees why nothing fitted.</span>
        ${ic('link')}<span>Until then it can’t be linked to other things. You can still attach the documents it came from.</span></div>
      <p class="m">Closest kind: ${K(t.closest).word}. Putting it there would leave ${K(t.closest).has[0]} as a gap nobody can ever fill.</p>
      <button class="btn quiet" aria-disabled="true" title="Possible, but ${s.name} would see you weren’t sure">Put it under ${K(t.closest).word} anyway</button></div>`;
  }
  const k = K(kind);
  if (same) {
    const n = DATA.near.fits.find(x => x.id === same);
    return `<div class="slip"><div class="stamp">${ic('inbox', 12)}Sent to Triage, as an addition</div><h3>Add to ${n.name}</h3>
      <p>What you know is proposed as details of the record we already keep. Where you disagree with it (${n.diff[0].toLowerCase()}), both are shown side by side until it’s decided.</p>
      <div class="who">${ic('user-round-check')}<span><b>${s.name}</b>, ${s.role} (${s.floor}), checks it. Nothing skips Triage.</span></div></div>`;
  }
  return `<div class="slip"><div class="stamp">${ic('inbox', 12)}Sent to Triage, as a new ${k.word}</div><h3>${t.said}</h3>
    <div class="det">${detRows(k, t)}</div>
    <div class="who">${ic('user-round-check')}<span><b>${s.name}</b>, ${s.role} (${s.floor}), checks it before it’s kept. Nothing skips Triage.</span>
    ${ic('waypoints')}<span>Links proposed with it: ${t.links.map(l => `${l[0]} <b>${l[1]}</b>`).join(', ')}.</span></div></div>`;
}
function keys(list) {
  $('#keys').innerHTML = list.map(([k, l]) => `<span><span class="kbd">${k}</span>${l}</span>`).join('');
}
function reveal(el) { if (!el) return; el.classList.add('fade', 'pre'); requestAnimationFrame(() => requestAnimationFrame(() => el.classList.remove('pre'))); }

function boot(V) {
  frame(V);
  const go = () => { clearLater(); V.reset(); steps(0); keys([...V.keys(), ['N', MODE === 'fits' ? 'nothing fits' : 'one that fits'], ['S', 'studio words'], ['R', 'replay']]); later(() => V.demo(), ms('--motion-run')); };
  addEventListener('keydown', e => {
    if (e.metaKey || e.ctrlKey || e.altKey) return;
    const k = e.key.toLowerCase();
    if (k === 'r') { go(); return; }
    if (k === 'n') { MODE = MODE === 'fits' ? 'misfit' : 'fits'; go(); return; }
    if (k === 's') { document.body.classList.toggle('studio'); studioFoot(); if (V.onStudio) V.onStudio(); return; }
    if (V.key && V.key(e)) e.preventDefault();
  });
  document.addEventListener('click', e => {
    const s = e.target.closest('[data-same]'), n = e.target.closest('[data-new]');
    if (s && V.done) V.done(s.dataset.same);
    if (n && V.done) V.done(null);
  });
  go();
}
