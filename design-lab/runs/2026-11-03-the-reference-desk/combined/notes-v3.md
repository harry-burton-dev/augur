# Combined V3: When the answer is “I don’t know”

`v3-when-the-answer-is-i-dont-know.html` · source in `_src/b/` (`python3 _src/b/build.py`
builds V3 and V4 from one shared sample: Halden Regional Services, Rosa Lind on the
Facilities Department floor, 51 suppliers, 24 contracts, all in one `DATA` object).

Combines **cant/V1 the base line** (base sentence, a cell per record), **cant/V2 not
supplied** (“I don’t know” as large as a number, fixed reasons, routes), **cant/V4 hand
it on** (errands previewed before sending), **cant/V5 the range** (“at least 10, up to
22”, the model’s own lane), **saved/V6 why it changed** (the five reasons on every
change), and **grammar/V3 working papers** (an agreed guess keeps its mark and who
proposed it).

## V3: When the answer is “I don’t know”

*Idea.* Rosa asks “Which suppliers have we not heard from since spring?”. The answer
leads with its base, **32 of 44**, then the count as a range (**10–22**), then one
template sentence. Under it, one cell per supplier in its empty mark, grouped as
covered / I don’t know / outside the base, with the sum shown (“32 + 12 = 44 ✓ each
supplier on one line”). On the right, “I don’t know, for 12.” is a full answer: a fixed
list of seven reasons in a fixed order, ticked where they apply, and each ticked reason
carries its errand, previewed before anything goes: **not known yet** → a Triage job per
keeper (Marcus 3, Lena 2, Priya 2, with the exact question they’ll see); **out of date** →
a Triage job to re-read the reports; **no record** → marked *nobody can close this*, nobody
asked; **not yours to see** → a share request to Dev Okafor scoped to this one question;
**no place for it** (Data Atlas has no place for an email) → a Mandate ask to Ola Brennan
that quotes the question. One Send. Then the days play: 4 Nov Marcus answers, 5 Nov
Priya, 6 Nov Lena re-reads, 9 Nov Dev grants access and the **base itself grows** (44 →
47), 12 Nov Ola takes the Mandate ask (no number moves). The base column rises 32/44 →
35 → 37 → 41 → 44/47 → 44/47, and every change in the log names who said it and which of
the five reasons moved it.

*Sources.* Opinion-poll base lines (“Base: all adults”); ISO 10161 inter-library loan
“not supplied” reason codes; the reference desk’s referral slip; election-night ranges;
audit working papers (prepared by / agreed); press-cutting bureaus (one change, told
once, with its reason); the catalogue’s six ways to be empty.

*What works.*
- **Base before count.** “32 of 44” is the first thing read; the count comes second and
  as a range, so a partial answer can’t be mistaken for a whole one. Every number on the
  page sums: the balance line is the test that nothing fell off.
- **“I don’t know” is a reason list, not an error.** The two unticked reasons do work
  too: *not found* says “the suppliers are there, 48 kept”, *doesn’t apply* says why 4
  sit outside the base. Same reasons, same order, every time; an operator learns them.
- **Each empty knows its errand**, and the errand is the right *kind* of work: a Triage
  job (a fact will carry the keeper’s name), a share request (access, scoped to one
  question), a Mandate ask (the structure grows), and for no record, deliberately
  nothing. Before sending, one line says what the errands could buy: “covers up to 42 of
  44, plus Finance’s; still open after: 2 no record; the Mandate ask moves no number now.”
- **The base moving is the story.** Answers close gaps (covered rises); access widens
  the base (44 → 47). Showing both as one column per day makes “we learned about the
  past” and “different access” visibly different moves.
- **Pencil stays pencil.** The model’s three guesses sit in their own lane above their
  cells (dotted rings) and as hints inside the Triage preview. **G** removes them and the
  Mandate draft; no number on the page changes. When Marcus confirms Ashdown “met in
  June”, the cell becomes ink but keeps a dotted top edge and the log says “proposed by
  the model, agreed by Marcus Bell · the dots stay”; that survives G too, because it is
  history, not a live call.

*What fails or risks.*
- Dense. Five zones (lead, strip, days, log, slip) on one screen; at 1280×800 the slip
  and log scroll. A first-time reader needs the lead and the slip; the strip and days are
  for the second look.
- The range “10–22” beside “32 of 44” is two pairs of numbers in the first line; some
  readers will mix them. The labels carry it (“it covers”, “not heard from”).
