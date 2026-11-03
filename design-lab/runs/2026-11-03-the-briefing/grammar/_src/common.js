/* ---------- shared helpers (common.js) ---------- */
const $ = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => [...r.querySelectorAll(s)];
const RM = matchMedia('(prefers-reduced-motion: reduce)').matches;
const css = getComputedStyle(document.documentElement);
const tok = n => parseFloat(css.getPropertyValue(n)) || 0;
const ic = (n, s = 16, w = 1.5) => Icons.svg(n, { size: s, stroke: w });
let TIMERS = [];
const later = (f, t) => TIMERS.push(setTimeout(f, RM ? Math.min(t, 1) : t));
const clearTimers = () => { TIMERS.forEach(clearTimeout); TIMERS = []; };
const esc = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const cap = s => s[0].toUpperCase() + s.slice(1);

/* ---------- the numbers every height must agree on ---------- */
const S0 = (() => {
  const ev = DATA.event.week;
  const before = DATA.weeks.filter(w => w.wk < ev && w.count != null);
  const after = DATA.weeks.filter(w => w.wk >= ev && w.count != null);
  const last4 = after.slice(-4);
  const sum = a => a.reduce((t, w) => t + w.count, 0);
  const recs = DATA.records;
  const recAfter = recs.filter(r => r[2] >= ev), recBefore = recs.filter(r => r[2] < ev);
  const recLast4 = recs.filter(r => last4.some(w => w.wk === r[2]));
  const narrowShare = a => Math.round(100 * a.filter(r => r[4]).length / a.length);
  return {
    before: Math.round(sum(before) / before.length), beforeSum: sum(before), beforeN: before.length, beforeExact: sum(before) / before.length,
    after: Math.round(sum(last4) / last4.length), afterSum: sum(last4), afterN: last4.length, afterExact: sum(last4) / last4.length,
    total: recs.length, recAfter: recAfter.length, recBefore: recBefore.length, recLast4: recLast4.length,
    narrowBefore: narrowShare(recBefore), narrowAfter: narrowShare(recAfter),
    missing: DATA.weeks.filter(w => w.count == null), last4, max: Math.max(...DATA.weeks.map(w => w.count || 0))
  };
})();
const fill = s => s.replace(/\{(\w+)\}/g, (m, k) => k === 'eventDate' ? DATA.event.date : k === 'gapDates' ? DATA.gapDates : (k in S0 ? S0[k] : m));

/* ---------- confidence words ---------- */
const YI = w => DATA.yardstick.findIndex(y => y.w === w);
const yard = w => { const i = YI(w); return `<span class="yd" aria-hidden="true">${DATA.yardstick.map((y, j) => `<i class="${j === i ? 'on' : ''}"></i>`).join('')}</span>`; };
const cw = w => w ? `<span class="cw" title="${esc(w)}: ${DATA.yardstick[YI(w)].lo} to ${DATA.yardstick[YI(w)].hi} in 100 on the yardstick">${esc(w.toLowerCase())}${yard(w)}</span>` : `<span class="cw cant">${esc(DATA.cantSay.toLowerCase())}</span>`;
const wordFor = (e, a) => DATA.grid[e][a];
const recWord = () => `<span class="rec-word">${ic('database', 11)}recorded</span>`;
const tally = (n, label = 'records') => `<button class="tally" title="${n} ${label}: open them">${ic('rows-3', 10)}${n}</button>`;
const claimWord = c => c.kind === 'count' ? recWord() : cw(wordFor(c.evidence, c.agreement));

/* ---------- marks: the six ways to be empty ---------- */
const MK = {
  gap: '<span class="mk mk-gap" aria-hidden="true"></span>',
  stale: '<span class="mk mk-stale" aria-hidden="true"></span>',
  norecord: '<svg class="mk mk-break" viewBox="0 0 28 12" aria-hidden="true"><path d="M0 6 q3.5 -5 7 0 t7 0 t7 0 t7 0"/></svg>',
  hidden: `<span class="mk mk-unseen" aria-hidden="true">${ic('lock', 9)}</span>`,
  none: '<span class="mk mk-none">none</span>',
  na: '<span class="mk mk-na">n/a</span>',
  disagree: '<span class="mk mk-disagree" aria-hidden="true"></span>'
};
const emp = k => { const e = DATA.empties[k]; return `<div class="emp">${MK[k]}<span><b>${esc(e.plain)}.</b> ${esc(fill(e.line))}<span class="tk">${esc(e.tech)}</span></span></div>`; };

