# U-1 · An AUGUR upgrade went back, or didn't finish

*Read-do. One line, then the next. True for AUGUR 0.18.x. From docs/upgrade.md and docs/deploy.md; marked lines are not in the guides yet.*

**CONDITION.** A notice or Needs you says "AUGUR went back to … by itself", or "AUGUR … didn't install". (Says "halted by its publisher"? Wrong card: do what the Upgrade Centre says.)

**OBJECTIVE.** Every part on one release and every app opening, with nothing lost you didn't choose to lose. If that isn't safe tonight: safe until morning, with a note.

**HOUSE RULE** *(set in daylight)*: If restoring loses nothing people saved, restore tonight. Otherwise contain, and restore at ______ with ______.

> **MEMORY ITEMS**
> 1. **Touch nothing.** AUGUR may already have gone back by itself. Don't restart, retry or go back.
> 2. **Write down the backup file the notice names.** Never use "the newest".
> 3. **Start a log** (`~/augur-night-<date>.md`, outside `infra/deploy`): time, what you see, what you do. Write before you do.

---

**1. Four checks.** `READ`, they change nothing. Top to bottom; the first that fails decides. `PASTE` each into the log.

| # | Must hold | Check | Holds when |
|---|---|---|---|
| a | Sign-in works | open AUGUR, sign in | the shell loads |
| b | Every part answers | `pc ps`, then `pc exec -T updater node dist/index.js check` | all `healthy`; `"ok":true` |
| c | Data fits the code | `pc logs --since 15m <each part not healthy>` | no error about its tables, schema or data |
| d | The way back exists | `ls infra/deploy/backups`; `cat infra/deploy/backups/restore-test.json` | your file is there; its test says `"ok":true` |

- **All hold** → step 4.
- **a fails** → don't change releases. `pc logs --since 15m keycloak identity` into the log → step 4 (hand off).
- **b fails, c holds** → the part fails for another reason. Contain (plan B) → step 4.
- **c fails** → the code went back, the data didn't (docs/upgrade.md, Going back, step 2). → step 2.
- **d fails** → no restore tonight. Plan B → step 4.

**2. Choose, and say it.** `READ` Admin → Activity since the backup's time. Count what people saved.

| Plan | When | Cost | Undo? |
|---|---|---|---|
| **B. Contain.** Admin → Apps: turn the failing app off for the organisation. Upgrade Centre: AUGUR to Ask first | the house rule says wait, or you're too tired for 20 minutes | the app is off; a later restore loses more | yes |
| **C. Restore** the file you wrote down | the house rule says restore tonight | everything saved since the backup, in every app | **no** |

> **3. PAUSE POINT before plan C. Say out loud, and write in the log:**
> the file, by name · what it loses (from Activity) · that the night is copied into your log: the notice, the History steps, Activity since the backup. **The restore rewinds AUGUR's own record of the night.**
>
> `ONE-WAY` Stop everything but Postgres, load the file, start again:
> ```sh
> pc stop
> pc up -d postgres
> gunzip -c infra/deploy/backups/<the file> | pc exec -T postgres psql -U platform -d postgres
> pc up -d
> ```
> *Not in the guides: deploy.md's words say stop everything but Postgres, but its command names fewer parts. This card stops all.*
> **Then expect** to sign in again, and a new notice: "AUGUR … didn't install … restarted partway". That is the restored record closing itself (updater code, not the guides). Trust step 1, not the notices: do the four checks again.

**4. Stand down.** Do the four checks once more, into the log. Then send three short messages from it:
- **You, in the morning:** what's true now, one thing to do, one not to do, where the log is.
- **Harry**, if the release is at fault: please halt it (Actions → Halt rollout; only he can), and anything this card got wrong.
- **People who lost work:** what, and since when.

Mark Needs you looked at only if nothing is left to do.

---

**NEVER** · `pc down -v` (deletes every database) · go back past **0.18.0** (Keycloak 26.8 can't go back) · try the same upgrade again (same result, and a new backup that is now "the newest") · take a backup "to be safe" before a restore · `git checkout` over `infra/deploy` · restore a file by its date.

**HELP** · Harry: the release. A second deployment admin: Admin → People. *Card last tabletopped: pending.*
