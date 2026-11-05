# Scenario: AUGUR went back by itself, and Data Atlas is still down

The scripted failure every card in this run is tested on. Written from `docs/upgrade.md`, `docs/deploy.md`, `docs/release-channels.md`, `docs/notifications.md`, ADR 0020 and ADR 0051, and the updater's own code (`platform/services/updater/src/upgrade.ts` and `index.ts`) before any card was written.

Anything AUGUR's guides or code don't say is marked **not documented**, with how to play it. Those are findings, not facts.

## For the tester: how to play

You play the server, the screens and the world. The operator plays a tired admin at 2am, with one card and nothing else.

1. Pick a world before you start, and don't say which: **W0** (main line), **W1** (the 01:00 backup failed) or **W2** (the Upgrade Centre won't load). Each step says where the worlds differ.
2. Read out only the **Sees** text of the step you are on. Then wait.
3. The operator says what they do or type. Find it in that step's **If the operator...** list, or in **Look-ups any time** at the end. Read out only what it says they see, then go where it says.
4. If the move isn't listed, answer from the nearest listed move and write down that you did. Never explain why something happened unless the screen or output says it.
5. Count one **turn** for each thing the operator does (a command, a click, opening a page). Reading the card is free.
6. Play the **injects** where a step names one. They are messages from people, so the card is tested under pressure.
7. Stop when the operator says they are done, or at 40 turns. Record the end state against `key.md` (don't read `key.md` before you play).

Commands use the `pc` alias from `docs/deploy.md`. If the operator types the full `docker compose -f infra/deploy/compose.yml --env-file infra/deploy/.env` form, answer the same. The operator is in the checkout, `/home/admin/augur`, over SSH.

## The server, before the night

- One server, Docker Compose, private to the tailnet. One admin, who holds `deployment-admin` and signs in with a password and a code app.
- AUGUR **0.18.0**, `SERVER_RING=production`, `DEPLOYMENT_TIME_ZONE=Europe/London` (in November that is UTC). The updater is on (`COMPOSE_PROFILES=updater`). The admin upgraded once by hand earlier, so Automatic is allowed.
- AUGUR's policy: **Automatic**, patch releases, window **Sunday 01:40 for 2 hours**. Backups at `BACKUP_HOUR_UTC=1`, kept 14 days, restore test on Sundays. No off-server copy: Admin → Status says backups are kept on this server only.
- 0.18.0 is the release that moved Keycloak to 26.8. `docs/upgrade.md` says that migration can't be undone, and going back past 0.18.0 needs a restore.
- The night is Saturday into **Sunday 8 November 2026**.

## What happened overnight (tester only, never read out)

| Time | What happened | Source |
|---|---|---|
| 01:00 | Nightly backup writes `platform-2026-11-08.sql.gz`, then the Sunday restore test: restored and checked. **W1:** the nightly backup failed (`backup: FAILED, keeping earlier backups`); the restore test checked the newest, `platform-2026-11-07.sql.gz`. | deploy.md, backup.sh |
| 01:40 | The window opens. Automatic takes 0.18.1, a patch. The updater checks it fits. | upgrade.md, ADR 0020 |
| 01:40-01:42 | Backup `platform-2026-11-08T014012Z.sql.gz`, restored and checked. This overwrites `last-backup.json`, so in W1 Status no longer shows the 01:00 failure. | upgrade.ts, backup.sh |
| 01:42-01:48 | Pull, then each part restarts on 0.18.1 in turn. Data Atlas (`atlas`) migrates its tables on start and answers on 0.18.1. | upgrade.md, The updater |
| 01:48 | Verify passes. The 10-minute watch starts. | upgrade.ts |
| 01:52 | At the 4-minute look, `atlas` doesn't answer. Also 01:52: a night-shift person saves a document in Artifacts. | upgrade.ts |
| 01:54 | After 120 s: the watch fails, "atlas didn't answer within 120 s." | upgrade.ts `ready` |
| 01:54-01:57 | The updater puts every part back on 0.18.0. `atlas` 0.18.0 answers once, so the roll-back passes. Result: **went back by itself**. | upgrade.ts `rollBack` |
| 01:58 | The registry sends the notice to deployment admins and admins. | notifications.md, notices.ts |
| 01:58 on | `atlas` 0.18.0 runs on the tables 0.18.1 changed, stops after about 40 s, and Docker restarts it, again and again. Going back isn't watched, so nothing notices. | upgrade.md ("Going back to an earlier release isn't watched") |

Why `atlas` and not a platform service: if identity, the registry, events or the gateway were the part that failed, either the shell wouldn't load or the notice couldn't be sent (the registry sends it through events). The prompt's "platform service" is played as Data Atlas, which ships with AUGUR and keeps its own schema. Why a patch and not a minor: a 0.x minor never starts by itself in a window (upgrade.md); only a patch can start at 01:40 on its own.

---

## Step 1. 02:05, the phone

**Sees:** You wake up. Your phone shows AUGUR, open in a browser tab from last night. The band says there is something new. The notice reads:

> **AUGUR went back to 0.18.0 by itself**
> Back on 0.18.0: atlas didn't answer within 120 s. If 0.18.0 has trouble with data 0.18.1 changed, restore platform-2026-11-08T014012Z.sql.gz (docs/upgrade.md, Going back).

*How a notice reaches a phone: **not documented**. Notices show only in the shell (docs/notifications.md); email alerts are in a Proposed record (ADR 0059) and need SMTP, which hasn't landed. Play it as: the admin saw it in a tab left open.*

**If the operator...**
- opens the notice on the phone: the Upgrade Centre's AUGUR page opens, cramped (AUGUR has no phone layout yet). Read out Step 3's **Sees**, then say it is hard to read on a phone. Stay at step 1 until they move to a laptop.
- goes back to sleep: end of play. Record: no action, Data Atlas down until morning, no hand-off.
- opens a laptop: go to step 2.
- messages someone first: nobody answers at 02:05. Stay at step 1.

## Step 2. 02:08, the laptop

**Sees:** The laptop is on the tailnet. AUGUR's shell loads at its usual address and you're still signed in. Home looks normal. In the list of apps, **Data Atlas** is greyed out as unavailable. *(The shell's exact words for an unavailable app: **not documented**.)* The notice from step 1 is in the band.

**If the operator...**
- opens Data Atlas: it doesn't open; it stays unavailable. Stay at step 2.
- opens the Upgrade Centre (or the notice): go to step 3.
- opens Admin → Status: see **Look-ups any time**, "Admin → Status".
- opens Admin → Activity: see **Look-ups any time**, "Admin → Activity".
- connects to the server over SSH: go to step 4.
- reloads the page, signs out and in: nothing changes. Stay at step 2.

## Step 3. The Upgrade Centre

**W2 only. Sees:** The Upgrade Centre shows an error instead of its page. *(Its words: **not documented**.)* Admin, Status and Activity still load. Reloading doesn't help. **Upgrade to …**, **Go back** and **Mark looked at** can't be reached. Go to step 4 when the operator moves on; any later move that needs the Upgrade Centre gets this same error.

**W0 and W1. Sees:** AUGUR's page says it is running **0.18.0**. Under **Needs you**: "AUGUR went back to 0.18.0 by itself", with the notice's words and **Mark looked at**. 0.18.1 is listed as available and waiting for an admin, because an earlier try didn't finish, with **Upgrade to 0.18.1**. History, newest first:

| When | From → to | Who | Ended | Took | Backup |
|---|---|---|---|---|---|
| Sun 01:40 | 0.18.0 → 0.18.1 | By itself | Went back by itself | 17 min | platform-2026-11-08T014012Z.sql.gz |

**If the operator...**
- opens the history row: the steps read
  1. preflight: done
  2. backup: "platform-2026-11-08T014012Z.sql.gz, restored and checked"
  3. pull: done
  4. roll-forward: done
  5. verify: "Running AUGUR 0.18.1."
  6. watch: failed, "atlas didn't answer within 120 s."
  7. roll-back: done, "Back on 0.18.0: atlas didn't answer within 120 s. If 0.18.0 has trouble with data 0.18.1 changed, restore platform-2026-11-08T014012Z.sql.gz (docs/upgrade.md, Going back)."

  Stay at step 3.
- opens **Go back**: it lists the five releases before 0.18.0: 0.17.1, 0.17.0, 0.16.1, 0.16.0, 0.15.2. *(Whether it marks 0.18.0's Keycloak change as a one-way step: **not documented**. Play it as: no warning is shown.)* If they choose one and confirm with password and code: go to step 12.
- chooses **Upgrade to 0.18.1** and confirms: go to step 13.
- chooses **Mark looked at**: the item leaves Needs you for every admin. *(Whether it can be undone: **not documented**.)* Stay at step 3.
- changes AUGUR's policy to Ask first or Hold (asks for password and code): saved, and in Activity. Stay at step 3.
- goes to the server: go to step 4.

## Step 4. On the server

**Sees:** A shell prompt in `/home/admin/augur`.

Answer read-only commands from **Look-ups any time** (state **P**, the server as the night left it).

**Inject I1**, after the operator's second command on the server, unless they've already decided what to do: *A message from a colleague who's up early: "Data Atlas is down for me. Can't you just restart everything?"*

**If the operator...**
- restarts one part (`pc restart atlas`, `pc up -d atlas`): `atlas` starts, shows `healthy` for about 40 s, then `Restarting` again. Stay at step 4.
- restarts everything (`pc restart`, `pc down` then `pc up -d`, `sudo reboot`): it takes about 3 minutes; Keycloak takes a minute. The AUGUR tab stops answering for a while, then asks you to sign in again *(after a restart: **not documented**; play it so)*. Then `atlas` is `Restarting` again; everything else is `healthy`. **W1 only:** the backup container, finding no backup for today, takes one as it starts: `platform-2026-11-08.sql.gz` now exists, a copy of tonight's broken state (backup.sh: "Takes one at start too when today has none"). Stay at step 4.
- runs `pc down -v`: go to step 14.
- takes a backup now (`pc exec backup /bin/sh /backup/backup.sh --now`): `backup: wrote /backups/platform-2026-11-08T02MMSSZ.sql.gz` (the current time). It is now the newest backup, and it holds tonight's broken state. A `--restore-test` after it tests this new one. Stay at step 4.
- runs `backup.sh --once`: W0: nothing (today already has one). W1: writes `platform-2026-11-08.sql.gz`, of tonight's broken state. Stay at step 4.
- deletes a backup file (`rm infra/deploy/backups/...`): it's gone. Record which. Stay at step 4.
- puts 0.18.0 on by hand (`git checkout augur@0.18.0`, `PLATFORM_VERSION=0.18.0`, `pc pull && pc up -d --remove-orphans`): git says it is already there; the pull downloads nothing; every container is up to date; `atlas` is still `Restarting`. *(0.18.1 changed no deploy files, so the checkout changes nothing.)* Stay at step 4.
- puts an older release on by hand (`git checkout augur@0.17.1`, `PLATFORM_VERSION=0.17.1`, `pc up -d --remove-orphans`): go to step 12, "by hand".
- decides to leave Data Atlas down until morning: go to step 6.
- decides to restore a backup: go to step 7.

## Step 5. (Reserved: the decision)

Not a place the operator is sent. When an operator stops to decide between waiting and restoring, note which turn it was and what they read to decide. Then go to step 6 or step 7.

## Step 6. Contain and wait for morning

**Sees:** Nothing new. Data Atlas is still unavailable.

**If the operator...**
- turns Data Atlas off for the organisation in Admin → Apps: it shows to everyone as turned off by an admin, rather than as broken. Turning it on again undoes it. The `atlas` container keeps restarting *(whether turning it off stops the container: **not documented**; play it as no)*. Stay at step 6.
- sets AUGUR's policy to Ask first or Hold: as in step 3. (W2: the Upgrade Centre gives its error.)
- writes a hand-off: note where (paper, a message, a file on the server, an Artifacts document), and what it says. Stay at step 6.
- messages Harry, the publisher, to halt 0.18.1: no answer tonight. Note it. Stay at step 6.
- marks the result looked at: as in step 3.
- says they're done: go to step 11.
- changes their mind and restores: go to step 7.

## Step 7. Before a restore

**Sees:** Nothing changes until the operator acts. Answer look-ups from state **P**.

What a restore loses: everything saved since the backup was taken. In W0 and W1, Activity shows one person's save in Artifacts at 01:52. Nothing else by people.

**If the operator...**
- checks Admin → Activity since 01:40: see **Look-ups any time**. Note that they checked.
- lists the backups: see **Look-ups any time**. Note which file they choose and why.
- runs `backup.sh --restore-test`: it tests the **newest** file. If nothing has been taken since 01:40, that is `platform-2026-11-08T014012Z.sql.gz`: `restore-test: platform-2026-11-08T014012Z.sql.gz (local) restored and checked`. If they took a backup since, it tests that one instead, and says so by name.
- copies the night's record somewhere off the database (screenshots, copying the history steps, the notice's words, Activity): note what they kept. A restore puts the database back as it was at the backup, so AUGUR's own record of the night goes with it (see step 10).
- stops parts: go to step 8.
- runs the restore without stopping anything: go to step 9, "nothing stopped".

## Step 8. Stopping AUGUR for the restore

**If the operator runs...**
- deploy.md's line, `pc stop tailscale web gateway identity registry events keycloak backup`: each one says `Stopped`. The AUGUR tab stops answering. Still running: `postgres`, `garage`, `models`, `updater`, `docker-proxy`, and the services of the apps that ship with AUGUR: Artifacts and its rendition worker, Explorer, Data Atlas (`atlas`, restarting) and Mandate. (Read out their container names from `pc ps` if asked.) *(deploy.md's words say "stop everything but Postgres"; its command lists fewer. Whether the rest must be stopped: **not documented**.)* Go to step 9.
- `pc stop` (everything), then `pc up -d postgres`: everything stops, then Postgres alone starts and shows `healthy`. Go to step 9, "everything but Postgres".
- any other set: answer as the nearer of the two above, and write down what was left running.

## Step 9. Loading the backup

The command is deploy.md's: `gunzip -c infra/deploy/backups/<file> | pc exec -T postgres psql -U platform -d postgres`.

Which file:
- `platform-2026-11-08T014012Z.sql.gz` (the one the notice names): the right file.
- W0's `platform-2026-11-08.sql.gz` (01:00, before the upgrade): also good; it loses 01:00-01:40 too, when nobody worked. Treat as the right file, but note it.
- `platform-2026-11-07.sql.gz`: Saturday 01:00. Loses every change people made on Saturday. Note this as a lost day.
- any file taken after 01:54 (a `--now` the operator took, W1's restart copy, a backup a Go back or a retry took): it holds tonight's broken tables. It loads, and Data Atlas stays down.

**Everything but Postgres stopped, any file:** a long run of SQL lines scrolls past for about a minute and ends at the prompt *(what a clean restore prints: **not documented**; play it as no lines saying ERROR)*. Go to step 10.

**Only deploy.md's line stopped, or nothing stopped:** *Not documented.* The dump drops and recreates each database itself, and Postgres won't drop a database others are connected to. Play it as: lines scroll past, and among them `ERROR:  database "platform" is being accessed by other users`, then more lines saying ERROR. The prompt comes back. The database is partly loaded. Go to step 15.

## Step 10. Starting again after a good restore

**If the operator runs `pc up -d`:** every part starts on 0.18.0. Keycloak takes about a minute. The AUGUR tab asks you to sign in again, with your code *(after restoring Keycloak's database: **not documented**; play it so)*.

Then, by file:
- **a file from before 01:40:** `atlas` shows `healthy` and stays so. Data Atlas opens. Within half a minute a **new notice** arrives:
  > **AUGUR 0.18.1 didn't install**
  > The updater restarted partway through the upgrade to 0.18.1. Check Admin → Status, and docs/upgrade.md, Going back.

  This comes from the updater's code, not the guides: the backup was taken while the upgrade was under way, so the restored database holds an upgrade still running, and the updater closes it as stopped partway (`index.ts`). The Upgrade Centre's history now shows the 01:40 upgrade as **stopped partway**, with those words. The "went back by itself" record, the first notice and everything in Activity after 01:40 are gone. Needs you shows the failed upgrade, with **Mark looked at**.
- **a file from after 01:54:** `atlas` is `Restarting` again. Data Atlas stays unavailable. Go back to step 7 if they try again.

**Inject I2**, at the first look-up after a restore that used a file from before 01:52, if the operator hasn't already told people: *A message from the night-shift person: "The document I saved just before 2 has gone back to an older version. Did something happen?"*

Answer look-ups from state **R** (restored). Go to step 11 when the operator says they're done.

## Step 11. End of play

Ask the operator, in character, one question: "What did you leave, and for whom?" Write down the answer as given. Then record against `key.md`: end state, turns, wrong turns, one-way steps taken and whether the card had warned of each before, and each place the operator said they were guessing.

## Step 12. Trap: going back past 0.18.0

**From the Upgrade Centre (Go back to 0.17.x):** after password and code, the updater runs: a backup first (`platform-2026-11-08T02MMSSZ.sql.gz, restored and checked`, now the newest backup, of tonight's state), then each part on 0.17.x. Keycloak restarts on 0.17.x's image. *(What that Keycloak does on a database Keycloak 26.8 migrated: **not documented**. Play it as: it doesn't start.)* For five minutes the AUGUR tab can't sign anyone in. Then: "keycloak didn't answer within 300 s.", and the updater puts every part back on 0.18.0 by itself. A new notice: "AUGUR went back to 0.18.0 by itself". `atlas` is still `Restarting`. About 10 minutes in all. Go back to step 3 or 4, wherever the operator goes.

**By hand (`augur@0.17.1`, `PLATFORM_VERSION=0.17.1`, `pc up -d --remove-orphans`):** the images are on the server, so nothing downloads. Keycloak doesn't become `healthy` *(as above, **not documented**)*; identity and the front door wait for it, up to five minutes, then show as not started. The shell can't sign anyone in. Nothing goes back by itself. The way out is the same steps with 0.18.0. *(Whether the old Keycloak changed its database in trying: **not documented**. Play it as: putting 0.18.0 back works.)* Then back to state P, 12 minutes or more later. A restore while 0.17.1 is set: Keycloak still doesn't start, until 0.18.0 is set again.

## Step 13. Trap: trying 0.18.1 again

After password and code, the upgrade runs again exactly as at 01:40: a new backup (`platform-2026-11-08T02MMSSZ.sql.gz`, now the newest, of tonight's state), pull, each part on 0.18.1, verify, and the watch. At its 4-minute look `atlas` doesn't answer; two minutes later every part goes back to 0.18.0. A new notice, the same as step 1. About 17 minutes. Then state P again. Go to step 3 or 4.

## Step 14. Trap: `pc down -v`

**Sees:** Every container stops and is removed, then: `Volume platform_pgdata Removed`, `Volume platform_garage-meta Removed`, `Volume platform_garage-data Removed`.

This can't be undone. Every database and every app's files on the server are gone. The backups are not: they are files in `infra/deploy/backups/`, outside the volumes.

**If the operator...**
- runs `pc up -d`: Postgres starts empty; Keycloak starts as on a new server; the first admin from `.env` can sign in with the password in `.env`; there are no documents, no people but the first admin, nothing. Data Atlas works, on empty tables.
- restores `platform-2026-11-08T014012Z.sql.gz` (as in steps 8 to 10) and then apps' files from `objects-2026-11-08T014012Z.tar.gz` (deploy.md, "Restore apps' files"): AUGUR is as at 01:40, as in step 10. Without the files step, documents open with their files missing *(what Artifacts shows then: **not documented**)*.

Record it as a one-way step, and whether the card warned of it before.

## Step 15. A partly loaded restore

**If the operator runs `pc up -d`:** every part starts. `atlas` is still `Restarting`. *(Which other data is as it was: **not documented**. Play it as: everything else looks normal, but nobody can say what is in the database.)*

The way out: stop everything but Postgres and load the same file again (step 8, second line, then step 9). Count the turns.

---

## Look-ups any time

Answer by state. **P**: the server as the night left it (steps 1 to 9). **R**: after a good restore from before 01:40 (step 10 on). Where W1 or W2 differ, it says so.

| The operator runs or opens | State P | State R |
|---|---|---|
| `pc ps` | Every service `healthy`, images at 0.18.0, except `atlas`: `Restarting (1) 12 seconds ago` | Every service `healthy` |
| `pc ps -a` | As above, plus `storage` and `keycloak-config` `Exited (0)` | As above |
| `pc logs atlas`, or with `--since` | Lines repeating every 40 s or so: atlas starting, then an error that its tables are newer than it knows *(the words of atlas's log: **not documented**; read out "an error saying its tables are newer than this version expects")* | atlas started, listening, no errors |
| `pc logs updater` | Two lines of JSON for the night: `"msg":"upgrading","from":"0.18.0","to":"0.18.1"` at 01:40:02, and `"msg":"upgrade ended","outcome":"rolled-back","to":"0.18.1"` at 01:57:10. The steps' messages aren't in the log (index.ts writes only these) | The same, then a line `watching for upgrades` from its restart |
| `pc exec -T updater node dist/index.js check` | One line of JSON: `"ok":false`, with `"problems":["atlas doesn’t answer."]`. Exits 1 | `"ok":true`, `"problems":[]`. Exits 0 |
| `pc logs --since 10m gateway identity registry events` | No errors from identity, the registry or events. The gateway shows a few failed calls to Data Atlas | No errors |
| `grep PLATFORM_VERSION infra/deploy/.env` | `PLATFORM_VERSION=0.18.0` | The same |
| `git describe --tags` or `git status` | `augur@0.18.0`, nothing changed | The same |
| `ls infra/deploy/backups` | W0: `platform-2026-11-07.sql.gz`, `platform-2026-11-08.sql.gz`, `platform-2026-11-08T014012Z.sql.gz`, an `objects-` file beside each, older days, `last-backup.json`, `restore-test.json`. W1: the same without `platform-2026-11-08.sql.gz` (and its objects file). Add any backups the operator has taken since | The same |
| `cat infra/deploy/backups/last-backup.json` | `{"at":"2026-11-08T01:41:31Z","ok":true,"file":"platform-2026-11-08T014012Z.sql.gz",...}` (W1 too: the 01:40 backup overwrote the failure) | The same |
| `cat infra/deploy/backups/restore-test.json` | `{"at":"2026-11-08T01:42:20Z","from":"local","file":"platform-2026-11-08T014012Z.sql.gz","ok":true,...}` | The same |
| `pc logs backup` | W0: at 01:00, `backup: wrote /backups/platform-2026-11-08.sql.gz`, then the restore test: restored and checked. W1: at 01:00, `backup: FAILED, keeping earlier backups`, then the restore test of `platform-2026-11-07.sql.gz`: restored and checked. The 01:40 backup isn't here: the updater ran it, and its output went to the updater | The same, then `backup: next at 2026-11-09 01:00 UTC` |
| Admin → Status | Every part Running at 0.18.0 except Data Atlas, which isn't *(its words: **not documented**)*. No "Backups need a look" (W1 too). "Backups are kept on this server only" | Every part Running |
| Admin → Activity | Entries for the upgrade from 01:40 to 01:57 *(their names: **not documented**)*; one person's save in Artifacts at 01:52; nothing else by people since 01:40. Anything the operator did since | Nothing after 01:40 except what the operator has done since the restore |
| The Upgrade Centre | Step 3 (W2: its error) | Step 10's description (W2: its error) |
| `infra/deploy/public.sh status` | private | private |
| `docker compose -p augur-apps -f infra/deploy/apps/compose.yml ps` | nothing running (Mandate ships with AUGUR now) | the same |
| Anything not listed | answer from the nearest row; write down that you did | |

## Not documented (for the critique)

1. How the halt notice reaches a phone. Notices are in the shell only; email alerts are Proposed (ADR 0059) and wait on SMTP.
2. The words the shell and Admin → Status use for an app whose service is down.
3. Whether **Go back** marks 0.18.0 (Keycloak 26.8, which can't be undone) as one-way; and what an older Keycloak does on a 26.8 database.
4. Whether deploy.md's restore works while the shipped apps' services (Artifacts, its worker, Explorer, Data Atlas, Mandate, models) and the updater are still connected. Its words say stop everything but Postgres; its command names fewer.
5. What a clean restore prints.
6. That a restore of the updater's own backup brings back the open upgrade, and a second notice, "didn't install", follows. This is in the updater's code (index.ts), not in any guide.
7. Whether you must sign in again after a restart or a restore.
8. Whether **Mark looked at** can be undone, and whether turning an app off stops its container.
9. What atlas's log says.
10. Going back isn't watched (that is documented), so nothing tells anyone that atlas is failing again after the go-back. The notice reads as if the problem were over.
