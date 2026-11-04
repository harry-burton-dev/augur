# Round 2 · Combined screens

Four screens that could ship, built from the strongest round 1 variants. All share the run's one `DATA` object and the marks from the ladder (rung stair, lift chip, reader edge, why here, holds while). Built by `../_src/build.py` from `_src/v*.src.html`. Every page was checked by screenshot at 1600×900 and 1280×800, in normal and reduced motion. None has console errors or sideways scroll.

---

## V1: The life of a working set (`v1-the-life-of-a-working-set.html`), the required screen
*What it is.* One working set, WS-31, followed through five stops on a strip across the top: **assembled** (3 Nov), **handed over** (14 Nov), **a piece goes stale** (18 Nov), **re-checked** (24 Nov), **decided** (1 Dec). The left side is always the same object, the set itself, with context first, then information, then data. The right side is what that stop asks of a person. Space steps through it, 1–5 jump, R replays. The moment at about 1.2 s jumps to the handover and plays it.

*Taken from.* Working set V1 (bundle index) and V2 (release, two names). Stale V2 (holds while, trips on its condition), V1 (state chips with the five reasons), V4 (re-check only what moved), V5 (versions kept) and V6 (what left with Tom). The readback moves it (paper and the desk). The apprentice's "no supervisor, no run".