- Errands are load on colleagues. One question sends 7 questions to 3 people; a curious
  operator could do this all day. Needs merging (“someone already asked Marcus this”) and
  a per-keeper limit.
- The share request changes the base for this question only. If Dev grants it, Rosa’s
  answer and a colleague’s rerun differ (different access); the page says so in the
  log, but the saved question must record it.
- Days compressed to ~600 ms each for the demo; in life this is a week, told once a day
  at most. The column of days becomes long for slow questions (needs folding, as
  saved/V2 does).

*Principles.* Explain, never hide: at its fullest (every gap, why, who, and what the
errand will say). Consequence preview: every errand before Send. Calm: deposits once, the
days fill once, nothing loops; changes are lit for one day then go quiet. Letterbox: not
used (a partial answer is not urgent). Focus stacking: not used; the slip is a pane, not
a plane.

*Needs.*
- Tokens (all mixes of kit tokens, top of `_src/b/common.css`): `--x-proposed-pencil`,
  `-pencil-wash`; `-gap-ink`, `-gap-tick`, `-hatch`, `-stale`, `-unseen`, `-quiet`
  (catalogue marks); `-here`, `-here-wash`; `-lit`, `-lit-wash`; `-type-micro`. New mark:
  **no place for it** (corner ticks inside a dashed box), the question-level state from
  cant/V2. `--font-mono` relied on (ADR still needed).
- Kit parts: the empty-mark set; a base line (“covers N of M”) with its balance; the
  reason slip; an errand preview card; a provenance edge for agreed guesses.

*New employee test.* **Passes** (my judgement, not tested). “Covers 32 of 44” and “I don’t
know, for 12” read without help; the reason rows read like a form they’ve met; the
strip is learned from its labels.

*Score.* Clarity 4 · Distinctiveness 4 · Feasibility 4 · Fit 5

### What Data Atlas would need (against docs/atlas.md)
- **Expected details per kind** (“every live supplier should have a last contact”), so
  an absence is a *not known yet* gap and not just nothing. Today Data Atlas holds what is
  known; it has no notion of what should be.
- **Coverage per answer**: for each record the answer touched, which of the empty states
  it is in, computed by rules (expected-but-absent, source last read, lost windows,
  access, scope). The base line, range and balance are arithmetic on that.
- **A source register** with last-read dates and **lost windows** (the depot inbox,
  Jan–Apr), so *out of date* and *no record* are facts, not judgements.
- **Counts across floors that say “some”**: the answer must know rows exist on Finance
  without counting them for Rosa.
- **Triage jobs addressed to a keeper**, one short question per record, whose answers
  enter as observations with the keeper as source (Triage stays the only way in).
  **A “none” answer** (“checked: no contact since February”) as an observation in its own
  right, with who checked and when.
- **A share request scoped to one saved question**, granted by the floor’s lead, that
  widens that question’s reach and nothing else; it shows as “different access” on reruns.
- **A Mandate ask about the ontology** (“give suppliers a place for last emailed”) that
  quotes the question; when the detail lands, every question that asked for it becomes
  *not known yet* for each record and is rerun.
- **Saved question with a watch**: rerun when an errand lands, compare rows, attach one
  of the five reasons, notify once a day at most.

### What the model gateway would do (and what works without it)
| Step | Without the gateway | With it |
|---|---|---|
| “Since spring”, “heard from” | Deployment calendar; the desk’s word list | Odder phrasing, as pencil |
| Count, base, range, balance, reasons, errands, days | Always | Never |
| Hints on Triage questions (“met in June?”) | The question goes without a hint | Pencil, from minutes and plans; never counted |
| Mandate ask text | A template that quotes the question | A friendlier draft, pencil, editable |
| Agreeing a guess | — | Only through Triage, by a person; the dotted edge and “proposed by the model” stay |

## Open questions for Harry
1. Must a partial count always be said as a range (“10–22”), or may it lead with the
   floor (“at least 10”)? I built the range beside the base.
2. Who may send errands for a question, and how many per keeper per week? Without a
   limit the reference desk becomes a way to load colleagues.
3. Should a share request ever be scoped to one question (as built), or only to a floor?
   Scoped is safer but adds a new kind of access.

**Where I went beyond the ask:** the share request scoped to one question; “none”
answers counting as covered (with who checked); and the base growing on its own day when
access is granted, so access changes are never mistaken for new facts.
