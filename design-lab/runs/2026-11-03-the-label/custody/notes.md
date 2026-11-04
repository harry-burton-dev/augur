# Surface 6 · Custody

**The moment:** the pilot's time on duty has passed through nine hands in three weeks: the duty roster recorded it, Kofi Mensah typed it into his report (from the paper roster, so no link was kept), Data Atlas proposed it as a fact and matched it back to the roster row (the link is mended), Kofi accepted it and shared it with Leah Morgan for the investigation, it was read six times in Pilotage, Leah counted it into answer A-77, quoted the count in her briefing and shared the briefing with the Safety committee. All of it is `DATA.custody`; every variant reads it as a chain, not an audit log.

**Rule carried through all six:** acts are named (who held, changed, quoted, shared), looks are counted (reads by others only as a number, never below the policy's minimum group; your own are exact). From mine versus ours (wear and time run).

**Keys:** R, T, S as everywhere; each page lists its own.

---

## V1: The chain
*Idea.* One link per hand, read left to right, joined where AUGUR recorded the hand-over. A hand-over it didn't see is a **broken join** (dashed, with an unlink mark) and stays broken after it is mended; the mend is a seam on the next join. Reads are a thin dotted link with a count. Picking a link shows who, what, where, the label set, the purpose and receipt of a share, or the transform ("name dropped, counted with 4 other groundings").

*Sources.* Evidence chain of custody; visible repair (wear and time run).

*What works.* "A chain, not an audit log" in the most literal way, and the break is unmissable without being alarming. Nine links fit on two rows.

*What fails or risks.* Long chains (hundreds of reads, dozens of quotes) need folding by hand. Link shapes made of borders are fiddly at small sizes.

*Principles.* Explain, never hide: strong (breaks shown). Calm: the chain draws once.

*Needs.* Custody events from every app with a common shape (hand, act, what, where, to, purpose, receipt); a "hand-over not seen" event.

*Scores.* Clarity 5 · Distinctiveness 3 · Feasibility 4 · Fit 4

## V2: Hands as lanes
*Idea.* One lane per hand, time along the bottom, the value as one line stepping between lanes like a train on Marey's graph. Dashed where the hand-over wasn't recorded; thicker and blue once it travels as a count.

*Sources.* Marey's train graph; swimlane diagrams; metro maps.

*What works.* Time and hands in one picture: you see that the value sat with Kofi for a week before it moved, and that it changed form at the answer.

*What fails or risks.* Lanes multiply with hands; nine is already tall. Acts close in time overlap (wrote and accepted on the same day). Hard to read for someone who hasn't met a train graph.

*Principles.* Explain, never hide: good. Calm: draws once.

*Needs.* Timestamps on every custody event (they exist).

*Scores.* Clarity 3 · Distinctiveness 4 · Feasibility 3 · Fit 3

## V3: Told in sentences
*Idea.* The chain as a short story, one sentence per hand, the floor colour on each line's edge, the admin line under each with T. Beside it, "mine and ours": your trace is exact, others' looks are a count, acts carry names.

*Sources.* Said in a sentence (catalogue run); two registers; mine versus ours.

*What works.* Anyone can read it, including the data protection officer, the pilot and an inspector. The sentence about reads ("Who read it isn't shown") states the privacy rule where it applies.

*What fails or risks.* Doesn't scale past a dozen events; needs folding ("then 14 more reads and 2 quotes"). Sentence templates per act must be translated whole.

*Principles.* Explain, never hide: strong. Calm: very.

*Needs.* A sentence template per custody act.

*Scores.* Clarity 5 · Distinctiveness 3 · Feasibility 5 · Fit 5

## V4: About me
*Idea.* Custody from the other side: what AUGUR holds about Dafydd Rees, the pilot. Each value about him says on what grounds it is held (the port's safety duty, which can't be withdrawn; or his consent, which can), what it is not for, where it went (including "as a count" copies) and how long it is kept. His consent receipt for the fatigue diary has a **Withdraw** with a preview: it leaves Data Atlas and Leah's notes at once and each place says so; it **never reached** the answer or the briefing, because their labels kept it out.

*Sources.* Kantara Initiative consent receipts; GDPR subject access; mine versus ours.

*What works.* The strongest moment of the run for trust: the person the data is about can see the label working for them. "Never reached" is evidence that labels did their job, and a reason to give consent next time.

*What fails or risks.* A self-service view of everything held about a person is a big promise (subject access is usually a DPO-run process). Showing "Leah Morgan is told; she doesn't learn why" needs care around retaliation.

*Principles.* Explain, never hide: strong. Calm: yes.

*Needs.* "About" links from values to people; consent records with reached / not reached computed from custody.

*Scores.* Clarity 5 · Distinctiveness 5 · Feasibility 3 · Fit 4

## V5: Every copy, over time
*Idea.* Every copy of the value as a tree from its source, and a date you can move (← →). Shares end (Leah's on 31 Dec), keep-untils pass (the hours, the report's §3 and the fact go at the end of 2032, each place saying so), and **a count outlives the values it was made from** because it no longer names anyone.

*Sources.* Retention schedules and archival disposal; family trees.

*What works.* The retention cascade, finally visible: "keep until" stops being a promise in a policy and becomes something an operator can check. The count surviving is the right answer to "do we lose our statistics when the personal data goes?"

*What fails or risks.* Moving the date into the future is a simulation, and must look like one. The tree for a popular value would be huge.

*Principles.* Explain, never hide: strong. Time as an address (wear and time run).

*Needs.* A reverse index of copies; keep dates resolved per copy; removal in place with a mark.

*Scores.* Clarity 4 · Distinctiveness 5 · Feasibility 3 · Fit 4

## V6: Seals
*Idea.* Each hop keeps what it was given and how it was made from the hop before. Correct the source (C: the roster's start time moves from 15:12 to 16:12) and every seal downstream re-checks: the fact re-derives with a seam (13 h 40 → 12 h 40), the typed report **can't** and its seal breaks and says what the roster now says, the answer re-checks and **holds** (still over 12 hours, still 2 of 5), the briefing's seal is re-made with no seam, and the committee is not told because nothing they read has changed.

*Sources.* Tamper-evident seals; assay marks; visible repair; five reasons an answer moves (reference desk run).

*What works.* Custody as integrity, not just history, and calm by design: only what changed tells anyone. The typed value's broken seal is the clearest argument for quoting values instead of typing them.

*What fails or risks.* Re-deriving across apps is real engineering (Explorer answers and Artifacts quotes must re-run). Seals are a metaphor that needs the deed beside it.

*Principles.* Explain, never hide: strong. Calm: the best in the set. Visible repair: yes.

*Needs.* Derivation recipes kept with each hop; change events from Data Atlas to Explorer and Artifacts.

*Scores.* Clarity 4 · Distinctiveness 5 · Feasibility 2 · Fit 5

---

## Ranking
1. **V3 Told in sentences**: the default view.
2. **V1 The chain**: the picture, with breaks and mends.
3. **V4 About me**: the subject's view and withdrawal.
4. **V5 Every copy, over time**: the retention cascade.
5. **V6 Seals**: the long-term goal; needs derivations kept.
6. **V2 Hands as lanes**.

**What I'd build first.** A common custody event shape across apps, shown as sentences (V3) with the chain (V1) as its picture, acts named and looks counted. Then the copies index that V5 and V4 both need, because retention and withdrawal both depend on knowing where every copy went.