/* ---------- pictures ---------- */
/* weekly columns from zero; the week with no record is a wavy break, never a dip */
function weekChart({ w = 520, h = 160, labels = true, title = '', every = 2 } = {}) {
  const W = DATA.weeks, n = W.length, pad = labels ? 22 : 2, top = 12;
  const bw = (w - 2) / n, max = Math.ceil(S0.max / 10) * 10, y = v => top + (h - top - pad) * (1 - v / max);
  let s = `<svg class="chart" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}" role="img" aria-label="${esc(title)}">`;
  if (labels) [0, max / 2, max].forEach(v => { s += `<line class="axis" x1="0" x2="${w}" y1="${y(v)}" y2="${y(v)}" opacity="${v ? .4 : 1}"/><text x="${w + 6}" y="${y(v) + 4}">${v}</text>`; });
  W.forEach((wk, i) => {
    const x = 1 + i * bw;
    if (wk.count == null) s += `<g class="nr"><path d="M${x + bw * .1} ${y(0) - 6} q${bw * .2} -6 ${bw * .4} 0 t${bw * .4} 0"/></g>`;
    else s += `<rect class="${wk.wk >= DATA.event.week ? 'b1' : 'b0'} bar" data-wk="${wk.wk}" x="${x + bw * .14}" width="${bw * .72}" y="${y(wk.count)}" height="${y(0) - y(wk.count)}" rx="1"/>`;
    const near = W[i - 1] && W[i - 1].count == null || W[i + 1] && W[i + 1].count == null;
    if (labels && ((i % every === 0 && !near) || wk.count == null)) s += `<text x="${x + bw / 2}" y="${h - 6}" text-anchor="middle">${wk.count == null ? 'none kept' : 'w' + wk.wk}</text>`;
  });
  const ex = 1 + DATA.weeks.findIndex(x => x.wk === DATA.event.week) * bw;
  s += `<line class="ev" x1="${ex}" x2="${ex}" y1="0" y2="${y(0)}"/>`;
  if (labels) s += `<text x="${ex + 4}" y="${top - 2}" style="fill:var(--ink)">${esc(DATA.event.date)}</text>`;
  return s + '</svg>';
}
function spark(w = 64, h = 14) {
  const W = DATA.weeks, bw = w / W.length;
  let s = `<svg class="spark" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}" aria-hidden="true">`;
  W.forEach((wk, i) => { if (wk.count != null) { const bh = Math.max(1, h * wk.count / S0.max); s += `<rect class="${wk.wk >= DATA.event.week ? 'b1' : 'b0'}" x="${i * bw + .5}" width="${bw - 1}" y="${h - bh}" height="${bh}"/>`; } });
  return s + '</svg>';
}
/* isotype row: one symbol per `per` records; the last one is cut to its share, never shrunk */
function iso(count, per, size = 16, finding = false) {
  let out = '';
  const full = Math.floor(count / per), part = (count % per) / per;
  for (let i = 0; i < full; i++) out += `<span class="s${finding ? ' f' : ''}" style="width:${size}px">${ic(DATA.kind.icon, size)}</span>`;
  if (part > 0) out += `<span class="s${finding ? ' f' : ''}" style="width:${Math.max(2, Math.round(size * part))}px">${ic(DATA.kind.icon, size)}</span>`;
  return `<span class="iso" role="img" aria-label="${count} ${DATA.kind.many}">${out}</span>`;
}

/* ---------- sentences: templates filled from the numbers, never typed ---------- */
const bottomLine = () => ({
  s1: `${cap(DATA.kind.many)} in ${DATA.area} rose from <span class="n">${S0.before}</span> to <span class="n">${S0.after}</span> ${DATA.kind.per} after ${esc(DATA.event.label)} on ${esc(DATA.event.date)}.`,
  s2: `That is ${cw(wordFor(DATA.claims[1].evidence, DATA.claims[1].agreement))} because the new rounds skip the narrow streets, and it puts the ${DATA.intent.target}-a-week target out of reach.`
});
/* the picture's title is its finding, worded by rule from the ratio */
const changeWord = () => { const r = S0.afterExact / S0.beforeExact; return r >= 3 ? 'more than tripled' : r >= 2 ? 'more than doubled' : r > 1.1 ? 'rose' : r < .9 ? 'fell' : 'held steady'; };
const pictureTitle = () => `${cap(DATA.kind.many)} ${changeWord()} after ${esc(DATA.event.date)}`;
const steps = () => [
  [`Took every ${DATA.kind.one} in the ${DATA.log}, ${DATA.span}`, S0.total, ''],
  [`Split them at ${DATA.event.date}, when ${DATA.event.label}`, `${S0.recBefore} | ${S0.recAfter}`, ''],
  [`Averaged the ${S0.beforeN} weeks before and the last ${S0.afterN} weeks with records`, `${S0.before} → ${S0.after}`, ''],
  [`Left out week ${S0.missing.map(w => w.wk).join(', ')}: depot logs were down ${DATA.gapDates}`, 'no record', 'out'],
  ['Counted the share on narrow streets, before and after', `${S0.narrowBefore}% → ${S0.narrowAfter}%`, '']
];
const stepsHTML = () => `<ol class="wk">${steps().map((s, i) => `<li class="${s[2]}"><span class="no">${String(i + 1).padStart(2, '0')}</span><span>${esc(s[0])}</span><span class="ct">${s[2] === 'out' ? MK.norecord : esc(s[1])}</span></li>`).join('')}</ol>`;
function setTech(on) { document.body.classList.toggle('tech', on); $$('[data-key=t]').forEach(e => e.classList.toggle('on', on)); }
function setGate(off) { document.body.classList.toggle('gate-off', off); $$('[data-key=g]').forEach(e => e.classList.toggle('on', off)); }
