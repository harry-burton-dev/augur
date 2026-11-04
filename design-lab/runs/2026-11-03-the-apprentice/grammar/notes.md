# Surface 1 · The apprentice sheet (grammar)

**The question:** what are the words and marks every agent screen in AUGUR shares? An agent works under a person, within a scope, at a level; its work is a proposal until accepted; some things can be undone and some can only wait for a person's go. Each variant names that vocabulary a different way and maps it to the terms of ADR 0014 (agents are apps, a durable runs service, grants at start, checkpoints to the Inbox, budgets, cancel, audit).

**Shared data, one object (`DATA`) for the whole run:** Westmere Port Authority (Org, 640 people), its Marine Operations department (58) and the Vessel Records team (7). Three agents, each an app: **Survey reader** (SR) reads vessel survey reports in Artifacts and proposes details to Data Atlas, under Ana Ferreira; **Filing clerk** (FC) files incoming certificates, under Tom Okoye; **Notice drafter** (ND) drafts Notices to Mariners, under Rhiannon Price, the harbourmaster. Survey reader does six kinds of work, each with its own rung and cap.

**Keys on every page:** R replays, T shows the ADR 0014 words under the plain ones (two registers), G turns the model gateway off. Each page plays its moment about 1.2 s after load.

**The ladder used across the run** (V2 is where it was chosen):

| Rung | Name | Alone it… | A person… | Sheridan–Verplank |
|---|---|---|---|---|
| 0 | Shadow | keeps nothing; its work is compared with people's | checks nothing | 4 |
| 1 | Asks each time | drafts each piece in pencil | accepts each piece | 5 |
| 2 | Asks for the batch | drafts a run's work as one batch | checks a sample, then signs the batch | 5, batched |
| 3 | Acts, then shows | does reversible work in its own area | checks a sample in the diary; undo for 14 days | 7 |

No rung 4: a person is always the master. Each **kind of work** has a **cap** (facts for Data Atlas cap at 2, because nothing skips Triage; withdrawing caps at 1) and its supervisor sets the **rung** within it. Above every rung sits the **ceiling**: ten things no agent does alone.

**Files:** `v1-indenture.html` … `v6-mode-line.html`, built by `../_src/build.py` from `../_src/common.css`, `data.js`, `lib.js` and `_src/v*.src.html`.

---

## V1: The indenture
*Idea.* The agent's binding document, one page, eight numbered clauses: supervisor and deputy, errand, scope, rung per kind of work, the ceiling, marks, limits and diary, with the supervisor's signatures at the foot (bound, widened, narrowed). A margin names each clause in the grammar and says whether ADR 0014 already has it (grey tick) or needs it (green plus). The moment lights the five clauses ADR 0014 lacks, one after another.

*Sources.* Guild indentures (a contract binding apprentice to master, listing duties and the master's obligations); the clinical scope-of-practice letter; ADR 0014's own vocabulary.

*What works.* It is the most direct answer to "what does ADR 0014 need to add": five of eight clauses are new (supervisor and deputy, rung per kind, the ceiling, proposedBy/acceptedBy, the diary). The page reads like a document a person can sign, which is the point: an agent's authority is a document someone put their name to. The signature row is the start of the trust record.

*What fails or risks.* It is a static page; it doesn't show what any clause looks like in use. Eight clauses at 1280×800 need the ceiling list cut to eight with "and 2 more", which goes against showing it whole. People skim documents like this: the indenture is for Admin and for the record, not for daily use.

*Principles.* Explain, never hide: strong (scope, ceiling and who answers, in one place anyone affected can read). Calm: nothing moves after the margin lights. No letterbox, no focus stacking.

*Needs.* A rendering of the manifest `agents` block plus the grants in words (said in a sentence). `--x-proposed-ceiling`, `--x-proposed-mark-size`.

*Scores.* Clarity 5 · Distinctiveness 3 · Feasibility 5 · Fit 4

## V2: The ladder and the ceiling
*Idea.* Four rungs drawn as a ladder, each with what the agent does alone, what a person does, and where Survey reader's kinds of work sit (dropped onto their rungs at the moment). Above the top rung, a solid bar: the ceiling, ten things no agent does at any rung, each with its reason. A side panel maps Sheridan and Verplank's ten levels onto the four, striking out 6 (the veto timer) and 8 to 10.

*Sources.* Sheridan and Verplank's levels of automation (1978); SAE J3016 (who monitors, who is the fallback); the guild grades (apprentice, journeyman, master).

*What works.* It is where the run's ladder was chosen, and the strike-throughs carry the two strongest rules: **silence is never a yes** (no level 6: no "goes ahead unless you stop it") and **the diary always tells** (no 8 to 10). "There is no rung above 3: a person is always the master" turns the guild metaphor into a limit, not a promise. Showing kinds of work on the rungs makes the rung per kind, not per agent, obvious at once; the "5 kinds can't reach this rung" chip makes caps visible.

*What fails or risks.* Four rungs plus caps plus a ceiling is three ideas to learn. The rung numbers read like a score (people will want "rung 3" as an achievement). The ladder is drawn bottom-up, so the first thing read is the ceiling.

*Principles.* Explain, never hide: strong (caps are shown as dashed rungs, not missing ones). Calm: one drop, then still. Fit with the water language is plain but fine.

*Needs.* A level and cap per kind of work in the grant (new in ADR 0014). The ceiling as fixed checkpoint kinds.

*Scores.* Clarity 4 · Distinctiveness 4 · Feasibility 4 · Fit 4

## V3: The life of a piece of work
*Idea.* Every state a piece of agent work can be in, as four paths: Propose (drafted, waits, then accepted, changed or rejected), Act then show (done, in the diary, then countersigned or undone), Stand by (prepared, standing by, then go, held or lapsed), Repair (found wrong, recalled, then repaired and rung reviewed). Each state shows its mark and who moves it on; only a person moves work to something final, in green. Keys 1–4 trace a path.

*Sources.* The stage manager's prompt book (each cue's states: standby, go, held); pencil and ink (reference desk run); visible repair (wear and time run); Inbox states from ADR 0026 (open, done, declined, handed on).

