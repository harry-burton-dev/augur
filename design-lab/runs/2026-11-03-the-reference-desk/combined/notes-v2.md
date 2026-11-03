# Combined V2: With and without the model (`v2-with-and-without-the-model.html`)

The same question, the same records, the same day, answered twice side by
side: **with the model** (the gateway on) and **without it**. Four aligned
steps (reading your words, sharpening, linking records, the answer) with a
gutter that says whether the two transcripts agree (`=`), nearly agree (`≈`)
or take a different route (`≠`), and a foot that totals what each route cost.
The demo deposits the lines in turn from 1.2 s, then focuses the first pencil
match and sends it to Triage. Keys: **G** gateway on/off, **↑↓** a match,
**C** it's them, **N** not them, **H** show the answer *without* the
unmatched line (what not to build), **T** technical words, **R** replay.

It uses the same `DATA` and `run()` as V1 (`_src/a/`): Sam Okafor's question
of 27 Oct, "since spring" = 1 March, "suppliers" = with a contract running.
Both columns are computed by the same function with `gateway` true or false.

*Idea.* Double reading (two readers, a third settles disagreements), drawn as
two court transcripts with cues: Sam, Data Atlas, and the model, indented and
in pencil. **The ink is identical: 7 = 7**, covers 16 of 18, same rows. What
differs is the route. With the model, it proposes a reading of "heard from"
(Sam agrees, and the dots stay with his initials) and proposes **three supplier
names matched by meaning** for records that name no supplier ("the Brightwater
team came about the deep clean" → Brightwater Cleaning?; "the lift maintenance
crew" → Fenwick Lifts?; "accounts@sp-group: the leaflet run" → Sefton Print?).
They are pencil, beside the count ("3 of the 7 may have been heard from, if
the model's matches are right"), never in it. **Confirming one sends it to
Triage**: "proposed by the model, agreed by SO, waits for Joy Mensah. Until
she accepts, Brightwater Cleaning stays in the 7, in ink." Without the model,
the person does more: a tick list for what counts as contact (one more turn),
and a short **identification key** per unmatched record (1a one of the 7 →
pick it · 1b another supplier → name it · 1c not sure → leave it). The answer
says **"3 records matched nobody and wait in Triage. If any is from one of
these 7, the answer is smaller."** with a warning beside it: this line must
stay. **H** shows the version that drops it, framed as "what not to build":
"7 suppliers. Sure for all 7." That is grammar V6's finding, the V6 risk:
without the model, an answer can look surer than it is.

*Combines.* Grammar V6 (two transcripts, cues, the gutter, "the model asks,
never tells"); workings V6 (two hands, the difference is the only thing that
needs a person, Triage as the only route to a fact, the gateway log); ask V4
(the key as the no-model way to narrow); cant V1 (base line on both sides);
the settled ink and pencil rule.

*Sources.* Double reading in breast screening; court transcripts and
screenplay format (cues, parentheticals for what was done); dichotomous
identification keys; "explain the SQL" studies (the technical query under
**T** is the same for both, with the meaning-match kept outside the join).

*What works.*
- **It is the proof of the rule in one screen.** Harry, an admin choosing
  whether to turn the gateway on, or an auditor sees that the model changes the
  conversation and the work, never the count. **G** dims the left column ("nobody
  gets this now; Ade Bello can turn it on in Admin") and no number moves.
- **The difference is small and named.** Three pencil cards, each with the
  model's evidence and a yes/no. Everything both routes agree on is plain ink.
- **The cost is honest both ways.** With: 3 turns + 3 yes/no, 2 gateway calls
  (logged before each, 14 of 500 today). Without: 3 turns + a tick list + up
  to 3 key questions, 0 calls. Without the model is not "worse", it is more
  work for the person and more waiting in Triage.
- **The risk is shown as an anti-example, not a lecture.** **H** puts the
  dishonest version on screen in a dashed danger frame, so the reason for the
  unmatched line is felt.
- **Going beyond the ask:** "Not them" also tells the model not to propose that
  record again, and leaves it unmatched in Triage, so a rejected guess is
  remembered and never silently returns.

*What fails or risks.*
- **It is an Admin and docs view**, not an operator's screen. No one would
  answer a question twice in daily work. Its homes: Admin's model gateway
  page ("what turning this off changes"), the Data Atlas guide, and a "how was
  this answered?" link from an answer.
- **At 1280×800 step 3 scrolls** inside its band; the answer row and the
  cost stay fixed so the comparison is never lost.
- **The key is thin.** Three leads per record is a picker by another name; a
  real key would need couplet templates per kind (ask V4's cost).
- **Danger red for "what not to build"** borrows a status colour for a
  teaching device. Fine in a lab page; it should not ship.
- **"Same rows" is asserted by the gutter** from the two runs here; a real page
  would compute and show the diff (it is empty), not trust the label.

*Principles.* Explain, never hide: the unmatched records are named on the
no-model side, and the gateway-off state says who can change it. Calm: lines
deposit once in turn (only the newest animates), then nothing moves. Focus:
the focused match takes the floor-coloured edge and glow; the dimmed column
under **G** is a rack focus without a scrim. Letterbox: not used.

*Needs.*
- Tokens: the same `--x-proposed-*` set as V1 (pencil, pencil-wash,
  pencil-line, ink, here, here-soft, lit, quiet, type-micro). No new ones.
- `--font-mono` for cues and counts (still needs its ADR).
- Kit parts: a transcript line with cue (You / Data Atlas / the model), the
  pencil card with its yes/no, and a gutter cell.

*What Data Atlas would need to serve it.*
1. **Run the same question with the gateway forced off**, for the right
   column (cheap: it is the normal path; the meaning-match step is skipped).
2. **Unmatched records as a first-class result** of the linking step: "3
   records name no supplier", each linked to the answer rows it *could*
   change (here: any of the 7). Without this the honest line can't be drawn.
3. **Triage proposals that come from an answer**, carrying proposer (the
   model), agreer (Sam) and acceptor (Joy Mensah), kept after acceptance so
   provenance never washes out; and a "not them" that blocks re-proposal.
4. **Key templates** per kind for placing an unmatched record without a
   model (which supplier, another supplier, leave it), ordered by spelling
   closeness.
5. **The deployment word list** for "heard from", so the no-model route can
   offer the tick list.

*What the model gateway would need to serve it.* Two kinds of call, each
logged in the audit log *before* it is made: reading a phrase the word list
doesn't know into event kinds; and matching records to suppliers by meaning
(pgvector over the record text, scored, top one only). A readable per-app
daily call count against its limit. A way for an admin to see this page from
Admin's gateway settings. It must never be asked for a count, a sentence or a
rerun.

*New employee test.* **Pass** (my judgement): "on the left a computer helped
and guessed three things; on the right it didn't and three things wait; the
answer is 7 either way" reads at once. "Key" may need its leads to be read
once.

*Score.* Clarity 5 · Distinctiveness 4 · Feasibility in Quill 4 · Fit 4.

## Open question for Harry
**Should the no-model route offer the key at all, or only "wait in Triage"?**
The key puts work on whoever asked (who may not know the record); Triage puts
it on the keeper (who does). Built as optional, defaulting to "leave it".
