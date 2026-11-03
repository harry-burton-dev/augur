/* Shared helpers for designer a's round-2 screens. No numbers live here:
   they all come from DATA through q() and word(). */
const $ = (s, el = document) => el.querySelector(s);
const $$ = (s, el = document) => [...el.querySelectorAll(s)];
const RM = matchMedia('(prefers-reduced-motion: reduce)').matches;
const ic = (n, s = 14) => Icons.svg(n, { size: s, stroke: 1.5 });
const esc = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const MON = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
const day = iso => { if (!iso) return ''; const [y, m, d] = iso.split('-').map(Number); return d + ' ' + MON[m - 1]; };
const dayY = iso => day(iso) + ' ' + iso.slice(0, 4);
const WORDS = ['none','one','two','three','four','five','six','seven','eight','nine','ten','eleven','twelve'];
const word = n => WORDS[n] ?? String(n);
const cap = s => s.charAt(0).toUpperCase() + s.slice(1);
const cssVar = n => getComputedStyle(document.documentElement).getPropertyValue(n).trim();
const ms = n => { const v = cssVar(n); return v.endsWith('ms') ? parseFloat(v) : parseFloat(v) * 1000; };

/* ---- floors: a floor shows what's kept on it and on the floors above ---- */
function above(f) { const out = []; while (f) { out.push(f); f = DATA.floors[f].parent; } return out; }
function canOpen(readerFloor, keptOn) { return above(readerFloor).includes(keptOn); }
function floorColour(f) { const t = DATA.floors[f].tier; return `var(--floor-${t === 'you' ? 'you' : t}-high)`; }

/* ---- the one query: every height reads its rows, so they can't differ ---- */
function q(asOf = DATA.today) {
  return DATA.inspections.map(r => {
    let s = r.state;
    if (s === 'done') s = r.done <= asOf ? 'done' : (r.due < asOf ? 'overdue' : 'notdue');
    else if (s === 'overdue') s = r.due < asOf ? 'overdue' : 'notdue';
    else if (s === 'disputed' && r.due >= asOf) s = 'notdue';
    return { ...r, s };
  }).filter(r => r.s !== 'notdue');
}
function tally(rows) {
  const t = { overdue: 0, disputed: 0, gap: 0, norecord: 0, hidden: 0, some: 0, done: 0, late: 0 };
  rows.forEach(r => { if (r.some) t.some++; else t[r.s]++; if (r.s === 'done' && r.done > r.due) t.late++; });
  t.cantsay = t.gap + t.norecord;
  t.sitesOver = new Set(rows.filter(r => r.s === 'overdue').map(r => r.site)).size;
  t.sitesOpen = new Set(rows.filter(r => !r.some).map(r => r.site)).size;
  t.rows = rows.filter(r => !r.some).length;
  return t;
}

/* ---- the yardstick: the word is a rule over grades and agreement ---- */
function wordOf(src) {
  const w = src.map(s => DATA.grades[s.g].w), best = Math.max(...w), n = w.length;
  if (best === 3 && n >= 2) return 6;
  if ((best >= 2 && n >= 2) || best === 3) return 5;
  if (best === 2 || n >= 2) return 4;
  return 3;
}
function stick(i, bar) {
  return `<span class="stick" aria-hidden="true">${DATA.yardstick.map((_, k) => `<span class="st-c${k <= i ? ' on' : ''}${k === bar ? ' bar' : ''}"></span>`).join('')}</span>`;
}

/* ---- reading time: words at the deployment's speed, plus a fixed time per picture ---- */
const secs = (text, pics = 0) => Math.round(text.trim().split(/\s+/).filter(Boolean).length / DATA.readWpm * 60 + pics * DATA.pictureSeconds);

/* ---- keys, hints, replay ---- */
function hints(el, list) {
  el.innerHTML = list.map(([k, t]) => `<span>${k.split(' ').map(x => `<span class="kbd">${x}</span>`).join('')} ${t}</span>`).join('');
}
function onKeys(map) {
  addEventListener('keydown', e => {
    if (e.target.closest('textarea,input') || e.metaKey || e.ctrlKey || e.altKey) return;
    const f = map[e.key] || map[e.key.toLowerCase()];
    if (f) { e.preventDefault(); f(e); }
  });
}
let timers = [];
const later = (fn, t) => timers.push(setTimeout(fn, t));
const clearLater = () => { timers.forEach(clearTimeout); timers = []; };
