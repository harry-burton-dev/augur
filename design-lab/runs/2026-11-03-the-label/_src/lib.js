/* ---- shared helpers (same in every page of this run) ---- */
const $ = (s, el = document) => el.querySelector(s);
const $$ = (s, el = document) => [...el.querySelectorAll(s)];
const I = (n, size = 16, stroke = 1.5) => Icons.svg(n, { size, stroke });
const fmt = n => n.toLocaleString('en-GB');
const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
const css = v => getComputedStyle(document.documentElement).getPropertyValue(v).trim();
const ms = v => parseFloat(css(v)) || 0;
const P = id => DATA.people[id];
const F = id => DATA.floors[id];
const L = id => (typeof id === 'string' ? DATA.labels[id] : id);
const FACT = id => DATA.record.facts.find(f => f.id === id);
const first = n => n.split(' ')[0];
const orList = a => a.length < 2 ? a.join('') : a.slice(0, -1).join(', ') + ' or ' + a[a.length - 1];
const andList = a => a.length < 2 ? a.join('') : a.slice(0, -1).join(', ') + ' and ' + a[a.length - 1];

/* the policy in force: every marking word comes from here. S swaps deployments */
let POL = DATA.policies[0];
const MK = id => POL.markings[id];
const DS = id => POL.descriptors[id];
const US = id => POL.uses[id];
const tpl = s => s.replace(/\{minGroup\}/g, POL.minGroup);
const USE_IDS = () => Object.keys(POL.uses);
const USE_ORDER = { no: 0, count: 1, ask: 2, yes: 3 };

/* floors: a reader opens what is kept on their floor and the floors above it */
function chainOf(f) { const a = []; while (f) { a.push(f); f = F(f).parent; } return a; }
const canOpen = (keptOn, readerFloor) => chainOf(readerFloor).includes(keptOn);
const tierOf = f => F(f).tier;
const fchip = f => `<span class="fchip" data-tier="${tierOf(f)}">${F(f).name} · ${F(f).word}</span>`;

