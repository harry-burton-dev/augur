/* ---------- helpers shared by the six variants ---------- */
const $ = (s, el = document) => el.querySelector(s);
const $$ = (s, el = document) => [...el.querySelectorAll(s)];
const esc = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const ic = (n, size = 14) => Icons.svg(n, { size, stroke: 1.5 });
const RM = matchMedia('(prefers-reduced-motion: reduce)').matches;
const tok = name => { const v = getComputedStyle(document.documentElement).getPropertyValue(name).trim(); return parseFloat(v) * (v.endsWith('ms') ? 1 : 1000); };
let TIMERS = [];
const later = (fn, t) => { TIMERS.push(setTimeout(fn, RM ? 0 : t)); };
const clearTimers = () => { TIMERS.forEach(clearTimeout); TIMERS = []; };
const MON = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const fmt = d => { const [y, m, dd] = d.split('-'); return `${+dd} ${MON[+m - 1]} ${y}`; };
const fmtS = d => { const [, m, dd] = d.split('-'); return `${+dd} ${MON[+m - 1]}`; };
const daysBetween = (a, b) => Math.round((new Date(b) - new Date(a)) / 864e5);
const P = k => DATA.people[k];
const F = k => DATA.floors[k];
const SRC = k => DATA.sources[k];
const SUP = id => DATA.suppliers.find(s => s.id === id);
const Q = DATA.question;
const setTech = on => { document.body.classList.toggle('tech', on); $$('[data-tech]').forEach(b => b.setAttribute('aria-pressed', on)); };
const fl = k => `<span class="fl" data-tier="${F(k).tier}">${esc(F(k).name)}</span>`;
const howTag = k => `<span class="how ${k}">${ic(DATA.how[k].icon, 11)}${esc(DATA.how[k].short)}</span>`;

/* ---------- the answer, computed: (who reruns it, the data as it was on asOf) ---------- */
function answer(who, asOf, opts = {}) {
  const sees = P(who).sees;
  const can = src => sees.includes(SRC(src).floor);
  const out = { who, asOf, rows: [], never: [], heard: [], ended: [], hidden: Object.keys(DATA.sources).filter(k => !can(k)) };
  DATA.suppliers.forEach(s => {
    const known = (s.contractLogged || s.contract[0]) <= asOf;
    const running = known && s.contract[0] <= asOf && asOf <= s.contract[1];
    if (!running) { out.ended.push({ s, why: s.contract[0] > asOf ? 'its contract had not started' : 'its contract ended ' + fmt(s.contract[1]) }); return; }
    const vis = s.contacts.filter(c => can(c.src) && (c.logged || c.on) <= asOf);
    const facts = vis.filter(c => !c.guess || opts.guesses);
    const guesses = vis.filter(c => c.guess && !opts.guesses);
    const last = facts.sort((a, b) => a.on < b.on ? 1 : -1)[0];
    if (!last) { out.never.push({ s }); return; }
    const g = guesses.find(c => c.on >= Q.cutoff);
    if (last.on < Q.cutoff) out.rows.push({ s, last, guess: g || null });
    else out.heard.push({ s, last });
  });
  return out;
}
const ids = a => a.rows.map(r => r.s.id);
function diff(a, b) {
  const A = ids(a), B = ids(b);
  return { joined: B.filter(x => !A.includes(x)), left: A.filter(x => !B.includes(x)), same: B.filter(x => A.includes(x)) };
}
/* Why did one supplier's place differ between run a and run b? */
function why(id, a, b) {
  const s = SUP(id);
  const startA = s.contract[0] <= a.asOf && (s.contractLogged || s.contract[0]) <= a.asOf;
  const startB = s.contract[0] <= b.asOf && (s.contractLogged || s.contract[0]) <= b.asOf;
  if (startA !== startB) return { r: 'world', text: `Its contract started on ${fmt(s.contract[0])}.` };
  const seesA = P(a.who).sees, seesB = P(b.who).sees;
  const late = s.contacts.find(c => c.logged && c.logged > a.asOf && c.logged <= b.asOf && seesB.includes(SRC(c.src).floor));
  if (late && seesA.join() === seesB.join()) return { r: 'learned', text: `A ${c2(late)} on ${fmt(late.on)} was logged on ${fmt(late.logged)}${late.by ? ' by ' + late.by : ''}.`, c: late };
  const only = s.contacts.find(c => seesA.includes(SRC(c.src).floor) !== seesB.includes(SRC(c.src).floor) && c.on >= Q.cutoff);
  if (only) {
    const holder = seesA.includes(SRC(only.src).floor) ? a.who : b.who;
    return { r: 'access', text: `${SRC(only.src).plain} are kept on ${F(SRC(only.src).floor).name}. ${P(holder).first} can open them; ${P(holder === a.who ? b.who : a.who).first} can’t.`, c: only, holder };
  }
  const onlyAny = s.contacts.find(c => seesA.includes(SRC(c.src).floor) !== seesB.includes(SRC(c.src).floor));
  if (onlyAny) {
    const holder = seesA.includes(SRC(onlyAny.src).floor) ? a.who : b.who;
    return { r: 'access', text: `Its only contact is in ${SRC(onlyAny.src).plain.toLowerCase()}, kept on ${F(SRC(onlyAny.src).floor).name}, which ${P(holder === a.who ? b.who : a.who).first} can’t open.`, c: onlyAny, holder };
  }
  return { r: 'world', text: 'Something in the record changed.' };
}
const c2 = c => c.via;
const reasonTag = r => `<span class="how">${ic(DATA.reasons[r].icon, 11)}${esc(DATA.reasons[r].plain)}</span>`;

