/* ---- helpers shared by every variant ---- */
const $ = (s, r = document) => r.querySelector(s), $$ = (s, r = document) => [...r.querySelectorAll(s)];
const esc = s => String(s ?? '').replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const cssv = n => getComputedStyle(document.documentElement).getPropertyValue(n).trim();
const ms = n => parseFloat(cssv(n)) || 0;                 /* motion token in ms */
const px = n => { const v = cssv(n); return v.endsWith('rem') ? parseFloat(v) * 16 : parseFloat(v) || 0; };
const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
const kindOf = id => DATA.kinds.find(k => k.id === id);
const fl = f => `<span class="fl f-${DATA.floors[f].tok}">${esc(DATA.floors[f].label)} · ${esc(DATA.floors[f].name)}</span>`;
const fmtWhen = s => { const d = new Date(s.slice(0, 10) + 'T12:00:00'); return d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' }) + (s.length > 10 ? ' · ' + s.slice(11) : ''); };
const ic = (n, s = 16) => Icons.svg(n, { size: s });
let timers = [];
const later = (fn, t) => timers.push(setTimeout(fn, t));
const clearLater = () => { timers.forEach(clearTimeout); timers = []; };
function keys(list) {
  $('#keys').innerHTML = list.map(([a, b]) => `<span>${a.split(' ').map(x => x === 'or' ? 'or' : `<span class="kbd">${esc(x)}</span>`).join(' ')} ${esc(b)}</span>`).join('');
}
function rail(foot) {
  $('#appname').textContent = DATA.app;
  $('#navs').innerHTML = DATA.nav.map(n => `<a class="nav${n.on ? ' on' : ''}" href="#"><i data-lucide="${n.icon}" data-size="16"></i>${esc(n.label)}${n.n != null ? `<span class="n">${n.n}</span>` : ''}</a>`).join('');
  if (foot) $('#railfoot').innerHTML = foot;
}
/* why-panes for anything that explains itself */
const TIPS = {};
function tip(el) { const p = $('#tip'), k = el.dataset.tip; if (!TIPS[k]) return; p.innerHTML = TIPS[k](el); const r = el.getBoundingClientRect(), g = px('--space-3');
  p.style.left = Math.max(g, Math.min(innerWidth - p.offsetWidth - g, r.left + r.width / 2 - p.offsetWidth / 2)) + 'px';
  const top = r.bottom + g; p.style.top = (top + p.offsetHeight > innerHeight - g ? r.top - g - p.offsetHeight : top) + 'px'; p.classList.add('on'); Icons.hydrate(p); }
document.addEventListener('mouseover', e => { const el = e.target.closest('[data-tip]'); if (el) tip(el); });
document.addEventListener('mouseout', e => { const el = e.target.closest('[data-tip]'); if (el && !el.contains(e.relatedTarget)) $('#tip').classList.remove('on'); });
document.addEventListener('focusin', e => { const el = e.target.closest('[data-tip]'); if (el) tip(el); else $('#tip').classList.remove('on'); });
function boot(demo, onKey) {
  addEventListener('keydown', e => {
    if (e.metaKey || e.ctrlKey || e.altKey) return;
    if (e.key === 'r' || e.key === 'R') { $('#tip').classList.remove('on'); clearLater(); return demo(); }
    if (onKey) onKey(e);
  });
  Icons.hydrate();
  document.fonts.ready.then(demo);
}
/* the gap mark: who could fill this, in plain words */
function gapMark(rec, short) {
  const f = rec.fill, ch = DATA.changes[0].fillers;
  if (f.state === 'filled') return `<span class="mono">${esc(f.value)}</span>`;
  if (f.state === 'doc') return `<span class="gap doc" data-tip="doc" data-r="${esc(rec.name)}">${ic('file-search', 14)}<span>${short ? '' : 'Not filled · '}<b>${esc(f.value)}?</b> read from a document</span></span>`;
  if (f.state === 'keeper') return `<span class="gap keeper" data-tip="keeper" data-r="${esc(rec.name)}">${ic('user-check', 14)}<span>${short ? '' : 'Not filled · '}<b>${esc(f.who)}</b> can fill</span></span>`;
  return `<span class="gap nobody" data-tip="nobody" data-r="${esc(rec.name)}">${ic('circle-help', 14)}<span>${short ? '' : 'Not filled · '}<b>nobody yet</b>, ${esc(f.ask)} asked</span></span>`;
}
const recBy = el => DATA.records.find(r => r.name === el.dataset.r);
TIPS.doc = el => { const r = recBy(el), c = DATA.changes[0]; return `<div class="micro">Gap · ${esc(c.detail.word)}</div><div class="t">${esc(c.fillers.fromDocs.word)}</div><p><b>${esc(r.fill.value)}</b> was read from <b>${esc(r.fill.src)}</b> in Artifacts.</p><p class="m">${esc(c.fillers.fromDocs.how)} Until then it is not shown as known.</p>`; };
TIPS.keeper = el => { const r = recBy(el), c = DATA.changes[0]; return `<div class="micro">Gap · ${esc(c.detail.word)}</div><div class="t">${esc(r.fill.who)} can fill this</div><p>They manage ${esc(r.name)}. ${esc(c.fillers.keepers.how)}</p><p class="m">Anyone can propose a value; it waits in Triage for them.</p>`; };
TIPS.nobody = el => { const r = recBy(el), c = DATA.changes[0]; return `<div class="micro">Gap · ${esc(c.detail.word)}</div><div class="t">${esc(c.fillers.nobody.word)}</div><p>${esc(r.name)} has no manager on record, so no one is asked by default.</p><p class="m">${esc(c.fillers.nobody.how)} You can propose a value now.</p>`; };
