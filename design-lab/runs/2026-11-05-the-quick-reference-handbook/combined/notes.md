# Round 2: critique

Two pieces that would ship together: the 2am card `card.md` (U-1) and its daylight check `daylight.md` (U-0). Tabletopped as a walk-through ([tabletop-combined.md](../checks/tabletop-combined.md)), which I played against the scenario in all three worlds ([results](../checks/results.md)). The injects couldn't be put to the operator, so of the prompt's four branches, "restart before reading" and "install the previous release" were tested only as the operator's own refusals, not as pressure. **The combined card did not win:** V2 from round 1 reached the better ending and U-1 didn't.

## U-1: the card (`card.md`)
*Idea.* V1's condition, objective and memory items on top; V2's four checks as the spine, re-run after anything you do; V4's plan table as the one decision; V3's time out as the pause point before the restore; V2-handoff's timeline as the log, started as a memory item; V4-handoff's three messages to stand down. A house rule decided in daylight answers "restore now or wait?" before 2am.
*Tabletop result.* **Ending B (contained) in W0, W1 and W2**, about 20 turns, no wrong turns, no one-way step without warning. Safe, but not the ending it was built for. Two causes, both the card's: (1) the **house rule was blank**, so step 2 had no answer; the operator read the printed half, saw one save in Activity and contained. (2) **"The first that fails decides" clashed with its own branches**: check b failed before c, so by the top line b decided ("contain"), while the "c fails" branch was the one that fit. The operator ran c anyway and was left unsure. What worked: every memory item, the NEVER line, check d, and the restore box (the operator added their own wait for Postgres). In W2, "Ask first" fails on the Upgrade Centre's error with no branch. 16 guesses.
*What it was built to hold.* Every trap in `key.md` has a line before the operator reaches it: restart (memory item 1), the moving "newest" (memory item 2, NEVER), going back past 0.18.0 (NEVER), the record a restore erases (pause point), the short stop list (the restore box), the second notice (the restore box), no Upgrade Centre (all four checks are commands; the backup's name is in the notice).
*What fails or risks.* It is a full A4 page, at the limit. Check c needs a judgement ("an error about its tables"), the one place it can't go by symptoms alone. The restore box departs from deploy.md's command on purpose: if the guide is right and this card is wrong, the card is the risk. It depends on a house rule someone must have filled in; blank, step 2 has no answer. Its two not-in-the-guides lines go stale the moment either the guide or the updater changes.
*Needs.* See SHORTLIST.md, product asks 1 to 6.
*Score (from the tabletop).* Recovery 3 · Safety 5 · Upkeep 3 · Fit 4 (was 4 · 5 · 3 · 4)

## U-0: the daylight check (`daylight.md`)
*Idea.* Two decisions made once (the window, the house rule), five lines that prove the way back, four that prove you can act at night, one honest line about what a production server can't prove, and a rule for keeping U-1 true.
*Tabletop result.* Indirect. The walk-through shows U-1 depends on U-0: the operator had never filled in the house rule, and the card stalled at step 2 without it. A card that needs a daylight check must still work when the check wasn't done.
*What fails or risks.* Line 1 can't see the scenario's W1: the updater's own backup overwrote the failed nightly result. Line 6 has no good answer today. Line 5 is hand-copied from release notes.
*Score.* Recovery 4 · Safety 4 · Upkeep 4 · Fit 4

## What round 2 should have done

Combine less. V2 alone was the stronger card. The merge added two things that needed judgement or daylight work (a house rule, a plan table) and one top-line rule that fought the branches below it. The next version of U-1 is V2 plus the fixes in `../checks/results.md`, plus one default for a blank house rule: "If the rule is blank: restore when Activity shows no more than a few saves since the backup and every check but c holds; otherwise contain."