/* the question said in a sentence; blanks show who filled them and how */
function sentenceHtml() {
  return Q.sentence.map(p => p.b
    ? `<span class="b ${Q.clar[p.b].how === 'model' ? 'model' : ''}" data-b="${p.b}" title="${esc(Q.clar[p.b].said)} → ${esc(Q.clar[p.b].chose)}">${esc(p.t)}</span>`
    : esc(p.t)).join(' ') + '.';
}
/* "not yours to see", said once, never per row: no count, no names */
function unseenHtml(who) {
  const a = answer(who, DATA.today);
  return a.hidden.map(k => {
    const f = F(SRC(k).floor);
    return `<div class="unseenbox">${ic('lock', 13)}<span><b>${esc(SRC(k).plain)}</b> are kept on ${esc(f.name)}, a floor ${who === 'sam' ? 'you' : esc(P(who).first)} can’t open. ${esc(DATA.hiddenCount[0].toUpperCase() + DATA.hiddenCount.slice(1))} suppliers here may have been heard from there. Ask ${esc(f.lead)}, ${esc(f.name.toLowerCase())} lead.<span class="tk">${esc(SRC(k).tech)} · 403 on read · count withheld</span></span></div>`;
  }).join('');
}
function rowHtml(r, extra = '') {
  const lc = r.last ? `${fmtS(r.last.on)} ${r.last.on.slice(0, 4)} · ${r.last.via}` : '';
  const g = r.guess ? `<span class="sub"><span class="gtag">${ic('cpu', 10)}guess</span> <span class="guess">${esc(r.guess.via)} ${fmtS(r.guess.on)}?</span> a meeting note says ${esc(r.guess.guess.said)}, ${esc(r.guess.guess.why)}. Not counted until someone confirms it.</span>` : '';
  return `<li class="row ${extra}" data-id="${r.s.id}"><span class="nm">${esc(r.s.name)}</span><span class="lc">${lc}</span>${g}</li>`;
}

/* ---------- keyboard: R replays, T technical words; each variant adds its own ---------- */
let onKey = () => false;
document.addEventListener('keydown', e => {
  if (e.metaKey || e.ctrlKey || e.altKey) return;
  const k = e.key.toLowerCase();
  if (onKey(k, e)) { e.preventDefault(); return; }
  if (k === 'r') boot();
  else if (k === 't') setTech(!document.body.classList.contains('tech'));
});
let toastT;
function toast(html) {
  const t = $('#toast'); if (!t) return;
  t.innerHTML = html; Icons.hydrate(t); t.classList.add('on');
  clearTimeout(toastT); toastT = setTimeout(() => t.classList.remove('on'), tok('--motion-toast'));
}
