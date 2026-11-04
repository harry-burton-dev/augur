/* ---- shared helpers and the routing model (same in every page) ----
   route(n) works out, for one notice, who is told, on which channel, when, what held it,
   the receipts, and the escalation steps, from DATA's rules alone. */
const $ = (s, el = document) => el.querySelector(s);
const $$ = (s, el = document) => [...el.querySelectorAll(s)];
const I = (n, size = 16, stroke = 1.5) => Icons.svg(n, { size, stroke });
const P = id => DATA.people[id];
const A = id => DATA.apps[id];
const N = id => DATA.notices.find(n => n.id === id);
const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
const first = s => s.split(' ')[0];

/* ---- time: minutes from Monday 00:00 of the week ---- */
const DAY = 1440, DAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
const WEEK_END = 7 * DAY;
function tm(s) {
  if (s == null) return null;
  if (typeof s === 'number') return s;
  let add = 0; if (s.startsWith('next ')) { add = 7 * DAY; s = s.slice(5); }
  const [d, hm] = s.split(' '); const [h, m] = hm.split(':').map(Number);
  return add + DAYS.indexOf(d) * DAY + h * 60 + m;
}
const mins = hm => { const [h, m] = hm.split(':').map(Number); return h * 60 + m; };
const pad = n => String(n).padStart(2, '0');
const hhmm = t => `${pad(Math.floor((t % DAY) / 60))}:${pad(t % 60)}`;
const dayOf = t => Math.floor(t / DAY);
const dayName = t => dayOf(t) >= 7 ? `next ${DAYS[dayOf(t) % 7]}` : DAYS[dayOf(t)];
const dayLong = t => dayOf(t) >= 7 ? DATA.week.next : DATA.week.days[dayOf(t)];
const at = t => t == null ? '' : `${dayName(t)} ${hhmm(t)}`;
function dur(m) {
  if (m == null) return '';
  if (m < 60) return `${m} min`;
  const h = Math.floor(m / 60), r = m % 60;
  if (h < 24) return r ? `${h} h ${r} min` : `${h} h`;
  const d = Math.floor(h / 24), hh = h % 24;
  return hh ? `${d} d ${hh} h` : `${d} d`;
}

/* working hours: { days, from, to } as minutes */
const hoursOf = h => ({ days: h.days, from: mins(h.from), to: mins(h.to) });
const H = pid => hoursOf(P(pid).hours);
const TEAMH = hoursOf(DATA.teamHours);
function inHours(h, t) { const d = dayOf(t) % 7, m = t % DAY; return h.days.includes(d) && m >= h.from && m < h.to; }
function nextStart(h, t) {
  if (inHours(h, t)) return t;
  for (let d = dayOf(t); d < dayOf(t) + 15; d++) {
    if (!h.days.includes(d % 7)) continue;
    const s = d * DAY + h.from;
    if (s >= t) return s;
  }
  return t;
}
function addWork(h, t, m) {
  t = nextStart(h, t);
  for (let guard = 0; guard < 30; guard++) {
    const end = dayOf(t) * DAY + h.to, avail = end - t;
    if (m <= avail) return t + m;
    m -= avail; t = nextStart(h, end);
  }
  return t;
}
function awayAt(pid, t) { const a = P(pid).away; return !!a && t >= tm(a.from) && t < tm(a.to); }
const backAt = pid => nextStart(H(pid), tm(P(pid).away.to));
const present = (pid, t) => inHours(H(pid), t) && !awayAt(pid, t);
function nextEdition(pid, t) {
  const p = P(pid), h = H(pid), em = mins(p.digest);
  for (let d = dayOf(t); d < dayOf(t) + 15; d++) {
    if (!h.days.includes(d % 7)) continue;
    const e = d * DAY + em; if (e > t) return e;
  }
}

