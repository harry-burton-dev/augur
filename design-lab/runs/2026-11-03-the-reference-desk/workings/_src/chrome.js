/* Shared chrome: the rail, the head, and the choices for every step (with the answer each would give). */
const UI = (() => {
  const { esc, BY } = E;
  const I = (n, s = 16) => Icons.svg(n, { size: s });
  function rail(keys) {
    return '<nav class="rail" aria-label="' + esc(DATA.app) + '"><div class="an">' + esc(DATA.app) + '</div>' +
      '<a class="nav on" aria-current="page">' + I("message-circle-question") + 'Ask</a>' +
      '<a class="nav">' + I("bookmark") + 'Saved questions<span class="n">4</span></a>' +
      '<a class="nav">' + I("shapes") + 'Kinds of thing</a>' +
      '<a class="nav">' + I("inbox") + 'Triage<span class="n">3</span></a>' +
      '<div class="foot"><span class="fl"></span>On <b>' + esc(DATA.floor.name) + '</b>, a Department. You see what is kept here and on ' + esc(DATA.floor.above) + '.</div>' +
      '<div class="keys">' + keys.map(k => '<span><span class="kbd">' + k[0] + '</span>' + k[1] + '</span>').join("") + '</div></nav>';
  }
  function byChip(by, short) { const b = BY[by]; return '<span class="by ' + by + '" title="' + esc(b.label) + '">' + I(b.icon, 12) + (short ? b.short : b.label) + '</span>'; }
  function gwChip(on) { return on ? '<span class="by model">' + I("bot", 12) + 'model gateway on</span>' : '<span class="by">' + I("power-off", 12) + 'model gateway off, so every step uses the record only</span>'; }
  function stamp() { return '<span class="stamp">Asked by <b>' + esc(DATA.person.name) + '</b> · ' + esc(DATA.asked.at) + ' · data as it is now</span>'; }

  /* options for one step: [{v, label, sub, on, n, disabled, why}] */
  function options(step, P) {
    const base = E.run(P).answer.length;
    const pv = f => E.preview(P, f);
    if (step === "since") return DATA.since.options.map(o => { const p = pv(Q => Q.since = o.v); return { v: o.v, label: o.label + " " + E.d(o.v).getFullYear(), sub: o.why, on: P.since === o.v, n: p.n, maybe: p.maybe }; });
    if (step === "status") return DATA.statuses.map(s => { const p = pv(Q => Q.status.has(s.id) ? Q.status.delete(s.id) : Q.status.add(s.id)); return { v: s.id, label: E.cap(s.label) + " contracts", on: P.status.has(s.id), n: p.n, multi: true, disabled: P.status.has(s.id) && P.status.size === 1, why: "Keep at least one" }; });
    if (step === "kinds") return DATA.kinds.map(k => { const p = pv(Q => Q.kinds.has(k.id) ? Q.kinds.delete(k.id) : Q.kinds.add(k.id)); return { v: k.id, icon: k.icon, label: E.cap(k.many), sub: DATA.sources[k.src].name + " · kept since " + E.dayShortY(DATA.sources[k.src].from), on: P.kinds.has(k.id), n: p.n, multi: true }; });
    if (step === "match") return DATA.matches.map(m => { const p = pv(Q => Q.match.has(m.id) ? Q.match.delete(m.id) : Q.match.add(m.id)); return { v: m.id, icon: m.icon, label: "By " + m.label, sub: m.model ? (P.gateway ? "Uses the model gateway: a guess" : "Needs the model gateway, which is off") : "Works without a model", on: P.match.has(m.id) && (!m.model || P.gateway), n: p.n, multi: true, disabled: m.model && !P.gateway, why: "Admin turns the model gateway on", model: m.model, tech: m.tech }; });
    if (step === "floor") return [{ v: "here", label: DATA.floor.name + " and " + DATA.floor.above, on: true, n: base, disabled: true, why: "Where you are" }, { v: "below", label: "Floors below, such as " + DATA.hidden.floor, sub: "Not yours to see: ask " + DATA.hidden.ask, on: false, n: null, disabled: true, unseen: true }];
    return [];
  }
  function apply(P, step, v) {
    if (step === "since") P.since = v;
    else if (step === "status") { if (P.status.has(v)) { if (P.status.size > 1) P.status.delete(v); } else P.status.add(v); }
    else if (step === "kinds") { P.kinds.has(v) ? P.kinds.delete(v) : P.kinds.add(v); }
    else if (step === "match") { P.match.has(v) ? P.match.delete(v) : P.match.add(v); }
  }
  const QUESTION = { since: DATA.since.asked, status: "Which suppliers do we still use?", kinds: "What counts as hearing from them?", match: "How should contacts be linked to a supplier?", floor: "Where should the desk look?" };
  function popHTML(step, P, base) {
    const os = options(step, P);
    let h = '<div class="ph"><span>' + esc(QUESTION[step]) + '</span><span>answer becomes</span></div>';
    for (const o of os) {
      const delta = o.n == null ? "" : o.n === base ? '<b>' + o.n + '</b>' : '<b>' + o.n + '</b> (' + (o.n > base ? "+" : "") + (o.n - base) + ')';
      h += '<button class="opt" role="menuitemcheckbox" data-step="' + step + '" data-v="' + o.v + '" aria-checked="' + !!o.on + '"' + (o.disabled ? ' disabled title="' + esc(o.why || "") + '"' : '') + '>' +
        '<span class="tick">' + (o.unseen ? '<span class="mk mk-unseen" style="width:var(--space-4)"></span>' : I(o.multi ? "check" : "check", 14)) + '</span>' +
        '<span>' + (o.icon ? '<span class="ico muted">' + I(o.icon, 14) + '</span> ' : '') + '<span class="' + (o.model ? 'guess' : '') + '">' + esc(o.label) + '</span>' + (o.sub ? '<small>' + esc(o.sub) + '</small>' : '') + (o.tech ? '<span class="tk">' + esc(o.tech) + '</span>' : '') + '</span>' +
        '<span class="c">' + (o.disabled && o.why && !o.unseen ? esc(o.why) : delta) + '</span></button>';
    }
    if (step === "kinds") h += '<div class="pf">' + I("bot", 12) + ' A model read “' + esc(DATA.heard.said) + '” as these; you confirmed. ' + esc(DATA.heard.fallback) + '</div>';
    if (step === "match") h += '<div class="pf">Matching by number, name and spelling is how ' + esc(DATA.app) + ' links records without a model. Only “meaning” asks the model gateway.</div>';
    if (step === "floor") h += '<div class="pf">' + E.cap(DATA.hidden.count) + ' suppliers kept on ' + esc(DATA.hidden.floor) + ' may fit. You can’t open that floor; ' + esc(DATA.hidden.ask) + ' can rerun this question there.</div>';
    return h;
  }
  /* place a popover under an anchor, inside a container */
  function place(pop, anchor, box) {
    const ar = anchor.getBoundingClientRect(), br = box.getBoundingClientRect();
    const edge = parseFloat(E.css("--edge")) || 24;
    let left = ar.left - br.left; const max = innerWidth - br.left - pop.offsetWidth - edge;
    pop.style.left = Math.max(0, Math.min(left, max)) + "px";
    let top = ar.bottom - br.top + 6; const room = innerHeight - ar.bottom - edge * 2;
    if (pop.offsetHeight > room && ar.top > pop.offsetHeight + edge) top = ar.top - br.top - pop.offsetHeight - 6;
    pop.style.top = top + "px";
  }
  /* a rolling number */
  const rolls = new WeakMap();
  function roll(el, to) {
    if (!el) return; const from = +(el.dataset.v || to); el.dataset.v = to; const me = (rolls.get(el) || 0) + 1; rolls.set(el, me);
    const t0 = performance.now(), dur = E.reduced ? 1 : E.ms("--motion-calm");
    (function f(t) { if (rolls.get(el) !== me) return; const p = Math.min(1, (t - t0) / dur); el.textContent = Math.round(from + (to - from) * (1 - Math.pow(1 - p, 3))); if (p < 1) requestAnimationFrame(f); })(t0);
  }
  return { I, rail, byChip, gwChip, stamp, options, apply, popHTML, place, roll, QUESTION };
})();
