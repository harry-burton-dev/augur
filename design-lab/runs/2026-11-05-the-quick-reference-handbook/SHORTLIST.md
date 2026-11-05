# Shortlist: the quick reference handbook

The cards were tested by walk-through, not by a live tabletop. Three fresh operators each wrote out every move they'd make with one card, and I played each against `checks/scenario.md` in all three worlds. Results: [`checks/results.md`](checks/results.md).

The headline: **by the time the admin wakes, AUGUR has already done the memory items, and the card that worked best was the one that never asked why.** The updater went back by itself, so the 2am card's first job is to stop the admin undoing that. Every operator, on every card, kept to that: none restarted, retried or went back past 0.18.0. The hard step is the one the guides only touch: the code went back but Data Atlas's data didn't, and the fix is a restore that also erases AUGUR's own record of the night. Only one card got a tired person through that restore safely: V2, the symptom card from round 1. **The combined card did not win.** It was safe but contained in every world, because it relied on a house rule nobody had filled in, and its top line fought its own branches.

| # | Build | Look at | What the tabletop showed |
|---|---|---|---|
| 1 | **Four things must hold.** Sign-in, every part answers, data fits the code, the way back exists. Check top to bottom; a table per failure; check again after every act; trust the checks, not the notices | [status tree](card/v2-status-tree.md) | The only card to reach the better ending (a safe restore) in W0, W1 and W2, with no wrong turns. Needs four fixes (below) |
| 2 | **Memory items are do-nots.** "Touch nothing: AUGUR may already have gone back", before any reading | [U-1](combined/card.md), [QRH](card/v1-qrh.md), [status tree](card/v2-status-tree.md) | 3 of 3 operators made no restart, retry, go-back, `pc down -v` or "safety" backup |
| 3 | **The way back has a name.** The file the notice names, never "the newest" or a date | the same three | 3 of 3 used the named file; W1's missing nightly did no harm |
| 4 | **Write the night down before the restore,** outside AUGUR | [timeline](handoff/v2-timeline.md), [ledger](handoff/v3-way-back-ledger.md) | Every operator who reached a pause point copied the notice, History and Activity first, and understood why |
| 5 | **Fix deploy.md's restore.** Stop everything but Postgres, as its words say, not only the parts its command names | [QRH](card/v1-qrh.md) vs [status tree](card/v2-status-tree.md) | V1 copied the guide's command and its restore would have left a partly loaded database; V2 stopped everything and loaded cleanly |
| 6 | **Decide restore-or-wait in daylight, with a default when nobody did.** And upgrade when someone is awake | [awake window](daylight/v4-awake-window.md), [U-0](combined/daylight.md) | The combined card stalled at a blank house rule; two operators said a tired person contains without one |

**Fixes to V2 before it ships** (from the walk-throughs; the tested file is left as it was tested):
1. Print the `pc` alias and `cd` to the checkout at the top. All three operators guessed at both.
2. Send Table 3 back through check 4 before the restore, so the file is proved on disk first.
3. Add a branch for "restored, and a check still fails": stop, hand off, don't restore again.
4. Say that `pc stop` stops AUGUR's own Tailscale node, not your SSH to the host; that the file name is in UTC; that `restore-test.json`'s `"file"` must be your file; and use `--since 1h`.

**Worth keeping as options:**
- [Quick reference card](card/v1-qrh.md): the shortest path (about 11 turns) and the best containment. It is right once deploy.md's restore is fixed.
- [U-1](combined/card.md): its pause point, NEVER line and three closing messages worked; its house rule and plan table didn't earn their place.
- [The way-back register](daylight/v2-way-back-register.md), for minors and majors.
- [SBAR, read back](handoff/v1-sbar.md), when there is a second admin.

**Not worth pursuing:** "the first that fails decides" as a top line over branches that say otherwise; a plan table that needs a daylight rule to choose between plans; [three pauses](card/v3-three-pauses.md) as the 2am card (no commands); the incident log as a step before every act; an eleven-line monthly proof sheet.

## Answers to the prompt's questions

