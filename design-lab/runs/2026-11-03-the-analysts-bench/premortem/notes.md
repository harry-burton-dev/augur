# The premortem

Facilities imagines the renewal failed. On 1 Dec 2026, five people (Jo Reyes in the chair, Sam Okafor, Marta Kowal, Ola Mensah, Priya Nair from Finance) and the assistant in pencil take Klein's prompt: *it is 1 April 2028; the 12-month renewal failed; why?* Nine reasons, in eight groups. Each group must leave the room as one of three things: **a change to the plan now**, **a watch** (a sign, a source and an owner), or **a risk accepted by name**. Here: 2 changes (credit doubled; a named watcher and stand-in), 5 watches (2 AUGUR can't see), 1 accepted. All data in `_src/data.js` (`premortem`, `watches`).

---

## V1: News from the future
*Idea.* The room reads a **front page dated a year on** ("The 12-month renewal failed: the North round is still missing collections and the tender is being rushed"), on its own cooler far plane, then each person's reasons appear under their name. The assistant has one column and one reason, in pencil.

*Sources.* Gary Klein, "Performing a project premortem" (HBR 2007); Amazon's working-backwards press release, turned to failure.

*What works.* The headline does what Klein's instructions do, in one image: it makes the failure a fact to explain, not a risk to rate, which is what lets people say uncomfortable things. The far-plane styling keeps it from being mistaken for real news.

*What fails or risks.* A fake headline about a real supplier could leak and be read as real. It must never leave the room: no share, no export, and the word "imagined" in the masthead. The page is the setup, not the work.

*Principles.* Focus stacking: the future on a far plane. Calm: one reveal. Explain, never hide: names on every reason.

*Needs.* `--x-proposed-future`, `--x-proposed-future-wash`. A "can't be shared" flag on the premortem page.

*Test.* Klein's claim is that premortems surface more reasons than "what could go wrong?". Running both framings on similar decisions, the premortem should give more distinct reasons per person. If not, the headline is decoration.

*Score.* Clarity 4 · Distinctiveness 4 · Feasibility 5 · Fit 4.

## V2: Alone, then aloud
*Idea.* The method's one hard rule made visible: **everyone writes alone first**. Each seat shows how many reasons its person has written, face down, never what. When the last person says done (or 3 minutes pass), all cards turn over at once. Then one reason each, round the room, the chair after the others and the assistant last.

*Sources.* Klein; Delbecq and Van de Ven's nominal group technique (1971).

*What works.* Anchoring is the reason premortems work and the reason they fail; this page enforces the cure. Counts without content keep a little social pressure ("Priya has written one") without leaking ideas. Chair-reads-late is an old rule people will recognise.

*What fails or risks.* Face-down cards need everyone in the same session at once; a premortem done asynchronously over a day needs a different rule (reveal at a set time). Card flips need a reduced-motion version (it crossfades).

*Principles.* Calm: one turn-over. Pencil and ink: the assistant writes alone too and is read last.

*Needs.* Shared session state for a group (who has written, hidden content until reveal).

*Test.* Reasons written alone should overlap less than reasons said aloud. If the share of near-duplicate reasons is the same, the hiding isn't needed.

*Score.* Clarity 5 · Distinctiveness 4 · Feasibility 3 · Fit 4.

## V3: Reasons become work
*Idea.* The reasons, grouped, then sorted into three lanes: **change the plan now** (a reason you can fix before signing is fixed, not watched), **watch for it** (a sign, a source, an owner, and whether AUGUR can see it), **accept, by name** (who accepted it and why). The footer counts the outcome and ends "0 reasons dropped": no reason may leave the room as "noted".

*Sources.* Klein; Kawakita's KJ method (affinity grouping); RAID logs.

*What works.* It is the step most premortems skip, and the one that makes the 20 minutes pay. "Fix it now if you can" is a strong rule: two reasons changed the decision's words. Watches come out with their blind spots stated.

*What fails or risks.* Grouping is the slow part and the page shows only the result. Accepting a risk by name may feel like blame; it needs neutral wording.

*Principles.* Explain, never hide: strong (nothing dropped). Watches say what they can't see. Calm.

*Needs.* Watches created from a premortem group, owned by a person, linked back to the reasons.

*Test.* "0 dropped" is checkable: every reason in the room must have a lane. Over a quarter, at least one change or watch per premortem; a premortem that leaves only "accepted" risks didn't pay.