/* label words */
const markWord = lb => { lb = L(lb); return MK(lb.marking).word + lb.desc.map(d => ' · ' + DS(d).word).join(''); };
const markShort = lb => { lb = L(lb); return MK(lb.marking).short + lb.desc.map(d => ' ' + DS(d).short).join(''); };
function markHTML(lb, cls = '') {
  lb = L(lb);
  return `<span class="mk ${cls}" data-rank="${MK(lb.marking).rank}">${MK(lb.marking).word}${lb.desc.map(d => `<span class="sep">·</span><span class="ds">${DS(d).word}</span>`).join('')}</span>`;
}
function pmHTML(lb) { lb = L(lb); return `<span class="pm" data-rank="${MK(lb.marking).rank}" title="${markWord(lb)}">(${MK(lb.marking).short}${lb.desc.map(d => ` <b>${DS(d).short}</b>`).join('')})</span>`; }
function useHTML(id, v, opt = {}) {
  const u = US(id); const w = POL.useWords[v];
  return `<span class="use" data-v="${v}" title="${u.long}: ${w}"><span class="ic">${I(u.icon, opt.size || 12)}</span>${opt.noword ? '' : `<span class="w">${u.word}</span>`}${opt.verdict ? `<span class="muted">&nbsp;${w}</span>` : ''}</span>`;
}
function usesHTML(lb, opt = {}) {
  lb = L(lb); const ids = USE_IDS().filter(id => !opt.only || opt.only.includes(lb.uses[id]));
  return `<span class="uses ${opt.compact ? 'compact' : ''}">${ids.map(id => useHTML(id, lb.uses[id], opt)).join('')}</span>`;
}
const keepWord = lb => POL.keepRules[L(lb).keep];
const whoChanges = lb => { lb = L(lb); return lb.desc.length ? DS(lb.desc[0]).owner : POL.owner; };
const askFor = (lb, use) => { lb = L(lb); return (lb.ask && lb.ask[use]) || whoChanges(lb); };
function lineHTML(lb, opt = {}) {
  lb = L(lb);
  return `<span class="lbl">${markHTML(lb)}<span class="k">${usesHTML(lb, { compact: true })}</span><span class="k">${I('hourglass', 12)}<b>${keepWord(lb)}</b></span>${opt.origin ? `<span class="k">${I('file-text', 12)}${opt.origin}</span>` : ''}</span>`;
}
/* the deed: plain words behind a label, and who can change it */
function deedHTML(lb, extra = {}) {
  lb = L(lb); const m = MK(lb.marking), ch = P(whoChanges(lb));
  const rows = [];
  rows.push(['shield', `<b>${m.word}</b>: ${m.plain} ${m.handle}`]);
  lb.desc.forEach(d => rows.push([DS(d).icon, `<b>${DS(d).word}</b>: ${DS(d).plain}`]));
  const yes = USE_IDS().filter(u => lb.uses[u] === 'yes').map(u => US(u).word.toLowerCase());
  const cnt = USE_IDS().filter(u => lb.uses[u] === 'count').map(u => US(u).word.toLowerCase());
  const ask = USE_IDS().filter(u => lb.uses[u] === 'ask').map(u => US(u).word.toLowerCase() + ' (ask ' + P(askFor(lb, u)).name + ')');
  const no = USE_IDS().filter(u => lb.uses[u] === 'no').map(u => US(u).word.toLowerCase());
  rows.push(['circle-check', `<b>May be used for</b> ${andList(yes) || 'nothing yet'}${cnt.length ? `; ${andList(cnt)} only as a count` : ''}${ask.length ? `; ${andList(ask)}` : ''}.${no.length ? ` <b>Not for</b> ${andList(no)}.` : ''}`]);
  if (lb.caveat) rows.push(['corner-down-right', `<b>Caveat</b>: ${tpl(lb.caveat.plain)}`]);
  rows.push(['hourglass', `<b>Kept</b> ${keepWord(lb)}${lb.keepDate ? ` (${lb.keepDate})` : ''}.`]);
  if (extra.origin) rows.push(['file-text', `<b>From</b> ${extra.origin}`]);
  rows.push(['message-square-text', `<b>Why this label</b>: ${lb.why} Set by ${P(lb.setBy).name}.`]);
  return `<div class="deed" role="dialog" aria-label="What this label means">${rows.map(([i, t]) => `<div class="row">${I(i, 14)}<span>${t}</span></div>`).join('')}
    <p class="who">${I('user-round', 12)} Anyone may make it stricter. Only <b>${ch.name}</b> (${ch.role}) may make it less strict. From ${POL.name}, ${POL.version}.</p>
    <p class="tk">label=${Object.keys(DATA.labels).find(k => DATA.labels[k] === lb)} · marking=${lb.marking} · desc=[${lb.desc}] · keep=${lb.keep}${lb.caveat ? ' · caveat=' + lb.caveat.id : ''}</p></div>`;
}

/* combining labels: the strictest marking wins, uses narrow, each part keeps its own keep-until */
function combine(ids) {
  const ls = ids.map(L);
  const top = Math.max(...ls.map(l => MK(l.marking).rank));
  const marking = Object.keys(POL.markings).find(k => POL.markings[k].rank === top);
  const desc = [...new Set(ls.flatMap(l => l.desc))];
  const uses = {};
  USE_IDS().forEach(u => { uses[u] = ls.map(l => l.uses[u]).sort((a, b) => USE_ORDER[a] - USE_ORDER[b])[0]; });
  const causes = ids.filter(id => MK(L(id).marking).rank === top);
  const narrowedBy = {};
  USE_IDS().forEach(u => { narrowedBy[u] = ids.filter(id => L(id).uses[u] === uses[u] && uses[u] !== 'yes'); });
  return { marking, desc, uses, causes, narrowedBy, keep: ls.map(l => l.keep), setBy: ls[0].setBy, why: 'Combined from its parts.', caveat: ls.find(l => l.caveat)?.caveat };
}

