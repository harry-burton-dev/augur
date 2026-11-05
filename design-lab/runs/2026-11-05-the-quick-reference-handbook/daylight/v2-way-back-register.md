# Daylight · V2 · The way-back register

*Before each upgrade window, fill in one row. The 2am card then reads "your way back is in the register, last row" instead of asking you to work it out. After "the way back is recorded": a step that can't be undone is written down with its way back, its cost and what it depends on, before it is taken.*

## Before the window

From the Upgrade Centre (What's new since, Needs you first) and the release notes in docs/upgrade.md:

| Field | This window |
|---|---|
| Window opens | |
| From → to | |
| Kind | patch / minor / major (a 0.x minor never starts by itself) |
| Parts that migrate data ("migration" in the release's changelog) | |
| Anything that can't be undone ("can't be undone" in the release notes) | |
| The furthest you may go back without a restore | the release you run now, unless the notes say otherwise |
| Settings it needs (Needs you first) | |
| Who's on, and awake, when it opens | |

## The way back, worked out now

| If, in the morning... | The way back | Costs | Depends on |
|---|---|---|---|
| it went back by itself, and every part is healthy | nothing to do | nothing | the updater's watch |
| it went back, and a part fails on its tables | restore the backup the updater took first (its name is in the notice and History) | everything saved since the window opened | that backup restoring (the updater tests it first) |
| it kept running, and the watch saw a problem | Upgrade Centre → Go back, if no release between is breaking; else a restore | as above, or nothing | no breaking release between |
| sign-in fails | not past the "can't be undone" release above; a restore if needed | as above | the same |

## After the window

| Field | |
|---|---|
| How it ended (History) | |
| Backup it took (by name) | |
| Anything done by hand, and when | |
| Row closed by, on | |

**Where the register lives:** on paper beside the card, or in a file outside the database. Not in AUGUR: a restore rewinds AUGUR, and the register is how you'd know what to restore.
