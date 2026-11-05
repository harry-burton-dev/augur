# Walk-through, 02:05, card U-1

Legend: [GUESS] = the card left me guessing. [ONE-WAY] = I believe it cannot be undone. [STOP] = I go back to bed.

## Memory items (before anything else)

1. I read the notice again. Condition matches: "AUGUR went back to 0.18.0 by itself". It does not say "halted by its publisher", so this is the right card.
   - Move: no command. I do not tap Retry, Restart or Go back in the Upgrade Centre.
   - Next: continue.

2. Write down the backup file the notice names. I type on my laptop, and in the log I will make in move 4:
   `platform-2026-11-08T014012Z.sql.gz`
   - Note: the notice names the file, and the card says never to use "the newest". Good.
   - [GUESS] The date in the file name (11-08) may not match the date I think it is. I am tired and the card does not tell me to compare. I would only notice if I looked at `date`. I would not act on it, but it bothers me.
   - Note: the backup time is 01:40:12 UTC, and it is now about 02:05. If the clock is UTC, only about 25 minutes of data sit after the backup. The card does not say this. I infer it myself, and I am not sure the server runs UTC.

3. SSH in.
   `ssh admin@<the server's Tailscale name>`
   - [GUESS] The card never says where to be. I `cd /home/admin/augur`. The card says `infra/deploy`, so I `cd infra/deploy` too, since `ls infra/deploy/backups` and the `pc` commands assume a spot.