/* what a reader sees of a fact */
function viewFact(f, reader) {
  const lb = L(f.label);
  const share = DATA.shares.find(s => s.to === reader.person && s.facts.includes(f.id));
  const consent = DATA.consents.find(c => c.facts.includes(f.id));
  if (consent) {
    if (consent.to === reader.person) return { state: 'open', via: 'consent', consent };
    return { state: 'unseen', why: 'Given by the person it is about, to one investigator only.', ask: consent.subject, askWhy: 'only they can extend their consent' };
  }
  if (canOpen(f.keptOn, reader.floor)) return { state: 'open' };
  if (share) return { state: 'open', via: 'share', share };
  if (lb.desc.some(d => DS(d).hideExistence)) return { state: 'hidden' };
  if (lb.caveat && lb.caveat.other) return { state: 'said', text: lb.caveat.other, why: tpl(lb.caveat.plain) };
  if (lb.caveat) return { state: 'unseen', why: tpl(lb.caveat.plain), ask: lb.setBy, counted: true };
  return { state: 'unseen', why: `Kept by ${F(f.keptOn).name}.`, ask: lb.setBy };
}

/* top bar */
function topHTML(crumbs, hints, viewer) {
  const me = P(viewer || DATA.me);
  return `<header class="top"><p class="brand">AUGUR</p>
    <nav class="crumb" aria-label="Where you are">${crumbs.map((c, i) => (i ? I('chevron-right', 14) : '') + (i === crumbs.length - 1 ? `<b>${c}</b>` : `<span>${c}</span>`)).join('')}</nav>
    <span class="fchip" data-tier="${tierOf(me.floor)}">${me.name} · ${F(me.floor).name}</span>
    <div class="hints">${hints.map(([k, w, id]) => `<span ${id ? `id="${id}"` : ''}><span class="kbd">${k}</span>${w}</span>`).join('')}</div></header>`;
}
const STD_HINTS = [['R', 'replay'], ['T', 'admin words', 'h-t'], ['S', 'other policy', 'h-s']];

/* one popover for every "explained in a click": any [data-why] opens the label's deed */
let DEED = null;
function openDeed(el) {
  closeDeed();
  const lb = el.dataset.why === '@' ? window.__label?.() : el.dataset.why;
  if (!lb) return;
  const box = document.createElement('div');
  box.className = 'deedpop';
  box.style.cssText = `position:fixed;z-index:var(--layer-overlay);`;
  box.innerHTML = deedHTML(lb, { origin: el.dataset.origin });
  document.body.appendChild(box); Icons.hydrate(box);
  const r = el.getBoundingClientRect(), w = box.offsetWidth, h = box.offsetHeight;
  box.style.left = Math.max(16, Math.min(r.left, innerWidth - w - 16)) + 'px';
  box.style.top = (r.bottom + h + 8 < innerHeight ? r.bottom + 6 : Math.max(8, r.top - h - 6)) + 'px';
  el.setAttribute('aria-expanded', 'true'); DEED = { box, el };
}
function closeDeed() { if (DEED) { DEED.box.remove(); DEED.el.setAttribute('aria-expanded', 'false'); DEED = null; } }
document.addEventListener('click', e => {
  const w = e.target.closest('[data-why]');
  if (w) { e.stopPropagation(); if (DEED && DEED.el === w) closeDeed(); else openDeed(w); return; }
  if (DEED && !e.target.closest('.deedpop')) closeDeed();
});
const whyBtn = (lb, inner, origin = '') => `<button class="why" data-why="${lb}" aria-expanded="false" ${origin ? `data-origin="${origin.replace(/"/g, '&quot;')}"` : ''} aria-label="What this label means">${inner}</button>`;

/* keys shared by every page */
const STATE = { tech: false };
function commonKeys(e, rerender, replay) {
  const k = e.key.toLowerCase();
  if (e.metaKey || e.ctrlKey || e.altKey) return false;
  if (e.key === 'Escape' && DEED) { closeDeed(); return true; }
  if (k === 'r') { closeDeed(); replay(); return true; }
  if (k === 't') { STATE.tech = !STATE.tech; document.body.classList.toggle('tech', STATE.tech); $('#h-t')?.classList.toggle('on', STATE.tech); return true; }
  if (k === 's') { closeDeed(); POL = POL === DATA.policies[0] ? DATA.policies[1] : DATA.policies[0]; rerender(); $('#h-s')?.classList.toggle('on', POL !== DATA.policies[0]); return true; }
  return false;
}
function settleIn() {
  document.body.classList.add('pre');
  requestAnimationFrame(() => requestAnimationFrame(() => document.body.classList.remove('pre')));
}
function afterRender(root) { Icons.hydrate(root || document.body); document.body.classList.toggle('tech', STATE.tech); $('#h-t')?.classList.toggle('on', STATE.tech); $('#h-s')?.classList.toggle('on', POL !== DATA.policies[0]); }

