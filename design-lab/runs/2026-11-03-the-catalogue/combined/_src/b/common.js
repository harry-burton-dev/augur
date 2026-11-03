/* ---- helpers shared by both b-screens ---- */
const $ = (s, r = document) => r.querySelector(s), $$ = (s, r = document) => [...r.querySelectorAll(s)];
const RM = matchMedia('(prefers-reduced-motion: reduce)').matches;
const ms = t => { const v = getComputedStyle(document.documentElement).getPropertyValue(t).trim(); return v.endsWith('ms') ? parseFloat(v) : parseFloat(v) * 1000; };
let timers = [];
/* reduced motion: the same steps in the same order, ten times quicker; transitions crossfade */
const later = (fn, d) => timers.push(setTimeout(fn, RM ? d / 10 : d));
const clearLater = () => { timers.forEach(clearTimeout); timers = []; };
const K = id => DATA.kinds.find(k => k.id === id);
const F = id => DATA.families.find(f => f.id === id);
const FL = id => DATA.floors[id];
const P = id => DATA.predicted.find(p => p.id === id);
const Q = id => DATA.questions.find(q => q.id === id);
const ic = (n, s = 16) => Icons.svg(n, { size: s, stroke: 1.5 });
const tk = w => `<span class="tk">${w}</span>`;
const W = k => DATA.words[k];
const fmt = n => n.toLocaleString('en-GB');
const flName = id => { const f = FL(id); return `<span class="fl" data-tier="${f.tier}" title="${f.kind}">${f.name}</span>`; };
const flChip = id => { const f = FL(id); return `<span class="fl" data-tier="${f.tier}">${f.kind} · ${f.name}</span>`; };

/* ---- the six ways to be empty: one renderer each ---- */
const E = {
  gap: (who, extra) => `<span class="e gap"><span class="w">Not known yet</span><span>${who ? `<b>${who}</b> could fill it` : 'Nobody named yet'}${extra ? ` · ${extra}` : ''}</span>${tk('missing value · sh:minCount 1 not met')}</span>`,
  none: (who, when) => `<span class="e none"><span class="w">None</span><span>${who} checked, ${when}</span>${tk('stated absence')}</span>`,
  na: why => `<span class="e na"><span class="w">Doesn’t apply</span><span>${why}</span>${tk('not in the class’s profile')}</span>`,
  stale: (v, age, rule) => `<span class="e"><span class="w">${v}<span class="age" title="Stale: ${rule}">${age}</span></span><span>Stale: ${rule}</span>${tk('review age exceeded')}</span>`,
  unseen: (floor, what) => { const f = FL(floor); return `<span class="e unseen">${ic('lock', 12)}<span><span class="w" style="color:var(--ink-muted)">Not yours to see</span> · ${what || `kept on ${f.name}`}, ask <b>${f.ask}</b>${tk('403 · reason: kept elsewhere')}</span></span>`; },
  wave: (from, to, why, w = 220) => `<svg class="wave" viewBox="0 0 ${w} 16" preserveAspectRatio="none" aria-label="No record ${from} to ${to}">
      <path d="M0 8 ${Array.from({ length: Math.floor(w / 8) }, (_, i) => `Q${i * 8 + 2} ${i % 2 ? 13 : 3} ${i * 8 + 4} 8 T${i * 8 + 8} 8`).join(' ')}" style="fill:none;stroke:var(--ink-muted);stroke-dasharray:2 2"/></svg>`
};
/* the key strip, every screen; `here` lists the marks shown on this view */
function emptyKey(here, v) {
  const m = {
    gap: `<div class="m gap">Not known yet</div>`, none: `<div class="m">None</div>`, na: `<div class="m na">Doesn’t apply</div>`,
    stale: `<div class="m stale">2 Apr&nbsp;<span>7 months</span></div>`, norec: `<div class="m">${E.wave('', '', '', 120)}</div>`,
    unseen: `<div class="m unseen">${ic('lock', 12)}Not yours to see</div>`
  };
  return `${v ? `<div class="micro">Six ways to be empty${tk('the blank family')}</div>` : ''}<div class="ekey${here ? ' on-these' : ''}${v ? ' v' : ''}" aria-label="Six ways to be empty">${DATA.empty.map(e => `<div class="${!here || here.includes(e.id) ? 'here' : ''}">${m[e.id]}<div class="s"><b>${e.plain}.</b> ${e.say}${tk(e.tech)}</div></div>`).join('')}</div>`;
}
function keys(list) { $('#keys').innerHTML = list.map(([k, l]) => `<span><span class="kbd">${k}</span>${l}</span>`).join(''); }
function reveal(el) { if (!el) return; el.classList.add('fade', 'pre'); requestAnimationFrame(() => requestAnimationFrame(() => el.classList.remove('pre'))); }
function techFoot() {
  const on = document.body.classList.contains('tech');
  const el = $('#railfoot'); if (!el) return;
  el.innerHTML = on ? `<b>Technical words are on.</b> Each plain word shows the name admins use, one step down. <span class="kbd">T</span> hides them.`
    : `Plain words only. Anyone can show the <b>technical words</b> underneath with <span class="kbd">T</span>.`;
}
function boot(V) {
  const go = () => { clearLater(); V.reset(); later(() => V.demo(), ms('--motion-run')); };
  addEventListener('keydown', e => {
    if (e.metaKey || e.ctrlKey || e.altKey) return;
    const k = e.key.toLowerCase();
    if (k === 'r') { go(); return; }
    if (k === 't') { document.body.classList.toggle('tech'); techFoot(); if (V.onTech) V.onTech(); return; }
    if (V.key && V.key(e)) e.preventDefault();
  });
  if (location.hash.includes('tech')) document.body.classList.add('tech');
  go();
}
