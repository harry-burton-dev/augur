# Walk-through, 02:05, tired, sole admin

Legend: GUESS = the card left me guessing. ONE-WAY = I believe it can't be undone. STOP = back to bed.

0. Memory items first (card): hands off, nothing restarted. Write the backup name from the notice on paper/notes: `platform-2026-11-08T014012Z.sql.gz`. Open the card at step 1.
   - GUESS/oddity: the file name carries a date (2026-11-08) that I can't square with "now" from the notice alone. I would not trust it by memory. I compare it with the History row in step 1 and copy the name exactly.

1. Card step 1. On the phone, click Upgrade Centre -> AUGUR. Note the version it runs (expect 0.18.0). Open the newest History row. Note how it ended and which backup it took. "PASTE" these into my notes.
   - GUESS: "PASTE" where? The card never says (a note, a chat, the hand-off?). I paste into a notes app.
   - Branch A: History backup name matches the notice -> carry on.
   - Branch B: History names a different backup than the notice -> I would stop and think. The card doesn't say which wins. At step 6 it says "the one from step 1, by name", so I would use the History one and record the mismatch. GUESS.
   - Branch C: Upgrade Centre won't load -> use the notice's words and SSH in: `ssh admin@<server's tailscale name>`, then `cd /home/admin/augur/infra/deploy` (GUESS: card never says which directory `pc` works from, or what `pc` is; I assume a shell alias/wrapper for docker compose already on the server) then `pc logs updater`. Go on.

2. Card step 2. SSH in: `ssh admin@<server>` (host name not in card; I know it from my own setup). Then `cd /home/admin/augur` (GUESS: directory for `pc`).
   `pc ps`
   - Branch: every service `healthy` -> step 3.
   - Branch: any `unhealthy`, `starting` or `Restarting` -> note which -> step 4. I expect atlas (from the notice).
   - Branch: `pc: command not found` -> GUESS. Card has no fallback. I would try `docker compose ps` from infra/deploy, but that's inventing. If that doesn't work in 5 min -> STOP, go to step 8 via the Upgrade Centre on the phone (Ask first), write a note, go to bed.

3. Card step 3. `pc exec -T updater node dist/index.js check`
   - `"ok":true` -> card says AUGUR is back and well -> step 9 (close).
     - Slight worry: the notice said atlas didn't answer, yet check is ok. Card says close anyway. I follow it, and in the hand-off note that atlas timed out once.
   - `"ok":false` -> note each problem -> step 4.
   - Command errors (updater not running) -> not covered. GUESS. I treat as "can't tell" -> step 4 on updater, then 8.

4. Card step 4. `pc logs --since 15m atlas` (GUESS: service name is "atlas"; the notice says "atlas", so I use that. Repeat for every part flagged in steps 2 or 3.) Paste the first error.
   - Says tables/data/schema newer than expected (the notice hinted at this) -> step 5.
   - Anything else or can't tell -> step 8.
   - GUESS: no example wording of the "newer than it expects" message. I'd look for "schema", "migration", "newer", "version".
   - GUESS: `--since 15m` may be too short if the rollback was earlier. I'd widen to 1h; card doesn't say.

5. Card step 5. On the phone: Admin -> Activity, scroll from the backup's time (01:40:12 UTC per the file name; GUESS whether it's UTC or local) to now. Count what people saved.
   - Little or nothing, and I'm awake enough for 20 min -> step 6.
   - Otherwise (people saved things, or I'm too tired) -> step 8.
   - GUESS: "little" is undefined. I'd say 0 to a couple of trivial entries. Also, who is "people" on a small server at 02:00? Probably just me.
   - Honest tiredness check: at 02:05 half asleep I'd lean to step 8.

6. Card step 6, PAUSE POINT. Say out loud: "File: platform-2026-11-08T014012Z.sql.gz (as the History row names it). Lost: <count from step 5>. I have written down the notice, the History steps and the Activity since the backup."
   - Warned before ONE-WAY: yes, clearly.
   - GUESS: "by name (not the newest)" - I'd check on disk first: `ls -l infra/deploy/backups/` (read-only; card doesn't list this, but it's harmless) to confirm the file exists. If the file isn't there -> STOP, step 8, ask Harry. Card gives no branch for a missing file.
   - STOP here if anything is unclear. Going back to bed with step 8 is allowed by the objective ("safe until morning").

7. Card step 7, ONE-WAY. Restore:
   ```
   pc stop tailscale web gateway identity registry events keycloak backup
   gunzip -c infra/deploy/backups/platform-2026-11-08T014012Z.sql.gz | pc exec -T postgres psql -U platform -d postgres
   pc up -d
   ```
   - GUESS: `pc stop tailscale ...` stops tailscale, so if I'm SSHing over Tailscale my session dies. Card doesn't warn. Run in `tmux`/`screen` or on the console? Not in card. This is my biggest worry; I'd probably get cut off mid-restore. Card doesn't mention it.
   - GUESS: stop list doesn't include atlas, updater or other apps. They stay running against the database while it's replaced. Card doesn't say why or whether to stop them.
   - GUESS: the dump goes into `postgres` db; does it drop and recreate the databases? Card doesn't say. I'd just trust it.
   - GUESS: path is relative; I must be in /home/admin/augur.
   - Branch: psql prints errors ("already exists") -> unknown whether harmless. Card silent. I'd save the output and not run `pc up -d`?? No: card says go on. I'd run `pc up -d` and then step 2, keeping the errors for the hand-off.
   - Branch: SSH drops -> reconnect later; unknown state. STOP, reconnect via the phone / Upgrade Centre if up; otherwise wait for morning.
   - Then step 2 again (`pc ps`), then 3. Sign in again if asked.
   - If still not healthy after restore -> step 4 again; if it's the same, step 8. Don't loop a second restore (the card doesn't say it, I decide so).

8. Card step 8, contain until morning.
   - Phone: Admin -> Apps -> turn atlas (the failing app) off for the organisation. Undo: turn it on.
   - Phone: Upgrade Centre -> set AUGUR to **Ask first**. Undo: set back.
   - Do NOT mark Needs you as looked at. -> step 9.
   - GUESS: "the failing app" - if more than one fails or it's a core part (identity, gateway), turning an app off doesn't help. The card has no branch for a core part failing. I'd STOP and wait for Harry.

9. Card step 9, close. Write the hand-off (notes/message to myself and Harry): what I saw (steps 1 to 4, with pasted logs), what I did and the time, what is still wrong, what was lost. Tell Harry that 0.18.1 made atlas time out and the server went back (only he can Halt rollout). Mark looked at only if nothing is left (e.g. after a restore that passes step 3). Then back to bed.

DO NOT list, which I checked before each move: no `pc down -v`, no extra backup, no re-upgrade, no `git pull/checkout` over infra/deploy, no going back to 0.17.x.

Irreversible steps: only step 7; the card warned first (step 6). Also anything I do by `pc stop` is undoable. Where I'd stop for bed: after step 3 ok; after step 8 containment; whenever step 5 shows work saved or I'm too tired; and before step 7 if the file is missing or doubtful.

## Three sentences
The card helped most with the ordered read-do shape, the clear PAUSE POINT before the one-way restore, and the DO NOT list that let me stay hands-off. It failed me by never saying what `pc` is or where to run it, which service names to use, that stopping `tailscale` could cut my own SSH session, what a missing or mismatched backup means, and what "little" means in step 5. I'd fear most restoring over the wrong data, or cutting myself off mid-restore with the databases half replaced.