*Score.* Clarity 5 · Distinctiveness 4 · Feasibility 5 · Fit 5.

## V4: The fishbone
*Idea.* The same reasons on an **Ishikawa diagram of the failure**, with six fixed bones in plain words (vehicles, people, the contract, supplies, watching, the round and the depot). An empty bone is lit as a question: "Nobody named a supply: bins, fuel, spare parts. Ask the depot stores before signing."

*Sources.* Kaoru Ishikawa (1968), the six Ms.

*What works.* Fixed bones show what the room *didn't* think of, which a free list can't. One empty bone becomes one question to a named person, not a lecture.

*What fails or risks.* Six Ms fit manufacturing better than a contract decision; some reasons straddle bones. A diagram with long reasons on diagonal bones is hard to lay out at 1280. It's a view, not a second exercise.

*Principles.* Explain, never hide: the empty bone is shown. Calm.

*Needs.* A bone per reason group (a person's call), fixed bone names as product grammar.

*Test.* An empty-bone question should, at least sometimes, produce a reason that becomes a watch or change. If it never does over a quarter, drop the view.

*Score.* Clarity 3 · Distinctiveness 4 · Feasibility 3 · Fit 3.

## V5: How these usually fail
*Idea.* Before sorting, the room's reasons are laid beside **how renewals like this one actually failed here**: 7 of 11 past renewals under a performance notice went wrong, grouped by why. Each way of failing is marked "named in the room", "in the assumptions check", or **"nobody named it"** (lit): a supplier losing its contract manager happened once, and nobody thought of it. Reasons with no past case are grey: new here, not wrong.

*Sources.* Kahneman and Lovallo's outside view (1993); Klein.

*What works.* It joins the two strongest techniques in the run: the outside view supplies failures the room hasn't seen, the premortem supplies ones the record hasn't. The lit gap is one concrete question.

*What fails or risks.* Depends on a contract outcomes register with a "why it failed" field, which most organisations don't keep. Matching reasons to past failures is a judgement; the page needs a person to confirm each match.

*Principles.* Explain, never hide: strong. Calm: one match pass.

*Needs.* A reason field on contract outcomes in Data Atlas, from a controlled list.

*Test.* "Nobody named it" should be non-empty in a fair share of premortems where the record exists. If it is always empty, the room already knows the record and the step can go.

*Score.* Clarity 4 · Distinctiveness 5 · Feasibility 3 · Fit 4.

## V6: Tripwires
*Idea.* The premortem's watches across the contract year, drawn as **tripwires**: dark while nothing crosses them. A crossing lights one point and marks D-142 worth revisiting. Dashed wires are the ones AUGUR can't see; when one was crossed (tender preparation, 30 April), it was found by hand 12 days late, and the wire says so. ← → moves through the year.

*Sources.* Chip and Dan Heath, *Decisive* (2013), tripwires; indicators and warnings.

*What works.* Dark when normal: an uncrossed tripwire draws only its line. The 12-day miss is the clearest argument in the run for the events service's clock. A closed gap (the audit report arriving) is drawn differently from a crossing.

*What fails or risks.* A year-long timeline at desktop width squeezes events in January. It overlaps with the decision's own watch view (combined V3); it should be the same component.

*Principles.* Dark when normal: strong. Watches say what they can't see: strong.

*Needs.* The events service's clock (dates passing as events) and silence events; the shared time rail.

*Test.* Every tripwire AUGUR can see should fire within a day of its line being crossed. Every one it can't see should be listed as such on the decision before it is signed.

*Score.* Clarity 4 · Distinctiveness 4 · Feasibility 4 · Fit 5.

---

## Ranked
1. **V3 Reasons become work.** The step that makes a premortem pay.
2. **V2 Alone, then aloud.** The rule that makes it honest.
3. **V5 How these usually fail.** The outside view as a check on the room.
4. **V6 Tripwires.** The output, a year long and dark when normal.
5. **V1 News from the future.** A good opening, with a leak risk.
6. **V4 The fishbone.** A view worth keeping only for its empty bones.

## What I'd build first
**V2 then V3** as one flow: write alone, turn over together, read round, then sort every group into change, watch or accept with nothing dropped. Watches go to the decision with their blind spots. V5's record check sits between turn-over and sorting once contract outcomes carry a reason. V6 is the decision's watch view, shared with combined V3.

## Needs token
- `--x-proposed-future`, `--x-proposed-future-wash` (new).
- Card flips crossfade on reduced motion.
