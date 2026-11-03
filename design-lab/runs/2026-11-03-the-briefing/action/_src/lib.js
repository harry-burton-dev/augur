/* ---- shared helpers (same in every variant) ---- */
const $ = (s, el = document) => el.querySelector(s);
const $$ = (s, el = document) => [...el.querySelectorAll(s)];
const I = (n, size = 16, stroke = 1.5) => Icons.svg(n, { size, stroke });
const RANK = Object.fromEntries(DATA.floorOrder.map((f, i) => [f, i]));
const P = id => DATA.people[id];
const F = id => DATA.floors[id];
const G = id => DATA.groups.find(g => g.id === id);
const fmt = n => n.toLocaleString('en-GB');
const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
const css = v => getComputedStyle(document.documentElement).getPropertyValue(v).trim();
const ms = v => parseFloat(css(v)) || 0;
const fill = (tpl, o) => tpl.replace(/\{(\w+)\}/g, (_, k) => o[k] ?? DATA.finding[k] ?? '');

/* access: a reader on floor r opens what is kept on r or on the floors above it */
const canOpen = (keptOn, reader) => RANK[keptOn] <= RANK[reader];
const total = g => Object.values(g.kept).reduce((a, b) => a + b, 0);
const openN = (g, reader) => g.restricted ? 0 : Object.entries(g.kept).reduce((a, [f, n]) => a + (canOpen(f, reader) ? n : 0), 0);
const allTotal = () => DATA.groups.reduce((a, g) => a + total(g), 0);
const allOpen = reader => DATA.groups.reduce((a, g) => a + openN(g, reader), 0);
/* who to ask about what a reader can't open in a group */
const askFor = g => P(g.keeper).name;
/* a claim is checkable by a reader if every record behind it opens, partly if some do */
function checkable(c, reader) {
  const o = c.basis.map(G).map(g => openN(g, reader) / total(g));
  if (o.every(x => x === 1)) return 'all';
  if (o.some(x => x > 0)) return 'part';
  return 'none';
}
const CHECK_WORD = { all: 'they can check it', part: 'they can check part of it', none: 'they can’t open what’s behind it' };

/* the probability yardstick at word size */
function cw(i) {
  const y = DATA.yardstick[i];
  return `<span class="cw" title="${y.w}: ${y.r}"><span class="yd" aria-hidden="true">${DATA.yardstick.map((_, k) => `<i class="${k === i ? 'on' : ''}"></i>`).join('')}</span>${y.w}<span class="tk">&nbsp;· ${y.r} · probability yardstick</span></span>`;
}

/* sparkline at word size; the forecast point is a judgement, so it is dotted */
function spark(w = 96, h = 22, withForecast = true) {
  const s = DATA.finding.series, f = DATA.finding.forecast;
  const pts = withForecast ? [...s, f] : s;
  const max = Math.max(...pts.map(p => p.v)), n = pts.length - 1;
  const X = i => 2 + i * (w - 4) / n, Y = v => h - 2 - v * (h - 4) / max;
  const ink = s.map((p, i) => `${X(i).toFixed(1)},${Y(p.v).toFixed(1)}`).join(' ');
  const last = s.length - 1;
  const fc = withForecast ? `<line x1="${X(last)}" y1="${Y(s[last].v)}" x2="${X(n)}" y2="${Y(f.v)}" stroke="var(--ink-muted)" stroke-dasharray="1.5 2.5" stroke-width="1.25"/><circle cx="${X(n)}" cy="${Y(f.v)}" r="2" fill="none" stroke="var(--ink-muted)"/>` : '';
  return `<svg class="spk" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}" role="img" aria-label="Overdue each month: ${s.map(p => p.m + ' ' + p.v).join(', ')}${withForecast ? ', ' + f.m + ' likely ' + f.v : ''}"><polyline points="${ink}" fill="none" stroke="var(--ink)" stroke-width="1.25" stroke-linejoin="round"/><circle cx="${X(last)}" cy="${Y(s[last].v)}" r="2.25" fill="var(--light)"/>${fc}</svg>`;
}

/* isotype: repeated figures, never a scaled one. returns markup and the key */
function figures(n, opts = {}) {
  const per = n > 60 ? 20 : 1, k = Math.ceil(n / per);
  const sz = opts.size || 14;
  let out = '';
  for (let i = 0; i < k; i++) {
    const part = (i === k - 1 && n % per) ? (n % per) / per : 1;
    out += `<span class="fig" style="--part:${part}">${I(opts.icon || 'user-round', sz, 1.5)}</span>`;
  }
  return { html: `<span class="figs" role="img" aria-label="${fmt(n)} people">${out}</span>`, key: per === 1 ? 'each figure is one person' : `each figure is ${per} people` };
}