/* ---- the vocabulary ---- */
const LEVELS = {
  needs:  { word: 'Needs you', icon: 'hand' },
  failed: { word: 'Failed',    icon: 'octagon-x' },
  done:   { word: 'Done',      icon: 'check' },
  info:   { word: 'Info',      icon: 'info' }
};
/* classes: how a notice travels (the postal analogy) */
const CLASSES = {
  urgent: { word: 'Urgent',         post: 'Special delivery', icon: 'siren',
            promise: 'Reaches whoever is on call now, day or night: the Letterbox when they are in AUGUR, email when they are not. Asked again every 15 minutes until someone takes it.',
            receipt: ['told', 'seen', 'taken', 'acted'], tech: 'level: needs + urgent (proposed; AUGUR’s own services, or an app with an urgency budget)' },
  needs:  { word: 'Needs you',      post: 'Recorded delivery', icon: 'hand',
            promise: 'Your Inbox and the band. Waits for your next working hour if you are quiet; goes to your cover if you are away. If nobody takes it by its limit, the team’s policy asks the next person.',
            receipt: ['told', 'seen', 'taken', 'acted'], tech: 'level: needs → Inbox item (ADR 0026) + notification (ADR 0044)' },
  first:  { word: 'Tell me',        post: 'First class', icon: 'mail',
            promise: 'The band and your list, now or at your next working hour. Never escalates.',
            receipt: ['told', 'seen'], tech: 'level: failed | done (ADR 0044)' },
  record: { word: 'For the record', post: 'Second class', icon: 'newspaper',
            promise: 'Your list without a pulse, and your next edition. Never interrupts.',
            receipt: ['told'], tech: 'level: info (ADR 0044); no pulse is a change' }
};
const classOf = n => n.urgent ? 'urgent' : n.level === 'needs' ? 'needs' : n.level === 'info' ? 'record' : 'first';
const CHANNELS = {
  letterbox: { word: 'Letterbox',  icon: 'rectangle-horizontal' },
  band:      { word: 'Band',       icon: 'panel-top' },
  list:      { word: 'List',       icon: 'list' },
  inbox:     { word: 'Inbox',      icon: 'inbox' },
  toast:     { word: 'Toast',      icon: 'message-square' },
  email:     { word: 'Email now',  icon: 'mail' },
  digest:    { word: 'Edition',    icon: 'newspaper' },
  emaildigest: { word: 'Emailed edition', icon: 'mail-open' },
  card:      { word: '“While you were out” card', icon: 'sticky-note' }
};
/* the rules, in the order they are tried. setBy says whose setting it is. */
const RULES = {
  permission: { word: 'Not allowed on this floor', icon: 'lock',         setBy: 'Department admin', where: 'Admin, Apps' },
  teamoff:    { word: 'Team notices are off',      icon: 'bell-off',     setBy: 'team lead',        where: 'the team’s settings' },
  repeat:     { word: 'Already told',              icon: 'repeat-1',     setBy: 'the sending app',  where: 'its key' },
  nobody:     { word: 'Nobody to ask',             icon: 'user-x',       setBy: 'admin',            where: 'Admin, People' },
  urgent:     { word: 'Urgent gets through',       icon: 'siren',        setBy: 'admin',            where: 'the urgency budget' },
  away:       { word: 'Away',                      icon: 'plane',        setBy: 'the person',       where: 'My switchboard' },
  muted:      { word: 'App muted',                 icon: 'bell-off',     setBy: 'the person',       where: 'My switchboard' },
  record:     { word: 'For the record',            icon: 'newspaper',    setBy: 'the person',       where: 'My switchboard' },
  quiet:      { word: 'Quiet hours',               icon: 'moon',         setBy: 'the person',       where: 'My switchboard' },
  live:       { word: 'Told live',                  icon: 'radio',        setBy: '',                 where: '' }
};
const RULE_ORDER = ['permission', 'teamoff', 'repeat', 'urgent', 'away', 'muted', 'record', 'quiet', 'live'];

