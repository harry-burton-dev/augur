# Concepts found by this run

The first run on the ops track. Each concept is bigger than one card and could steer a future run, on any track. The evidence is from the scenario and from three walk-through tabletops played against it in three worlds ([results](checks/results.md)). They are also filed in `design-lab/concepts/`, with `track: ops`.

## Memory items are do-nots (`memory-items-are-do-nots`)
When automation has already acted (the updater went back by itself), the first lines a woken person reads must stop them repeating or undoing it: touch nothing, note the way back, start a log. The pilot's memory items are actions because the aircraft waits for no one; AUGUR's are holds, because AUGUR has already done the urgent part. A card that opens with an action invites the restart, the retry and the go-back.

Evidence: every costly branch in `checks/scenario.md` (steps 4, 12, 13, 14); card V1 and V2, combined U-1. Tabletop: 3 of 3 operators made none of the costly moves. Could steer: Upgrade Centre's notice text, the Letterbox for platform news, Admin's Status page when something has gone back.

## The way back has a name (`the-way-back-has-a-name`)
A way back is one exact thing named where the person will look (a backup file in the notice, a release in History), never a relative like "the newest" or "last night's". Relatives move: each Go back, retry, manual backup and some restarts take a new backup of the broken state, and a date name points at the wrong night when one failed.

Evidence: scenario steps 4, 9, 12, 13 and world W1; card V1, V2, combined U-1. Tabletop: 3 of 3 used the named file, and W1 did no harm. Could steer: Upgrade Centre History, Artifacts versions, any undo that points at a snapshot.

## The record survives the restore (`the-record-survives-the-restore`)
A restore rewinds everything in the database, including the system's own record of why the restore was needed: history, notices, audit. So the record of the incident is written before the one-way step and kept outside what it rewinds, and afterwards the system says plainly that its own record was rewound. In AUGUR today the updater even closes the restored upgrade as "stopped partway", telling a second, different story.

Evidence: scenario step 10 (from the updater's code, `index.ts`); hand-off V2 and V3; combined U-1's pause point. Tabletop: every operator who reached a pause point copied the record first, and said why. Could steer: an updater-run restore, Admin's audit export, the wake (the minute run), any "go back" in Mandate or Data Atlas.

## Four things must hold (`four-things-must-hold`)
A symptom-based card: name the few things that must be true (sign-in works, every part answers, the data fits the code, the way back exists), check them in order, let the first that fails decide, and check them all again after every act. It never asks why, and it doesn't trust notices written by the thing that failed. From nuclear plants' critical safety function status trees.

Evidence: card V2, combined U-1 step 1; scenario W2 and step 15. Tabletop: **the strongest result of the run**: V2 was the only card to reach a safe restore, in all three worlds. Its lesson for the form: the order must send you to the failing part's check, not stop at the first red line (the combined card's "first that fails decides" stalled its operator). Could steer: Admin → Status as a status tree, a deployment's own health page, Explorer's "why can't I open this".

## Upgrade while someone is awake (`upgrade-while-awake`)
Schedule change for when the watch can judge it and a person can act on it. At night the watch is too quiet to judge errors and the one admin is asleep; a restore that would cost nothing at 02:00 waits until it costs the morning. The cheapest 2am card is the one the window makes unnecessary.

Evidence: daylight V4, combined U-0; docs/upgrade.md on the quiet watch; ADR 0020 as amended. Tabletop: two of three operators contained because they were too tired, and the combined card stalled on a daylight rule nobody had set. A rule made in daylight needs a default for when it wasn't. Pushes back on an Accepted default, so it needs Harry's decision. Could steer: Upgrade Centre windows, app install windows, Mandate deadlines that land overnight.

## Also advanced
- **Stop, don't guess** (on a server): the card's check c stops at the first part that fails on its data, and step 4 hands off "anything else" rather than guess.
- **The way back is recorded:** the way-back register (daylight V2) and ledger (hand-off V3) record each step's undo, cost and dependency before and after.
- **Consequence preview:** the plan table (card V4, U-1 step 2) and product ask 4, "restoring loses *n* changes".
- **The readback moves it:** SBAR with readback (hand-off V1), for a second admin.
- **Pause points:** one fixed time out before the one-way step (card V3, U-1 step 3).
