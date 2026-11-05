# Tabletop results

## How these were played

There was no live tabletop. Three fresh operators each saw one card and Step 1's **Sees** text, nothing else. Each wrote a walk-through of every move, with their own branches for what they might see:

- [tabletop-combined.md](tabletop-combined.md): `combined/card.md` (U-1)
- [tabletop-v2-status-tree.md](tabletop-v2-status-tree.md): `card/v2-status-tree.md`
- [tabletop-v1-qrh.md](tabletop-v1-qrh.md): `card/v1-qrh.md`

I then played each walk-through against `scenario.md` in all three worlds. At each move I looked up what the server would show, and took the operator's own branch for that output. Where they wrote two branches for the same output, I took the one they said they'd lean to. The grading is against `key.md`.

What this can't test: the injects (I1 "just restart it", I2 the lost save) were never put to anyone. Nobody saw a real output and then reacted to it. The turn counts are my count of their moves, not timed play. See SHORTLIST.md, "Method notes".

## Across the three cards and the three worlds

| Card | World | End state | Turns | Wrong turns | One-way steps taken without a warning | Guesses (of which load-bearing) |
|---|---|---|---|---|---|---|
| **U-1 combined** | W0 | **B: contained**, Data Atlas off, AUGUR on Ask first, Needs you left open | ~20 | 0 | 0 | 16 (3) |
| | W1 | B, the same | ~20 | 0 | 0 | 16 (3) |
| | W2 | B, but "Ask first" fails on the Upgrade Centre's error and the card has no branch for that (harmless: a try that didn't finish waits for an admin anyway) | ~20 | 0 | 0 | 17 (3) |
| **V2 status tree** | W0 | **A: restored** the named file, every part healthy, Data Atlas opens; the 01:52 save lost | ~20 | 0 | 0 | 12 (4) |
| | W1 | A, the same (it never relies on a date-named file) | ~20 | 0 | 0 | 12 (4) |
| | W2 | A. The pause point's "History steps" can't be copied; the operator keeps the notice and Activity | ~19 | 0 | 0 | 13 (4) |
| **V1 QRH** | W0 | **B: contained**, by the operator's own lean at step 5 ("half asleep I'd lean to step 8") | ~11 | 0 | 0 | 14 (4) |
| | W1 | B, the same | ~11 | 0 | 0 | 14 (4) |
| | W2 | B, through step 1's "won't load" branch; "Ask first" fails as for U-1 | ~11 | 0 | 0 | 15 (4) |
| *V1, restore branch* | all | **Failure: a partly loaded restore** (scenario steps 9 and 15). The card copies deploy.md's stop list; the operator noticed atlas and the updater were left running but followed the card, ran `pc up -d` over the ERROR lines, found atlas still failing, and contained on top of an unknown database | ~20 | 1 (the restore with parts still running) | **1**: the restore was warned as one-way, but not that the parts left running would spoil it | 14 (5) |

All three operators beat the traps that cost the most: none restarted anything, retried 0.18.1, went back past 0.18.0, ran `pc down -v`, took a backup "to be safe" or restored a file by its date. All three used the file the notice named. **So the memory items and the NEVER line worked on every card.**

## Grading against key.md

| | U-1 combined | V2 status tree | V1 QRH |
|---|---|---|---|
| Ending reached | B (acceptable) | **A (the better one)** | B; its A branch fails |
| Checked what a restore loses (Activity) first | yes | yes | yes |
| Wrote the night down before a restore | would have, at the pause point | yes | would have |
| Confirmed the backup file is on disk before the restore | yes (check d) | **no**: check 3 failed first, so it jumped to Table 3 and skipped check 4 | added `ls` on their own |
| Read the second notice correctly | warned (not reached) | yes: "trust the checks, not the notices" | not warned (not reached) |
| Told Harry to halt 0.18.1 | yes | yes | yes |
| Hand-off says a restore is still needed, which file, and that it costs more each hour | partly: says "restore at some time if wanted", not the cost | n/a (restored); the 01:52 loss known from Activity | partly: what was seen and done, not what a restore would cost |

