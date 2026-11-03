# Surface 2 · The shape of what we keep

Data Atlas's front page as the ontology made readable. An operator on a
Department floor (Operations) arrives and sees the kinds of thing, how many of
each, how they connect and where knowledge is thin, before any one record.

All six pages share one sample ontology in a single `DATA` object (a regional
services org: people, suppliers, sites, service areas, vehicles, equipment,
incidents, contracts; invoices kept on Finance; inspections kept on the Depot
North team floor below; routes and permits in the ontology but not kept;
"Depots" and "Qualifications" asked for by sources). They also share the same
**kind card** (the right-hand drawer): what a kind is, who looks after it,
each detail with how many records have it and who could fill the rest, its
links as sentences, what relies on it (intents in Mandate, documents in
Artifacts), and the technical names one step down (`T`). Only the picture
changes between variants. That was deliberate: the card is the explanation,
the picture is the map you choose from. The pages are generated from `_src/`
(`python3 _src/build.py`). Shared parts are in `common.css` and `common.js`,
and each variant has its own `vN-*.src.html`.

Floors in every variant: the strip under the title says where you are, what
you can see (this floor and the Org floor above) and what is out of reach
(Finance, a sibling department, and Depot North, the team floor below). Kinds
kept out of reach are always drawn, with a lock, the floor's name and who to
ask. Their counts are not shown, because the count itself may be private to
that floor.

The gap mark: a detail a kind expects but a record lacks is an **empty
socket**. That is a hairline outline with a faint hatch, filled from the left
by how many records have it. It is lighter than wear and time's stale hatch
and different from its "no record". "No record" is a stretch of *time* the
history doesn't cover. A gap is a *slot* the structure has room for that
nobody has filled. Same family (both are honest blanks), different marks. A
kind that is in the ontology but kept by nobody is a third case, the
**predicted gap** (dashed, "nobody keeps any yet").

---

## V1: Floor plan (`v1-floor-plan.html`)
*Idea.* The library floor plan. Each kind of thing is a room, sized by how
many are kept. Inside are shelves, one per detail, filled to how many records
have it. Upstairs (Org) and this floor (Operations) are two storeys, with the
links running through "the hall" between them as corridors. Locked rooms
(Finance, Depot North) and rooms "on the plan, never built" (routes, permits,
words sources asked for) sit in an annexe.

*Sources.* Library floor plans and shelf maps, Chen's ER (rooms as entities),
Bertin (size = quantity).

*What works.* Floors are literal, so "upstairs is kept for everyone, you can
read it" lands at once. Shelves make the gap obvious: a half-empty shelf reads
as "half the vehicles don't say who drives them". The annexe makes "locked"
and "never built" visible without alarm. Each room carries "N waiting in
triage · N thin shelves".

*What fails or risks.* The hall is the weakest part. Twelve corridors in a
narrow band tangle, and labels only work for the selected room. Room width
follows count (a sqrt, shared with an even share), so tiny kinds (38 service
areas) look as important as big ones; that's honest about *kinds*, less
honest about volume. It doesn't scale past roughly 6 kinds per storey: a real
CCO profile with 30 kinds needs a second rung. The metaphor breaks when a
floor has many sub-floors.

*Principles.* Explain, never hide: strong (locked rooms with who to ask, never
built rooms). Calm: nothing moves at rest. Focus stacking: the selected room
lights and others desaturate, so the far plane recedes. No letterbox needed.

*Needs.* `--x-proposed-gap-ink`, `--x-proposed-gap-fill`,
`--x-proposed-known`, `--x-proposed-reach-out` (shared, below). The kit needs
a "room" container. Data: counts per kind per floor, fill % per detail.

*New employee test.* **Passes, mostly.** "Rooms, shelves, upstairs, locked"
needs no teaching. The hall is ignored on day one, which is fine because the
card carries the links.