/* ---- addressing ---- */
const rotaOn = t => DATA.rota.byDay[dayOf(t) % 7];
const teamOf = pid => DATA.teams[P(pid).team];
const holders = roles => Object.keys(DATA.people).filter(id => (P(id).roles || []).some(r => roles.includes(r)));
function addressOf(n) {
  const to = n.to;
  if (to.people) return { kind: 'people', words: to.people.length > 1 ? `${to.people.length} people by name` : to.people[0] === DATA.me ? 'you by name' : `${P(to.people[0]).name} by name` };
  if (to.team) { const tt = DATA.teams[to.team]; return { kind: 'team', words: `everyone on ${tt.name}` }; }
  if (to.rota) return { kind: 'rota', words: `whoever is on call for ${DATA.teams[DATA.rota.team].name}` };
  if (to.role) return { kind: 'role', words: `everyone with the ${to.role.map(r => r.replace('-', ' ')).join(' or ')} role` };
}
function recipients(n) {
  const t = tm(n.at), to = n.to;
  if (to.people) return to.people.map(p => ({ p, via: 'addressed' }));
  if (to.team) return DATA.teams[to.team].members.filter(p => p !== to.except).map(p => ({ p, via: 'team' }));
  if (to.rota) return [{ p: rotaOn(t), via: 'rota' }];
  if (to.role) return holders(to.role).map(p => ({ p, via: 'role' }));
  return [];
}

/* ---- one person's delivery ---- */
function deliver(n, pid, t, via, step) {
  const p = P(pid), cls = classOf(n), o = (n.out || {})[pid] || {};
  const d = { n, p: pid, via, step, sent: t, told: t, ch: [], rule: 'live', held: null,
    seen: tm(o.seen), taken: tm(o.accepted), acted: tm(o.acted), passed: tm(o.passed), act: o.act, note: o.note };
  const inbox = cls === 'needs' || cls === 'urgent';
  if (cls === 'urgent') {
    d.rule = 'urgent';
    if (present(pid, t)) d.ch = ['letterbox', 'band', 'list', 'inbox'];
    else if (p.email.urgent) d.ch = ['email', 'letterbox', 'inbox'];
    else { d.ch = ['letterbox', 'inbox']; d.held = { rule: 'urgent', until: nextStart(H(pid), t) }; d.told = d.held.until; }
  } else if (awayAt(pid, t)) {
    d.rule = 'away'; d.held = { rule: 'away', until: backAt(pid) }; d.told = d.held.until; d.ch = ['card', 'list'];
    if (inbox && p.away.cover && via !== 'cover') d.coverTo = p.away.cover;
  } else if (p.muted.includes(n.app)) {
    d.rule = 'muted'; d.ch = inbox ? ['inbox', 'list'] : ['list'];
  } else if (cls === 'record') {
    d.rule = 'record'; d.ch = ['list', 'digest']; d.edition = nextEdition(pid, t);
    if (p.email.digest) d.ch.push('emaildigest');
  } else if (!inHours(H(pid), t)) {
    d.rule = 'quiet'; d.held = { rule: 'quiet', until: nextStart(H(pid), t) }; d.told = d.held.until;
    d.ch = (inbox ? ['inbox', 'band', 'list'] : ['band', 'list']).concat(p.toasts.includes(n.level) ? ['toast'] : []);
  } else {
    d.ch = (inbox ? ['inbox', 'band', 'list'] : ['band', 'list']).concat(p.toasts.includes(n.level) ? ['toast'] : []);
  }
  return d;
}

/* ---- one notice's whole route ---- */
const ROUTES = {};
function route(n) {
  if (typeof n === 'string') n = N(n);
  if (ROUTES[n.id]) return ROUTES[n.id];
  const t = tm(n.at), cls = classOf(n), app = A(n.app);
  const r = { n, t, cls, blocked: null, deliveries: [], steps: [], status: 'told' };
  ROUTES[n.id] = r;
  const would = recipients(n).length;
  if (n.floor && app.may && app.may[n.floor] === false) { r.blocked = { rule: 'permission', would, why: app.mayWhy }; r.status = 'blocked'; return r; }
  if (n.to.team && !DATA.teams[n.to.team].teamNotices.on) {
    const tt = DATA.teams[n.to.team];
    r.blocked = { rule: 'teamoff', would: tt.members.length, why: `${tt.name} has not turned team notices on. ${P(tt.lead).name}, its lead, can.` }; r.status = 'blocked'; return r;
  }
  const prev = n.key && DATA.notices.find(m => m !== n && m.app === n.app && m.key === n.key && tm(m.at) < t);
  if (prev) { r.blocked = { rule: 'repeat', would, of: prev.id, why: `Each person is told this once. ${A(n.app).name} sent it again ${dur(t - tm(prev.at))} later with the same key.` }; r.status = 'repeat'; return r; }
  for (const { p, via } of recipients(n)) r.deliveries.push(deliver(n, p, t, via, 0));
  if (cls === 'needs' || cls === 'urgent') escalate(r);
  else if (cls === 'record') r.status = 'record';
  else r.status = r.deliveries.some(d => d.held) ? 'held' : 'told';
  return r;
}