4. Start the log, before doing anything.
   `date -u; date`
   `nano ~/augur-night-2026-11-05.md` (I use today's date). I write: the notice text, the file name, the time, "starting four checks".
   - [GUESS] `<date>` has no format.
   - The log is in my home directory, not in `infra/deploy`, as the card says.

5. [GUESS] `pc`. The card never defines it. I try `type pc` or `which pc`.
   - If it exists (an alias or a script): go on.
   - If "not found": I try `alias`, then `ls ~/augur/infra/deploy`, then look for a compose wrapper. I do not know what it expands to, and I do not know which compose files or env file it passes. I do not guess `docker compose` with bare flags, because the wrong project name could point at the wrong stack. If I cannot find it in about five minutes: [STOP]. I write the log, leave everything as it is, and go to bed. The card says to touch nothing, and AUGUR may already be fine.

## Step 1. Four checks

6. Check a. On my phone, reload the AUGUR tab and sign in. I paste what I see into the log ("shell loads" or "does not").
   - [GUESS] I am already signed in from last night, so "sign in works" is only half proven. I sign out and back in if the card means that. It does not say.
   - Shell loads: a holds. Go to move 7.
   - Shell does not load, or sign-in fails: a fails. Do not change releases.
     `pc logs --since 15m keycloak identity | tee -a ~/augur-night-2026-11-05.md`
     Then go to step 4 (hand off). Skip 7-9, but still run the four checks once more in step 4. [GUESS] The card says "step 4 (hand off)" but I do not know whether I should also do b, c and d. I would do d to be safe, since it only reads.

7. Check b.
   `pc ps | tee -a ~/augur-night-2026-11-05.md`
   `pc exec -T updater node dist/index.js check | tee -a ~/augur-night-2026-11-05.md`
   - Look for: every part `healthy`, and `"ok":true` from the check.
   - All healthy and `"ok":true`: b holds.
   - A part is `unhealthy`, `restarting`, or missing (likely atlas): b fails. Write down which parts.
   - [GUESS] If `updater` itself is not running, `pc exec` errors out. The card does not say what that means (b fails, I assume).
   - [GUESS] "healthy" vs. a part with no healthcheck (shows only "Up"). I would count it as not healthy and look at its logs.

8. Check c.
   `pc logs --since 15m atlas | tee -a ~/augur-night-2026-11-05.md` (and each other part that was not healthy)
   - Look for: any error about tables, schema, columns, migrations, or data.
   - No such error: c holds.
   - There is such an error: c fails, "the code went back, the data didn't". Go to step 2.
   - [GUESS] Judging "an error about its tables, schema or data" at 2 a.m. is a judgement call. A message like "relation does not exist" or "column ... does not exist" I would count. A vague timeout, connection refused, or "migration newer than code" I would not be sure about. If unsure, I treat it as c failing (the safer reading, since step 2 only asks me to choose).
   - Note: the 15-minute window. The upgrade may have been 20+ minutes ago, and the failing part may only show old errors. The card does not warn about this. I would extend with `--since 60m` and say so in the log.

9. Check d.
   `ls -l infra/deploy/backups | tee -a ~/augur-night-2026-11-05.md`
   `cat infra/deploy/backups/restore-test.json | tee -a ~/augur-night-2026-11-05.md`
   - Look for: `platform-2026-11-08T014012Z.sql.gz` is in the listing, and the test says `"ok":true`.
   - File there, test ok: d holds.
   - File missing: d fails. No restore tonight. Plan B, then step 4.
   - Test `"ok":false` or the file missing: d fails (same).
   - [GUESS] Does `restore-test.json` refer to my file, or to some other backup (e.g. the newest)? The card does not say, and I cannot tell from "ok":true alone. I look at whether it names a file; if it names a different one, I treat d as failing.
   - Order: the card says "top to bottom; the first that fails decides". So if a fails, I stop at a, and so on.

10. Branch table, for what the checks decide.
    - All four hold: go to step 4. Nothing to do. I do the checks again and go to bed. [STOP] after step 4 messages.
    - a fails: described above, step 4.
    - b fails, c holds: "contain" with plan B (move 13), then step 4.
    - c fails: step 2.
    - d fails: plan B, then step 4.
    - [GUESS] What if b fails AND c fails AND d fails? "First that fails decides", so b decides: contain, even though c would send me to step 2. But with b failing at the top, I would never run c. I run c anyway because it is read-only and the log needs it. I decide by the card's order, but I do not like it.

## Step 2. Choose, and say it

11. Read Admin -> Activity since the backup time (01:40). On my phone or laptop: Admin -> Activity, filter by time from 01:40. Count what people saved, by app, and put the count in the log.
    - [GUESS] Where exactly the time filter is, and whether Activity records saves in every app (does an app that does not report to Activity look like "zero loss"?). The card does not say. I would write "Activity shows N; may not show everything".
    - [GUESS] Time zone: Activity may show local time and the file name is UTC (the trailing Z). I would convert in the log.
    - Zero or near-zero saves since 01:40 (it is 2 a.m., so likely): restoring costs little.
    - Real saves exist: restoring loses them.

12. The HOUSE RULE.
    - [GUESS, biggest gap] The house rule on the card is blank: "restore at ______ with ______". The card says it was "set in daylight", but I never set it, or I cannot tell if I did. I cannot recall a rule. I do NOT invent one.
    - The only half-rule I have: "If restoring loses nothing people saved, restore tonight. Otherwise contain." That first sentence is printed, so I read it as set. So:
      - Activity shows nothing saved since 01:40 and the checks say restore is safe (d holds): plan C is allowed.
      - Anything saved, or I am unsure: plan B.
    - Tired as I am, I lean toward plan B anyway: "the house rule says wait, or you're too tired for 20 minutes". I am. Plan B is undoable. So I choose B unless c clearly fails AND zero loss AND d holds.
    - [GUESS] "20 minutes": the card says plan C would take 20 minutes, but not how I know it will not take longer. Database size is unknown.

13. Plan B, contain. (Undoable, the card says yes.)
    - Admin -> Apps: turn atlas (the failing app) off for the organisation. Log it first ("write before you do"), then do it.
    - Upgrade Centre: set AUGUR to "Ask first".
    - [GUESS] Which app is "the failing app" if b shows more than one, or none by name. I would take the one the notice names (atlas).
    - [GUESS] Does turning the app off hide its data from people, or lose anything? The card says "the app is off". It says nothing about whether turning it off is also a thing to undo later. It says "yes" to undo, so I trust it.
    - [GUESS] Does "Ask first" stop AUGUR from retrying the same upgrade overnight? The card says "never try the same upgrade again" in the NEVER list, so I assume yes, but it does not say that this is why.
    - Then step 4.

## Plan C, only if I choose it

14. PAUSE POINT. I say out loud and write in the log (the card requires it):
    - the file by name: `platform-2026-11-08T014012Z.sql.gz`
    - what it loses (from Activity): the count from move 11
    - that the night is copied into the log: the notice, the History steps, Activity since the backup. I do that now: copy the notice text, copy the Upgrade Centre History steps, and copy the Activity list since 01:40 into the log.
    - [GUESS] "History steps" is not explained. I guess it means the Upgrade Centre's History list.
    - [GUESS] The card says "the restore rewinds AUGUR's own record of the night". So after restoring, the evidence of the failed upgrade is gone from AUGUR. That is why the copy matters. I understand that.
    - [ONE-WAY, WARNED] The card marks `ONE-WAY` and warns before, and the Plan table says "no" to undo. Good.
    - If I feel unsure at this point: [STOP]. I choose plan B instead and go to bed.

15. The commands, one at a time, logging each before running it.
    `pc stop`
    `pc up -d postgres`
    `pc ps` (my addition: I wait until postgres is `healthy`.)
    - [GUESS] The card gives no wait between `pc up -d postgres` and the next line. If I run the next line at once, psql may fail with "the database system is starting up". I add my own `pc ps` check. If it fails, I wait and rerun that line only, since nothing has been loaded yet.
    `gunzip -c infra/deploy/backups/platform-2026-11-08T014012Z.sql.gz | pc exec -T postgres psql -U platform -d postgres`
    - [GUESS] I replace `<the file>` with the exact name I wrote down. I check for typos by `ls` first. Wrong name = `gunzip` error and nothing piped, which is harmless.
    - [ONE-WAY, WARNED] This is the destructive step. The card does not tell me what it does to the current database (does the dump drop and recreate databases?), only "load the file". I assume it replaces them. I cannot undo it if the file is bad. The card told me not to take a backup "to be safe" (it would become "the newest"), so I have no safety net by design.
    - [GUESS] Lots of output, possibly errors in the middle (e.g. "database platform already exists", "role already exists"). The card does not say which errors are expected. I would not know whether to continue. If I see a lot of ERROR lines: I do not run `pc up -d` yet; I paste them into the log and [STOP]? That leaves AUGUR down all night. I would probably carry on with `pc up -d` and trust step 1, since the card says so. This is a real gap.
    - If the command pipeline fails entirely (gunzip error "not in gzip format", or file truncated): I stop, nothing is changed if it died before loading. [STOP] and message Harry.
    `pc up -d`
    - Expect: sign in again; a new notice, "AUGUR ... didn't install ... restarted partway". The card says that is the restored record closing itself. Do not act on it.
    - I do not retry or press anything on that notice.

## Step 4. Stand down

16. The four checks again, into the log (moves 6-9, same commands).
    - All hold: good.
    - Something fails after plan C: I have no branch on the card for "restore done and a check still fails". [GUESS] I would stop, write it down and message Harry. [STOP]
    - After plan B: the app is off on purpose, so check b may still show it not healthy. [GUESS] The card does not say whether "b holds" counts an app I turned off. I write that in the log.

17. Three short messages, from the log.
    - To myself, in the morning (an email or a note): what's true now (which release, which app is off), one thing to do (decide the house rule, restore at some time if wanted), one not to do (do not run the upgrade again; do not `pc down -v`), and the log's path `~/augur-night-2026-11-05.md`.
    - To Harry, if the release is at fault: "please halt it (Actions -> Halt rollout)", and anything the card got wrong (the gaps in this file). [GUESS] How do I contact Harry at 2 a.m.? The card says HELP: Harry, but gives no channel. I send an email/message and do not wait.
    - To people who lost work: only if plan C lost something. What and since when (01:40).
    - Then mark the Needs you item as looked at only if nothing is left to do. After plan B, something is left (the app is off, restore is pending), so I leave it open.

18. [STOP] I go to bed. The NEVER list is in my head: no `pc down -v`, nothing past 0.18.0, no retry, no extra backup, no `git checkout` over `infra/deploy`, no restore by date.

## Where I would stop and go back to bed
- Move 5 if I cannot find `pc`.
- Move 10 if all four checks hold (after step 4 messages).
- Move 13 plan B, then step 4 (the usual outcome tonight, given the blank house rule and my tiredness).
- Move 14 if I feel unsure.
- After any check fails following a restore.

## Steps I believe cannot be undone
- Move 15, the `psql` load (and so `pc up -d` after it). The card warned me first: `ONE-WAY`, "Undo? no", and a pause point.
- Not warned: tapping Retry or Go back in the Upgrade Centre (the card warns in the NEVER list and the memory items, so it is warned, but only in words).
- Turning the app off (plan B) is undoable, the card says so.

## Three sentences
The card helped most with its order and its brakes: touch nothing first, name the file from the notice, read-only checks before any change, and a clearly marked one-way step with a pause point and a NEVER list that kept me from the tempting wrong moves. It failed me where it assumed knowledge I do not have at 2 a.m.: `pc` is never defined, the house rule is a blank I never filled in, there is no wait or expected-errors note around the `psql` load, no branch for a check still failing after the restore, and no way to reach Harry. What I would fear most is running the restore with the wrong file or into a half-started Postgres and wiping the only record of the night and the only good data, with no backup to fall back on, so I would choose containing and sleeping.
