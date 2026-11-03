# Surface 2: the fact at three heights

One entity's key fact (Northgate Depot's overdue inspections, on the
Facilities department floor) as a sentence, a picture and its records,
moving between them in place. All six variants share one data object
(`_src/data.js`: a site, its eleven-inspection regime, sixteen visits with
their source documents, a lost stretch of time, a dispute, peers, a
contract, two intents) and one set of helpers (`_src/common.js`). Counts,
lateness and history are worked out from the visits; nothing is typed in.
`python3 _src/build.py` assembles the pages; `_src/shoot.js` takes
screenshots after key presses.

The fact the data was built to test: three overdue for certain, a fourth
where two sources disagree (*likely*), two due soon, and one each of
not known yet, not yours to see and doesn't apply. Plus a stretch with no
record (Feb to Mar), so a fire alarm test that fell due inside it is
"can't say", not overdue.

Every variant keeps the carried vocabulary: the six ways to be empty (the
corner ticks, the 135° hatch with a lock and whom to ask, the wavy break,
the quiet "doesn't apply"), the yardstick words (*almost certain*,
*likely*), the two registers on T, and pencil and ink in V6.

---

## V1: The ladder (`v1-ladder.html`)
*Idea.* There are three rungs (sentence, picture, records), and the stage
shows one at a time. "Your place" is one inspection, held in the rail.
Each height draws itself around it: the phrase that contains it is lit in
the sentence, its symbol in the picture and its row in the records. Moving
up and down with ↑↓ never drops it, and ←→ moves the place sideways at any
height.
*Sources.* Bret Victor, "Up and Down the Ladder of Abstraction"; BLUF (the
sentence is the top rung); Isotype for the picture (one symbol per
inspection, grouped by state, counted and never scaled).
*What works.* It is the clearest mental model of the six: three named
heights and a held thing. The held line under the sentence ("Your place:
Fire doors, inside 'three inspections overdue'") answers "where is my
thing in this summary?", which is the whole point of the ladder. The
picture's title is its finding. The records height pairs a table with the
held item's visits and sources, and shows the lost stretch as a wavy break
in the fire alarm's history.
*What fails or risks.* Only one height is visible at a time, so the
reader can't compare the sentence with the picture without stepping.
The sentence height leaves the lower half of the screen empty at 1600×900.
The transition (a short vertical travel and a crossfade) is plain.
*Principles.* Calm: nothing moves at rest. Explain, never hide: each
empty state has its own symbol, and the hidden lift names Marta Kowal
right in the picture. No letterbox, which is right for a non-urgent fact.
*Needs.* `--x-proposed-lit` (your place), a held-selection contract in the
shell (the held id survives height changes), and the sentence handles
(`data-ref`) as a kit part.
*New employee test.* **Pass.** A manager reads the sentence in seconds and
the picture in under a minute, and "The records" is a word they already
know.
*Model or template.* All text comes from templates: the headline, the
picture's title and each item line. No model writes here.
*Score.* Clarity 5 · Distinctiveness 3 · Feasibility 5 · Fit 4

## V2: The symbol unfolds (`v2-isotype-unfold.html`)
*Idea.* The picture is an Isotype count over time: each month-end column
stacks one symbol per overdue inspection, and the chart's title is its
finding ("went from none at the end of August to three, and probably
four, today"). Any symbol unfolds where it stands into its record card:
the state at that month, a lane of the same inspection across all months,
then the visits and their sources. The chart rack-focuses behind it.
*Sources.* Otto and Marie Neurath's Isotype and the transformer; Our World
in Data's titles that state the finding; the catalogue's honest empties.
*What works.* The counting reads at once: you can count three red symbols
without an axis. The no-record column and the "can't say" symbols in
March and April are the most honest picture of lost time in the run. The
**transformer's note** (why this picture, what one symbol is, what the
picture leaves out and why, who made it) turns "how do you know?" into
something on the page. The unfold keeps your place literally, because the
card grows out of the symbol.
*What fails or risks.* The card covers part of the chart. Over time only
the overdue states are drawn, so "due soon" is missing at this height.
Months with nothing in them read as empty ground, softened only by the
word "none".
*Principles.* Explain, never hide: strong, both the not-in-the-picture
list and no record. Focus stacking: the rack focus behind the card.
Calm: yes.
*Needs.* A statusAt(entity, date) service in Data Atlas (state as of a
past date, from visits), the no-record window as data, the transformer's
note as a kit part.
*New employee test.* **Pass.** The title is the answer, and the symbols
count themselves.
*Model or template.* The title, the sub-line and the card sentences are
templates. A model could propose *which picture to draw* (the transformer
role), shown in pencil in the note, but it never draws the counts.
*Score.* Clarity 4 · Distinctiveness 4 · Feasibility 4 · Fit 4

## V3: Stretchtext (`v3-stretchtext.html`)
*Idea.* There is only the paragraph. Every phrase is a handle that
stretches in place. "Three inspections overdue" grows into the three names
with word-size lateness bars. Each name grows into a lifeline (last done,
then due, then today), the visit, its source document and its record id.
↑ shrinks the phrase again. What a stretch added sits between ⟨ ⟩, one
size smaller and one step quieter. A gauge on the left shows how far down
the paragraph has gone.
*Sources.* Ted Nelson's stretchtext; Tufte's sparklines (pictures at word
size, inside sentences); Bret Victor.
*What works.* It is the purest form of "in place". The reader's eye
never leaves the sentence, and the records arrive inside the claim they
support. The word-size bars and lifelines are legible at a glance and
cost nothing. The disputed hoists show both sources side by side
mid-sentence, with *likely* next to them. Of all six, this one is closest
to a briefing you could paste.
*What fails or risks.* Fully stretched (E twice) it becomes a wall of
mixed sizes. The tall line boxes of the parent paragraph make deep
stretches airy. It is hard to scan, and comparing two items means reading
both. Screen readers need careful `aria-expanded` handling (done) and
announcements. It needs a real inline layout engine to stay tidy in
Quill.
*Principles.* Calm: it only grows when asked. Explain, never hide: the
gap and the hidden lift stretch into their whom-to-ask. No focal planes.
*Needs.* The sentence tree as data: each template slot knows its
expansion (a "stretch" per slot in the sentence template), and the
sparkline marks as kit parts.
*New employee test.* **Pass at one stretch, fail at full stretch.**
Managers read the first sentence and one opened phrase easily. Fully
opened, they lose the thread.
*Model or template.* All templates. A model must never write a stretch,
because the stretch is the evidence.
*Score.* Clarity 4 · Distinctiveness 5 · Feasibility 3 · Fit 4

## V4: The detail dial (`v4-detail-dial.html`)
*Idea.* There is one vertical control with four stops: one number, one
bar, a line each, every visit. The same eleven elements (one per
inspection) move between the stops. They gather into the number, line up
as the bar's cells, then become lanes on a shared timeline (due ticks,
late segments, today, the lost stretch as a hatched band). At the last
stop each visit carries its date and record id. The sentence stays at the
top at every stop.
*Sources.* Bret Victor (abstracting over a parameter with a control);
Heer and Robertson's animated transitions (object constancy); Tufte
(small multiples as lanes).
*What works.* Object constancy is real: you watch the extinguishers'
cell become its lane. The lane height is the best picture of the run
for "how late, since when": a lead sees the late red tails line up
against today. Hidden, gap and doesn't-apply lanes span the timeline
with their own marks and words. Holding an inspection lights it at every
stop.
*What fails or risks.* "How much detail" as a dial is abstract for an
operator; they will press the stops, not drag. At 1280×800 the visit
labels crowd, so ids are dropped below a row height. The number stop
repeats the headline. Animating `left/top/width/height` on many elements
won't scale past a few dozen, so it needs FLIP transforms.
*Principles.* Calm: movement only on a change. Explain, never hide:
strong in lanes. No focal planes. The dial echoes the radial menu's
"fixed directions", up being always more abstract.
*Needs.* `--x-proposed-unit`; a timeline lane kit part; a per-entity
time series from Data Atlas (due dates per regime item).
*New employee test.* **Pass at stops 1 to 3**, borderline at 4 on a small
screen.
*Model or template.* All templates and drawing. No place for a model.
*Score.* Clarity 4 · Distinctiveness 4 · Feasibility 3 · Fit 4