/* the finding, as one block (headline ink, bottom line pencil, claims ink) */
const STATE = { tech: false, gateway: true, accepted: false };
function headlineHTML() {
  const h = DATA.finding.headline;
  return fill(h.tpl, h);
}
function bottomLineHTML() {
  const b = DATA.finding.bottomLine, h = DATA.finding.headline;
  if (!STATE.gateway) {
    return `<div class="pencil off" data-bl><p class="pl">${I('file-text', 12)} Model gateway is off · bottom line from the template, no number changes</p><p class="pt" style="margin:0">${fill(b.template, h)}</p></div>`;
  }
  if (STATE.accepted) {
    return `<div class="pencil inked" data-bl><p class="pl">${I('pen-line', 12)} Bottom line · drafted by the model, accepted by ${P(DATA.me).name}</p><p class="pt" style="margin:0">${b.model}</p></div>`;
  }
  return `<div class="pencil" data-bl><p class="pl">${I('pencil', 12)} Bottom line · drafted by the model, not yet accepted <button class="pbtn" data-accept>${I('check', 12)} Accept <span class="kbd">A</span></button></p><p class="pt" style="margin:0">${b.model}</p><p class="tk">every number in it comes from the claims below; the model may only choose words</p></div>`;
}
function claimsHTML(reader) {
  return `<ul class="claims">${DATA.claims.map((c, i) => {
    const chk = reader ? checkable(c, reader) : null;
    const ic = c.kind === 'judge' ? 'scale' : 'circle-dot';
    const basis = c.basis.map(G).map(g => `<b>${g.label}</b>`).join(', ');
    return `<li class="dep ${c.kind}" style="--i:${i}">${I(ic, 14)}<span><span class="ct">${c.text}</span> ${c.kind === 'judge' ? cw(c.word) : ''}${c.disagree ? ' <span class="mk-disagree" title="sources disagree"></span>' : ''}
      <span class="bs">${c.sources} From ${basis}.${chk ? ` <span class="ck ck-${chk}">${CHECK_WORD[chk]}</span>` : ''}</span></span></li>`;
  }).join('')}</ul>`;
}
function findingHTML(opts = {}) {
  return `<p class="eyebrow">Finding · ${DATA.finding.subject} · checked ${DATA.finding.checked}</p>
    <h2 class="fd-h">${headlineHTML()} ${spark()}</h2>
    ${bottomLineHTML()}
    ${opts.claims === false ? '' : claimsHTML(opts.reader)}`;
}

/* top bar */
function topHTML(crumbs, hints) {
  const me = P(DATA.me), fl = F(DATA.myFloor);
  return `<header class="top"><p class="brand">AUGUR</p>
    <nav class="crumb" aria-label="Where you are">${crumbs.map((c, i) => (i ? I('chevron-right', 14) : '') + (i === crumbs.length - 1 ? `<b>${c}</b>` : `<span>${c}</span>`)).join('')}</nav>
    <span class="fchip" data-tier="${DATA.myFloor}">${fl.name} · ${fl.word}</span>
    <div class="hints">${hints.map(([k, w, id]) => `<span ${id ? `id="${id}"` : ''}><span class="kbd">${k}</span>${w}</span>`).join('')}</div></header>`;
}

/* keys shared by every variant */
function commonKeys(e, rerender, replay) {
  const k = e.key.toLowerCase();
  if (e.metaKey || e.ctrlKey || e.altKey) return false;
  if (k === 'r') { replay(); return true; }
  if (k === 't') { STATE.tech = !STATE.tech; document.body.classList.toggle('tech', STATE.tech); $('#h-t')?.classList.toggle('on', STATE.tech); return true; }
  if (k === 'g') { STATE.gateway = !STATE.gateway; $('#h-g')?.classList.toggle('on', !STATE.gateway); rerender(); return true; }
  if (k === 'a') { STATE.accepted = !STATE.accepted; rerender(); return true; }
  return false;
}
document.addEventListener('click', e => { if (e.target.closest('[data-accept]')) { STATE.accepted = true; window.__rerender && window.__rerender(); } });

/* timers for the auto demo, cleared on replay */
let TIMERS = [];
const later = (fn, t) => TIMERS.push(setTimeout(fn, reduced ? Math.min(t, 50) : t));
const clearLater = () => { TIMERS.forEach(clearTimeout); TIMERS = []; };