*What works.* It is the only variant that makes the state machine explicit, and it surfaced two rules: **Lapsed means not done** (a standby with no answer doesn't happen; silence is never a go), and **Changed keeps the person's value as feedback** to the agent's record (it isn't the same as rejected). It also shows the agent never moves anything past pencil, a held lamp or an undoable act.

*What fails or risks.* A developer's diagram: right for the kit and the ADR, too much for a supervisor. The four paths are drawn as if separate, but a mistake (path 4) starts from an accepted proposal (path 1); the link isn't drawn.

*Principles.* Explain, never hide: strong. Calm: the trace runs once. Letterbox: none (a standby that is also urgent goes to the Letterbox; see standby V2).

*Needs.* A `state` and `kind` on every agent output in the runs service; Inbox item states mapped to standby (open = standing by, done = go, declined = held, handed on); a "lapsed" state the Inbox doesn't have yet.

*Scores.* Clarity 3 · Distinctiveness 3 · Feasibility 4 · Fit 3

## V4: The marks
*Idea.* A specimen sheet of the twelve marks agent work can wear, one meaning each: maker's mark, pencil, ink with the mark kept, the batch, the standby lamp, the ceiling, the rung, outside its scope, held for you, the seam, countersigned, and now-and-next. Space flips the sheet between before (the agent has acted) and after (a person has).

*Sources.* Assay office mark charts (the maker's mark beside the office's own mark); theatre cue lights (standby lit, out on go); proof correction marks (BS 5261).

*What works.* The **maker's mark** is the run's most useful single invention: a 2–3 letter monogram set by the agent's app, dotted while its work is pencil, solid once accepted, and kept on the work for good. It answers "how do agent proposals differ from people's" at a glance, in any app, at text size, without a robot icon. The sheet also shows the marks can be told apart without colour (shape: dotted, solid, struck, seam, lamp, bar, hatch).

*What fails or risks.* Twelve is a lot; four (mark, pencil, lamp, seam) carry most of the meaning. The standby lamp's warm white sits close to the Team floor's amber; it is never shown without words, but it needs its own token. Monograms collide (two agents called "Survey reader" and "Search robot" would both be SR); the app would have to choose.

*Principles.* Calm: the lamp never blinks; the box on a mode change shows once. Explain, never hide: "outside its scope" uses the same hatch as "not yours to see", deliberately.

*Needs.* `--x-proposed-standby`, `--x-proposed-standby-wash`, `--x-proposed-ceiling`, `--x-proposed-mark-size` (new); the manifest `agents` block needs a `mark`.

*Scores.* Clarity 4 · Distinctiveness 5 · Feasibility 5 · Fit 5

## V5: Who answers for what
*Idea.* The delegation matrix. The five rights of delegation from nursing (right task, circumstance, person, direction, supervision) head the page, each mapped to a part of the grammar. Below, twelve actions against everyone they touch: the agent, its supervisor, the deputy, anyone affected, the deployment admin. Cells say does, drafts, checks, stands by, says go, accepts, answers for, may flag, may stop, can't. The moment lights the supervisor's column: every "answers for" lands on a person.

