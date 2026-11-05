# U-0 · Daylight check for card U-1

*Do-confirm. The day before any upgrade window, and once a month. Run each line, paste what it printed, tick it. Each line is here because card U-1 counts on it at 2am. True for AUGUR 0.18.x.*

## 1. Decide two things once (and write them on card U-1)

- **When AUGUR may upgrade by itself.** The default is Sunday 02:00 for two hours. At night the watch is usually too quiet to judge errors (docs/upgrade.md), and you're asleep. Choose a working-day hour when you're up, or set **Ask first** and start each one yourself. `ACT` Upgrade Centre → AUGUR → policy and windows.
- **The house rule:** "If restoring loses nothing people saved, restore tonight. Otherwise contain, and restore at ____ with ____." Fill in the blanks.

## 2. Prove the way back

| # | Proves | Run | Good looks like | Pasted | ✓ |
|---|---|---|---|---|---|
| 1 | A backup was taken | `cat infra/deploy/backups/last-backup.json` | `"ok":true`, within a day | | |
| 2 | It restores | `pc exec backup /bin/sh /backup/backup.sh --restore-test` | ends `restored and checked` | | |
| 3 | It leaves the server | Admin → Status | a copy in the last day, not "kept on this server only" | | |
| 4 | The watch can see | `pc exec -T updater node dist/index.js check` | `"ok":true` | | |
| 5 | Where you can't go back past | the newest "can't be undone" in docs/upgrade.md's release notes | today: **0.18.0** (Keycloak 26.8). Write it on card U-1's NEVER line | | |

## 3. Prove you can act at night

| # | Proves | Do | Good looks like | ✓ |
|---|---|---|---|---|
| 6 | You'd hear | see a notice in AUGUR from the phone you keep by the bed | it opens. *Not documented: anything that reaches a phone not looking at AUGUR* | |
| 7 | You can reach the server without AUGUR | SSH from the laptop you'd use | a prompt in the checkout | |
| 8 | You can step up | Upgrade Centre: open a change, then cancel | password and code both work | |
| 9 | Someone else could act | Admin → People: who holds `deployment-admin` | named here: ______ | |

## 4. What this server can't prove

A production server refuses a test install of a broken release (ADR 0051). On a one-server deployment, AUGUR's go-back has been proved on the publisher's staging server, not on yours. Write that in the hand-off rule, not as a pass.

## 5. Keep the card true

- After each AUGUR upgrade: read the release notes for "can't be undone", "migration", and anything about the updater, restores or backups. If one is there, change card U-1 the same day.
- Once a quarter, play the card against `checks/scenario.md` with a second person. Write the date on the card's last line.

**Signed:** ________ **Date:** ________ **AUGUR:** ________ **Card U-1 version:** ________
