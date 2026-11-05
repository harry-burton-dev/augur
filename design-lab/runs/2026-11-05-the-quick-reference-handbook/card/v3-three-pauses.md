# Upgrade went back: three pauses

*Do-confirm card, after the WHO surgical checklist. Work from what you know and from docs/upgrade.md, Going back. Stop at each of the three pauses and confirm every line out loud before you go on. Killer items only: each line is here because missing it has cost data or sign-in. True for AUGUR 0.18.x.*

**For:** a notice that AUGUR went back by itself, didn't install, or kept running after its watch saw a problem.

---

## PAUSE 1 · SIGN IN (before you touch the server)

Confirm out loud:

- [ ] I know the release AUGUR runs **now**: ______ (Upgrade Centre, or `grep PLATFORM_VERSION infra/deploy/.env`)
- [ ] I know how the upgrade ended: went back / didn't install / still on the new release
- [ ] I've written down the backup file it names: ______________________
- [ ] I know which parts are not healthy (`pc ps`): ______
- [ ] I have not restarted, retried or gone back. If I have, I've written down what and when.

Then work it out. The two usual cases:
- Every part is healthy and `pc exec -T updater node dist/index.js check` says `"ok":true`: AUGUR is back and well. Go to Pause 3.
- A part fails on the tables the new release changed (`pc logs <part>`): the code went back, the data didn't. A restore of the named file fixes it (docs/deploy.md, Backups → Restore). Go to Pause 2 before you do.

---

## PAUSE 2 · TIME OUT (before anything that can't be undone)

Before a restore, `pc down -v`, deleting a backup, or going back past a release:

- [ ] I'm restoring **the file I wrote down**, by name, not the newest
- [ ] I know what it loses: Admin → Activity since its time shows ______
- [ ] I've written down the night (notice, History steps, Activity), because a restore rewinds AUGUR's record of it
- [ ] I'll stop **everything but Postgres**, as docs/deploy.md's words say, not only the parts its command lists
- [ ] I'm not going back past 0.18.0: Keycloak 26.8's database can't go back
- [ ] I'm awake enough for 20 minutes. If not: turn the app off (Admin → Apps), and go to Pause 3

---

## PAUSE 3 · SIGN OUT (before you leave it)

- [ ] `pc ps` and the updater's `check`, run again now: ______
- [ ] What's still wrong, in one line: ______
- [ ] What was lost, and who to tell: ______
- [ ] Harry told if the release is at fault (only he can halt it)
- [ ] Needs you: marked looked at only if nothing is left to do
- [ ] The hand-off is somewhere the morning will find it: ______