*Words.* kinds of thing → class · details (shelves) → data/object property ·
links (corridors) → object property · upstairs/this floor → floor (Org,
Department) · locked room → out-of-scope floor · never built → unadopted
class · thin shelf → low fill rate.

*Scores.* Clarity 4 · Distinctiveness 4 · Feasibility 3 · Fit 4

## V2: Table of kinds (`v2-periodic-table.html`)
*Idea.* A periodic table of the kinds of thing. Columns are the big families
(people and organisations, places, things we run, things that happen,
agreements and papers). Rows are floors: Org, then Operations, then "out of
reach", then "not kept yet". Each square has a two-letter symbol, the count
(top left), how much is known (top right), brightness by how well known, and
one bar per detail with its empty part as the gap. The layout predicts what's
missing, as Mendeleev's did: an empty row segment is explained in words ("No
people or places are kept on Operations: they're kept once, on the floor
above, so this row is empty on purpose"). The predicted kinds sit in their
family's column, dashed.

*Sources.* Mendeleev's periodic table (gaps that predict), Ranganathan (a
fixed set of facets: family × floor), Isotype's legend-in-the-gap.

*What works.* It's the best at "what kinds exist and where they live" in a
single glance. The legend sits where the periodic table puts its own, in the
empty first-row run, with a made-up "Ab" square so it never reads as a real
kind. When a square is selected, its linked squares show the verb and the %
in place of their bars ("← is based at · 93%"). The "not kept yet" row is the
first place an operator can *see* a hole in the ontology and ask for it.

*What fails or risks.* Symbols ("Ve", "Eq") are a gimmick for operators. They
help only if they're stable and short, and many deployments will collide
("Co" for contracts and contacts). Drop them or derive them from an admin
field. Families need curating: CCO's top level (Agent, Site, Artifact,
Process, ICE) must be renamed per deployment. Links are weak: they appear only
on selection, so it shows *what* rather than *how things connect*. It needs
more height as families grow. At about 10 columns it is too wide for
1280×800.

*Principles.* Explain, never hide: very strong, since the empty spaces carry
words. Calm: yes. Focus stacking: dim and desaturate the rest on selection.

*Needs.* Same gap tokens. Data: a **family** per kind (an admin-chosen top
level, mapped from CCO), a symbol or short name per kind, counts per floor.
The tile could become an Aerie/Quill "kind tile" component.

*New employee test.* **Passes.** People recognise "a table where position
means something" from school, and the key sits right there. Symbols are
skipped and names are read.

*Words.* family → upper-level class (cco:Agent, bfo:Site …) · kind → class ·
square's bars → properties with fill rate · not kept yet → class in profile,
not adopted · asked for ×14 → term requested by sources (triage) · out of
reach → other floor.

*Scores.* Clarity 5 · Distinctiveness 5 · Feasibility 4 · Fit 4

