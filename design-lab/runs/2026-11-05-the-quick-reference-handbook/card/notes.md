# The card: critique

Surface 2 of the quick reference handbook. Four forms of the 2am procedure for an AUGUR upgrade that went back or didn't finish. Each is meant to be used alone: in the tabletop the operator has the card and nothing else, not the guides.

**Scores.** V1 and V2 were tabletopped, and their scores come from that: fresh operators wrote walk-throughs from the card alone, and I played each against `checks/scenario.md` in all three worlds ([results](../checks/results.md)). V3 and V4 weren't played, so their scores stay my reading of the card.

**Shared by all four.** The same condition (went back, didn't install, kept running after the watch saw a problem); the memory item "touch nothing, AUGUR may already have gone back"; the backup named, never "the newest"; the Keycloak 26.8 boundary at 0.18.0 as a do-not; and Harry as the one person who can halt a release for other servers. All four were written after `checks/scenario.md`, so all four know its traps. That is a leak the brief tries to prevent by order alone, and it can't fully: see SHORTLIST.md, "What didn't work".

---

## V1: Quick reference card (`v1-qrh.md`)
*Idea.* The Boeing QRH layout taken straight: condition, objective, three boxed memory items, then numbered read-do steps with "go to step N". It uses only the guides' own words and commands, nothing from the updater's code.
*Sources.* Boeing 737 QRH structure; Degani and Wiener (read-do for rare, ordered tasks).
*Tabletop result.* [Walk-through](../checks/tabletop-v1-qrh.md). Ending B (contained) in W0, W1 and W2, about 11 turns, no wrong turns: the shortest path of the three. The operator leaned to containing because they were "half asleep". Its restore branch would have failed in every world: deploy.md's stop list leaves the apps' services running, and the scenario plays that as a partly loaded database. The operator saw the gap ("stop list doesn't include atlas, updater") and followed the card anyway. W2: step 1's "won't load" branch worked; "Ask first" then fails on the same error, with no branch. 14 guesses: `pc` and where to run it, whether `pc stop tailscale` cuts SSH, what "little" means, UTC or local.
*What works.* The first three lines say "wrong card?" and "what done looks like" before anything else. Nine steps, each with one check and its two outcomes, so a tired person is never asked to judge more than one thing at a time. The pause point before the restore names three things to say out loud. The do-not box gives each don't its cost.
*What fails or risks.* It copies deploy.md's restore command word for word, and that command stops only some parts while its own words say "everything but Postgres". If the scenario's reading is right, V1 leads straight into a partly loaded restore (scenario step 9). Being true to the guide carries the guide's gap onto the card. It doesn't warn that a restore brings a second, alarming notice, because only the code says so. Step 4 branches on the part's log saying "tables newer than it expects": the words of the log aren't documented, so the branch may not match what a real log says. One page only if printed small.
*Needs.* A restore command in the guide that stops everything but Postgres; a guide line on the notice after a restore; the words a part logs when its tables are newer than it knows.
*Score (from the tabletop).* Recovery 3 · Safety 2 · Upkeep 3 · Fit 4 (was 4 · 3 · 3 · 5)

## V2: Four things that must hold (`v2-status-tree.md`)
*Idea.* A symptom-based card, after nuclear plants' critical safety function status trees. Four things must hold: sign-in works, every part answers, the data fits the code, the way back exists. Check them top to bottom; the first that fails sends you to its table. Check all four again after anything you do. It never asks why.
*Sources.* Symptom-based emergency procedures (act on what you see, not the cause you guess); Google SRE (mitigate first).
*Tabletop result.* [Walk-through](../checks/tabletop-v2-status-tree.md). **Ending A (restored) in W0, W1 and W2**, about 20 turns, no wrong turns, no one-way step without warning: the only card that reached the better ending. The symptom order carried the operator from "a part is restarting" to "its tables are newer" to the restore without asking why. "Trust the checks, not the notices" was read as meant. W2 cost nothing but the History steps in the record. The flaw it showed: Table 3 doesn't send you back to check 4, so the operator restored without first confirming the file was on disk and tested. 12 guesses; the load-bearing ones were `pc`, `pc stop` and SSH, which file `restore-test.json` tested, and what psql output is normal.
*What works.* It doesn't depend on the notice being right, or on the Upgrade Centre loading (W2), or on the cause. "Check all four again after anything you do" catches a restore that didn't take. It is the only card that says notices after a restore describe AUGUR's rewound records, so the checks win. Check 4 makes the way back a thing that must hold, not an afterthought, and its table says what to do when the named file isn't there. The restore stops everything and starts Postgres alone, as deploy.md's words say.
*What fails or risks.* That restore line is not deploy.md's command; it is two compose commands put together to do what deploy.md's words say. It is flagged on the card, but it is a judgement the guide hasn't made. Four tables plus the restore box is a page and a half. "Data fits the code" needs a person to read a log line and judge it, the one place a symptom card can't avoid judgement. Check 1 asks the operator to sign in, which may need a code at 2am.
*Needs.* As V1, plus a "what is safe to restore" signal from the updater (see SHORTLIST.md, product asks).
*Score (from the tabletop).* Recovery 5 · Safety 4 · Upkeep 3 · Fit 4 (was 4 · 4 · 3 · 4)

## V3: Three pauses (`v3-three-pauses.md`)
*Idea.* The WHO surgical checklist: do-confirm, killer items only, three fixed pauses: sign in (before you touch), time out (before anything one-way), sign out (before you leave it). Between the pauses you work from what you know.
*Sources.* Gawande, *The Checklist Manifesto*; the WHO surgical safety checklist; Degani and Wiener (do-confirm).
*Tabletop result.* Not played (ranked out before the tabletop).
*What works.* The shortest card, and the one most likely to be kept true: almost no commands, so little goes stale between releases. "Time out" names every one-way step in one place, and it is the only card that makes "am I awake enough?" a checkbox. "Sign out" makes the hand-off's place a thing you write down.
*What fails or risks.* Do-confirm assumes you know the procedure. A one-admin deployment restores maybe once a year: at 2am that admin doesn't know it. The card says "a restore of the named file fixes it" and gives no command. Used alone in a tabletop, it leaves the operator guessing at the restore, which is the guess that costs most. It is the right form for the daylight check, not the 2am one.
*Needs.* The guide open beside it, which defeats the point of a card.
*Score (not tabletopped).* Recovery 2 · Safety 4 · Upkeep 5 · Fit 3

## V4: You are in command (`v4-in-command.md`)
*Idea.* Incident command for one person. Take command and write the first log line; size it up with six read-only looks; choose one of three plans (hold, contain, restore), each with its cost and whether it can be undone; look again every 15 minutes; stand down. The log is the hand-off.
*Sources.* UK incident command (one person in command, a stated plan, a reassessment interval); Google SRE, "Managing Incidents" (mitigate first, the living record).
*Tabletop result.* Not played (ranked out before the tabletop).
*What works.* The plan table is the clearest consequence preview of the four: each plan with when, cost and "can undo?". Only this card states the plans never on offer. The 15-minute look stops the slow drift of one fix piled on another. The log removes the separate hand-off step: writing it as you go is the hand-off.
*What fails or risks.* "Command" is a team idea; alone at 2am it is ceremony. Writing a log line before every act is real work for a tired person, and the first thing they'll skip. Plan C points at deploy.md for the restore without its commands, so alone it leaves the operator to guess, as V3 does. It never says what a part's failure on its tables looks like.
*Needs.* The restore commands on the card. A place for the log that survives the restore (a file outside the database; see `handoff/`).
*Score (not tabletopped).* Recovery 3 · Safety 4 · Upkeep 4 · Fit 3

---

## Ranked (after the tabletop)

1. **V2: Four things that must hold.** Reached the restore, safely, in all three worlds. It also beat the combined card (see `../combined/notes.md`).
2. **V1: Quick reference card.** The clearest read-do and the shortest path, but its restore would have failed: the guide's own stop list.
3. **V4: You are in command.** The best plan table and log; too much ceremony and no restore commands.
4. **V3: Three pauses.** The right form for daylight, the wrong one for 2am.

**Tabletopped: V2 and V1.** They were chosen because they are the only two that a person with nothing but the card could carry through a restore, and they differ in the way the tabletop can measure: V1 follows the events in order and the guide's own commands; V2 follows symptoms and departs from the guide's restore command on purpose. V1's restore would hit the partly loaded restore and V2's didn't: that is evidence for changing deploy.md, not only the card.

What I'd build now: V2 as it stands, with the fixes in `../checks/results.md` (define `pc`, send Table 3 back through check 4, a branch for "restored and still failing"). The combining round added a house rule and a plan table, and the tabletop showed both cost more than they gave when daylight work wasn't done.
