/* ---------- shared helpers: dates, counts, the template sentence, marks, keys ---------- */
const D = DATA;
const $ = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => Array.from(r.querySelectorAll(s));
const REDUCE = matchMedia('(prefers-reduced-motion: reduce)').matches;
/* every wait comes from a motion token, never a magic number */
const MS = n => parseFloat(getComputedStyle(document.documentElement).getPropertyValue(n)) || 0;
const wait = n => new Promise(r => setTimeout(r, typeof n === 'string' ? MS(n) : n));
const DAY = 864e5;
const dt = s => new Date(s + 'T12:00:00');
const TODAY = dt(D.today);
const MONTH = ['January','February','March','April','May','June','July','August','September','October','November','December'];
const MON = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
const fmt = s => { if (!s) return ''; const d = dt(s); return d.getDate() + ' ' + MON[d.getMonth()] + ' ' + d.getFullYear(); };
const fmtS = s => { const d = dt(s); return d.getDate() + ' ' + MON[d.getMonth()]; };
const days = (a, b) => Math.round((dt(b) - dt(a)) / DAY);
const WORDS = ['no','one','two','three','four','five','six','seven','eight','nine','ten','eleven','twelve'];
const ORD = ['','first','second','third','fourth','fifth','sixth','seventh','eighth','ninth','tenth','eleventh','twelfth'];
const word = n => WORDS[n] || String(n);
const cap = s => s.charAt(0).toUpperCase() + s.slice(1);
const esc = s => String(s).replace(/[&<>"]/g, c => ({ '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;' }[c]));
const ico = (n, size = 16, stroke = 1.75) => Icons.svg(n, { size, stroke });

/* derive from the records: late days, days to go, the visits of each item */
D.regime.forEach(r => {
  r.visits = D.visits.filter(v => v.of === r.id).sort((a, b) => a.date < b.date ? -1 : 1);
  if (r.due) { r.late = days(r.due, D.today); r.togo = -r.late; }
});
const R = id => D.regime.find(r => r.id === id);
const V = id => D.visits.find(v => v.id === id);
const ORDER = Object.keys(D.states);
const byState = st => D.regime.filter(r => r.state === st);
const COUNT = Object.fromEntries(ORDER.map(s => [s, byState(s).length]));
const overdueSorted = byState('overdue').sort((a, b) => b.late - a.late);
const oldest = overdueSorted[0];
const floorOf = k => D.floors[k];

/* ---------- the bottom line, built by template from the counts (never by a model) ---------- */
/* returns an array of parts: strings, or {t, ref, cls} handles onto the picture and records */
function headlineParts() {
  const n = COUNT.overdue, p = COUNT.disputed, e = D.entity.name;
  const parts = [e + ' has ', { t: word(n) + ' ' + D.fact.noun[n === 1 ? 0 : 1] + ' overdue', ref: 'state:overdue', cls: 'ov' }];
  if (p) parts.push(', and ', { t: 'probably a ' + ORD[n + 1], ref: 'state:disputed' });
  parts.push('. The oldest is ', { t: oldest.name.toLowerCase(), ref: 'item:' + oldest.id }, ', ', { t: oldest.late + ' days late', ref: 'item:' + oldest.id }, '.');
  return parts;
}
function secondParts() {
  const parts = [];
  if (COUNT.soon) parts.push({ t: cap(word(COUNT.soon)) + ' more ' + (COUNT.soon === 1 ? 'is' : 'are') + ' due in the next fortnight', ref: 'state:soon' });
  const rest = [];
  if (COUNT.gap) rest.push({ t: word(COUNT.gap) + ' is not known yet', ref: 'state:gap' });
  if (COUNT.hidden) rest.push({ t: word(COUNT.hidden) + ' is kept where you can’t see it', ref: 'state:hidden' });
  if (rest.length) { parts.push('; '); rest.forEach((x, i) => { if (i) parts.push(' and '); parts.push(x); }); }
  parts.push('.');
  return parts;
}
function partsHTML(parts, cls = 'ref') {
  /* punctuation after a handle is kept on its line, so a line never starts with a comma */
  let out = '';
  for (let i = 0; i < parts.length; i++) {
    const p = parts[i];
    if (typeof p === 'string') { out += esc(p); continue; }
    const btn = `<button class="${cls} ${p.cls || ''}" data-ref="${p.ref}">${esc(p.t)}</button>`;
    const nx = parts[i + 1], m = typeof nx === 'string' && nx.match(/^[,.;:]+/);
    if (m) { out += `<span class="nw">${btn}${esc(m[0])}</span>`; parts = parts.slice(); parts[i + 1] = nx.slice(m[0].length); }
    else out += btn;
  }
  return out;
}
/* which regime items a ref points at */
function refItems(ref) {
  const [k, v] = ref.split(':');
  if (k === 'state') return byState(v).map(r => r.id);
  if (k === 'item') return [v];
  return [];
}
/* one plain line per item, by template */
function itemLine(r) {
  switch (r.state) {
    case 'overdue': return `${r.name}: due ${fmt(r.due)}, ${r.late} days late. Last done ${fmt(r.last)} by ${r.by}.`;
    case 'disputed': return `${r.name}: due ${fmt(r.due)}. Two sources disagree about whether it was done.`;
    case 'soon': return `${r.name}: due ${fmt(r.due)}, in ${r.togo} days. Last done ${fmt(r.last)}.`;
    case 'ok': return `${r.name}: in date until ${fmt(r.due)}. Last done ${fmt(r.last)}.`;
    case 'gap': return `${r.name}: not known yet. ${cap(r.fillWhy)}. ${r.fill} could fill it.`;
    case 'hidden': return `${r.name}: kept on ${floorOf(r.keptOn).name}, a floor you can’t open. Ask ${r.ask}.`;
    case 'na': return `${r.name}: doesn’t apply. ${r.naWhy}`;
  }
  return r.name;
}
function shortStatus(r) {
  switch (r.state) {
    case 'overdue': return r.late + ' days late';
    case 'disputed': return 'sources disagree';
    case 'soon': return 'due in ' + r.togo + ' days';
    case 'ok': return 'until ' + fmtS(r.due);
    case 'gap': return 'not known yet';
    case 'hidden': return 'ask ' + r.ask.split(',')[0];
    case 'na': return 'doesn’t apply';
  }
}
function cellHTML(r, cls = '') {
  const st = r.state;
  const ic = st === 'hidden' ? 'lock' : st === 'na' ? 'minus' : r.icon;
  return `<span class="cell ${cls}" data-state="${st}" data-id="${r.id}" title="${esc(r.name + ': ' + D.states[st].plain)}">${ico(ic, 20, 1.75)}</span>`;
}
const BREAK = `<svg class="mk-break" viewBox="0 0 28 12" aria-hidden="true"><path d="M1 6 q3.5 -5 7 0 t7 0 t7 0 t6 0"/></svg>`;
function stateKey(states = ORDER) {
  return states.filter(s => COUNT[s]).map(s => `<span class="kitem"><span class="cell s" data-state="${s}"></span>${esc(D.states[s].plain)}<span class="tk">${esc(D.states[s].tech)}</span></span>`).join('');
}

/* the top band: where you are, on which floor, and the register switch */
function bandHTML(extra = '') {
  const f = floorOf(D.entity.floor);
  return `<div class="crumb"><span>${esc(D.app)}</span><span class="sep">${ico('chevron-right', 14)}</span><span>Sites</span><span class="sep">${ico('chevron-right', 14)}</span><b>${esc(D.entity.name)}</b><span class="tk">${esc(D.entity.id)} · ${esc(D.entity.kindTech)}</span></div>
  ${extra}<span class="fl"><span>Kept on <b>${esc(f.name)}</b>, ${esc(f.word.toLowerCase())}</span></span>
  <button class="techbtn" id="techbtn" aria-pressed="false"><span class="kbd">T</span> technical words</button>`;
}

/* keys: R replay, T register, plus each variant's own */
const KEYS = {};
function setTech(on) {
  document.body.classList.toggle('tech', on);
  const b = $('#techbtn'); if (b) b.setAttribute('aria-pressed', on ? 'true' : 'false');
}
document.addEventListener('click', e => { if (e.target.closest('#techbtn')) setTech(!document.body.classList.contains('tech')); });
document.addEventListener('keydown', e => {
  if (e.metaKey || e.ctrlKey || e.altKey) return;
  if (e.target.matches && e.target.matches('input,textarea')) return;
  const k = e.key.length === 1 ? e.key.toLowerCase() : e.key;
  if (k === 't') { setTech(!document.body.classList.contains('tech')); return; }
  if (k === 'r' && window.replay) { window.replay(); return; }
  if (KEYS[k]) { e.preventDefault(); KEYS[k](e); }
});
/* the demo is cancelled by any person's key or click, so it never fights them */
let DEMO = 0;
const demoAlive = id => id === DEMO;
document.addEventListener('pointerdown', e => { if (e.isTrusted) DEMO++; }, true);
document.addEventListener('keydown', e => { if (e.isTrusted && !['r','R'].includes(e.key)) DEMO++; }, true);
function startDemo(fn) {
  const id = ++DEMO;
  setTimeout(() => { if (demoAlive(id)) fn(id); }, MS('--motion-run'));
}

/* ---------- one item's records: its visits, the lost stretch, the dispute, the empty ---------- */
function visitRows(r) {
  const out = [];
  const nr = D.noRecord;
  r.visits.forEach((v, i) => {
    const prev = r.visits[i - 1];
    if (prev && prev.date < nr.from && v.date > nr.to && days(prev.date, v.date) > r.months * 30 * 1.5)
      out.push({ brk: true });
    out.push(v);
  });
  return out;
}
function visitsHTML(r) {
  if (r.state === 'gap') return `<p class="say"><span class="cell s" data-state="gap"></span> ${esc(D.states.gap.plain)}. ${esc(cap(r.fillWhy))}. <b>${esc(r.fill)}</b> could fill it.</p>`;
  if (r.state === 'hidden') return `<p class="say"><span class="unseen">${ico('lock', 12)} kept on ${esc(floorOf(r.keptOn).name)}</span> Its visits exist, on a floor you can’t open. Ask <b>${esc(r.ask)}</b>.</p>`;
  if (r.state === 'na') return `<p class="say">${esc(D.states.na.plain)}. ${esc(r.naWhy)}</p>`;
  const rows = visitRows(r).slice().reverse().map(v => v.brk
    ? `<li class="brk">${BREAK}<span><b>No record</b> ${esc(fmtS(D.noRecord.from))} to ${esc(fmtS(D.noRecord.to))}: ${esc(D.noRecord.why)}. A visit was due in this stretch; nobody can say whether it happened.</span></li>`
    : `<li data-visit="${v.id}">${ico(v.disputed ? 'git-fork' : 'file-text', 14)}<span><b>${esc(fmt(v.date))} · ${esc(v.result)}</b> ${esc(v.by)} <span class="id">${esc(v.id)}</span><br>from <i>${esc(v.src)}</i>, in Artifacts<span class="tk">observation · prov:wasDerivedFrom → artifacts/${esc(v.id.toLowerCase())}</span></span></li>`).join('');
  let dis = '';
  if (r.state === 'disputed') dis = `<div class="fork" style="margin:var(--space-2) 0 var(--space-3)">${r.sides.map(s => `<div class="alt"><b>${esc(s.says)}</b><span>${esc(s.from)}</span><span>${esc(s.gradeWord)}<span class="tk"> · grade ${s.grade}</span></span></div>`).join('')}</div>
  <p class="say"><span class="conf">${esc(r.confidence)}</span> ${esc(r.confidenceOf)}: the person on site outranks the supplier’s own report until someone checks the hoist tag.</p>`;
  return dis + `<ul class="vis">${rows}</ul>`;
}

/* ---------- the state of one inspection at a past date, worked out from its visits ---------- */
const addMonths = (s, m) => { const d = dt(s); d.setMonth(d.getMonth() + m); return d.toISOString().slice(0, 10); };
const inLost = s => s >= D.noRecord.from && s <= D.noRecord.to;
function statusAt(r, d) {
  if (!r.months || !['overdue','disputed','soon','ok'].includes(r.state)) return null;
  const vs = r.visits.filter(v => v.date <= d);
  const last = vs.filter(v => !v.disputed).pop();
  if (!last) return null;
  const due = addMonths(last.date, r.months);
  if (due >= d) return { st: 'ok', due };
  if (inLost(due)) return { st: 'norecord', due };
  if (vs.some(v => v.disputed && v.date > due)) return { st: 'disputed', due, late: days(due, d) };
  return { st: 'overdue', due, late: days(due, d) };
}
/* month ends for the last twelve months, then today */
function monthEnds() {
  const t = TODAY, out = [];
  for (let i = 11; i >= 1; i--) { const e = new Date(t.getFullYear(), t.getMonth() - i + 1, 0, 12); out.push({ d: e.toISOString().slice(0, 10), m: MON[e.getMonth()], y: e.getFullYear() }); }
  out.push({ d: D.today, m: 'Today', y: t.getFullYear(), today: true });
  return out.map(c => ({ ...c, lost: inLost(c.d), items: D.regime.map(r => ({ r, s: statusAt(r, c.d) })).filter(x => x.s && x.s.st !== 'ok') }));
}