*Sources.* The five rights of delegation (US NCSBN and ANA joint guidance; the RCN's accountability and delegation guidance in the UK); RACI charts.

*What works.* It says plainly that the person who delegates stays accountable, and puts names in every cell. It found two rules: **anyone affected may pause that kind of work** (an andon cord; see mistake V6), but only the supervisor may change its rung, and **the deputy can say go but can't change the rung**. It is the page an auditor or a new supervisor would want.

*What fails or risks.* Matrices are read once and forgotten. The "Anyone affected" column is vague: in AUGUR it would be "anyone who can see the work", which needs a definition. Twelve rows is already the limit.

*Principles.* Explain, never hide: strong (every can't is shown, not omitted). Calm: one lit column, then still.

*Needs.* A deputy in the grant (new); a "pause this kind of work" action open to anyone who can see the work (new, needs Harry's decision).

*Scores.* Clarity 4 · Distinctiveness 3 · Feasibility 5 · Fit 3

## V6: Now and next
*Idea.* The agent's mode line, from the flight mode annunciator: five cells (agent, now, next, stops at, rung). Now is the engaged mode in words, Next the armed mode in blue, Stops at the limit that will stop it. When a cell changes it is boxed for a few seconds and the reason is written under the line, then the box goes. Below, the night of Sunday to Monday as the line showed it, step by step (← →): reading, setting a disagreement aside, stopping at 500 calls, resuming at 00:00 UTC, waiting with a batch. G shows the line when the model gateway is off.

*Sources.* The Airbus FMA (engaged and armed modes; a box round a mode change for ten seconds); Sarter and Woods, "How in the world did we ever get into that mode?" (1995); Palmer's NASA study of mode confusion.

*What works.* It answers the four questions people ask of automation (what is it doing, what next, when will it stop, why did it do that) in one line that fits anywhere: the top of Triage, a diary, the shell's band. "Holding", "Stopped" and "Paused" are modes in words, never blanks, so an idle agent is never mysterious. It is the cheapest piece to build and the one every other surface reuses.

*What fails or risks.* A line that is always visible tempts people to watch it. The box must show once per change and never loop. Five cells at 1280 needs short words; long report titles are cut with an ellipsis (the full title is one click away). "Armed" in blue is a cockpit convention most people don't know; the word "Next" carries it.

*Principles.* Calm: strong (the line is still at rest; a change is boxed once). Explain, never hide: strong (why it changed, in words). Focus stacking: none.

*Needs.* From the runs service: the current step in words, the next step, the stop conditions (budget, schedule) and a reason on every change of mode. ADR 0014 has run status and budgets; it needs "next step" and "reason".

*Scores.* Clarity 5 · Distinctiveness 4 · Feasibility 4 · Fit 5

---

## Ranking
1. **V6 Now and next**: every surface reuses it; cheapest; answers the aviation lesson directly.
2. **V4 The marks**: the maker's mark and the lamp are the run's vocabulary.
3. **V2 The ladder and the ceiling**: where the four rungs, caps and the ceiling were chosen.
4. **V1 The indenture**: the Admin page and the answer to "what ADR 0014 needs".
5. **V5 Who answers for what**: the audit view.
6. **V3 The life of a piece of work**: for the kit and the ADR, not for people.

**What I'd build first.** The mode line (V6) as an Aerie part the shell shows wherever an agent's work appears, with the maker's mark (V4) in Quill so any app can sign agent work in pencil. Both need only small things from the runs service: the current and next step in words, and `proposedBy` on every output. Then put the four rungs, caps and the ceiling (V2) into ADR 0014 as text, and render the indenture (V1) in Admin from the manifest and the grant.

## Needs token
Carried: `--x-proposed-unseen`, `--x-proposed-quiet`, `--x-proposed-type-micro`, `--x-proposed-lit`, `--x-proposed-lit-wash`, `--x-proposed-disagree`, `--x-proposed-disagree-wash`, `--x-proposed-pencil`, `--x-proposed-pencil-wash`, `--x-proposed-seam`, `--x-proposed-seam-wash`.
New: `--x-proposed-standby`, `--x-proposed-standby-wash` (the lamp), `--x-proposed-ceiling` (the ceiling bar), `--x-proposed-mark-size` (the maker's mark).
Every page relies on `--font-mono` (IBM Plex Mono), which still needs an ADR.
