# U-1 · AUGUR upgrade went back, or didn't finish

*Quick reference card. Read-do: read one line, do it, then the next. True for AUGUR 0.18.x. Written only from docs/upgrade.md and docs/deploy.md.*

---

**CONDITION.** A notice, or the Upgrade Centre's Needs you, says one of:
- "AUGUR went back to *version* by itself"
- "AUGUR *version* didn't install"

Says "halted by its publisher" instead? This is the wrong card: follow what the Upgrade Centre says to move to.

**OBJECTIVE.** Every part on one release, every app opening, and nothing lost that you didn't choose to lose. If that can't be done safely tonight: safe until morning, with a note.

> **MEMORY ITEMS**
> 1. Hands off. Don't restart, upgrade or go back.
> 2. Write down the backup file the notice names.
> 3. Open this card at step 1.

---

**1. Where are you?** `READ` Upgrade Centre → AUGUR. Note the version it runs, and open the newest History row. Note how it ended and the backup it took. `PASTE`
- The Upgrade Centre won't load: use the notice's words, and `pc logs updater`. Go on.

**2. Is every part up?** `READ` `pc ps`
- every service `healthy` → step 3
- any `unhealthy`, `starting` or `Restarting` → note which → step 4

**3. Does AUGUR pass the watch's own look?** `READ` `pc exec -T updater node dist/index.js check`
- `"ok":true` → AUGUR is back and well → step 9
- `"ok":false` → note each problem → step 4

**4. What does the part say?** `READ` `pc logs --since 15m <part>` `PASTE` the first error.
- It says its tables, data or schema are newer than it expects → step 5
- anything else, or you can't tell → step 8

**5. The code went back; the data didn't.** This is docs/upgrade.md, Going back, step 2. The fix is a restore of the backup from step 1. **Clock:** a restore loses everything saved since that backup, and more each hour people work.
`READ` Admin → Activity, from the backup's time. Count what people saved.
- little or nothing, and you're awake enough for 20 minutes → step 6
- otherwise → step 8

---

> **6. PAUSE POINT. The next step can't be undone.** Say out loud:
> - the file: the one from step 1, by name (not "the newest")
> - what will be lost: what step 5 counted
> - that you've written down the notice, the History steps and Activity since the backup

**7. `ONE-WAY` Restore** (docs/deploy.md, Backups → Restore):
```sh
pc stop tailscale web gateway identity registry events keycloak backup
gunzip -c infra/deploy/backups/<the file> | pc exec -T postgres psql -U platform -d postgres
pc up -d
```
Then step 2. You may have to sign in again.

---

**8. Contain until morning.**
- `ACT` Admin → Apps: turn the failing app off for the organisation, so people see it's off, not broken. Undo: turn it on.
- `ACT` Upgrade Centre: set AUGUR to **Ask first**. Undo: set it back.
- Leave Needs you unmarked: someone still has to act. → step 9

**9. Close.** Write the hand-off: what you saw (steps 1 to 4), what you did and when, what is still wrong, what was lost. If the release itself is at fault, tell Harry: only he can halt it for other servers (Actions → Halt rollout). Mark it looked at only if nothing is left to do.

---

**DO NOT**
- **Go back further** than the release you're on. 0.18.0 moved Keycloak to 26.8, which can't be undone: going back past it needs a restore (docs/upgrade.md).
- **Try the same upgrade again.** It does the same, and takes a new backup.
- **`pc down -v`.** It deletes every database on the server.
- **Take a backup "to be safe"** before a restore. It becomes the newest.
- **`git checkout` or `git pull` over `infra/deploy`.** The updater may have written files there.

**WHO CAN HELP.** Harry: the release, and halting it. Another deployment admin, if there is one (Admin → People).
