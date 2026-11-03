/* ---- shared helpers for the ask-by-example variants ---- */
const $ = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => [...r.querySelectorAll(s)];
const cssv = n => getComputedStyle(document.documentElement).getPropertyValue(n).trim();
const ms = n => parseFloat(cssv(n)) || 0;
const REDUCE = matchMedia('(prefers-reduced-motion: reduce)').matches;
const MON = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
const D = DATA;
const S = { model: D.model.on, tech: false };
function fdate(iso, y) { if (!iso) return ''; const [Y, M, d] = iso.slice(0, 10).split('-'); return (+d) + ' ' + MON[+M - 1] + (y ? ' ' + Y : ''); }
function money(k) { return '£' + k + 'k'; }
function nowText() { const t = D.now; return fdate(t, true) + ', ' + t.slice(11, 16); }
function ic(name, size) { return Icons.svg(name, { size: size || 16, stroke: 1.5 }); }
function esc(s) { return String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c])); }
const byId = id => D.suppliers.find(s => s.id === id);
const det = k => D.details[k];
function lab(k) { return det(k).label + '<span class="tk">' + esc(det(k).tech) + '</span>'; }
/* a step tag: works from the record, or needs the model gateway */
function rtag(t) { return '<span class="rtag">' + ic('database', 11) + (t || 'from the record') + '</span>'; }
function gtag(t) { return '<span class="gtag">' + ic('bot', 11) + (t || 'model’s guess') + '</span>'; }
/* the not-known-yet value for a missing last-heard */
function heard(s, short) {
  if (!s.lastHeard) return '<span class="mk-gap w" title="Not known yet. ' + esc(s.gapWho) + ' could fill it.">not known yet</span>';
  return '<span class="fact">' + fdate(s.lastHeard, !short) + '</span>';
}
let timers = [];
function later(t, fn) { timers.push(setTimeout(fn, REDUCE ? Math.min(t, ms('--motion-base')) + timers.length : t)); }
function clearLater() { timers.forEach(clearTimeout); timers = []; }

function rail(active) {
  const items = [
    ['book-open', 'What we keep'], ['message-circle-question', 'Ask'], ['bookmark', 'Saved questions', D.saved.count], ['inbox', 'Triage', 3], ['lock', 'Studio']
  ];
  return '<aside class="rail"><div class="an">' + esc(D.app) + '</div>' +
    items.map(([i, l, n]) => '<button class="nav' + (l === active ? ' on' : '') + (i === 'lock' ? ' off' : '') + '"' + (i === 'lock' ? ' title="Admins change the structure in the studio. Ask ' + esc(D.people.admin) + '."' : '') + '>' + ic(i) + '<span>' + l + '</span>' + (n ? '<span class="n">' + n + '</span>' : '') + '</button>').join('') +
    '<div class="gw" id="gwbox"></div>' +
    '<div class="fl"><i class="bar"></i><b>' + esc(D.floor.name) + '</b>, a ' + esc(D.floor.kind.toLowerCase()) + '. ' + esc(D.floor.note) + '</div>' +
    '<div class="keys" id="keys"></div></aside>';
}
function gwbox() {
  const b = $('#gwbox'); if (!b) return;
  b.innerHTML = S.model
    ? '<div class="row">' + ic('bot', 14) + '<span>Model gateway on</span></div>Steps it does are marked <span class="gtag">guess</span>. ' + D.model.callsLeft + ' asks left today.'
    : '<div class="row">' + ic('bot', 14) + '<span>Model gateway off</span></div>' + esc(D.model.offWhy) + ' <b>' + esc(D.model.whoCan) + '</b> Everything marked ' + rtag('record') + ' still works.';
}
function keys(list) {
  if (!$('#keys')) return;
  const all = list.concat([['M', 'model gateway on / off'], ['T', 'technical words'], ['R', 'replay']]);
  $('#keys').innerHTML = all.map(k => '<span class="kbd">' + k[0] + '</span><span>' + k[1] + '</span>').join('');
}
/* boot: draws the frame, wires M T R, plays the demo ~1.2 s after load */
function boot(o) {
  document.body.classList.toggle('model-off', !S.model);
  const play = () => { clearLater(); o.reset(); if (!$('#keys').innerHTML) keys(o.keys || []); gwbox(); later(ms('--motion-run'), o.demo); };
  document.addEventListener('keydown', e => {
    if (e.target.matches('input')) { if (e.key === 'Escape') e.target.blur(); return; }
    const k = e.key.toLowerCase();
    if (k === 'r') play();
    else if (k === 'm') { S.model = !S.model; document.body.classList.toggle('model-off', !S.model); gwbox(); o.render && o.render(); }
    else if (k === 't') { S.tech = !S.tech; document.body.classList.toggle('tech', S.tech); const b = $('#tbtn'); b && b.classList.toggle('on', S.tech); }
    else o.key && o.key(k, e);
  });
  const tb = $('#tbtn'); tb && tb.addEventListener('click', () => document.dispatchEvent(new KeyboardEvent('keydown', { key: 't' })));
  Icons.hydrate(document.body);
  play();
}