## V5: Rack focus (`v5-rack-focus.html`)
*Idea.* All three heights stay on screen as planes: sites like it (one
step up, small multiples of the same eleven-cell row), this site, and its
records. ↑↓ pull focus between them. The far planes blur a little,
desaturate and fold to a short, faded strip, but they never go.
*Sources.* AUGUR's own focal planes and rack focus (cinematic run); Hans
Rosling (is this unusual? compare); Tufte's small multiples.
*What works.* It adds the rung that most briefings need and the others
lack: *above* the entity ("the most overdue of the five sites you can
see; Hilltop has two, Eastfield one"). The locked Southmoor row says
"some" and names whom to ask, as the catalogue settled. It fits the house
language best.
*What fails or risks.* Blurred text is still text you can't read, and the
reader must pull focus to read the sentence of another plane. The left
rail's three stops don't line up with the planes. Three planes at
1280×800 leave the records cramped.
*Principles.* Focus stacking: a direct use. Calm: yes. Explain, never
hide: the far planes stay visible and labelled.
*Needs.* A peer set (same kind, same floor, counted by the same template)
from Data Atlas; counts across floors that are safe to show ("some");
`--x-proposed-rack-blur`.
*New employee test.* **Borderline.** The comparison helps, but the blur
reads as "disabled" to someone new.
*Model or template.* Templates only. A model could suggest the peer set
("sites like it"), in pencil, for a person to confirm.
*Score.* Clarity 3 · Distinctiveness 3 · Feasibility 4 · Fit 5

## V6: The lead's questions (`v6-the-leads-questions.html`)
*Idea.* After the bottom line come the questions a lead asks, as six
fixed buttons: Which ones? (picture), How do you know? (records), Since
when? (picture over time), Is that unusual? (one step up), Why? (pencil)
and What now? (use it). Each answer is drawn at the height its question
needs. The questions you ask, in the order you ask them, build the
briefing on the right: the bottom line first, then a section per question,
ready to publish to Artifacts.
*Sources.* BLUF and the staff appreciation (the order a busy reader
needs); pencil and ink (reference desk); the IPCC and UK probability
yardstick.
*What works.* The heights get plain-word names. "How do you know?" is
the records, and nobody has to learn "abstraction". It holds every other
variant's best part: V1's picture, V2's history, V5's peers and V3's
evidence lines. **Why?** is the one place a model writes: in pencil, with
three links to records (the contract that ended, the last service, the
intent past its deadline), "Accept as a note" and "Set aside". G turns
the gateway off: the same records appear in ink, and no number changes.
**What now?** shows the reach first (Dana first, then 23 people; the
intent's owner; only you).
*What fails or risks.* The answers pile up and scroll, so the first
answer can scroll out of view. Fixed questions may not fit every fact (a
budget fact needs "compared to what?"), so the set must come from the
kind of fact. The buttons wrap onto two lines.
*Principles.* Explain, never hide: strong, including the Why? that
refuses to guess when the gateway is off. Calm: yes. No focal planes yet
(the answers could rack-focus).
*Needs.* A question set per kind of fact (data, not code); the briefing
assembly in Artifacts (sections from answers); "watch for change" from
Data Atlas and the events service (a count-changed event per saved
question); `--x-proposed-pencil`.
*New employee test.* **Pass, best of six.** A manager reads the bottom
line, then the questions they would have asked anyway.
*Model or template.* The bottom line and every answer are templates (ink).
The model writes only the *Why?* reason, in pencil, always tied to the
records it cites. It may also suggest which question to ask next, but it
never answers one.
*Score.* Clarity 5 · Distinctiveness 4 · Feasibility 4 · Fit 4

---

## Ranked
1. **V6 The lead's questions**: the heights named by questions, and the
   asking is the briefing.
2. **V3 Stretchtext**: the purest "in place", and the evidence sits in
   the sentence.
3. **V1 The ladder**: the clearest model, and the held place.
4. **V4 The detail dial**: object constancy and the best lane picture.
5. **V2 The symbol unfolds**: the transformer's note and honest history.
6. **V5 Rack focus**: the one-step-up rung is essential; blur as the
   carrier is not.

## What I'd build first
A small kit part, **the sentence with handles**, comes first. The bottom
line is built from a template whose slots each carry a reference
(`state:overdue`, `item:ext`) into the picture and the records, plus one
**held place** (an entity id) that every height lights. Every variant here
is that part plus a different way to change height, so it is the shared
foundation and cheap in Quill. On top of it I'd build V6's six questions
as the default way down for operators, with V3's one-step stretch for a
single phrase, V1's "Your place" line, V2's transformer's note under any
picture and V5's peer rung as the "Is that unusual?" answer. The dial (V4)
waits until the timeline lane exists as a kit part.

## Needs token (all mixes of kit tokens, in `_src/common.css`)
- `--x-proposed-overdue`, `--x-proposed-overdue-wash`: overdue is the one
  lit state (softened danger).
- `--x-proposed-settled`: in date, ink at rest.
- `--x-proposed-lit`, `--x-proposed-lit-wash`: your place across heights.
- `--x-proposed-unit`: the Isotype unit cell.
- `--x-proposed-rack-blur`: far plane blur (V2 card, V5).
- Carried: `--x-proposed-gap*`, `--x-proposed-unseen`,
  `--x-proposed-disagree*`, `--x-proposed-pencil*`, `--x-proposed-quiet`,
  `--x-proposed-type-micro`, `--x-proposed-here`.
- `--font-mono` is used for record ids, keys and yardstick words, and
  still needs an ADR.

## Data the shell doesn't have
The state of an entity at a past date, from its observations
(`statusAt`); declared no-record windows; an inspection regime per site
(expected details with a cadence); the template text for each sentence
slot and each stretch; a peer set per kind and floor, with safe counts;
a question set per kind of fact; and a count-changed event for "watch".
