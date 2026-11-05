# You are in command: an upgrade that went back

*Incident command card, after UK fire service incident command and Google SRE's incident practice. One person in command (you), a plan said out loud and written down, and a time to look again. Mitigate first; find the cause in daylight. True for AUGUR 0.18.x.*

---

## 1. Take command (2 minutes)

Write the first line of the log below: the time, "I'm in command", and the notice's words. From now on, anything you do goes in the log first, then gets done.

Don't touch the server yet. AUGUR may already have gone back by itself.

## 2. Size it up (5 minutes, nothing changes)

| Look | Command (`READ`) | Write in the log |
|---|---|---|
| What runs | `grep PLATFORM_VERSION infra/deploy/.env` | the release |
| What's down | `pc ps` | each part not `healthy` |
| What the watch would say | `pc exec -T updater node dist/index.js check` | its problems |
| Why, in the part's words | `pc logs --since 15m <part>` | the first error |
| The way back | the notice, or Upgrade Centre → History | the backup file, by name |
| What a restore would lose | Admin → Activity, since that backup | who saved what |

## 3. Choose a plan and say it

Pick one. Say it out loud, write it in the log with the time you'll look again.

| Plan | When | Costs | Can undo? |
|---|---|---|---|
| **A. Hold.** Change nothing, hand off | Every part healthy, `check` ok | Nothing | Yes |
| **B. Contain.** Turn the failing app off (Admin → Apps); set AUGUR to Ask first | A part fails, and a restore would lose work or you're too tired | That app is off until someone restores; a later restore loses more | Yes |
| **C. Restore** the named backup (docs/deploy.md, Backups → Restore; stop everything but Postgres) | A part fails on its tables, and Activity shows little since the backup | Everything saved since the backup; AUGUR's record of the night | **No** |

Plans that are never on this card: try the upgrade again; go back past 0.18.0 (Keycloak 26.8 can't go back); `pc down -v`; restore "the newest".

## 4. Look again every 15 minutes

At each look: `pc ps` and the updater's `check`. Write both in the log. If the plan isn't working, or something new is down, go back to step 3 and choose again. Don't add a second plan on top of the first.

Before plan C: write in the log, "Restoring *file*. Loses *what*. The night is written above." Then do it. Then look again at once.

## 5. Stand down

When you stop, the log is the hand-off. Add: what is still wrong, what was lost and who to tell, and whether Harry needs to halt the release (only he can: Actions → Halt rollout).

---

## The log

| Time | What I saw or did | Output (pasted) |
|---|---|---|
| | I'm in command. Notice: | |
| | Plan: ___ . Look again at: ___ | |
| | | |
| | | |
| | | |
| | Stood down. Still wrong: ___ . Lost: ___ . Tell: ___ | |
