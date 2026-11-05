# Before you need it: critique

Surface 3. What the admin checks or sets up in daylight so the 2am card can be short. These weren't tabletopped directly. The card walk-throughs ([results](../checks/results.md)) tested them indirectly, and showed what was missing at 2am: no operator knew what `pc` was or where to run it, none knew how to reach Harry, and the one with U-1 had no house rule. Scores are final where the walk-throughs bear on them, otherwise my reading.

---

## V1: The proof sheet (`v1-proof-sheet.md`)
*Idea.* Eleven do-confirm checks, monthly and the day before a window, each a real command with what good looks like and a box for the pasted output. Each line takes one question off the 2am card.
*Sources.* Degani and Wiener (do-confirm for routine); docs/upgrade.md, "Before you start"; docs/deploy.md, Backups.
*Tabletop result.* Indirect: the walk-throughs never used a date-named file, so W1 did no harm; but the scenario's W1 (a nightly backup that failed and was then hidden) is exactly what line 1 would catch the next day, and nothing the night before.
*What works.* Everything on it can be pasted, so an agent or Harry can check it from a message. Lines 6 and 7 (reach the server without AUGUR; step-up works) are what the scenario's W2 and every `ACT` in the Upgrade Centre depend on, and no guide asks you to check them.
*What fails or risks.* A monthly sheet doesn't catch a backup that fails the night of the window: in W1 the updater's own backup overwrote `last-backup.json`, so line 1 shows `ok` the next morning too. Line 9 has to be updated by hand each release that adds a "can't be undone". Eleven lines is long for something done monthly; the first three would be skipped first.
*Needs.* A history of backups, not only the last one (last-backup.json keeps one result), so a failure the updater's backup covered still shows.
*Score.* Recovery 3 · Safety 4 · Upkeep 3 · Fit 5

## V2: The way-back register (`v2-way-back-register.md`)
*Idea.* One row per upgrade window, filled in before it opens: what migrates, what can't be undone, the furthest you may go back, who's awake. Then the four ways it can end, each with its way back, cost and what it depends on, worked out in daylight. Kept outside AUGUR, because a restore rewinds AUGUR.
*Sources.* "The way back is recorded" (the annotated game run); the release notes' "can't be undone" lines in docs/upgrade.md.
*Tabletop result.* Indirect. No operator went near the Keycloak trap: the cards' NEVER line was enough. With the register, the trap (step 12) is answered before 2am: "furthest you may go back: 0.18.0".
*What works.* It moves the hardest thinking (where can't I go back past, what does a restore cost) to daylight. "Not in AUGUR" is the one rule here the scenario proved necessary: after a restore, AUGUR's record of the night is gone.
*What fails or risks.* An Automatic patch window comes every week: nobody fills a form every Sunday. It is right for minors and majors, which wait for an admin anyway, and too much for patches. Most of its fields could be filled by the Upgrade Centre itself.
*Needs.* The Upgrade Centre to show "the furthest you can go back without a restore" and "parts that migrate data" per release. Then the register is a printout.
*Score.* Recovery 4 · Safety 5 · Upkeep 2 · Fit 4

## V3: Rehearse it (`v3-rehearsal.md`)
*Idea.* A quarterly rehearsal of what can be rehearsed, each with where it may run: the halted-release test install (dev or preview only, ADR 0051), the updater's one look, the restore test, the off-server restore test, a whole restore on a spare machine, and a tabletop of the card itself.
*Sources.* ADR 0051; docs/deploy-test.md (broken mode); Google SRE (the runbook as a living record).
*Tabletop result.* Indirect. This sheet is the only one that makes playing `checks/scenario.md` a routine.
*What works.* It is honest about one-server deployments: most can't rehearse the go-back on their own hardware, and the sheet says to write that down rather than pretend. The "whole restore on a spare machine" row names a real gap: no guide gives a restore rehearsal.
*What fails or risks.* A quarterly rehearsal is the first thing a one-admin deployment drops. It needs a spare machine most don't have. It doesn't make the 2am card shorter, only truer.
*Needs.* A documented restore rehearsal (in docs/deploy-test.md, for Harry to write); the restore command fixed first.
*Score.* Recovery 3 · Safety 4 · Upkeep 3 · Fit 4

## V4: Upgrade while someone is awake (`v4-awake-window.md`)
*Idea.* Argues against the default Sunday 02:00 window. At night the watch is too quiet to judge errors (the guide says so), the admin is asleep, and a restore that would cost nothing at 02:00 waits until it costs the morning. Move the window to an early working-day hour, or set Ask first. Then set up how you'd hear, who else can act, and the restore-or-wait rule.
*Sources.* docs/upgrade.md (the watch, windows, the light watch); ADR 0020 (amended: night windows too quiet); UK incident command (the decision made before the incident).
*Tabletop result.* Indirect, and the strongest evidence of this surface: U-1's operator stalled at the blank house rule and contained. Without a rule made in daylight, a tired person contains; two of the three operators said so.
*What works.* It removes the scenario rather than answering it. The watch gets the calls it needs to judge errors, and a failure meets someone awake. The restore-or-wait rule is a one-line answer to the hardest 2am decision. It is the only sheet that names how the notice reaches the admin, and that the answer is "not documented".
*What fails or risks.* It pushes back on an Accepted default (ADR 0020), so it needs Harry's decision. A morning window risks people's work landing on a release that then goes back; a failure in it has more saved work at stake. Some deployments will want nights.
*Needs.* Harry's decision on the default window. A notice that reaches a phone.
*Score.* Recovery 5 · Safety 4 · Upkeep 5 · Fit 3

---

## Ranked (after the tabletop)

1. **V4: Upgrade while someone is awake.** The cheapest change with the biggest effect, and it needs a decision, not a form.
2. **V1: The proof sheet,** lines 1, 2, 5, 6, 7 and 9, plus a line the walk-throughs asked for: the `pc` alias and the checkout path, written on the card.
3. **V2: The way-back register,** for minors and majors only, and as a product ask for the Upgrade Centre to fill it in.
4. **V3: Rehearse it.** Right, and the first thing that will be dropped.

What goes into `combined/daylight.md`: V4's rule and window on top, V1's six lines that matter, V2's "furthest you may go back" and "outside AUGUR" rules, and V3's one honest line about what a one-server deployment can't rehearse.