## Why each card ended where it did

**U-1 (combined) contained, in every world, for two reasons the card made.** (1) Its **house rule was blank**: the operator had no daylight rule, read only the printed half ("if restoring loses nothing people saved, restore tonight"), saw one save in Activity and chose to contain. The card depends on U-0 having been done, and without it step 2 has no answer. (2) Its top line, "the first that fails decides", **clashed with its own branches**: check b failed before check c, so by the top line b decided ("contain"), even though the "c fails → step 2" branch was the one that fit. The operator noticed the clash, ran c anyway, and was left unsure. Ending B is acceptable under the key, but the card was built to reach A, and didn't.

**V2 restored, in every world.** Its symptom order worked: check 2 failed, Table 2 sent the operator to check 3 *for that part*, check 3 failed and Table 3 decided. "Little or nothing by people" let one save count as little. Its restore stops everything and starts Postgres alone, which the scenario plays as a clean load. It works without the Upgrade Centre. Its weak spot: Table 3 doesn't send you back to check 4, so the operator restored without first confirming the file was on disk and tested. That cost nothing in any of the three worlds; in a fourth (the file missing) it would have.

**V1 contained by tiredness, and its restore would have failed.** Read-do worked: the shortest path of the three (~11 turns) and a sound containment. But the restore branch is the guide's own command, and the scenario says that leaves the apps' services connected while the dump tries to drop the database. This operator spotted the gap ("stop list doesn't include atlas, updater or other apps") and followed the card anyway, which is what a card is for. This is the clearest evidence for fixing deploy.md, not only the card.

## Gaps every walk-through hit

| Gap | U-1 | V2 | V1 | Fix |
|---|---|---|---|---|
| `pc` is never defined, nor where to run it | yes | yes | yes | Print the alias and `cd <checkout>` at the top of every card |
| `pc stop` might cut my own SSH (tailscale is a compose service) | | yes | yes | Say: `pc stop` stops AUGUR's own Tailscale node; your SSH to the host doesn't go through it. Check before you start. *Not documented how an admin reaches the host* |
| What psql prints, and which errors are normal | yes | yes | yes | Not documented; needs a guide line, or a restore command that checks itself (product ask 6) |
| No branch for "restored, and a check still fails" | yes | yes | (own rule: don't restore twice) | Add: stop, hand off, don't restore again |
| UTC or local time (the file name ends in Z) | yes | yes | yes | Say the file name is in UTC |
| Does `restore-test.json` test my file? | yes | yes | | Say: its `"file"` must be your file |
| "Little" saves, and "20 minutes" of what | | yes | yes | A number in the house rule, set in daylight |
| `--since 15m` may be too short | yes | | yes | Use `--since 1h` |
| No wait for Postgres before the load | yes | (not noticed) | n/a | Add `pc ps postgres` until `healthy` |
| How to reach Harry at 2am | yes | | | A contact line, filled in by U-0 |
| The house rule left blank | yes | n/a | n/a | A default for when it's blank (see SHORTLIST.md) |

## Final scores (Recovery · Safety · Upkeep · Fit)

| Card | Before | After | Why it moved |
|---|---|---|---|
| V2 status tree | 4 · 4 · 3 · 4 | **5 · 4 · 3 · 4** | Reached A in all three worlds; Safety held at 4 for skipping check 4 before the restore |
| U-1 combined | 4 · 5 · 3 · 4 | **3 · 5 · 3 · 4** | Safe throughout, but contained in all three worlds: the blank house rule and the b-before-c clash |
| V1 QRH | 4 · 3 · 3 · 5 | **3 · 2 · 3 · 4** | Its restore branch ends in a partly loaded database; Fit down, because copying the guide carried the guide's gap |

V3 and V4 weren't played; their scores stay provisional.