/* timers for the auto demo, cleared on replay */
let TIMERS = [];
const later = (fn, t) => TIMERS.push(setTimeout(fn, reduced ? Math.min(t, 50) : t));
const clearLater = () => { TIMERS.forEach(clearTimeout); TIMERS = []; };
const MOMENT = () => ms('--motion-run');

/* readers used across the run */
const READERS = {
  kofi: { person: 'p2', floor: 'pil' },
  leah: { person: 'p1', floor: 'mops' },
  sam:  { person: 'p7', floor: 'vts' },
  owen: { person: 'p9', floor: 'com' }
};
/* a fact's value as this reader gets it: open, said another way, not yours to see, or not there at all */
function valueHTML(f, reader, opt = {}) {
  const v = viewFact(f, reader), lb = L(f.label);
  if (v.state === 'open') return `<span class="val">${f.v}</span>`;
  if (v.state === 'said') return `<span class="said" title="${v.why}">${v.text}</span>`;
  if (v.state === 'hidden') return '';
  return `<span class="unseen">${I('lock', 12)} ${v.counted ? 'counted, not shown' : 'not yours to see'} · ask ${P(v.ask).name}</span>`;
}
const GLOMAR = () => tpl(POL.rules[3]);

/* sharing: what the label lets through to a target, paragraph by paragraph */
const TG = id => DATA.targets.find(t => t.id === id);
const tgName = t => t.kind === 'outside' ? DATA.groups[t.ref].name : t.kind === 'group' ? DATA.groups[t.ref].name : F(t.ref).name;
function shareCheck(t) {
  return DATA.briefing.paras.map(p => {
    const lb = L(p.label), os = MK(lb.marking).rank >= 1;
    if (p.stop) return { p, v: 'stop', why: p.stop, fix: 'Leave it out. The count before it says the same without naming anyone.' };
    if (t.kind === 'outside') {
      const u = lb.uses.outside;
      if (u === 'no') return { p, v: 'stop', why: `${US('outside').long}: ${POL.useWords.no}. ${tpl(POL.clauses.outside)}`, fix: 'Send the paper without it.' };
      if (u === 'ask') return { p, v: 'ask', who: askFor(lb, 'outside'), why: `${US('outside').long}: ${POL.useWords.ask}.` };
      return { p, v: 'ok' };
    }
    if (os && (t.kind === 'floor' || t.people >= F(t.floor).people)) return { p, v: 'stop', why: `${MK(lb.marking).word} goes to named people or groups, never a whole floor.`, fix: 'Send it to a named group, or send the paper without it.' };
    if (p.said) return { p, v: 'said', why: `Already a count over ${DATA.answer.of} groundings, none named.` };
    return { p, v: 'ok' };
  });
}
const paraLabel = p => p.said ? { ...L(p.label), desc: [] } : L(p.label);
function paperLabel(checks) {
  const pass = checks.filter(c => c.v !== 'stop').map(c => paraLabel(c.p));
  return combine(pass.length ? pass : ['lbOff']);
}

/* a collection's own label, worked out from its parts */
const DSET = () => DATA.dataset;
const partLabel = id => L(DSET().parts.find(p => p.id === id).label);
const dsetLabel = () => combine(DSET().parts.map(p => p.label));
const pct = (a, b) => Math.round(a / b * 100);

/* custody helpers */
const handName = h => !h ? '' : DATA.people[h] ? P(h).name : DATA.hands[h].name;
const handIcon = h => DATA.people[h] ? 'user-round' : DATA.hands[h].icon;
const toName = k => !k.to ? '' : DATA.people[k.to] ? P(k.to).name : DATA.groups[k.to].name;
const actWord = k => k.act[0].toUpperCase() + k.act.slice(1);