## V3: Readers' diagram (`v3-readers-diagram.html`)
*Idea.* An ER diagram drawn for readers, not modellers. Boxes are kinds:
Bertin's size = how many, value (brightness and a fill bar) = how much is
known, hue = which floor, dashed texture = kept elsewhere. Lines are verbs
written on the line in plain words ("is based at"), with weight = how many
links, dotted = fewer than 70% say, and an arrowhead for which way the
sentence reads. On focus each line adds "93% of vehicles say". The most-linked
kind sits in the middle (Chen's hub), and every other kind is on a ring
grouped by family. The layout is deterministic for any ontology.

*Sources.* Peter Chen (1976) ER diagrams, Bertin's *Semiology of Graphics*
(size, value, texture, hue), business ER as drawn on whiteboards.

*What works.* It's the only variant where *how things connect* is the main
subject. Every line is a readable sentence, and the legend teaches the
reading ("read each line as a sentence: a vehicle is based at a site"). The
hub layout makes "almost everything is about a site" visible, which is a real
insight about this org.

*What fails or risks.* Edges cross the hub (vehicle ↔ person runs through
Sites), and at 15+ kinds it becomes a hairball. That's the classic failure,
and it needs filtering ("only links of the selected kind") or a second rung.
Verb labels collide near the hub at rest. Floors are only hue, so "where it's
kept" is weaker than in V1/V2. The SVG font sizes and stroke widths are
literal px (12, 15, 1–4.5) and need tokens if adopted.

*Principles.* Explain, never hide: good (dashed boxes say where and who).
Calm: yes. Focus stacking: rack focus works well here, since the unlit graph
drops to 12–30%.

*Needs.* Gap tokens; a diagram type scale for SVG labels
(`--x-proposed-diagram-label`). Data: link counts and coverage per kind of
link, and direction.

*New employee test.* **Half.** At rest it reads as "a diagram", which
intimidates non-technical people. Once a box is selected, the sentences make
it legible. Better as the second view, "how things connect", than as the
front page.

*Words.* box → class · line → object property (verb = its label) · arrow →
domain → range · line weight → number of assertions · dotted → low coverage ·
dashed box → class on another floor.

*Scores.* Clarity 3 · Distinctiveness 3 · Feasibility 4 · Fit 3

## V4: Contents page (`v4-contents-page.html`)
*Idea.* The contents page of an encyclopedia, with no boxes at all. Parts are
floors: Part One is Northvale Regional Services (Org, kept once for
everyone), Part Two is Operations (kept here). Each entry is a kind of thing,
with leader dots to its count, a one-line description, its steward, how much
is known and how many are waiting. Its details follow as run-in sub-entries;
a thin one is *italic* with a small hatched socket. "See:" lines are the
links ("is based at Sites; Incidents involved these"). A third column holds
"Other volumes" (kept elsewhere, ask whom), an "Appendix: not yet written"
(predicted kinds) and an **index of links**, A to Z, as in the back of a book.

*Sources.* Encyclopaedia contents pages, Dewey/UDC schedules, the
back-of-book index, Ranganathan's "see also", hierarchy without containers
(weight, size, rhythm).

*What works.* It's the most legible for a non-technical reader: everyone can
read a contents page, and it scales to 40 kinds by scrolling, not shrinking.
It holds the most information of any variant (every detail with its %), yet
stays calm. Cross-references are clickable: clicking a "see" name turns to
that entry. The index of links is a genuinely new way in ("what *involves*
anything?"). It is the cheapest to build, since it's text and a list.

*What fails or risks.* No picture, so relative size ("people outnumber
vehicles 3 to 1") must be read from numbers, not seen. Long "See:" lines get
dense for hub kinds (Sites has five). "See" names are spans inside a button:
for keyboard users they need to be their own focus stops. Heavy text may look
"like documentation" to people expecting an app.

*Principles.* Explain, never hide: strong ("See the Finance volume … Ask Priya
Nair"). Calm: maximal. Focus: lit entry plus its neighbours; others drop to
40%.

*Needs.* Gap tokens; italics as a meaning ("thin") needs to be in the grammar
sheet. Data: a description and steward per kind (the ontology's
`rdfs:comment` rewritten in plain words, which is an admin task).

*New employee test.* **Passes best.** Nothing to learn; the italic + hatch
convention is stated in the header.

*Words.* part → floor · entry → class · sub-entries → properties · "see" →
object property · index of links → property list · other volumes → other
floors' classes · appendix, not yet written → unadopted classes and requested
terms.

*Scores.* Clarity 5 · Distinctiveness 3 · Feasibility 5 · Fit 5

## V5: Line map (`v5-line-map.html`)
*Idea.* A Beck-style line map. Kinds are stations; floors are fare zones
(Zone 1 Org above, Zone 2 Operations where you are, Zone 3 Depot North below
and "closed from here", Finance a closed zone beside). Lines are **chains of
links that read as one sentence**, generated from the ontology by covering
every kind of link with directed chains, longest first. Chains that start at
the same kind are branches of one line, as on the Northern line. Examples:
"An invoice is against a contract, which is with a supplier, which has a
contact person, who works at a site, which is in a service area." A thin link
is drawn hollow, like "limited service". Planned stations are the kinds not
kept yet.

*Sources.* Harry Beck's Underground diagram (1933): octilinear routing, zones,
interchange rings, "limited service", "under construction".

*What works.* The line descriptions are the best plain-language statement of
the structure anywhere in this run, and they come automatically from the
ontology. Zones make floor reach intuitive ("Zone 3 is closed from here").
Hollow track for thin coverage is a lovely, familiar mark.

*What fails or risks.* The geometry is generic, and generic Beck maps aren't
beautiful. Beck's map was hand-drawn for years, and an automatic octilinear
layout will always have awkward diagonals and crossings. Lines are an
artefact of the algorithm, not something the org recognises. A named line
("Commercial line") would need an admin to curate it, or should come from
real questions people ask (which Mandate's intents could supply). It needs a
categorical colour set the tokens don't have yet. It's the most gimmicky of
the six over a working day.

*Principles.* Explain, never hide: good (closed stations say who). Calm: yes.
Light: the lit station uses the green ring, matching "you are here".

*Needs.* `--x-proposed-line-1..6` (categorical, not floor, not status: a real
token set and an ADR-level decision about category colours). Data: link
direction (domain → range) for every kind of link.

*New employee test.* **Half.** People can read the map, but "what does riding
a line mean?" needs the side panel's sentences. The sentences pass; the
picture alone doesn't.

*Words.* station → class · line → property path (chain of object
properties) · interchange → class on several paths · zone → floor · limited
service → coverage below threshold · planned station → unadopted class.

*Scores.* Clarity 3 · Distinctiveness 5 · Feasibility 2 · Fit 3

## V6: Every record (`v6-every-record.html`)
*Idea.* The overview rung. All 6,914 records are drawn, one cell each, grouped
into a block per kind and split into two bands by floor. The cell size is the
same for the whole page, so the blocks' *areas* are honest about volume.
Brightness is how many of that record's details are known. A record missing
most of its details is a hollow socket. Hovering a cell says what it lacks
and who could fill it. Selecting a kind opens a lens ("Vehicles · show which
lack: Mileage · 343"), which turns exactly those records into lit hollow
cells. Kept-elsewhere and not-kept kinds are holes with words in a side
column.

*Sources.* The overview rung (Bret Victor's ladder of abstraction), Tufte's
micro/macro, wear and time's library V4 (one cell per document).

*What works.* It's the only variant where "thin" is *seen* rather than read:
the vehicles block visibly peppers with hollow cells under the Mileage lens.
Volume is unmistakable (people and equipment dwarf everything). It works at
any size (canvas, about 7k cells, cheap), and it's the natural bridge from
shape to records: the next click is a list of exactly those 343 vehicles.

*What fails or risks.* At rest it says "how much" far better than "what kinds
connect": links appear only as dimming on selection. Cell-level hover is
fiddly at 6px. At 100k records the cell drops below 2px and needs
aggregation (one cell = 10 records), which changes its meaning. The
completeness ordering inside a block is a choice. It reads as a heat-map, and
some operators will ask "what's the colour?" before the legend.

*Principles.* Explain, never hide: holes for out-of-reach and never kept; the
hollow socket for missing. Calm: at rest it's a still texture, nothing moves.
Focus stacking: dimming the non-neighbours.

*Needs.* `--x-proposed-overview-cell` / `--x-proposed-overview-gap` (shared
with wear and time's library V4), gap tokens. Data: **per-record
completeness against the details a kind expects**, which Atlas doesn't
compute today, plus a "which records lack detail X" query.

*New employee test.* **Passes with the legend.** "Each square is one vehicle;
hollow means we don't know much about it" lands quickly. Inferring links
from it doesn't.

*Words.* cell → individual (entity) · block → class extension · brightness →
completeness over expected properties · hollow → individual missing most
expected properties · lens → property-absence query.

*Scores.* Clarity 4 · Distinctiveness 4 · Feasibility 4 · Fit 4

---

## Shared proposed tokens ("needs token")
- `--x-proposed-gap-ink`: outline of a gap socket (ink at 26%).
- `--x-proposed-gap-fill`: faint hatch inside a gap (ink at 7%). It is
  lighter than wear and time's stale hatch on purpose.
- `--x-proposed-known`: how much is known, as light (ink at 78%, never
  `--light`).
- `--x-proposed-reach-out`: edge of something kept on a floor you can't see
  (dashed, muted).
- V5 only: `--x-proposed-line-1..6`, a categorical set for lines. Category
  colours need their own decision.
- V6 only: `--x-proposed-overview-cell`, `--x-proposed-overview-gap`.
- V3/V5 SVG labels use literal 11–15px font sizes; they need a diagram type
  scale.
- All variants lean on `--font-mono` for counts (IBM Plex Mono still needs an
  ADR).

## Data Atlas would need (doesn't give today)
1. Counts per kind **per floor**, and whether a floor's count may be shown
   off-floor. That decides between "count not shown" and the real number.
2. **Expected details per kind** and the fill rate of each. That needs a
   "required/expected" flag on properties in the profile, which CCO doesn't
   carry.
3. Link counts and coverage per kind of link (% of the domain kind that has
   at least one).
4. A plain-word label, plural, singular, one-line description and steward per
   kind (`skos:prefLabel` / `rdfs:comment` rewritten for operators).
5. A **family** per kind (an admin-mapped upper level) for V2 and V3's
   grouping.
6. Unadopted classes in the profile, and terms sources asked for (from
   Triage), with counts.
7. Who to ask for each floor's data (a steward per floor).

## Which ontology words operators may see
Shown: "kinds of thing", "details", "links", "kept on <floor>", "known",
"waiting in triage", "not kept yet". Only behind `T` (admins, one step down):
class, property (data/object), domain/range, CCO/BFO identifiers, OWL,
profile, adopted. Never shown to operators: **"Artifact"**. CCO's
`cco:Artifact` (here "Equipment") collides with the Artifacts app, so the
word must be renamed in every deployment's plain labels.

## Ranked
1. **V4 Contents page**: most legible on day one, scales by scrolling, cheapest, calmest.
2. **V2 Table of kinds**: best single-glance "what exists and where", and it makes predicted gaps visible.
3. **V6 Every record**: the only one where thinness is *seen*, and the bridge into records.
4. **V1 Floor plan**: warm and literal about floors; the link hall doesn't hold.
5. **V3 Readers' diagram**: the right *second* view (how things connect), not the front page.
6. **V5 Line map**: the generated sentences are a keeper; the map itself isn't.

## What I'd build first
Ship V4's contents page as the Data Atlas front page, with V2's two best
ideas inside it: the rows-are-floors structure, with its sentence explaining
an empty row ("kept once, on the floor above"), and the "not kept yet" row as
the appendix. Put V6's every-record block one rung down: clicking an entry's
count opens that kind's cells with the "show which lack" lens, which leads
straight into a filtered list. Keep V5's line sentences as the "See:" text,
since generated chains read better than a list of verbs. Use V3's diagram as
an optional "How things connect" tab for admins and curious operators. The
shared kind card (drawer) should become the one Atlas component every variant
relies on. Before any of this, Atlas needs per-kind expected details and fill
rates; without them, the honest gap can't be drawn.

**Where I went beyond the ask:** the shared kind card, the `T` toggle for
ontology words, the "Artifact" naming collision, and the predicted-gap mark
for unadopted kinds and terms requested in Triage.