/* escalation along the team's policy (needs) or the urgent policy */
function escalate(r) {
  const n = r.n, urgent = r.cls === 'urgent';
  const asked = new Set(r.deliveries.map(d => d.p));
  const all = () => r.deliveries;
  const done = () => { const ts = all().map(d => Math.min(d.taken ?? Infinity, d.acted ?? Infinity)); const m = Math.min(...ts); return m === Infinity ? null : m; };
  const from = Math.min(...all().map(d => d.told));
  let until = urgent ? from + DATA.urgentPolicy.wait : (n.limit ? tm(n.limit) : addWork(TEAMH, from, DATA.policy.firstWait));
  r.steps.push({ k: 0, who: 'addressed', people: all().map(d => d.p), at: Math.min(...all().map(d => d.sent)), until });
  /* cover: an addressee who is away, or goes away before the limit */
  for (const d of [...all()]) {
    const a = P(d.p).away; if (!a || !a.cover) continue;
    const goes = Math.max(d.sent, tm(a.from));
    if (goes < until && !asked.has(a.cover)) {
      const when = nextStart(TEAMH, goes); const res = done();
      if (res != null && res <= when) continue;
      const c = deliver(n, a.cover, when, 'cover', 1); c.coverFor = d.p; r.deliveries.push(c); asked.add(a.cover);
      r.steps.push({ k: 1, who: 'cover', people: [a.cover], at: when, until, for: d.p });
    }
  }
  const steps = urgent ? DATA.urgentPolicy.steps : DATA.policy.steps.filter(s => s.who !== 'cover').map(s => s.who);
  let k = 2;
  for (const who of steps) {
    const res = done();
    if (res != null && res <= until) break;
    if (until >= WEEK_END) break;
    /* someone passed it on early */
    const passed = all().filter(d => d.passed && d.passed < until).map(d => d.passed);
    const t0 = passed.length ? Math.min(...passed) : until;
    /* a notice to a role has no rota, lead or floor: only the role's other holders */
    let pid = n.to.role ? null : who === 'rota' ? rotaOn(t0) : who === 'lead' ? DATA.teams[DATA.rota.team].lead : Object.keys(DATA.people).find(id => P(id).admin === 'department');
    const wait = urgent ? DATA.urgentPolicy.wait : (DATA.policy.steps.find(s => s.who === who) || {}).wait;
    if (!pid) { r.steps.push({ k: k++, who, skipped: 'none', at: t0 }); continue; }
    if (asked.has(pid)) { r.steps.push({ k: k++, who, people: [pid], skipped: 'asked', at: t0 }); continue; }
    if (awayAt(pid, t0)) { r.steps.push({ k: k++, who, people: [pid], skipped: 'away', at: t0 }); continue; }
    const d = deliver(n, pid, t0, 'escalation', k); r.deliveries.push(d); asked.add(pid);
    until = wait == null ? null : (urgent ? t0 + wait : addWork(TEAMH, d.told, wait));
    r.steps.push({ k: k++, who, people: [pid], at: t0, until, early: passed.length > 0 });
    if (until == null) break;
  }
  const res = done();
  r.resolved = res; r.by = res != null ? all().find(d => Math.min(d.taken ?? Infinity, d.acted ?? Infinity) === res).p : null;
  r.acted = all().find(d => d.acted);
  if (n.to.role && res == null) r.nobodyElse = true;
  /* urgent asks the same people again: three times 15 min apart, then each gap doubles (room tone) */
  if (urgent) { const last = r.steps.filter(s => s.people && !s.skipped).slice(-1)[0]; r.reasks = []; let g = DATA.urgentPolicy.wait, t = last.until ?? last.at + g;
    for (let i = 0; i < 6 && t < WEEK_END + DAY && (res == null || t < res); i++) { r.reasks.push(t); t += g; if (i >= 2) g *= 2; } }
  /* stood down: asked after it was taken, or before, and not the taker */
  if (res != null) all().forEach(d => { if (d.p !== r.by && d.told <= res) d.stoodDown = res; });
  r.status = r.acted ? 'acted' : res != null ? 'taken' : 'open';
}

