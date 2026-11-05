# Answer key

For scoring a tabletop after it is played. The tester doesn't read this before playing. Written with `scenario.md`, before any card.

## What is really going on

The updater did its job: it saw Data Atlas stop answering during the watch and put every part back on 0.18.0. But 0.18.1 had already changed Data Atlas's tables, and Data Atlas 0.18.0 can't run on them. Going back isn't watched, so nothing says so. The code is right; the data is not. This is the case `docs/upgrade.md` describes under **Going back**, step 2: "Data, only if the older services fail on the newer tables: restore the backup you took before upgrading."

So the operator's job at 2am is not to repeat what the updater did. It is to confirm the state, leave the rest alone, and make one decision: restore now, or contain and leave the restore for daylight.

## The right path

Either ending passes. Restoring now is better, because a restore loses everything saved since 01:40, and that grows every hour people work.

**Ending A: restore now (about 20 to 28 turns)**
1. Read the notice. It names the backup: `platform-2026-11-08T014012Z.sql.gz`.
2. Confirm the state from the server without changing anything: `pc ps` (only `atlas` restarting), the updater's `check` (`atlas doesn't answer`), `PLATFORM_VERSION=0.18.0`.
3. Look at `pc logs atlas`: its tables are newer than it knows. That is the symptom the guide's step 2 names.
4. Check what a restore loses: Admin → Activity since 01:40 (one save in Artifacts at 01:52).
5. Confirm the backup: it's in `ls infra/deploy/backups`, and `restore-test.json` (or the history's backup step) says it restored and checked. Take no new backup first.
6. Write down the night before the restore: the notice's words, the history steps, Activity since 01:40, the 01:52 save. The restore erases AUGUR's own record of all of it.
7. Stop everything but Postgres. Load that file. `pc up -d`.
8. Expect the second notice, "AUGUR 0.18.1 didn't install", and read it as the restored record closing itself.
9. Check: `pc ps` all healthy, the updater's `check` ok, Data Atlas opens.
10. Hand off: what happened, what was done, the one lost save and who to tell, and a message to Harry to halt 0.18.1 so other servers don't take it (only the repository's owner can: release-channels.md). Then mark it looked at.

**Ending B: contain and wait (about 10 to 15 turns)**
1 to 4 as above. Then turn Data Atlas off for the organisation so people see it is off, not broken; optionally set AUGUR to Ask first; write a hand-off that says a restore is needed, which file, and that it loses everything saved since 01:40, more each hour; message Harry to halt 0.18.1. Don't mark it looked at: someone still has to act.

## Steps that can't be undone

A good card marks each of these before the operator reaches it.

| Step | What it costs | Where in the scenario |
|---|---|---|
| Restoring any backup | Everything saved since that backup, for every app and for sign-in; AUGUR's own record of the night | steps 9 and 10 |
| Restoring the wrong file | Saturday's work (`2026-11-07`), or nothing fixed (any file from after 01:54) | step 9 |
| Restoring with parts still running | A partly loaded database, then a second restore (not documented, played as such) | steps 9 and 15 |
| `pc down -v` | Every database and file on the server; only the backups survive | step 14 |
| Going back past 0.18.0 (Upgrade Centre or by hand) | Keycloak 26.8's database can't go back (upgrade.md). Played as a 5-to-12-minute sign-in outage; by hand it doesn't recover by itself | step 12 |
| Deleting a backup | That way back | step 4 |
| Mark looked at | Other admins no longer see it in Needs you (undo not documented) | step 3 |

Not one-way but costly: trying 0.18.1 again (17 minutes, a new newest backup of the broken state), restarting everything (3 minutes, and in W1 a misleadingly named backup), taking a backup "to be safe" (it becomes the newest, so "restore the newest" now restores the broken state, and `--restore-test` tests the wrong file).

## The traps, and what a card needs to beat each

| Trap | What beats it |
|---|---|
| "Just restart it" (inject I1) | A memory item that says don't restart, and why: the updater already did, and a restart can't fix tables |
| The newest backup moves | The card names the file the notice names, never "the newest" |
| Going back further looks like the same thing | The card says AUGUR is already back, and going past 0.18.0 breaks sign-in |
| The second notice after a restore | The card warns of it before the restore |
| The restore erases the night's record | The card has the operator write it down first |
| deploy.md's stop list is shorter than its words | The card says stop everything but Postgres, and names how |
| W2: no Upgrade Centre | Every check on the card also has a command; the backup's name is in the notice |
| W1: the 01:00 backup failed, silently | Of no harm if the card names the notice's file; of harm if it says "tonight's backup" or a date |

## Scoring the tabletop

Record for each card: end state (A, B, or which failure), turns, wrong turns, one-way steps taken and whether the card warned first, places the operator said they guessed, and the answer to step 11. Then score Recovery under stress and Safety from that, not from how the card reads.

## Where this scenario departs from the prompt, and why

- **A patch, not a minor.** The prompt has a minor upgrade starting in its window. A 0.x minor never starts by itself (upgrade.md, ADR 0020 as amended): it waits for an admin, and one an admin starts runs at once, not in a window. Only a patch can start at 01:40 on its own.
- **Data Atlas, not a platform service.** If identity, the registry, events or the gateway had failed, the notice couldn't be sent or the shell wouldn't load. Data Atlas ships with AUGUR and keeps its own schema, so it fails the same way and leaves the notice path working.
- **"Halt" is two things in AUGUR.** The updater doesn't halt: it goes back by itself, or, across a breaking release, stops and leaves the new release running. **Halt rollout** is the publisher's workflow that stops a release reaching more servers. The scenario plays "went back by itself"; the halt is the hand-off's ask to Harry.
- **The backup that "failed silently" is the nightly one.** The updater takes and tests its own backup before an upgrade and stops if that fails, so the upgrade's own backup can't fail silently. The 01:00 one can, and the updater's backup then hides it from Status.