*The path.*
1. **Assembled.** Tom builds the set for Grace. Every piece has a rung, source, reason and condition. Contract reader (CR) was given three documents and proposed two clauses; one is accepted and becomes piece 13 with its mark kept. A release needs Tom's name and Grace's, and the page says one piece (the offer) runs out before the decision.
2. **Handed over.** Leah Morgan, who wasn't there, gets the set, not a briefing. The left side switches from conditions to *reasons in Tom's words*. The handover asks Tom what isn't in it. The 7 Nov phone call with the supplier, a gap with corner ticks, becomes a note in his words, marked *said, not checked*. Leah reads back what the decision turns on. Ownership and the agent's supervision move only then (17 Nov), and both names show until it does.
3. **A piece goes stale.** On 18 Nov the offer of 20 Oct is withdrawn. Its condition ("holds while the offer of 20 Oct stands") breaks. That one piece trips: hatched, struck through, with the reason (*something happened*) and the replacement. Leah is told once, in place. Two quieter moves (the route revert, the orphaned driver story) show as seams with no notice.
4. **Re-checked.** Leah reopens it on 24 Nov and answers only the 8 pieces that moved (kept and repaired, replaced, or asked and still marked). The set becomes version 3, and version 1 is kept with an errata slip.
5. **Decided.** Grace decides on version 4 (version 3 plus the new offer's terms, released by her on 28 Nov). The six pieces the decision rests on are lit, and the rest are dimmed but present. Her decision names its version, its signer and her release authority. The projection that came true (clause 7.2 on 21 Nov) and the claim that is still unchecked (the driver story) are both shown.

*What works.*
- **The set is the handover.** Leah never needed Tom in a room. Every reason is his and signed. The one thing that wasn't written down is drawn as a gap at the moment it is cheapest to fill.
- **Stale means a broken condition.** Only one piece lit on 18 Nov, because only one condition broke. The July count, three weeks old, never lit.
- **A decision names the version it rests on**, so a later reader can see exactly what Grace saw, even after the set moves on.
- It reads as one object changing, not five screens.

*What fails or risks.*
- Five stops make it a demo. In the product, these are five states of one page, and a person sees one at a time.
- The left list is long (15 rows). In the product it would be filed by question (working set V3); this screen uses rung groups so the staleness reads.
- The decision step implies Grace releases version 4 herself. Who may release is a decision for Harry (see the shortlist).

*Principles.* Explain, never hide: strong (gaps, orphans and dimmed pieces stay visible). Calm: one notice in three weeks, and the rest are seams. Focus stacking: the decision lights what it rests on and dims the rest. Letterbox: not used. Nothing here is urgent, and a stale piece should never open it.

*Needs.* `--x-proposed-broken`, `--x-proposed-seam`, `--x-proposed-stale`, `--x-proposed-lit`. The working-set object, versions, conditions watched by the events service, a handover with a readback and the "anything not in the set?" question, and a decision record that names a set version.

*Scores.* Clarity 4 · Distinctiveness 4 · Feasibility 4 · Fit 5

## V2: The working set page (`v2-the-working-set-page.html`)
*What it is.* The working set as a kind of Artifacts document. The decision's questions are on the left (Q1–Q6, with one gap), the pieces by rung in the middle, and the selected piece's **record** on the right: rung, lifted by (and from which pieces), source, said by, made by (an agent's mark), why here, for (the reader), serves (the intent), holds while, answers (which questions) and used by. **T** adds, under each field, the service that keeps it today (Data Atlas, Explorer, Artifacts, Identity, Mandate, the model gateway's audit) or "needs: the working set (new)". The moment selects Q2 and piece 11, then turns T on.

*Taken from.* Working set V1, V3 and V5, ladder V1, and two registers (T) from the catalogue run.

*What works.* It answers the prompt's third question on the page itself. **Most of what a piece needs is already held somewhere** (the source, its floor, the reader, the intent, the agent audit). What only a working set would hold is small and specific: the rung, the lift, the reason, the condition, the question link and the where-used link. Filtering by question dims everything that doesn't answer it, which is the pruning view.

*What fails or risks.* Three columns at 1280 are tight, and the record pane scrolls. The questions column takes width that the pieces need. It is a page for the assembler and reviewer; the decider wants combined V3 or the nut graf.

*Principles.* Explain, never hide: strong. Calm. Two registers: yes, with T. No letterbox.

*Needs.* As V1, plus a question object on the set.

*Scores.* Clarity 4 · Distinctiveness 3 · Feasibility 5 · Fit 4

## V3: Three readers, two frames (`v3-three-readers-two-frames.html`)
*What it is.* The information once, in a band with a "same digits in all three" check. Under it are three reader columns (Mira, Grace, Owen), each with their question, their paragraph built from one template with per-reader slots, a frame line, what it is drawn from, and what they can open (hatched with whom to ask where they can't). Along the foot, frame A and frame B, each with the "would change my mind" line written before the test, and the agreed test between them. The moment runs the test: both rules are met, both frames hold in part, and every reader's frame line updates in their own terms (Owen's still says nothing for the Org).

*Taken from.* Readers V1, V3 and V5; frames V1 and V6; the briefing's same digits at every height and reach before act.

*What works.* It shows *both* kinds of relativity at once: to the reader (three paragraphs) and to the frame (two readings), without averaging either. The test result reaches each reader as context for them, so it doesn't arrive as a broadcast. That is the prompt's "one shared picture each role filters", made concrete.

*What fails or risks.* It is again a publisher's view; nobody reads all three columns. The foot strip is cramped at 1280 (the quotes drop). The frame line per reader is written per reader, which is still work.

*Principles.* Explain, never hide: strong. Calm: one result, then still. No letterbox.

*Needs.* Paragraph templates with slots; frames as pieces; the same-digits check part.

*Scores.* Clarity 4 · Distinctiveness 4 · Feasibility 4 · Fit 4

## V4: What the agent was given (`v4-what-the-agent-was-given.html`)
*What it is.* An agent's working set, as the apprentice run's agent page would show it. The header has the maker's mark, the supervisor, the errand, and model calls against the daily limit. Under it is the apprentice's mode line (now, next, what stops it, why it last changed). **Given:** three pieces of WS-31, each with a direction. **Not given:** three, hatched, each with why. **What it said back:** each clause must name the given piece and place it comes from ("from A · §7.4"). The moment adds a third clause, *"Brightwell is three drivers short, so performance should recover by January"*. It cites the meeting note it was **not** given, so it is held with the reason "either a guess or a leak", the not-given row lights, and the mode line boxes "Holding one clause for a person".

*Taken from.* Working set V6; ladder V5 (an agent proposes a lift, never signs it); the apprentice's works under someone, maker's mark, now and next, and pencil and ink.

*What works.* It is the clearest answer to the prompt's agent question, and it agrees with the apprentice point for point: a named supervisor, pencil until a person accepts, the mark kept, the supervisor handed over with the set, no supervisor, no run. It adds one rule the apprentice didn't have: **the bundle is the agent's whole world.** A claim tied to nothing in it is held, not shown as an answer. That is a check AUGUR can run mechanically (cited piece ∈ given pieces).

*What fails or risks.* The check only works if every clause cites a piece and place, which the agent must be built to do (and can fake). "A guess or a leak" may alarm a supervisor over a model's ordinary filler; the words need testing. A direction is still free text.

*Principles.* Explain, never hide: strong. Calm: the held clause is the only lit thing. No letterbox. Agents never open it (apprentice).

*Needs.* Citations from agent output to bundle pieces (piece id and place); a "held: outside its bundle" state in Triage and the Inbox; a grant scoped to a working set with an end date.

*Scores.* Clarity 5 · Distinctiveness 4 · Feasibility 4 · Fit 4

---

## Ranked
1. **V1 The life of a working set**: the object, and why it pays back at handover.
2. **V4 What the agent was given**: the agent's input, reviewable, with one mechanical check.
3. **V2 The working set page**: the build spec, with who keeps what.
4. **V3 Three readers, two frames**: the reader and frame views, for when a set has more than one reader.