/* the week */
const ALL = () => DATA.notices.map(route);
const ALL_D = () => ALL().flatMap(r => r.deliveries);
const forPerson = pid => ALL_D().filter(d => d.p === pid);

/* ---- plain words: why, for one delivery ---- */
function viaWords(d) {
  const n = d.n, r = route(n), app = A(n.app).name;
  if (d.via === 'addressed') return `${app} sent it to you by name.`;
  if (d.via === 'team') { const tt = DATA.teams[n.to.team]; return `${app} sent it to everyone on ${tt.name}. Team notices are on there: ${P(tt.teamNotices.by).name} turned them on on ${tt.teamNotices.since}.`; }
  if (d.via === 'rota') return `${app} sent it to whoever is on call for ${DATA.teams[DATA.rota.team].name}. On ${dayLong(d.sent).split(' ')[0] === 'Sat' || dayLong(d.sent).split(' ')[0] === 'Sun' ? dayLong(d.sent) : dayLong(d.sent)} that is you, on the rota ${P(DATA.rota.setBy).name} keeps.`;
  if (d.via === 'role') return `${app} sent it to everyone with the ${n.to.role.map(x => x.replace('-', ' ')).join(' or ')} role, and you hold it.`;
  if (d.via === 'cover') return `It was for ${P(d.coverFor).name}, who is away until ${dayLong(backAt(d.coverFor))} and named you as cover.`;
  if (d.via === 'escalation') {
    const st = r.steps.find(s => s.k === d.step), prevPeople = r.deliveries.filter(x => x.told < d.sent || x.step < d.step).map(x => first(P(x.p).name));
    const why = st && st.early ? `${prevPeople.slice(-1)[0]} passed it on at ${hhmm(d.sent)}` : `Nobody had taken it by ${hhmm(d.sent)}`;
    const pol = r.cls === 'urgent' ? 'the urgent rule asks' : `the ${DATA.teams[DATA.rota.team].name} policy (${P(DATA.policy.setBy).name}’s) asks`;
    const whoW = st.who === 'rota' ? 'whoever is on call' : st.who === 'lead' ? 'the team lead' : 'the Department admin';
    return `${why}, so ${pol} ${whoW} next: you.`;
  }
}
function ruleWords(d) {
  const p = P(d.p), n = d.n;
  switch (d.rule) {
    case 'urgent': return d.ch[0] === 'email' ? `It is urgent and you weren’t in AUGUR, so it was emailed at ${hhmm(d.sent)} and waits in the Letterbox.` : d.held ? `It is urgent, but you haven’t chosen email for urgent, so it waited for ${at(d.told)}.` : `It is urgent, so the Letterbox opened at ${hhmm(d.sent)}.`;
    case 'away': return `You were away (${p.away.note.toLowerCase()}), so it waits on your “while you were out” card for ${dayLong(d.told)}${d.coverTo ? `, and ${P(d.coverTo).name}, your cover, was asked` : ''}.`;
    case 'muted': return `You have muted ${A(n.app).name}, so it is in your list${d.ch.includes('inbox') ? ' and Inbox' : ''} without a pulse or toast.`;
    case 'record': return `It is for the record, so it went into your list without a pulse and into your ${hhmm(d.edition)} edition on ${dayName(d.edition)}.`;
    case 'quiet': return `It came at ${hhmm(d.sent)}, in your quiet hours, so it waited until ${at(d.told)}.`;
    case 'live': return `You were in your working hours, so it reached the band${d.ch.includes('toast') ? ', a toast' : ''} and your list at ${hhmm(d.told)}.`;
  }
}
/* receipts for one delivery: told, seen, taken, acted */
function receipts(d) {
  const want = CLASSES[classOf(d.n)].receipt;
  return want.map(k => ({ k, t: k === 'told' ? (d.rule === 'record' ? d.edition : d.told) : d[k] ?? null }));
}