**Which steps can't be undone, and how does the card say so before you reach them?**
A restore of any backup (it loses everything since that backup, in every app and in sign-in, and AUGUR's record of the night); restoring with parts still running (not documented; the scenario plays it as a partly loaded database); `pc down -v`; going back past 0.18.0 (Keycloak 26.8's database can't go back); deleting a backup; and Mark looked at (undo not documented). The cards warned three ways: a NEVER line, a pause point across the page before the one `ONE-WAY` step, and "Undo?" as a column. **In the walk-throughs no operator took a one-way step without a warning.** The one failure was subtler: V1 warned that the restore was one-way, but not that the guide's command would spoil it. A warning only protects you if the step it guards is right.

**What should the Upgrade Centre or the halt notice show, so the card can be shorter?** (product asks, ranked by what the walk-throughs hit)
1. **A restore the updater runs.** One action that stops everything but Postgres, loads the named file, checks it loaded, starts again, writes the night's record to a file first, and closes the restored upgrade with a sentence saying so. All three operators feared the restore most: the stop list, the psql output nobody could judge, cutting their own SSH.
2. **Say whether the data went back too.** "0.18.1 migrated *parts*; 0.18.0 runs on their tables." Then "data fits the code" is read, not judged.
3. **Price the restore.** "Restoring loses *n* changes made since 01:40", next to the named backup. Every operator had to count Activity by hand, and two asked what "little" meant.
4. **Watch the go-back.** Going back isn't watched, so "went back by itself" reads as over while a part keeps failing. Say "went back, and *part* still isn't answering".
5. **A notice that reaches a sleeping admin.** Notices are shell-only; email alerts are Proposed (ADR 0059).
6. **The updater's result on disk**, beside `last-backup.json`, so the card works when the Upgrade Centre doesn't load.
7. **Mark the one-way line in Go back** at 0.18.0.
8. **Keep every backup result,** so the updater's backup doesn't hide a failed nightly.

**Where does the card live, and who keeps it true?**
In `docs/upgrade.md`, as "When an upgrade goes back at night", printable, and linked from the notice and Needs you. Not only inside AUGUR: it is needed most when AUGUR is down, and a restore rewinds AUGUR. Any pull request that changes the updater, the backup script or the restore, or adds a "can't be undone" release note, changes the card too (AGENTS.md: the matching guide in the same PR). A small check could hold every command on the card to the guides. The card names the release it's true for and when it was last tabletopped. The walk-throughs add one rule: a card is only as true as the guide command it copies (V1), so a wrong guide makes a wrong card.

## Where this pushes back
- **On the default window (ADR 0020).** Sunday 02:00 is when the watch can least judge and the admin can least act. Recommend an early working-day hour, or Ask first.
- **On deploy.md's restore.** Its words say stop everything but Postgres; its command stops fewer, from before the apps shipped with AUGUR. The V1/V2 split is the run's clearest evidence. Untested on a real server: the restore test uses a throwaway database.
- **On this run's own combining round.** Merging four cards made a weaker one than the best of them. The next round should start from the winner and only add what the tabletop asked for.
- **On the prompt's case.** A 0.x minor can't start in a window; the updater goes back rather than "halts"; a failing platform service would block the notice (`checks/key.md`).

## Decisions for Harry (none taken)
1. Move the production default window from Sunday 02:00, or default to Ask first?
2. Put the card in `docs/upgrade.md`, linked from the halt notice?
3. Should the updater watch the go-back (ask 4)? It changes ADR 0020's watch.
4. Should a restore be an updater action (ask 1)? Privileged and one-way, so it needs a record.
5. Is deploy.md's restore stop list right with the shipped apps running? Please check it on a spare server.

## Not documented (found by the scenario, confirmed as gaps by the walk-throughs)
How a notice reaches a phone; how an admin reaches the host, and whether `pc stop` affects that; the words for an unavailable app; whether Go back marks 0.18.0 as one-way; what an older Keycloak does on a 26.8 database; whether deploy.md's restore works with the apps' services connected; what a clean restore prints; that restoring the updater's backup brings a second "didn't install" notice (code only); whether you sign in again after a restore; whether Mark looked at can be undone; whether turning an app off stops its container; what a part logs when its tables are newer than it knows.

## Method notes: what the ops brief should change
- **Walk-throughs stood in for a live tabletop, and the brief should say when that's allowed and what it can't show.** An operator writing every branch in advance never sees a real output and reacts to it, can't be put under the injects' pressure, and can list branches a tired person would never think of. Playing their branches against the scenario gave a fair end state, and the gaps were real (all three hit `pc`, the psql output and SSH), but the turn counts are my count of their moves, not timed play. Prefer a live tabletop; when only walk-throughs are possible, the operator should also mark the one branch they'd actually take at each fork, and the grading should say it was a walk-through.
- **Give the operator a minimum of context.** Every walk-through spent guesses on `pc` and the checkout path, which any real admin of this server would know. The scenario should hand the operator a short "your server" note (alias, path, how you reach it), so the guesses that are left are about the card.
- **Separate the authors.** The same mind wrote the scenario and the cards, so every card knew its traps. Writing the scenario first isn't enough. Have one agent write the scenario and key, and another the cards.
- **Score after the tabletop, and say so in the brief.** Scores before it were wrong in both directions: V2 went up, V1 and the combined card came down. A run should either wait for the tabletop or publish its shortlist as a draft, as this one did.
- **Check the prompt's case against the guides first.** The case didn't fit them (a minor in a window, "halt", a platform service). Writing the scenario from the real code found more than the cards did: the stop list, the second notice, the unwatched go-back.
- **Don't let round 2 merge by default.** On a UI run, combining winners usually helps. Here it added parts that needed daylight work and a rule that fought the branches. The brief should let round 2 be "the winner, fixed".
- **"Fit with AUGUR's guides" shouldn't reward copying a guide's gap.** Score fit as "uses only documented behaviour, and flags where the guide is wrong".
- **Four variants of a card differ less than four prototypes.** V1 and V2 differed in idea; V3 and V4 mostly in form. The daylight and hand-off surfaces sit closer to the writing track. Three surfaces of three variants, plus a stronger scenario, may be the better size for ops.
