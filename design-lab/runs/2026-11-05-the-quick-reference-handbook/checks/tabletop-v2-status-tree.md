# Walk-through, 02:05, tired admin

Legend: [GUESS] the card left me guessing. [ONE-WAY] I believe it can't be undone. [STOP] go back to bed.

## 1. Read the card's BEFORE YOU READ ON box, touch nothing
Move: no command. Write on paper/notes: `platform-2026-11-08T014012Z.sql.gz` (from the notice).
- [GUESS] The notice date says 2026-11-08 while I'd think it is a different day. I'd assume the stamp is the server's clock/UTC and not worry, but at 02:05 I'd squint. I only note it and do not act on it.
- [GUESS] "Note the backup file the notice or History names": the notice names one, so I use it. I would not open History (the card doesn't require it).

## 2. Check 1: sign-in. On the phone, reload the AUGUR tab and sign in
Move: tap reload, sign in with my admin account.
- Shell loads and I'm signed in: check 1 holds. Go to step 3.
- Address doesn't answer: Table 1 row 1. Go to step 2a.
- Page loads but sign-in fails: Table 1 row 2. Go to step 2b.
- Anything else (odd error, blank page, half-loaded shell): Table 1 row 3. [STOP] hand off with what I saw (screenshot), back to bed.

### 2a. Address doesn't answer
SSH in (`ssh admin@<server's tailscale name>`; [GUESS] the card never says the host name, I'd use what I normally use, and if SSH fails too then the tailnet is the problem and I'm stuck: the card has nothing for that, I'd [STOP] and hand off). Then:
```
cd /home/admin/augur
pc logs tailscale
```
- [GUESS] The card never says what `pc` is or whether it works from a fresh SSH shell. I assume it's a shell alias/wrapper for docker compose already on this box. If `pc: command not found` I'm guessing (maybe `docker compose -p platform ...` from the "Compose project platform" habit, but I'm not allowed to invent that). I'd [STOP] and hand off.
- [GUESS] "docs/deploy.md, 'If something's wrong'" is pointed at, but the card says read only these files. In the exercise I can't open it. In real life I'd open it. Here I'd stop. Do NOT restart the stack (Don't).
- [STOP] after reading logs; hand off with the pasted output.

### 2b. Page loads, sign-in fails
```
pc ps keycloak identity
pc logs --since 15m keycloak identity
```
- Both healthy, logs quiet: probably my password/phone; try once more, then hand off. [GUESS] the card doesn't cover this.
- Keycloak/identity unhealthy: go to check 3 for these parts (step 5). Do not go back to a release before 0.18.0.
- Errors about the database being newer/missing: Table 3 (step 6).

## 3. Check 2: every part answers
Move (over SSH, from the checkout):
```
cd /home/admin/augur
pc ps
pc exec -T updater node dist/index.js check
```
- [GUESS] I must be in /home/admin/augur for relative paths; the card doesn't say so. I `cd` first.
- All `healthy` and `"ok":true`: check 2 holds. Go to step 4.
- One part `Restarting`/`unhealthy` (the notice suggests `atlas`), rest healthy: Table 2 row 1. Don't restart it. Go to check 3 for that part (step 5).
- Several parts down: `pc logs --since 15m <each>` for each, then step 5. Don't retry the upgrade.
- `check` says sign-in fails: Table 1 (step 2).
- [GUESS] `check` prints something that is neither `"ok":true` nor an obvious failure (e.g. the updater container itself isn't up so `exec` errors). The card has no row. I'd treat it as "several parts down", look at `pc logs --since 15m updater`, and if unclear [STOP] and hand off.

## 4. Check 3: data fits the code
Move: for each part not healthy (from step 3), e.g. atlas:
```
pc logs --since 15m atlas
```
If everything was healthy, there is nothing to read and the check holds trivially. Go to step 5b.
- No error about tables, schema or data being newer/missing: check 3 holds. [GUESS] If a part is unhealthy for another reason (e.g. out of memory, port), the card has no table for it. Table 2 sent me here and here I find nothing: I'd [STOP], hand off with the logs, and turn nothing off.
- Error about tables/schema/data newer or missing: Table 3 (step 6).

(Step numbering note: 5 is the same as this step; I merged them. Continue at 5b.)

## 5b. Check 4: the way back exists
```
cd /home/admin/augur
ls infra/deploy/backups
cat infra/deploy/backups/restore-test.json
```
- Look for `platform-2026-11-08T014012Z.sql.gz` in the listing and `"ok":true` in the test.
- [GUESS] `restore-test.json` doesn't say which backup file it tested. If other, newer backups exist, I can't tell if the test is about my file. I'd read the JSON for a file name; if it names my file and `"ok":true`, holds. If it names another file, I'm guessing; I'd treat as not proven and go to Table 4 row 1 (don't restore tonight).
- File there, test ok: check 4 holds.
- File missing or test failed: Table 4 row 1. Don't restore anything tonight; don't restore an older file by date. Turn the failing app off (Admin -> Apps, "ACT"). Hand off. [STOP]
- Newer backups exist: use mine by name, never "the newest" (Table 4 row 2).

## 6. All four hold
Write the hand-off (four checks with pasted output, what I did, nothing lost, what's unknown: why atlas timed out at 120 s). Tell Harry the release is probably at fault (atlas didn't answer) and that only he can Halt rollout. [STOP] bed. Likely outcome if the auto-rollback worked and atlas is healthy on 0.18.0.

## 7. Table 3 path: data doesn't fit the code
Decide: how much has been saved since the backup (01:40:12 stamp, now 02:05)?
Move: in the browser, Admin -> Activity, look at entries since the backup time.
- [GUESS] The card says "little or nothing by people, and you can give it 20 minutes". What counts as little, and 20 minutes of what (waiting? the restore duration?) I'd read it as "I can afford 20 minutes awake and no one is working". At 02:05 on a small server with one admin, likely nothing by people; the upgrade itself is the only change. But whether the upgrade's own writes show in Activity as "by people" is a guess.
- Little or nothing by people: go to step 8 (pause point, restore).
- Much saved, or not sure: `ACT` in Admin -> Apps turn that app off for the organisation. Hand off: "needs a restore of platform-2026-11-08T014012Z.sql.gz, loses everything since 01:40Z". [STOP]. This is reversible (switch app back on), card says ACT, not ONE-WAY.
- [GUESS] I'm not sure at 02:05 if it's safe to do the hand-off wording: "loses everything since *time*": I'd use 014012Z from the file name and say so.

## 8. PAUSE POINT, then ONE-WAY restore
Say out loud: "Restoring platform-2026-11-08T014012Z.sql.gz. It loses everything saved since about 01:40 for every app. The night is written down: notice, History steps, Activity, because the restore rewinds AUGUR's own record." Before that, actually copy the notice text, History steps and Activity entries somewhere outside AUGUR (screenshot/paste into my notes), since the restore will erase them.
- [GUESS] The card says the night is "written down", but it doesn't say by whom; I'd have to do it myself. I do it.
- If I feel unsure at any point here: [STOP]. This is the last cheap moment.

Then the commands:
```
cd /home/admin/augur
pc stop
pc up -d postgres
gunzip -c infra/deploy/backups/platform-2026-11-08T014012Z.sql.gz | pc exec -T postgres psql -U platform -d postgres
pc up -d
```
- [ONE-WAY] The `psql` line. The card warned first (Table 3 heading, PAUSE POINT, ONE-WAY tag). It did not say the restore also overwrites the current databases (does the dump drop and recreate them?), nor that I can't re-restore the lost state: I take it that the data in postgres right now is gone and I have no snapshot of it. [GUESS] Whether to take a fresh backup of the current state first: the card says nothing, and I'd be inventing a command. I'd not do it, but I fear this.
- [GUESS/DANGER] `pc stop` stops everything including `tailscale` (the card itself runs `pc logs tailscale`, so tailscale is a compose service). If my SSH goes over that tailscale, `pc stop` cuts my connection and I can't type the rest. The card doesn't warn. If tailscale runs on the host, fine. I'd [GUESS] and, because I can't tell, I'd run the whole sequence in one go: `pc stop && pc up -d postgres && gunzip ... && pc up -d` in `tmux`/`nohup`? I'm not told if tmux exists; I'd use `nohup sh -c '...' > /tmp/restore.log 2>&1 &` and reconnect after. This is me improvising; the card left me here.
- [GUESS] No output expected from `psql` is described. Errors like "already exists" or "role" lines: the card doesn't say whether those are fine. I'd scroll the output; if it ends in many `ERROR`s I can't judge and I'd [STOP] (but by then stopped parts are down and the data is half-restored; there's no way back).
- `gunzip` fails (corrupt file, "unexpected end of file"): nothing was fed to psql beyond the partial. The card's restore-test passed in check 4, so unlikely. If it happens: [STOP], hand off.
- `pc up -d` finishes: go to step 9.

## 9. Check all four again
Repeat steps 2, 3, 4, 5b (sign-in on phone, `pc ps`, `check`, logs, `ls`/`cat`).
- All hold: write the hand-off and [STOP]. Remember notices after the restore may be stale or false; trust the checks, not the notices.
- A notice shows up saying something has gone wrong again: ignore it for decisions; run the checks.
- Something still fails: the card says go to the table for that check again. After a restore there's no card path for "restore done and still broken". [STOP] and hand off with pasted outputs; I do not run the upgrade again, do not `pc down -v`, do not go past 0.18.0, do not `git checkout` over infra/deploy.

## Where I would stop and go back to bed
- Anywhere a table says "Anything else", "Stop", or "Hand off".
- If `pc` or SSH doesn't work.
- If check 4 fails (no restore tonight).
- If much was saved since 01:40 (turn the app off, hand off).
- After all four hold (hand-off, bed).
- Before the psql line if I'm in any doubt.

## Closing three sentences
The card helped most by making me check four things in order without diagnosing, and by putting the ONE-WAY restore behind a loud pause point with the exact file name and a "what it loses" line, plus the NEVER list. It failed me on never defining `pc`, never saying which directory to run from, `restore-test.json` not naming which backup it tested, `pc stop` possibly killing my own Tailscale-routed SSH session without warning, and having nothing for "restored and still broken" or for what psql errors are acceptable. I'd fear running the restore in a half-awake state on a guess (wrong file, or cutting my own connection mid-restore), because it overwrites everything since 01:40 with no copy of what's there now.