/* ---- markup helpers ---- */
const TIER = pid => ({ team: 'team', department: 'department', org: 'org' })[P(pid).floor] || 'you';
const who = (pid, opts = {}) => `<span class="who" data-tier="${TIER(pid)}">${opts.first ? first(P(pid).name) : P(pid).name}</span>`;
const lvl = n => `<span class="lvl lvl-${n.urgent ? 'urgent' : n.level}">${I(n.urgent ? 'siren' : LEVELS[n.level].icon, 12)}${n.urgent ? 'Urgent' : LEVELS[n.level].word}</span>`;
const appTag = id => `<span class="app">${I(A(id).icon, 12)}${A(id).name}</span>`;
const chip = (ch, on = true) => `<span class="ch ${on ? '' : 'off'}" title="${CHANNELS[ch].word}">${I(CHANNELS[ch].icon, 12)}${CHANNELS[ch].word}</span>`;
const ruleChip = r => `<span class="rule rule-${r}">${I(RULES[r].icon, 12)}${RULES[r].word}</span>`;
function rcpt(d) {
  return `<span class="rcpt" aria-label="Receipts">${receipts(d).map(x => `<span class="rc ${x.t != null ? 'on' : ''}" title="${x.k}${x.t != null ? ' ' + at(x.t) : ': not yet'}"><i></i>${x.k}${x.t != null ? ` <b>${hhmm(x.t)}</b>` : ''}</span>`).join('')}</span>`;
}

/* top bar */
function topHTML(crumbs, hints, floor = 'team') {
  const fl = DATA.floors[floor];
  return `<header class="top"><p class="brand">AUGUR</p>
    <nav class="crumb" aria-label="Where you are">${crumbs.map((c, i) => (i ? I('chevron-right', 14) : '') + (i === crumbs.length - 1 ? `<b>${c}</b>` : `<span>${c}</span>`)).join('')}</nav>
    <span class="fchip" data-tier="${floor}">${fl.name} · ${fl.word}</span>
    <div class="hints">${hints.map(([k, w, id]) => `<span ${id ? `id="${id}"` : ''}><span class="kbd">${k}</span>${w}</span>`).join('')}</div></header>`;
}

/* keys shared by every page: R replays, T shows the technical words */
const STATE = { tech: false };
function commonKeys(e, replay) {
  const k = e.key.toLowerCase();
  if (e.metaKey || e.ctrlKey || e.altKey) return false;
  if (e.target.closest && e.target.closest('input,textarea,select')) return false;
  if (k === 'r') { replay(); return true; }
  if (k === 't') { STATE.tech = !STATE.tech; document.body.classList.toggle('tech', STATE.tech); $('#h-t')?.classList.toggle('on', STATE.tech); return true; }
  return false;
}
let TIMERS = [];
const later = (fn, t) => TIMERS.push(setTimeout(fn, reduced ? Math.min(t, 50) : t));
const clearLater = () => { TIMERS.forEach(clearTimeout); TIMERS = []; };

/* what if: run the routing again with one setting changed, then put everything back */
function whatIf(mod, fn) {
  const snap = JSON.parse(JSON.stringify(DATA));
  Object.keys(ROUTES).forEach(k => delete ROUTES[k]);
  mod(DATA);
  let out; try { out = fn(); } finally {
    Object.keys(snap).forEach(k => { DATA[k] = snap[k]; });
    Object.keys(ROUTES).forEach(k => delete ROUTES[k]);
  }
  return out;
}
/* a person's own notices, in the order they were told */
const mine = (pid = DATA.me) => forPerson(pid).sort((a, b) => (a.rule === 'record' ? a.edition : a.told) - (b.rule === 'record' ? b.edition : b.told));

