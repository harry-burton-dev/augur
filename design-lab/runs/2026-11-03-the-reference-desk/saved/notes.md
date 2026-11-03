# Saved and shared questions: critique

Surface 6 of the reference desk. A question as an object you keep, rerun,
share to a floor and watch; it says when its answer last changed and whether
a rerun uses the data as it was then or as it is now (time as an address),
and it shows what a colleague on another floor sees when they rerun it.

**One question runs through all six.** Sam Okafor (operator, Facilities, a
Department floor) asked *"which suppliers have we not heard from since
spring?"* on 12 Oct 2026. It was sharpened to "Suppliers with a contract
running on the day whose last email, call, meeting or invoice query was
before 1 March 2026", shared to the Org floor on 27 Oct, and rerun by Priya
Nair (Finance, a Department floor beside his) on 3 Nov. Every count, row and
reason is computed by one `answer(who, asOf)` function from the sample data
object at the top of each page; nothing is typed in. The data was chosen so
the hard cases happen on their own:

- **Same count, different rows.** Asked on 12 Oct: 8. Now: 8. Halden Fleet
  left (a 9 Sep meeting was logged late, on 22 Oct) and Northgate Skips
  joined (its contract started 27 Oct). A watch that compared only counts
  would have said nothing.
- **Different access, different answer.** Priya gets 7, and three suppliers
  read differently: meeting notes are kept on Facilities (Sam can open them,
  Priya can't); invoice queries are kept on Finance (the other way round).
- **A model's guess.** One meeting note mentions "Brightwater team"; the
  model matched it by meaning. It is drawn dashed and blue-tinted, and it is
  not counted until someone confirms it.

Built from `_src/` (`python3 _src/build.py`): shared `data.js`, `common.css`
and `common.js`, plus each variant's own parts. Every output page stands
alone and links the kit exactly.

## The model gateway on this surface

The same split holds in all six. A **rerun never asks the model.**

| Step | Needs the model gateway? |
|---|---|
| Turning "since spring" into 1 March 2026 | No. It uses the deployment's list of calendar words. The person picks the date, and it is stored as a fixed date. |
| Turning "heard from" into four kinds of contact | Yes, the first time only. The model suggested the kinds and Sam chose them. The choice is stored as words, so a rerun or a share carries the choice, not a model call. |
| Matching supplier names in meeting notes | Mostly no: company number, then spelling (pg_trgm). Matching by meaning uses the model, and the match is stored as a **guess** that isn't counted until someone confirms it. Without the gateway, that one match doesn't exist, and the page says names were matched by key and spelling only. |
| Rerunning, "as it was then", watching, diffing, the five reasons, the share preview | No. Rules over stored records. Every record keeps the day it arrived (`logged`), so any day can be rerun exactly. |

**Guess or fact:** a fact is solid, upright and plain. A guess is always
italic, inside a dashed blue-tinted edge, tagged `GUESS` with the `cpu`
icon, and never counted. The "heard from" blank in the sentence keeps a
dashed underline for good, because the model suggested it, even though a
person confirmed it.

## What a question must keep to be rerun honestly

All six assume the same record (listed in `DATA.question.keeps`):

1. the words asked;
2. each choice that sharpened them: who chose, when, and whether the model
   suggested it;
3. the steps, as rules Data Atlas runs;
4. the moment it was asked (for "as it was then");
5. which version of Data Atlas's words it used (kinds and details), so a
   change in what a word means shows up as its own reason;
6. whose access each run used.

When the question is shared, its rows are **never** carried with it.
"As it was then" needs Data Atlas to keep two dates on every fact: when it
happened and when it arrived. Halden's 9 Sep meeting arriving on 22 Oct is
the whole case for this.

---

## V1: The date-due slip (`v1-date-due-slip.html`)
*Idea.* The question is a library catalogue card: the words in quotes, the
sentence, the pencilled notes on how each word was sharpened, and the steps.
The card is the same for every reader. Beside it, a date-due slip collects a
stamp for every run: date, who, count, and "same", "changed" or "data as of
12 Oct" (sepia). A stamp from someone else's run is hatched and says "their
answer is theirs". On screen, this morning's watch stamps the slip, then
Priya's rerun lands as a stamp Sam can't read.
*Sources.* Library date-due slips and catalogue cards; rubber stamps;
Dervin and Dewdney's reference interview (the pencilled clarifications).
*What works.* "Stamped, same" is the calmest possible way to say "nothing
moved", and operators get it at once. The card makes the record of the
question visible: words, choices, steps, watch. The A/N switch in the answer
shows that both versions give 8, with different suppliers.
*What fails or risks.* Three columns are a lot on 1280×800. The stamp
metaphor stops working past about 30 runs (it would need folding, as V2
does). The small stamp rotations are decorative. The card and the slip
compete for the eye.
*Principles.* Explain, never hide: the other person's stamp is shown and
says why it can't be read. Calm: one stamp is pressed per run, and nothing
moves at rest. No letterbox. No focus stacking.
*Needs.* `--x-proposed-then` (sepia) and `--x-proposed-guess`. Two dates on
every fact. A run log per question, kept per reader.
*New employee test.* Pass. "It's like a library card; each stamp is a time
it was checked."
*Model gateway.* Only the "heard from" clarification (as history). Reruns
and stamps work without it.
*Score.* Clarity 4 · Distinctiveness 4 · Feasibility 4 · Fit 3.

## V2: The register (`v2-register.html`)
*Idea.* An attendance register: suppliers down the side, runs across the
top, one mark per supplier per run. A run of marks that stops or starts
shows exactly when a supplier left or joined. Click any mark and the right
pane tells that supplier's story across the runs, each change with its
reason and source. A "Tell me when" picker shows, beside each choice, how
often it would have told you since the question was asked (2×, 1×, 3×).
Press A to add a column "as it was when asked" in sepia. On screen, today's
column fills in like someone taking a register, then Priya's column arrives
hatched.
*Sources.* School attendance registers, ships' muster rolls, git log.
*What works.* It's the most honest "same count, different rows" view: the
counts row says 8 8 8 7 8 8, and the marks show the 8s aren't the same.
Every mark explains itself (the object explains itself). The watch preview
is a consequence preview for a notification setting, and it's new. The six
empty marks carry over: the corner ticks mean no contact logged, the dot
means no contract.
*What fails or risks.* Wide: past about 12 runs it needs folding (built: a
note saying quiet mornings are folded away). Past about 200 rows it needs
grouping. Analysts will love it, and some operators will find the grid dense
at first.
*Principles.* Explain, never hide (hatched columns, the folded mornings are
named). Calm. No letterbox.
*Needs.* A stored answer per run (ids only), or the two-date facts to
recompute one. `--x-proposed-join`.
*New employee test.* Pass, after one look at the key. "Ticks for who was on
the list each day."
*Model gateway.* None at all. The guess mark comes from the stored match.
*Score.* Clarity 5 · Distinctiveness 4 · Feasibility 4 · Fit 4.

## V3: Two clocks (`v3-two-clocks.html`)
*Idea.* Time as an address, made literal. One time axis, two lines. The
lavender line is the question's own "since 1 March", fixed by its words. The
green line is "what we knew on": drag it, or use ←/→, and records that
arrived later fade to dashed outlines, even when they are about earlier
days. A late record draws a sepia leader from the day it happened to the day
it arrived ("logged 22 Oct"). The run window (12 Oct to now) is opened out
under the chart as its own slider, with the moments that move the answer
marked on it. The panel shows the address in words ("Q-118 · as known on
3 Nov · with Sam's access") and as a link. On screen, the green line glides
from the day it was asked to today, and Halden and Northgate swap.
*Sources.* Bitemporal data (Snodgrass), accounting "as at" dates and
prior-period adjustments, Shneiderman's dynamic queries.
*What works.* It's the only variant that makes "as it was then" versus "as
it is now" feel physical. The late-record leader explains the hardest case
in one stroke. "Link to this moment" is time as an address you can share.
*What fails or risks.* Two kinds of time on one axis takes a sentence of
explanation, so an operator needs the clock boxes above the chart. The run
window is a sliver of the year, which is why the opened-out slider exists,
and that is a second scale to read. Heavy on the DOM if there are many
suppliers and contacts (needs virtualising). Not for every day: it's the
"why did this change?" deep view.
*Principles.* Focus: the lit green line is the lit navigation path. Explain,
never hide (unknown-yet records stay as outlines). Calm: it moves only when
dragged.
*Needs.* The two dates on every fact, and on links and contracts as well.
`--x-proposed-then` and `--x-proposed-lit`. A shell-level "as known on"
address (concept time-as-address).
*New employee test.* Partial. They follow the glide, but "what we knew"
against "when it happened" needs saying once.
*Model gateway.* None. The guess dot is drawn from the stored match.
*Score.* Clarity 3 · Distinctiveness 5 · Feasibility 3 · Fit 4.

## V4: Two desks (`v4-two-desks.html`)
*Idea.* The same question at two desks, side by side, with rows lined up by
supplier, so a difference sits on one line and the gutter says why ("Meeting
notes: only Sam"). Above, "Who can open which floor" shows each source's
floor with a check or a hatched lock per person. A rack focus pulls between
the desks: the far desk blurs and desaturates, with no black scrim. The page
says plainly that **nobody sees both desks**: it's a review view, for us
and for admins. On screen, focus pulls to Priya's desk, her rerun fills line
by line, then both desks sharpen and the gutter fills.
*Sources.* Split screen in film, diff tools, the focal planes (cinematic
run).
*What works.* It answers "what does a colleague on another floor see?"
directly, and shows that the only reason two answers differ is access: same
question, same day. Each desk keeps "some" and whom to ask, so neither leaks
the other's rows.
*What fails or risks.* It can't ship for operators as built, because Sam
must never see Priya's rows. Its real home is Admin ("explain access for
this question") or a self-check with a made-up reader ("someone on Finance
only"), which V5 does. The blur is pretty but costly on long lists.
*Principles.* Focus stacking (the rack focus), explain-never-hide (the
access map). Calm. Conflicts with nothing, but it is a review tool.
*Needs.* `--x-proposed-far-blur`. An admin permission to "view as a floor".
Access per source.
*New employee test.* Pass. "Same question, two people, here's why the lists
differ."
*Model gateway.* None.
*Score.* Clarity 4 · Distinctiveness 4 · Feasibility 3 · Fit 4.

## V5: Share with a preview (`v5-share-preview.html`)
*Idea.* Sharing is choosing a floor in a stack of floors (Org at the top: up
is towards Org). The floors you aren't on stay listed, hatched, with whom to
ask. Choosing a floor previews what its people get when they rerun it: how
far each source reaches ("Meeting notes: 54 of 412"), which of your
suppliers will read differently for them and how ("Halden: heard from → in
the answer"), and a choice between **share the question** and **share your
answer as it is today**. The fixed copy is refused for any floor where some
people can't open a source behind your rows, and it says why and what to do
instead. On screen, the share moves up from Facilities to the Org; the
preview changes, and the fixed-copy option goes hatched with its reason.
*Sources.* Consequence preview (cinematic radial menu), printer's proofs,
mail-merge preview.
*What works.* It turns the access problem into a decision before sharing,
not a surprise after. It shows people counts per floor (safe), never
anyone's rows. The "fixed copy" rule settles when a snapshot may travel.
*What fails or risks.* Less distinctive: it's a good dialog. The "will read
differently" list uses a typical reader with only that floor's access; real
readers sit on many floors, so it is an estimate and should say so (it says
"for anyone who isn't also on Facilities"). People counts on large floors
need the identity service.
*Principles.* Consequence preview, explain-never-hide (floors you're not on,
and why the copy is refused). Calm.
*Needs.* People per floor and its teams (identity rollup). The source floor
for every fact. A "fixed copy" object marked "as it was on".
*New employee test.* Pass. Best of the six for "what happens if I click
this?".
*Model gateway.* None. It says sharing asks no model, and that the one
model-suggested choice travels as words.
*Score.* Clarity 5 · Distinctiveness 3 · Feasibility 4 · Fit 4.

## V6: Why it changed (`v6-why-it-changed.html`)
*Idea.* Watching, done calmly. Home shows "Your questions" and "Questions on
your floors" with no marks when nothing has changed. When the watch finds a
change, one line arrives at the top, then folds into a thin seam on that
question's row. Open the question and it gives an account in **five
reasons an answer can move**, always all five, with a count each:
*something happened* (Northgate's contract started); *we learned about the
past* (Halden's late meeting, with "See it as it was on 12 Oct"); *different
access* (0: "your access hasn't changed; when someone else reruns it, their
answer can differ for this reason"); *a guess was settled* (1 waiting: the
Brightwater guess, with "It's them / Not them"); *a word changed meaning*
(0). The header says "8 → 8, 1 joined, 1 left. The count alone would have
hidden it."
*Sources.* Press-cutting bureaus (one cutting per change, sent once),
newspaper corrections columns (a fixed list of kinds of correction),
tide-table errata. Carries the catalogue's "change arrives as work" and
"visible repair" (notice, then seam).
*What works.* It's the clearest answer to "says when its answer last
changed". Five reasons is a small, fixed vocabulary, and the zero rows teach
what *could* change. It splits world change from late knowledge from access
from model from ontology, which is exactly what an operator needs to trust
it. Dark when normal.
*What fails or risks.* Needs the reason worked out per supplier (built here
from the two dates, the contract dates and the floors). Edge cases with two
reasons at once need a rule (proposed: name the earliest in the chain). The
account is long on a small screen.
*Principles.* Calm (dark when normal; told once; seam). Explain, never hide
(zero reasons shown, dashed). No letterbox: a change to a saved question is
never urgent unless an intent depends on it, which could steer the letterbox
later.
*Needs.* The five reasons as a fixed list (a decision). An ontology version
per run. A "last looked" per person per question. Home lines from Data
Atlas's watch.
*New employee test.* Pass, strongest. "It tells you once, and it tells you
why."
*Model gateway.* None for the watch. The guess row comes from an earlier
model match, and settling it is a person's job.
*Score.* Clarity 5 · Distinctiveness 4 · Feasibility 4 · Fit 5.

---

## Ranked

| # | Variant | C | D | F | Fit | Total |
|---|---|---|---|---|---|---|
| 1 | V6 Why it changed | 5 | 4 | 4 | 5 | 18 |
| 2 | V2 The register | 5 | 4 | 4 | 4 | 17 |
| 3 | V5 Share with a preview | 5 | 3 | 4 | 4 | 16 |
| 4 | V3 Two clocks | 3 | 5 | 3 | 4 | 15 |
| 5 | V1 The date-due slip | 4 | 4 | 4 | 3 | 15 |
| 6 | V4 Two desks (admin review) | 4 | 4 | 3 | 4 | 15 |

## What I'd build first

The **question record** that every variant assumes (words, the choices with
who chose them and whether the model suggested them, steps as rules,
asked-at, words version, access per run, and never the rows when shared),
and **two dates on every fact** in Data Atlas (when it happened and when it
arrived). Without those, nothing here can be honest. On top of that, V6's
watch with the **five reasons** as the default view of a saved question,
with V2's register one click down as its history ("show every run"). V3's
green line becomes a control inside the register (the A key: "as it was
when asked"), not a separate screen. Use V5's preview as the share dialog,
including the rule that a fixed copy goes only where every reader can open
every source. Keep V4 for Admin as "explain this question's access". **Where
I went beyond the ask:** the watch's "how often would it have told you"
preview (V2), and refusing fixed copies by source reach (V5). Both need
Harry's yes.

## Pushes back / decisions for Harry
1. **Share the question, not the rows** (as built): a shared question
   carries words and steps. Each reader reruns it with their own access.
   Should a fixed copy ever cross floors? Proposed: only where every reader
   can open every source behind it.
2. **Hidden differences say "some"** (from the catalogue). V4 shows exactly
   which rows differ, but only as an admin/review view. Per-row "may differ"
   flags for operators would leak which suppliers have records on other
   floors.
3. **Five reasons** as a fixed list for every "changed" notice in Data Atlas
   (and later Artifacts and Mandate).
4. **The watch compares rows, not counts**, by default. Counts hide swaps.
5. **Relative words are fixed once chosen** ("since spring" stays 1 March
   2026). "On the day" (contract running) moves with each run. The card
   says which is which. Rolling periods ("in the last 6 months") would need
   a visible "rolls" marker.

## Needs token (all mixes of kit tokens)
`--x-proposed-guess` and `-guess-wash` (a model's guess: dashed, info
tint), `--x-proposed-then` and `-then-wash` (sepia "as it was"),
`--x-proposed-join` and `-join-wash` (joined since last run),
`--x-proposed-leave`, `--x-proposed-lit` and `-lit-wash`,
`--x-proposed-here`, `--x-proposed-unseen` (135° hatch), `--x-proposed-gap`
(corner ticks), `--x-proposed-hatch`, `--x-proposed-quiet`,
`--x-proposed-type-micro`, `--x-proposed-far-blur` (V4 rack focus).
Layout alias `--x-namew` in V3, built from `--measure-rail`. V1's stamp
rotations (±0.6°) are plain degrees, decorative. Every variant relies on
`--font-mono` (still needs an ADR).

## Data the shell and Data Atlas don't have yet
Two dates on every fact, link and contract (happened and arrived); the floor
each source is kept on; saved questions with runs (stored per reader, ids
only); an ontology version per run; "last looked" per person per question;
model matches stored as guesses with confirm and reject; people per floor
with teams (identity rollup); a Home line from a Data Atlas watch.
