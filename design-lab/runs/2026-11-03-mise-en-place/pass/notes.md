# Surface 5 · The pass

**The moment:** everything is tidied and mapped. Before anything reaches Triage, the pass shows what will be created, changed or linked, what is set aside, what was left out, and the recipe that made it, and checks it against the file's own total. In the kitchen the head chef checks every plate at the pass and the line answers "heard".

**Shared data:** the run's one sample. October's run lands 24 inspections, proposes 1 new van (WF-09), changes 21 odometers and links to 3 depots and 1 firm already kept (46 proposals). It sets aside 1 line (the loan van) and 1 value (NV-06's `c.12k`), and does not bring in 1 exact copy, the title, names, empty and TOTAL lines, or 2 other sheets. The file's TOTAL says 25 = 24 + 1. What landing would move outside Data Atlas is worked out from the vans' last inspection dates and a 6-month rule: Jo Barnes's briefing "North depot vans overdue" goes from 7 of 18 to 2 of 18. Keys: **R**, **T**, plus each page's own.

---

## V1: The ticket rail
*Idea.* One ticket per kind of change, hung on a rail: make 24 inspections, make 1 van, change 21 odometers, link 4 kept things (not changed), set aside 2 (1 line, 1 value), not brought in 9 (lines and sheets, said), waiting 24 (on "kind of visit"). Pick a ticket to see its rows and what it means. A balance line (file says 25 = 24 land + 1 set aside, balances) and "Send to Triage"; after sending, "heard: 46 proposals are in Priya Nair's Triage. The tray stays with you."

*Sources.* The kitchen's ticket rail at the pass; Power Query's "applied steps" result preview.

*What works.* Hanging the tray and the left-out on the *same* rail as what lands is the clearest "nothing silently dropped" in the run: the operator can't see the plate without seeing what didn't make it. "Link, not changed" separates touching a kept thing from changing it, which is the difference Triage cares about. The balance sits next to the send button.

*What fails or risks.* Seven tickets is the limit; a recipe with more kinds of change would need grouping. Numbers on tickets invite people to read only numbers. "Not brought in: 9" mixes lines and sheets; they should be two tickets once there are more.

*Principles.* Consequence preview: strong. Explain, never hide: strong. Calm: tickets hang once; only Send is lit.

*Needs token.* `--x-proposed-pass-edge`.

*Scores.* Clarity 5 · Distinctiveness 4 · Feasibility 5 · Fit 5

## V2: It balances
*Idea.* The pass as a reconciliation in two ledgers. Every line: 32 in the sheet − 2 title − 1 names − 2 empty − 1 TOTAL = 26 lines of visits − 1 exact copy = 25 visits ✓ (the file's own TOTAL) − 1 set aside = 24 inspections land. Every value on what lands: 168 statements (24 × 7) = 44 as the file had them + 85 changed by a recipe line + 24 said once for the file + 14 nothing to say + 1 not known yet = 168 ✓, and 24 waiting on "kind of visit". Pick any ledger line and its lines light in the sheet.

*Sources.* Bank reconciliation; the accountant's cross-foot; the reference desk's "the answer has a base and balances".

*What works.* It is the proof behind "nothing silently dropped": you can walk from 32 to 24 and see every line that left, and why. The values ledger is a new idea: it says how much of what lands the recipe actually touched (85 of 168), which is what a careful reviewer wants to know.

*What fails or risks.* Two ledgers is an auditor's view; most operators will look at the last line and the ticks. "Nothing to say" (empty notes) is a sixth kind of empty the catalogue's six don't name cleanly (it is closest to "none").

*Principles.* Explain, never hide: strongest of the surface. Calm.

*Needs.* The engine's per-line role and per-value provenance (already needed for V5 of the grammar).

*Scores.* Clarity 4 · Distinctiveness 4 · Feasibility 5 · Fit 4

## V3: Before and after
*Idea.* A diff of what Data Atlas keeps: each van as it is now and as it would be if Priya keeps everything. Struck values are today's, values with a seam are what this file brings (last inspected, odometer, inspections added as dots with their results, due: overdue → in date). A summary row: 22 vans change, 1 new, 24 new inspections, 21 odometers move, 11 come back in date, 2 still overdue, 9 not in this file. A toggles the vans not in the file.

*Sources.* A code diff; a stocktake sheet; wear and time's seam.

*What works.* It answers the question a manager actually has ("what will be different?") in the units they care about (vans, due dates), not in rows. "11 come back in date" is a consequence nobody asked the bench to compute and everyone wants. NV-06's odometer shows a not-known-yet mark rather than a blank.

*What fails or risks.* It is per van, so it hides that NV-04 got two inspections (shown only as two dots). A file of 2,000 records needs grouping by depot. Strikes in a table are noisy; seams carry the meaning better.

*Principles.* Consequence preview: strong. Visible repair (strike and seam). Calm: after-values fade in once.

*Needs.* Due rules per kind (here: six months), as configuration.

*Scores.* Clarity 4 · Distinctiveness 3 · Feasibility 4 · Fit 4

## V4: Taste before it goes
*Idea.* The head chef tastes some plates. The pass picks every plate one of the operator's answers touched (the new van, the odometer set aside, the two W'field lines joined by hand) plus three at random, each shown against its raw line, with "Same" or "Not right". A strip shows which of the 24 are being tasted. If one is not right, the pass stops and shows which recipe line made the wrong value and every other plate it made. The random pick is seeded by the file, so Priya can taste the same plates in Triage.

*Sources.* The head chef at the pass; acceptance sampling (ISO 2859); jidoka.

*What works.* "These aren't chosen to look good" is the right rule: sample where a person made a call, then a few at random to check the rules nobody looked at. Seeding by the file makes the check repeatable by the second person, which is what turns it into a real control.

*What fails or risks.* Seven checks per month is fine; it must not grow with file size (the random part stays small). People will click "Same" without reading; the raw line next to the plate is the only defence. A "Not right" needs a quick way to say which value.

*Principles.* Explain, never hide: good. Calm: no light until "Not right".

*Needs.* A seeded sample stored with the run.

*Scores.* Clarity 4 · Distinctiveness 5 · Feasibility 4 · Fit 4

## V5: The cook sends, the pass decides
*Idea.* The same pass from both ends. Left, Ade's bench after sending: the tray stays with him. Right, Priya's Triage: "Kestrel's October 2026 visits, from Ade Mensah", 46 proposals made by recipe "Kestrel monthly visits" (v1) from D-2291, the balance, the recipe, the answers Ade gave, and what he tasted. Priya keeps all but the new van ("Is WF-09 on the fleet list yet? Holding it until Dana confirms the lease"). Its inspection is held with it (23 kept, 1 held). Ade's side says "heard: Priya Nair kept 44 of 46. 2 are held with a question."

*Sources.* The brigade's pass (the cook plates, the chef sends); the two-person rule; Triage in docs/atlas.md ("nothing skips it").

*What works.* It shows that the pass is one object both people see, not a message. The dependency (a held van holds its inspection) is shown as a count. "Heard" travels back with the decision and the note, which closes the loop without a notification storm.

*What fails or risks.* Triage today lists proposals; a bundle from a recipe run is a new Triage shape. If Priya and Ade are the same person on a small deployment, the two keys collapse; Triage should say "you are deciding your own run".

*Principles.* Explain, never hide: strong. Calm: one decision, one quiet answer.

*Needs.* Triage bundles by run, with the recipe and tray attached; holds that carry their dependants.

*Scores.* Clarity 5 · Distinctiveness 4 · Feasibility 3 · Fit 5

## V6: What it moves
*Idea.* The pass shows what landing would move beyond Data Atlas, worked out before anything is sent: Jo Barnes's briefing in Artifacts goes from 7 of 18 overdue to 2 of 18 (5 overdue vans were inspected in this file; its readers see a seam until Jo republishes); Priya's intent in Mandate gets 14 inspections as evidence (nobody notified); Jo's watch tells her once, with the reason. A side column says what *doesn't* move and why: NV-06's odometer stays at 11,900, the loan van isn't counted anywhere, a held WF-09 keeps Westfield's counts as they are, and "kind of visit" can't be counted by anything yet.

*Sources.* Consequence preview (cinematic run); reach before act and watches say what they can't see (briefing run).

*What works.* It connects this run to the briefing run's world: the late file is the reason the overdue count moves, and the watch says so once. "What doesn't move" is as useful as what does.

*What fails or risks.* Working out downstream effects needs every app to answer "what would change if…?", which nothing does today; Data Atlas only knows bindings. For a big file the list would be long and should show only things a person owns or watches.

*Principles.* Consequence preview: strongest. Reach before act. Calm: cards light once.

*Needs.* A "would change" query across bindings and watches; due rules.

*Scores.* Clarity 4 · Distinctiveness 4 · Feasibility 2 · Fit 5

---

## Ranked
1. **V1 Ticket rail** with **V2's balance** under Send.
2. **V5 The cook sends, the pass decides**: the pass is one object, seen at both ends.
3. **V4 Taste before it goes**: answers first, then a seeded random few.
4. **V3 Before and after**, as the "what will be different" tab.
5. **V6 What it moves**, once apps can answer "would change".
6. **V2 It balances** in full, for reviewers.

**What I'd build first:** the ticket rail (V1) with the balance line from V2 and a "taste" step from V4 before Send. The same object goes to Triage (V5) with the recipe, the answers and the tray attached, so Priya sees what Ade saw. V3 and V6 are tabs on the same pass once the data exists.

## Where this pushes back
- **Triage gets bundles, not just items.** A recipe run's 46 proposals belong together (they balance against one file). Triage should keep the bundle as a unit while letting a person hold part of it. That changes Data Atlas's Triage, which today is item by item.
- **Two keys, or one.** Kitchens separate the cook from the pass. On small deployments the operator *is* the Triage decider. Recommend: allow it, but say so on the pass ("you are deciding your own run") and record it.

## Needs token
`--x-proposed-pass-edge` (the pass's lit edge). Uses the run's other tokens.