/* the trace of one notice: every hop in time order, in plain words, with its rule and owner */
function hops(r, me) {
  const n = r.n, app = A(n.app).name, H = [];
  const nm = p => p === me ? 'you' : P(p).name;
  H.push({ t: r.t, icon: 'zap', w: `${app} raised it${n.floor ? ` on ${DATA.floors[n.floor].name}` : ' for every floor'}, as ${LEVELS[n.level].word.toLowerCase()}${n.urgent ? ', urgent' : ''}.`, tk: `${n.app} · level=${n.level}${n.urgent ? ' urgent' : ''} · key=${n.key || '—'}` });
  if (r.blocked) { H.push({ t: r.t, icon: RULES[r.blocked.rule].icon, rule: r.blocked.rule, w: `Stopped: ${r.blocked.why}`, stop: true }); return H; }
  H.push({ t: r.t, icon: 'route', w: `Addressed to ${addressOf(n).words.replace('you by name', nm(r.deliveries[0].p) + ' by name')}.`, tk: JSON.stringify(n.to) });
  for (const d of r.deliveries) {
    const p = P(d.p);
    if (d.via === 'cover') H.push({ t: tm(P(d.coverFor).away.from), icon: 'plane', rule: 'away', w: `${P(d.coverFor).name} went away (set ${P(d.coverFor).away.set}), naming ${nm(d.p)} as cover.`, set: P(d.coverFor).name });
    if (d.via === 'escalation') {
      const st = r.steps.find(s => s.k === d.step), prev = r.steps[r.steps.indexOf(st) - 1];
      if (st.early) { const pd = r.deliveries.find(x => x.passed && x.passed === d.sent); H.push({ t: d.sent, icon: 'forward', w: `${nm(pd.p)[0].toUpperCase() + nm(pd.p).slice(1)} passed it on: “${pd.note}”`, me: pd.p === me }); }
      else H.push({ t: d.sent, icon: 'timer', w: `Nobody had taken it by ${hhmm(d.sent)}${prev && prev.until === d.sent && r.steps.indexOf(prev) === 0 && n.limit ? ', its limit' : ''}.`, tk: `policy=${r.cls === 'urgent' ? 'urgent' : DATA.policy.name} step=${d.step}` });
      const skipped = r.steps.filter(s => s.skipped && s.at <= d.sent && s.k < d.step && s.k > (prev ? prev.k : 0));
      skipped.forEach(s => H.push({ t: s.at, icon: 'minus', w: `Skipped ${s.who === 'lead' ? 'the team lead' : s.who === 'rota' ? 'on call' : 'the admin'}: ${s.skipped === 'asked' ? `${nm(s.people[0])} had already been asked` : s.skipped === 'away' ? `${nm(s.people[0])} is away` : 'nobody holds it'}.` }));
    }
    const whyTold = d.via === 'escalation' ? (r.steps.find(s => s.k === d.step).who === 'rota' ? `on call on ${dayName(d.sent)}` : r.steps.find(s => s.k === d.step).who === 'lead' ? 'team lead' : 'Department admin') : d.via === 'cover' ? 'cover' : d.via === 'rota' ? `on call on ${dayName(d.sent)}` : d.via === 'team' ? 'on the team' : d.via === 'role' ? 'holds the role' : 'by name';
    H.push({ t: d.told, icon: CHANNELS[d.ch[0]].icon, rule: d.rule, me: d.p === me, w: `${nm(d.p)[0].toUpperCase() + nm(d.p).slice(1)} (${whyTold}): ${d.held ? `held from ${hhmm(d.sent)}, ` : ''}${d.rule === 'record' ? `into the ${hhmm(d.edition)} edition` : d.ch.map(c => CHANNELS[c].word.toLowerCase()).join(', ')}.`, tk: `rule=${d.rule} via=${d.via} ch=${d.ch.join(',')}` });
    if (d.seen != null) H.push({ t: d.seen, icon: 'eye', me: d.p === me, w: `${nm(d.p)[0].toUpperCase() + nm(d.p).slice(1)} saw it.`, quiet: true });
    if (d.taken != null) H.push({ t: d.taken, icon: 'hand', me: d.p === me, w: `${nm(d.p)[0].toUpperCase() + nm(d.p).slice(1)} took it: “${d.note || 'I have it.'}”`, key: true });
    if (d.acted != null) H.push({ t: d.acted, icon: 'check-check', me: d.p === me, w: `${nm(d.p)[0].toUpperCase() + nm(d.p).slice(1)}: ${d.act}.`, key: true });
  }
  if (r.resolved != null) { const sd = r.deliveries.filter(d => d.stoodDown != null); if (sd.length) H.push({ t: r.resolved, icon: 'user-check', w: `${sd.map(d => nm(d.p)).join(', ').replace(/^y/, 'Y')} stood down: it left ${sd.length > 1 ? 'their' : 'the'} Inbox with “${P(r.by).name} has it”.`, me: sd.some(d => d.p === me) }); }
  (r.reasks || []).forEach((t, i) => H.push({ t, icon: 'repeat', w: `Asked again${r.nobodyElse ? ' (nobody else to ask)' : ''}.`, quiet: true }));
  return H.sort((a, b) => a.t - b.t);
}

