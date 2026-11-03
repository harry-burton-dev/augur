/* The answer engine shared by all six variants. Everything it says comes from DATA. */
const E = (() => {
  const K = Object.fromEntries(DATA.kinds.map(k => [k.id, k]));
  const M = Object.fromEntries(DATA.matches.map(m => [m.id, m]));
  const ST = Object.fromEntries(DATA.statuses.map(s => [s.id, s]));
  const MON = ["January","February","March","April","May","June","July","August","September","October","November","December"];
  const css = n => getComputedStyle(document.documentElement).getPropertyValue(n).trim();
  const ms = n => parseFloat(css(n)) || 0;
  const reduced = matchMedia("(prefers-reduced-motion: reduce)").matches;
  const wait = t => new Promise(r => setTimeout(r, reduced ? Math.min(t, ms("--motion-quick")) : t));
  const esc = s => String(s).replace(/[&<>"]/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
  const d = s => new Date(s + "T12:00:00");
  const day = s => { if (!s) return ""; const x = d(s); return x.getDate() + " " + MON[x.getMonth()].slice(0, 3); };
  const dayY = s => { if (!s) return ""; const x = d(s); return x.getDate() + " " + MON[x.getMonth()] + " " + x.getFullYear(); };
  const dayShortY = s => { if (!s) return ""; const x = d(s); return x.getDate() + " " + MON[x.getMonth()].slice(0, 3) + " " + x.getFullYear(); };
  const daysBetween = (a, b) => Math.round((d(b) - d(a)) / 864e5);
  const list = (a, w = "and") => a.length < 2 ? (a[0] || "") : a.slice(0, -1).join(", ") + " " + w + " " + a[a.length - 1];
  const plural = (n, one, many) => n + " " + (n === 1 ? one : many);
  const sinceLabel = v => (DATA.since.options.find(o => o.v === v) || { label: dayY(v) }).label;

  function defaults() {
    return {
      since: DATA.since.value,
      status: new Set(DATA.statuses.filter(s => s.on).map(s => s.id)),
      kinds: new Set(DATA.kinds.filter(k => k.on).map(k => k.id)),
      match: new Set(DATA.matches.map(m => m.id)),
      gateway: true
    };
  }
  const clone = P => ({ since: P.since, status: new Set(P.status), kinds: new Set(P.kinds), match: new Set(P.match), gateway: P.gateway });

  /* Run the question. Returns each supplier's fate and the reason in plain words. */
  function run(P) {
    const R = { all: [], outStatus: [], answer: [], maybe: [], unknown: [], heard: [] };
    for (const s of DATA.suppliers) {
      const row = { s, notes: [] };
      R.all.push(row);
      if (!P.status.has(s.status)) { row.fate = "status"; row.why = "Contract " + ST[s.status].label + (s.ended ? " on " + dayShortY(s.ended) : s.paused ? " since " + dayShortY(s.paused) : ""); R.outStatus.push(row); continue; }
      const usable = [], ignored = [];
      for (const c of s.c) {
        const [kind, date, match, text] = c, o = { kind, date, match, text, model: M[match].model };
        if (!P.kinds.has(kind)) { o.skip = "kind"; ignored.push(o); continue; }
        if (!P.match.has(match)) { o.skip = "match"; ignored.push(o); continue; }
        if (M[match].model && !P.gateway) { o.skip = "gateway"; ignored.push(o); continue; }
        usable.push(o);
      }
      usable.sort((a, b) => b.date.localeCompare(a.date));
      row.usable = usable; row.ignored = ignored;
      row.last = usable[0] || null;
      row.lastFact = usable.find(c => !c.model) || null;
      if (!s.c.length) { row.fate = "unknown"; row.why = "No contact of any kind is recorded for them"; row.sure = "none"; R.unknown.push(row); continue; }
      const after = usable.filter(c => c.date >= P.since);
      const afterFact = after.filter(c => !c.model);
      if (afterFact.length) { row.fate = "heard"; row.by = afterFact[0]; row.why = cap(K[afterFact[0].kind].label) + " on " + dayShortY(afterFact[0].date); R.heard.push(row); continue; }
      if (after.length) { row.fate = "maybe"; row.by = after[0]; row.why = "Only a model's match links them to " + an(K[after[0].kind].label) + " on " + dayShortY(after[0].date); row.sure = "guess"; R.maybe.push(row); continue; }
      row.fate = "answer";
      row.why = row.last ? "Last: " + K[row.last.kind].label + " on " + dayShortY(row.last.date) : "Nothing that counts";
      // sureness: a source they usually use had a gap after the date
      row.sure = "sure";
      if (s.usual) { const src = DATA.sources[K[s.usual].src]; if (src.gap && src.gap[1] >= P.since) { row.sure = "less"; row.doubt = "They usually phone, and the " + src.name.toLowerCase() + " kept nothing from " + day(src.gap[0]) + " to " + day(src.gap[1]) + "."; } }
      for (const g of ignored) if (g.date >= P.since) row.notes.push(g.skip === "kind" ? cap(an(K[g.kind].label)) + " on " + day(g.date) + " doesn't count" : g.skip === "gateway" ? "A model's match on " + day(g.date) + " is off" : "A " + M[g.match].label + " match on " + day(g.date) + " is off");
      R.answer.push(row);
    }
    R.visible = DATA.suppliers.length;
    R.inScope = R.visible - R.outStatus.length;
    return R;
  }
  const cap = s => s.charAt(0).toUpperCase() + s.slice(1);
  const an = w => (/^[aeiou]/i.test(w) ? "an " : "a ") + w;

  /* The question said in a sentence, built from the steps (never written by a model). */
  function sentence(P, html = true) {
    const w = (t, cls, step) => html ? '<button class="w ' + (cls || "") + '" data-step="' + step + '">' + esc(t) + "</button>" : t;
    const st = DATA.statuses.filter(s => P.status.has(s.id)).map(s => s.label);
    const ks = DATA.kinds.filter(k => P.kinds.has(k.id)).map(k => k.label);
    return cap(DATA.kind.many) + " kept on " + DATA.floor.name + " or " + DATA.floor.above + ", with a " + w(list(st, "or") + " contract", "", "status") + ", with " + w("no " + (ks.length ? list(ks, "or") : "contact of any kind"), "guess-src", "kinds") + " from them since " + w(dayY(P.since), "", "since") + ".";
  }
  function tech(P) {
    return "FIND " + DATA.kind.tech + " ?o\n  WHERE floor(?o) IN (" + DATA.floor.type + ", org)\n  AND contract(?o).status IN (" + [...P.status].join(", ") + ")\n  AND NOT EXISTS contact ?c (\n    kind(?c) IN (" + [...P.kinds].join(", ") + ")\n    AND date(?c) >= " + P.since + "\n    AND linked(?c, ?o) BY " + DATA.matches.filter(m => P.match.has(m.id) && (!m.model || P.gateway)).map(m => m.id).join(" | ") + ")";
  }
  /* What the answer would be with one step changed: the consequence preview for every choice. */
  function preview(P, change) { const Q = clone(P); change(Q); const r = run(Q); return { n: r.answer.length, maybe: r.maybe.length, unknown: r.unknown.length, r }; }
  function diff(a, b) { // names entering and leaving the answer
    const A = new Set(a.answer.map(x => x.s.id)), B = new Set(b.answer.map(x => x.s.id));
    return { joined: b.answer.filter(x => !A.has(x.s.id)), left: a.answer.filter(x => !B.has(x.s.id)) };
  }
  const steps = [
    { id: "floor", plain: "Where to look", by: "desk", model: false },
    { id: "status", plain: "Who counts as a supplier we still use", by: "you", model: false },
    { id: "kinds", plain: "What counts as hearing from them", by: "model", model: true },
    { id: "match", plain: "How contacts are linked to a supplier", by: "desk", model: "part" },
    { id: "since", plain: "Since when", by: "you", model: false }
  ];
  const BY = { you: { label: "you chose", short: "you", icon: "user-round" }, desk: { label: "the desk's default", short: "the desk", icon: "library" }, model: { label: "a model's reading, you confirmed", short: "a model", icon: "bot" } };
  function hydrate(el) { if (window.Icons) Icons.hydrate(el || document); }
  return { an, K, M, ST, css, ms, reduced, wait, esc, day, dayY, dayShortY, daysBetween, list, plural, cap, sinceLabel, defaults, clone, run, sentence, tech, preview, diff, steps, BY, hydrate, d };
})();
