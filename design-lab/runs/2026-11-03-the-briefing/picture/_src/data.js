const DATA = {
  /* Sample data for one deployment. Every name, label, count and sentence template
     on the page comes from here; nothing below this object is a literal from chat. */
  org: { name: "Wealden and Coast Services" },
  floor: { tier: "department", name: "Fleet and Depots", word: "Department" },
  viewer: { name: "Priya Shah", initials: "PS", role: "Operator" },
  lead: { name: "Tom Okafor", role: "Head of Depots" },
  today: "2026-11-03",
  months: ["2025-05","2025-06","2025-07","2025-08","2025-09","2025-10","2025-11","2025-12","2026-01","2026-02","2026-03","2026-04","2026-05","2026-06","2026-07","2026-08","2026-09","2026-10"],
  areas: { north: "North", coast: "Coast", south: "South", east: "East" },
  /* incidents per month per site; null = no record arrived for that month */
  sites: [
    { id: "s1", name: "Northgate depot",   short: "Northgate",   area: "north", gx: 2, gy: 1, inc: [2,1,2,2,1,2,3,2,2,2,4,5,4,5,6,5,6,7] },
    { id: "s2", name: "Kettle Lane depot", short: "Kettle Lane", area: "north", gx: 3, gy: 1, inc: [1,1,0,1,1,1,2,1,1,1,3,3,4,3,4,4,5,4] },
    { id: "s3", name: "Harbour Road depot",short: "Harbour Road",area: "north", gx: 4, gy: 2, inc: [1,2,1,1,2,1,1,2,1,null,2,3,3,4,3,4,4,5],
      noRecord: { month: "2026-02", why: "the depot log didn't sync that month", who: "Sam Reid, depot admin" } },
    { id: "s4", name: "Saltmarsh depot",   short: "Saltmarsh",   area: "coast", gx: 1, gy: 3, inc: [1,0,1,1,0,1,1,1,0,1,1,0,1,1,1,0,1,1] },
    { id: "s5", name: "Pier Street yard",  short: "Pier Street", area: "coast", gx: 1, gy: 4, inc: [0,1,0,0,1,0,1,0,1,0,0,1,0,1,0,0,1,0] },
    { id: "s6", name: "Ashby Cross depot", short: "Ashby Cross", area: "south", gx: 2, gy: 4, inc: [2,1,1,2,1,2,2,3,2,2,2,1,2,2,1,2,2,1] },
    { id: "s7", name: "Millbrook transfer station", short: "Millbrook", area: "south", gx: 3, gy: 5, inc: [1,1,1,0,1,1,1,1,1,1,1,1,0,1,1,1,1,1] },
    { id: "s8", name: "Fenwick depot",     short: "Fenwick",     area: "east",  gx: 5, gy: 3, inc: [1,2,1,1,1,1,2,1,2,1,1,2,1,1,2,1,1,2] },
    { id: "s9", name: "Oldfield recycling centre", short: "Oldfield", area: "east", gx: 5, gy: 4, inc: [0,0,1,0,0,1,0,0,1,0,0,0,1,0,0,1,0,0] },
    { id: "s10", name: "Ridgeway yard", short: "Ridgeway", area: "east", gx: 4, gy: 4, inc: null,
      unseen: { keptBy: "Estates", ask: "Mina Lowe", floorWord: "Department" } }
  ],
  incidentKinds: [
    { id: "slip", word: "Slip or trip", plural: "slips or trips", icon: "footprints" },
    { id: "vehicle", word: "Vehicle damage", plural: "vehicle damage", icon: "truck" },
    { id: "near", word: "Near miss", plural: "near misses", icon: "triangle-alert" },
    { id: "injury", word: "Injury", plural: "injuries", icon: "bandage" }
  ],
  reporters: ["Ana Costa","Joe Marsh","Lena Novak","Rui Alves","Kit Barnes","Ola Nwosu"],
  vehicles: [
    { site: "s1", status: ["in","in","off","in","shop","in","off","in"] },
    { site: "s2", status: ["in","in","off","in","in","in"] },
    { site: "s3", status: ["in","in","in","in","in"], checked: "2026-09-23" },
    { site: "s4", status: ["in","in","in","in"] },
    { site: "s6", status: ["in","shop","in","in","in","in"] },
    { site: "s8", status: ["in","in","off","in","in"] }
  ],
  noFleet: { sites: ["s5","s7","s9"], why: "keeps no vehicles of its own" },
  reader: { name: "Tom Okafor", role: "Head of Depots", when: "Monday briefing" },
  vehicleStatus: { in: "Can go out", shop: "In the workshop", off: "Off the road" },
  contracts: [
    { supplier: "Coastline Waste Ltd", value: 1840 },
    { supplier: "Greaves Fleet Services", value: 960 },
    { supplier: "Brightwater Cleaning", value: 620 },
    { supplier: "Harlow Fuel Cards", value: 410 },
    { supplier: "Medway Tyres", value: 280 },
    { supplier: "Tidy Grounds", value: 190 },
    { supplier: "Kestrel Pest Control", value: null, gap: { who: "Dev Patel, Procurement" } }
  ],
  event: { month: "2026-03", date: "2 March 2026", word: "night rounds started", cause: "the new night rounds", doc: "Night rounds: new shift pattern" },
  documents: [
    { id: "d1", title: "Night rounds: new shift pattern", app: "Artifacts", date: "2026-02-20" },
    { id: "d2", title: "Depot safety report, October", app: "Artifacts", date: "2026-11-01" }
  ],
  intents: [
    { id: "i1", title: "Bring depot slips down by a third by 31 March 2027", owner: "Tom Okafor", app: "Mandate" }
  ],
  recordSet: { word: "Incidents", one: "incident", lower: "incidents", from: "depot incident logs and inspection reports", source: "Depot incident log" },
  periods: { last3: "in the last three months", last1: "in October 2026" },
  /* Claims an operator might bring, for the demo (key C cycles them) */
  claims: [
    { text: "Incidents at all the depots have gone up since March", slots: { what: "all", where: "all", verb: "rose", when: "2026-03" } },
    { text: "Northgate has the most incidents lately", slots: { what: "all", where: "s1", verb: "most", when: "last3" } },
    { text: "Slips fell after the night rounds started", slots: { what: "slip", where: "all", verb: "fell", when: "2026-03" } },
    { text: "Things are calmer on the coast this year", slots: { what: "all", where: "coast", verb: "steady", when: "2026-01" } }
  ],
  /* Questions an operator can ask, each with the one picture that answers it. */
  questions: [
    { id: "worse",  ask: "Is it getting worse?",           form: "line",   formWord: "A line over time",            tech: "line · monthly count · zero-based",
      why: "Your question is about time, so time runs left to right. One line, from zero, so a rise isn't made to look bigger than it is." },
    { id: "big",    ask: "Which is biggest?",              form: "bars",   formWord: "Bars, longest first",          tech: "horizontal bar · sorted · zero-based",
      why: "Lengths are the easiest thing to compare. Longest first, names written out, every bar starting at zero." },
    { id: "where",  ask: "Where is it happening?",         form: "tiles",  formWord: "One tile per site, roughly where it is", tech: "tile map · equal area · sequential ink",
      why: "Each site gets the same size tile, placed roughly where it is. A shaded map would make big places look important for being big." },
    { id: "many",   ask: "How many?",                      form: "count",  formWord: "Count with symbols",          tech: "isotype · 1 symbol = 1 record",
      why: "One symbol is one incident, so you can count them. Symbols repeat; they never grow." },
    { id: "after",  ask: "Did it change after something?", form: "slope",  formWord: "Before and after",            tech: "slope chart · two means",
      why: "Each depot is one line from its monthly average before to its average after. Lines that climb are the ones that changed." },
    { id: "same",   ask: "Is it the same everywhere?",     form: "multiples", formWord: "Small pictures, same scale", tech: "small multiples · shared y",
      why: "One small picture per depot, all on the same scale, so you compare shapes, not axes." }
  ],
  /* Charts never offered to an operator, and why, in plain words. */
  never: [
    { word: "Pie or doughnut", why: "Angles are hard to compare. A count with symbols shows the share and the number.", tech: "pie, donut", icon: "chart-pie" },
    { word: "Anything in 3D", why: "Depth changes how big things look. Nothing is gained.", tech: "3D bar, 3D pie", icon: "box" },
    { word: "Two scales on one chart", why: "Two lines on different scales can be made to cross anywhere, so they suggest links that aren't there.", tech: "dual axis", icon: "chart-spline" },
    { word: "Gauges and dials", why: "A number dressed as a car dashboard. Say the number.", tech: "gauge, speedometer", icon: "gauge" },
    { word: "Bigger symbols for bigger numbers", why: "People read area, not height, so a symbol twice as tall looks four times as big. Repeat symbols instead.", tech: "scaled icons, bubbles", icon: "circle" },
    { word: "Bars that don't start at zero", why: "A cut axis turns a small difference into a big one.", tech: "truncated axis", icon: "chart-no-axes-column" },
    { word: "Layered areas", why: "Only the bottom layer can be read.", tech: "stacked area, streamgraph", icon: "chart-area" },
    { word: "Shaded maps of raw counts", why: "Big places look important because they are big. Every site gets the same size tile.", tech: "choropleth (unnormalised)", icon: "map" }
  ],
  notHere: { word: "Does one thing go with another?", why: "Two things moving together isn't one causing the other. This needs an analyst.", where: "Explorer", who: "the Data team", tech: "scatter, correlation" },
  /* IPCC and UK probability yardstick words, ranges in percent */
  yardstick: [
    { word: "Almost certain", lo: 95 }, { word: "Highly likely", lo: 80 }, { word: "Likely", lo: 55 },
    { word: "A realistic possibility", lo: 25 }, { word: "Unlikely", lo: 10 }, { word: "Highly unlikely", lo: 0 }
  ],
  /* Sentence templates. The finding on every chart is filled from these; a model never writes a title. */
  templates: {
    trend: "{measure} {verb}, from about {a} to {b} a month, since {since}",
    flat: "{measure} held steady at about {a} a month",
    trendWhere: "{share} of the rise is at the {group} depots: {names}",
    trendConf: "{word} to be a real rise, not chance: {kText} months since {since} were higher than any month before",
    big: "{top} had the most {measure} {period}: {v}, {x} times {second}",
    bigClose: "{top} had the most {measure} {period}: {v}, just ahead of {second} ({v2})",
    where: "{pct} of {measure} {period} were at the {area} depots",
    many: "{n} of {N} vehicles can't go out today; {k} of them are at {site}",
    after: "{measure} rose at {k} of {N} depots after {event}; most at {top}",
    afterGroup: "{measure} at the {group} depots went from {a} to {b} a month after {event}",
    same: "Not the same everywhere: {k} depots rose, {m} held steady",
    bigMoney: "{top} is the biggest contract: {v} a year, {pct} of all contract spend",
    manyInc: "{n} {measure} {period}; {k} of them were {kind}",
    whereSub: "Same size tile for every site. {measure} {period}.",
    bigSub: "Three-month totals, {from} to {to}.",
    countConf: "Counts, not estimates: each one is a record you can open",
    afterConf: "{word} that {cause} caused it: the rise starts that month, but nothing here tests why",
    claimChange: "{what} at {where} {verb} since {when}",
    claimMost: "{where} has had the most {what} {when}",
    verdicts: { yes: "True", part: "Partly true", no: "Not true" },
    verbs: { rose: "have risen", fell: "have fallen", steady: "have held steady" },
    whyPart: "True for {where} taken together, but only because of {k} of {N}: {names}. The other {m} held steady.",
    whyNo: "They {actual}, from about {a} to {b} a month.",
    whyYes: "Every depot in it agrees.",
    noRecord: "No record for {month} at {site}: {why}. The total for that month isn't known, so the line breaks.",
    unseen: "{site} is kept by {keptBy}. Its incidents are not counted here. Ask {ask}."
  }
};