/* an app's notices, grouped by kind (the first part of the key) */
const kindOf = n => { const k = (n.key || '').split(':')[0]; const ks = A(n.app).kinds || {}; return k in ks ? k : ''; };
const kindWord = n => (A(n.app).kinds || {})[kindOf(n)] || 'Other';

/* one person's edition at time t: what it gathers since their previous edition */
function prevEdition(pid, t) { const em = mins(P(pid).digest), h = H(pid); for (let d = dayOf(t) - 1; d > dayOf(t) - 9; d--) { if (h.days.includes(((d % 7) + 7) % 7)) return d * DAY + em; } return t - DAY; }
function edition(pid, t) {
  const since = prevEdition(pid, t), ds = forPerson(pid);
  const record = ds.filter(d => d.rule === 'record' && d.edition === t);
  const quietList = ds.filter(d => d.rule === 'muted' && d.sent > since && d.sent <= t);
  const overnight = ds.filter(d => d.held && d.rule === 'quiet' && d.told > since && d.told <= t);
  const open = ALL().filter(r => (r.cls === 'needs' || r.cls === 'urgent') && r.deliveries.some(d => d.p === pid && d.told <= t && !(d.passed != null && d.passed <= t)) && !(r.resolved != null && r.resolved <= t));
  const done = ALL().filter(r => r.acted && r.acted.acted > since && r.acted.acted <= t && r.deliveries.some(d => d.p === pid));
  const onCall = DATA.rota.byDay[dayOf(t) % 7] === pid;
  const away = Object.keys(DATA.people).filter(p => awayAt(p, t) && P(p).team === P(pid).team);
  const covering = away.filter(p => P(p).away.cover === pid);
  const heard = new Set(ds.filter(d => d.sent > since && d.sent <= t).map(d => d.n.app));
  const silent = Object.keys(DATA.apps).filter(a => !heard.has(a));
  return { pid, t, since, record, quietList, overnight, open, done, onCall, away, covering, silent };
}
const words = s => String(s).replace(/<[^>]+>/g, ' ').split(/\s+/).filter(Boolean).length;
const readSecs = html => Math.round(words(html) / DATA.relay.readWpm * 60);

/* who the policy asks next, and when, seen from time t (whether or not it came to that) */
function nextAsk(r, t) {
  const done = r.steps.find(s => !s.skipped && s.at > t); if (done) return done;
  const cur = r.steps.filter(s => !s.skipped && s.at <= t).pop(); if (!cur || cur.until == null || cur.until <= t) return null;
  if (r.n.to.role) return null;
  const order = r.cls === 'urgent' ? DATA.urgentPolicy.steps : DATA.policy.steps.map(s => s.who).filter(w => w !== 'cover');
  const asked = new Set(r.deliveries.filter(d => d.told <= t).map(d => d.p));
  const from = order.indexOf(cur.who) + 1;
  for (const w of order.slice(Math.max(0, from))) {
    const pid = w === 'rota' ? rotaOn(cur.until) : w === 'lead' ? DATA.teams[DATA.rota.team].lead : Object.keys(DATA.people).find(id => P(id).admin === 'department');
    if (pid && !asked.has(pid)) return { people: [pid], at: cur.until, who: w, would: true };
  }
  return null;
}
