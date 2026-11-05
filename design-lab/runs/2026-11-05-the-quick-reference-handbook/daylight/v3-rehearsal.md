# Daylight · V3 · Rehearse it

*A card nobody has used fails the first time it's needed. Once a quarter, rehearse the parts you can. Each rehearsal says where it may run, because a production server must refuse some of them.*

## What you can rehearse, and where

| Rehearsal | Where | How (from the guides) | Proves |
|---|---|---|---|
| **The watch sees a failure** | dev or preview server only | Upgrade Centre → AUGUR → **Install … for a test** beside a halted release (ADR 0051). Production refuses it, and says why | AUGUR goes back by itself from a broken release, on your hardware |
| **The watch's one look** | any server | `pc exec -T updater node dist/index.js check` | the updater can sign in, read the gateway and ask every part |
| **A backup restores** | any server | `pc exec backup /bin/sh /backup/backup.sh --restore-test` | the newest backup loads into a throwaway database. The live one is never touched |
| **The off-server copy restores** | any server with one | `pc exec backup /bin/sh /backup/backup.sh --restore-test --offsite` | the copy in the bucket, not only the file on this disk |
| **The whole restore** | a spare machine, never production | docs/deploy.md, Backups → Restore, with a copy of a real backup | that you can do it, and how long it takes. `NOT DOCUMENTED`: no guide gives a restore rehearsal; Harry could add one to docs/deploy-test.md |
| **The card itself** | a table, with a second person | play `checks/scenario.md` from this run: one reads the server, you use the card | that the card works for someone tired. Note every place you guessed |

## A one-server deployment

Most deployments have one production server and no preview. Then only the second, third and fourth rows run on your own hardware. Say so in the hand-off rule: "AUGUR's go-back has been proved on the publisher's staging server (ADR 0050), not on this one."

## After each rehearsal

Write on the card's foot: the date, what was rehearsed, and each line of the card that was wrong or unclear. Fix the card the same day. A card change that comes from AUGUR changing goes in the same pull request as the guide change (see SHORTLIST.md, "Where the card lives").
