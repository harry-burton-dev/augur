# Combined V1: One question, a week later (`v1-one-question-a-week-later.html`)

The required walk. Sam Okafor (operator, Facilities, a Department floor) types
*"which suppliers have we not heard from since spring?"* into the one box on
Data Atlas's front page on 27 Oct. Six steps follow on one screen, with a
timeline along the foot: **1 Ask · 2 Sharpen · 3 Answer · 4 Save · 5 Share ·
a week · 6 A week later**. The demo plays steps 1 to 3 from 1.2 s (typing, the
draft, the two questions answered) and stops on the answer with its workings.
`→`/`←`, `1`–`6` or a click on the timeline walks the rest; **W** jumps to the
week later. **G** turns the model gateway off, **T** shows technical words,
**R** replays. Deep links for checking: `#s=1` … `#s=5`, `#w`.

Built from `_src/a/` (`python3 _src/a/build.py`): one shared `DATA` object
(Vale Regional Services, 21 suppliers, two sources on two floors, the lost call
log, the saved question, the walk), shared with V2. Every count, row, split and
reason comes from one `run(viewer, day, choices, gateway)` function. Nothing is
typed in.

*Idea.* The reference interview in the order a good librarian works: answer
first, then ask only what would change the answer, then show the workings, then
let the question travel without its rows. **Draft at once** (ask V5): before a
single question, the page says "7 to 12" and marks the 5 rows that depend on a
loose word in amber. **Ask only what changes** (ask V1 + V4): four words are
loose; "since spring" splits 3 rows and is asked first, "suppliers" splits 2
and is asked second, "heard from" and "we" split none and are settled for you,
saying so. Each choice shows its count before you pick it, in calendar order,
none ticked, with **K keep it loose** always allowed. **The answer with its
workings** (workings V1, cant V1, workings V2): the template-built sentence, an
ink count, the base line ("Covers 16 of the 18 it applies to. For 2 we can't
say yet. Some are kept on Depot operations"), the balance under a double rule
("20 you can see = 7 + 9 + 1 + 1 + 2 ✓"), and a method card of six steps, each
with who set it. Model guesses sit in their own pencil lane beside the rows,
never in them. **Save** (saved V6 record): words, choices with who chose them,
steps, when asked and the word list then, whose access; the rows struck
through as "never kept". **Share** (saved V5): a floor stack with Org on top;
choosing Finance previews what its 22 people can open, and that 1 of Sam's 7
(Dunmore Waste, kept on Facilities) will read as "some, not yours to see"; the
fixed copy is refused with its reason. **A week later** (saved V6): Priya Nair
(Finance) reruns it with her own access and gets 5. The notice says 7 → 5 and
lists all five reasons with a count each: something happened 1 (Kestrel
Security emailed on 30 Oct), different access 1 (kept on Facilities, "ask Ade
Bello"), and three zeros.

*Combines.* Ask V5 (draft answer, "depends"), V1 (one question at a time, the
base component), V4 (biggest split first; no-difference words settled).
Workings V1 (method card), V2 (the balance), V6 (pencil lane). Cant V1 (base
line), the catalogue's empty marks (corner ticks, wavy break, 135° hatch).
Saved V6 (five reasons), V5 (share preview, fixed-copy refusal), V2 (rows, not
counts, decide "changed"). Grammar V3 (provenance never washes out: the dotted
"heard from" keeps Sam's initials, SO, for good).

*Sources.* Dervin and Dewdney's neutral questioning (1986); Shneiderman's
dynamic queries (counts on every choice); recipe and method cards; opinion-poll
base lines; bank reconciliation; press-cutting bureaus and corrections columns
(a fixed list of kinds of change); the cinematic run's consequence preview.

*What works.*
- **One screen holds the whole life of a question.** The answer column stays
  put while the side changes job (sharpen, workings, save, share, why it
  changed), so the person never loses the count while doing the next thing.
  The timeline makes "a week later" a place you can go, not a story.
- **Nothing is asked that doesn't matter.** Two questions instead of four, and
  the two that are skipped say why ("0 rows change"). The draft answer means
  the person sees *why* spring matters before being asked: Harrow Electrical
  and Quarry Lane are amber, a fortnight either side of the line.
- **The arithmetic can't hide anything.** Every supplier Sam can see is on
  exactly one line, the sum is shown, and "balances" is checked by the page.
  The base line is a sentence Sam can repeat to a manager.
- **Ink and pencil are never confused.** The 7 doesn't move when **G** is
  pressed. Only the pencil lane changes: "meeting 4 Apr may be them" becomes
  "1 meeting matched nobody · in Triage". The dotted "heard from" survives
  Sam's agreement, with his initials beside it.
- **The rerun is honest without anyone explaining access.** Priya never sees
  Dunmore's name. She sees that one row went away for "different access", who
  to ask, and the share request button. The rerun line says it asked the model
  0 times; at step 6 **G** changes nothing at all, which is the proof.
- **Going beyond the ask:** steps you chose are clickable on the method card
  ("Keep those with a contract running" reopens its question with counts), so
  the workings are also the editor.

*What fails or risks.*
- **Sam's count travels with the question**, so Priya can work out that
  exactly one hidden supplier differs (7 − 1 − 5). The catalogue's rule is
  "some", never a number. Built here as "1" because the arithmetic is on the
  screen anyway; it needs a decision (see Open questions).
- **Density.** At 1280×800 the answer's group lines and the side's last card
  scroll; the timeline drops its second line. The draft step is the busiest
  moment: amber sentence, range, 12 rows and three question cards at once.
- **Two dates per fact are assumed.** "Something happened" versus "we learned
  about the past" is computed from `on` and `logged`; Data Atlas keeps one.
- **The share preview speaks for "anyone on Finance only".** Real readers sit
  on several floors, so the counts are a floor-level estimate (as saved V5
  warned).
- **The walk is a demo shape.** In the product, steps 1–5 are one page on
  Sam's screen and step 6 is Priya's, reached from a Home line; the timeline
  is for Harry and the docs, not a control people would use.

*Principles.* Explain, never hide: every empty line names its kind and its
errand (Triage job for Joy Mensah; nobody can close it; ask Marta Kowal; ask
Ade Bello for access); the refused fixed copy says why. Calm: the demo types,
deposits once and stops; re-renders after the first don't re-animate; the
change notice is told once; nothing loops. Focus stacking: only the open
question is lit (floor-coloured edge and glow); answered questions fold to one
line. Letterbox: not used (nothing here is urgent; a changed answer that an
intent in Mandate depends on could earn it later).

*Needs.*
- Tokens (all `--x-proposed-*`, in `_src/a/common.css`): `pencil`,
  `pencil-wash`, `pencil-line` (the one guess mark: info mixed toward ink,
  1px dotted, italic, never colour alone); `ink`; `loose`, `loose-wash`;
  `here`, `here-soft`; `lit`, `lit-wash`; `leave`; `quiet`; `type-micro`;
  `gap-ink`, `gap-tick`, `gap`, `unseen`, `wave` (the catalogue's marks).
- `--font-mono` (IBM Plex Mono) is used for counts, balances, cues and
  technical lines. It still needs its ADR.
- Kit parts: a pencil-lane column for any Quill table; a "by" chip (you,
  Data Atlas rule, key and spelling, word list, model's reading); the
  double-rule balance line; the five-reasons list.

*What Data Atlas would need to serve it* (docs/atlas.md today has entities,
observations with sources, floors, Triage and matching by keys, names and
spelling):
1. **A count endpoint per choice**: "how many rows if spring = 1 April", fast
   enough to price every choice before it is picked (a few queries per
   keystroke at Data Atlas sizes).
2. **A deployment word list** (calendar words like "spring" and "financial
   year", and "contact" = which event kinds), owned by an admin and versioned,
   so clarifications can be raised and settled without a model.
3. **Last contact as a computed detail**: the latest dated observation per
   supplier across Data Atlas and Artifacts, with its source and floor.
4. **Two dates on every observation** (when it happened, when it arrived) and
   on contracts, so reruns can name "something happened" apart from "we
   learned about the past".
5. **A lost-window record per source** (the call log's March and April) for
   "no record, nobody can close it", and an expected-contact rule per
   supplier ("they phone").
6. **The saved question as a record**: words, each choice with who chose it,
   when, and whether the model proposed it; steps as rules; asked-at; word
   list version; never the rows. Runs stored per reader (ids only).
7. **Per-step provenance** so the method card and the dotted reading can be
   drawn from data, not from the page.
8. **Meaning-matches stored as Triage proposals linked to the answer rows they
   would change**, with proposer, agreer and acceptor kept after acceptance.
9. **Floors per source and per record, and people per floor** (identity
   rollup) for the share preview; a share request scoped to one record.
10. **A watch** that compares rows, not counts, and writes one Home line.

*What the model gateway would need to serve it.* Two calls on the first ask
only, both logged before the call: (1) propose a reading for a phrase the word
list doesn't know ("heard from" → event kinds) and say which words are loose;
(2) propose matches by meaning (pgvector over contact text) for records that
named no supplier, written to Triage as proposals. It never counts, never
writes the sentence, never runs on a rerun or a watch. Data Atlas would need to
read its own daily call count against the gateway's limit to show "14 of 500".

*New employee test.* **Pass** (my judgement of a first read, not a test with a
person): "it answered, asked me two things, showed its sums, and told Priya why
hers is different" reads without help. The pencil lane needs its header once.

*Score.* Clarity 5 · Distinctiveness 4 · Feasibility in Quill 4 · Fit 5.

## Open questions for Harry
1. **Does the asker's count travel with a shared question?** If yes (as
   built), a "different access: 1" can be worked out by subtraction. If no,
   the reader's notice can only say "your access differs from Sam's" with no
   number, and "7 → 5" disappears.
2. **Is "a week later" the reader's first run, or Sam's watch?** Built as
   Priya comparing against the count Sam shared. A reader with no earlier run
   of her own could instead get no change notice at all.
