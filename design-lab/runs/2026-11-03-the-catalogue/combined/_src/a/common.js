/* ===== shared helpers (inlined into both screens) ===== */
const $ = (s, r) => (r || document).querySelector(s);
const $$ = (s, r) => [...(r || document).querySelectorAll(s)];
const esc = s => String(s == null ? '' : s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const tok = n => parseFloat(getComputedStyle(document.documentElement).getPropertyValue(n)) || 0;
const RM = matchMedia('(prefers-reduced-motion: reduce)').matches;
const ic = (n, s) => Icons.svg(n, { size: s || 14, stroke: 1.5 });
const nf = n => Number(n).toLocaleString('en-GB');
const KIND = id => DATA.kinds.find(k => k.id === id);
const FLOOR = id => DATA.floors[id];
const SRC = id => DATA.sources[id] || id;
const EMPTY = id => DATA.empties[id];
const cap1 = s => s.charAt(0).toUpperCase() + s.slice(1);

/* the wavy break of "no record": data SVG, not an icon */
function breakSvg(small) {
  return `<svg class="mk mk-break${small ? ' s' : ''}" viewBox="0 0 28 12" aria-hidden="true"><path d="M2 2 L6 10 L10 2 L14 10 L18 2 L22 10 L26 2"/></svg>`;
}
/* one small mark per state, for lists, table cells and keys */
function mark(st) {
  if (st === 'gap') return '<span class="mk mk-gap s" aria-hidden="true"></span>';
  if (st === 'none') return '<span class="mk mk-none" aria-hidden="true">none</span>';
  if (st === 'na') return '<span class="mk mk-na" aria-hidden="true">n/a</span>';
  if (st === 'stale') return '<span class="mk mk-stale" aria-hidden="true"></span>';
  if (st === 'norecord') return breakSvg(true);
  if (st === 'hidden') return `<span class="mk mk-unseen" aria-hidden="true">${ic('lock', 9)}</span>`;
  if (st === 'disagree') return '<span class="mk mk-disagree" aria-hidden="true"></span>';
  return '';
}
/* the key: the six ways to be empty, one mark and one sentence each */
function keySix(ids) {
  ids = ids || ['gap', 'none', 'na', 'stale', 'norecord', 'hidden'];
  return ids.map(id => `<span title="${esc(EMPTY(id).line)}">${mark(id)}<b>${esc(EMPTY(id).plain)}</b></span>`).join('');
}
function hiddenWho(s) {
  const f = FLOOR(s.floor);
  return s.restricted ? `Restricted on the ${esc(f.word.replace(' floor', ''))} floor · ask ${esc(s.ask)}`
                      : `Kept on ${esc(f.name)}, a floor you can’t open · ask ${esc(s.ask)}`;
}
/* one statement: the sentence, with its slot drawn by state, and a meta line under it */
function statement(s, opts) {
  opts = opts || {};
  const st = s.st || 'ok';
  const fill = v => esc(s.say).replace('{v}', v);
  let say = '', meta = '';
  const src = s.src ? `${ic('file-text', 12)}<span>${esc(SRC(s.src))}</span>` : '';
  if (st === 'ok') {
    const val = s.link && s.to && (opts.follow || []).includes(s.to) ? `<button class="lk" data-follow="${s.to}">${esc(s.v)}</button>` : `<b class="${s.link ? 'lk' : ''}">${esc(s.v)}</b>`;
    say = fill(val + (s.also ? ` <span class="muted">${esc(s.also)}</span>` : ''));
    meta = src;
  } else if (st === 'gap') {
    say = fill('<span class="mk mk-gap" role="img" aria-label="not known yet"></span>');
    meta = `${ic('user-round', 12)}<span><b style="font-weight:400;color:var(--ink)">Not known yet.</b> ${esc(s.who)}.</span>`;
  } else if (st === 'none') {
    say = fill('<b class="v-none">none</b>');
    meta = `<span class="mk mk-none" aria-hidden="true">none</span><span>${esc(s.by)}</span>`;
  } else if (st === 'na') {
    say = `${esc(s.w)}: <span class="na">doesn’t apply</span>`;
    meta = `<span class="na">${esc(cap1(s.why))}.</span>`;
  } else if (st === 'stale') {
    say = fill(`<b>${esc(s.v)}</b> <span class="age">${esc(s.age)}</span>`);
    meta = src + `<span>Out of date</span>`;
  } else if (st === 'norecord') {
    say = fill(`${breakSvg()} <b>has no record, ${esc(s.span)}</b>`);
    meta = `<span>No record: ${esc(s.why)}. Nobody can close this.</span>`;
  } else if (st === 'hidden') {
    say = fill(`<span class="unseen">${ic('lock', 12)}not yours to see</span>`);
    meta = `<span>${hiddenWho(s)}</span>`;
  } else if (st === 'disagree') {
    say = esc(s.say).replace(/ ?\{v\}\.?/, '') + ` <span class="tag-dis">${ic('git-fork', 11)}sources disagree</span>`;
    meta = `<div class="fork">${s.vals.map(a => `<div class="alt"><b>${esc(a.v)}</b><span>${esc(SRC(a.src))}${a.note ? ', ' + esc(a.note) : ''}</span></div>`).join('')}</div>` +
      `<span style="display:block;margin-top:var(--space-1)">${esc(s.decide)}</span>`;
    return `<div class="stm" data-d="${s.d}" data-st="${st}"><p class="say">${say}</p>${meta}<p class="tk">${esc(s.tech)}</p></div>`;
  }
  return `<div class="stm${st === 'na' ? ' na' : ''}" data-d="${s.d}" data-st="${st}"><p class="say">${say}</p>${meta ? `<p class="meta">${meta}</p>` : ''}<p class="tk">${esc(s.tech)}</p></div>`;
}
/* the card's foot: everything it doesn't hold, one line each */
function footLines(rec) {
  return rec.st.filter(s => s.st && s.st !== 'ok' && s.st !== 'na' && s.st !== 'none').map(s => {
    let t = '';
    if (s.st === 'gap') t = `<b>${esc(s.w)}</b>: not known yet. ${esc(s.who)}.`;
    if (s.st === 'stale') t = `<b>${esc(s.w)}</b>: out of date (${esc(s.age.split(' ·')[0])}).`;
    if (s.st === 'hidden') t = `<b>${esc(s.w)}</b>: not yours to see. Ask ${esc(s.ask)}.`;
    if (s.st === 'norecord') t = `<b>${esc(s.w)}</b>: no record, ${esc(s.span)}.`;
    if (s.st === 'disagree') t = `<b>${esc(s.w)}</b>: sources disagree. ${esc(s.decide.split('.')[1] || '').trim()}.`;
    return `<li>${mark(s.st)}<span>${t}</span></li>`;
  }).join('');
}
function foot(rec) {
  return `<div class="foot"><p class="fh">What we don’t know</p><ul>${footLines(rec)}</ul></div>`;
}
/* timers for the auto-demo; R replays */
const TIMERS = [];
const later = (fn, t) => { TIMERS.push(setTimeout(fn, RM ? 0 : t)); };
const clearTimers = () => TIMERS.splice(0).forEach(clearTimeout);
/* the T switch: technical words one step down */
function setTech(on) {
  document.body.classList.toggle('tech', on);
  $$('.techbtn').forEach(b => b.setAttribute('aria-pressed', on ? 'true' : 'false'));
}
