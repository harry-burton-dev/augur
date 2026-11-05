# Daylight · V1 · The proof sheet

*Once a month, and the day before any upgrade window. Do-confirm: run each check, paste what it printed, tick it. Keep the filled sheet beside the 2am card. True for AUGUR 0.18.x.*

The 2am card can be short only if these were true yesterday. Each line here takes one thing off the 2am card.

| # | Proves | Run (`READ` unless marked) | Good looks like | Pasted | ✓ |
|---|---|---|---|---|---|
| 1 | The backup is taken | `cat infra/deploy/backups/last-backup.json` | `"ok":true`, today's or yesterday's date | | |
| 2 | It restores | `ACT` `pc exec backup /bin/sh /backup/backup.sh --restore-test` | last line ends `restored and checked` | | |
| 3 | Status agrees | Admin → Status | no "Backups need a look" | | |
| 4 | The backup leaves the server | Admin → Status, or `cat infra/deploy/backups/offsite.json` | a copy in the last day. "Kept on this server only" means a lost disk loses them too (docs/deploy.md, Off-server copy) | | |
| 5 | The watch can see | `pc exec -T updater node dist/index.js check` | `"ok":true` | | |
| 6 | You can reach the server without AUGUR | SSH to the server from the laptop you'd use at night | a prompt in the checkout | | |
| 7 | You can step up | Sign in to the Upgrade Centre; open a change, then cancel | it asks for password and code, and they work | | |
| 8 | Where you'd go back to | `grep PLATFORM_VERSION infra/deploy/.env`; Upgrade Centre → Go back | the release you run; the list of five | | |
| 9 | Where you can't go back past | the newest "can't be undone" in docs/upgrade.md's release notes | today: 0.18.0 (Keycloak 26.8) | | |
| 10 | When AUGUR may upgrade by itself | Upgrade Centre → AUGUR: policy and window | what you expect, and a time you'd be awake for | | |
| 11 | Who else can act | Admin → People: who holds `deployment-admin` | at least you; better two | | |

**If a line fails, fix it in daylight, before the next window.** For a failed backup or restore test, docs/deploy.md, Backups. Until lines 1 and 2 pass, set AUGUR to **Ask first** so nothing upgrades by itself.

**Signed:** ________ **Date:** ________ **AUGUR:** ________
