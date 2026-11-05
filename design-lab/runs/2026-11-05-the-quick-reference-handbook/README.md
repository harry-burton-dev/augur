# The quick reference handbook

The first design lab run on the **ops** track (5 November 2026, batch 7, prompt O1): what AUGUR's procedure for an upgrade that goes wrong at 2am looks like if it is written and tested like a flight-deck Quick Reference Handbook. Sources: the Boeing 737 QRH layout, Degani and Wiener on checklists, Gawande and the WHO surgical checklist, UK incident command, Google SRE's incident chapters, and symptom-based emergency procedures.

Everything is markdown, printable on one or two A4 pages. Commands are from AUGUR's guides; anything the guides don't say is marked. The cards were tabletopped by walk-through ([results](checks/results.md)): **the round-1 symptom card (V2) beat the combined card**, reaching a safe restore in all three worlds while the combined card contained.

## Start here
1. [`checks/scenario.md`](checks/scenario.md): the scripted failure, written before any card. For the tester.
2. [`combined/card.md`](combined/card.md): the 2am card (U-1), and [`combined/daylight.md`](combined/daylight.md): its daylight check (U-0).
3. [`SHORTLIST.md`](SHORTLIST.md): ranking, product asks, answers to the prompt's questions, what didn't work.

## Every file

| Surface | Variant | File | Critique |
|---|---|---|---|
| Checks | Scenario (for the tester) | [checks/scenario.md](checks/scenario.md) | |
| Checks | Answer key (read after playing) | [checks/key.md](checks/key.md) | |
| Checks | Results across cards and worlds | [checks/results.md](checks/results.md) | |
| 1. Grammar | One sheet: condition, objective, memory item, do-not, check, branch, pause point, one-way, way back, clock, hand-off | [grammar.md](grammar.md) | |
| 2. The card | V1 Quick reference card | [card/v1-qrh.md](card/v1-qrh.md) | [notes](card/notes.md) |
| 2. The card | V2 Four things that must hold | [card/v2-status-tree.md](card/v2-status-tree.md) | [notes](card/notes.md) |
| 2. The card | V3 Three pauses | [card/v3-three-pauses.md](card/v3-three-pauses.md) | [notes](card/notes.md) |
| 2. The card | V4 You are in command | [card/v4-in-command.md](card/v4-in-command.md) | [notes](card/notes.md) |
| 3. Before you need it | V1 The proof sheet | [daylight/v1-proof-sheet.md](daylight/v1-proof-sheet.md) | [notes](daylight/notes.md) |
| 3. Before you need it | V2 The way-back register | [daylight/v2-way-back-register.md](daylight/v2-way-back-register.md) | [notes](daylight/notes.md) |
| 3. Before you need it | V3 Rehearse it | [daylight/v3-rehearsal.md](daylight/v3-rehearsal.md) | [notes](daylight/notes.md) |
| 3. Before you need it | V4 Upgrade while someone is awake | [daylight/v4-awake-window.md](daylight/v4-awake-window.md) | [notes](daylight/notes.md) |
| 4. The hand-off | V1 SBAR, read back | [handoff/v1-sbar.md](handoff/v1-sbar.md) | [notes](handoff/notes.md) |
| 4. The hand-off | V2 The night, line by line | [handoff/v2-timeline.md](handoff/v2-timeline.md) | [notes](handoff/notes.md) |
| 4. The hand-off | V3 The way-back ledger | [handoff/v3-way-back-ledger.md](handoff/v3-way-back-ledger.md) | [notes](handoff/notes.md) |
| 4. The hand-off | V4 One night, three readers | [handoff/v4-three-readers.md](handoff/v4-three-readers.md) | [notes](handoff/notes.md) |
| Round 2 | U-1 The 2am card | [combined/card.md](combined/card.md) | [notes](combined/notes.md) |
| Round 2 | U-0 The daylight check | [combined/daylight.md](combined/daylight.md) | [notes](combined/notes.md) |

## Tabletops

Three fresh operators each saw one card and Step 1's text, and wrote a walk-through of every move; each was played against `checks/scenario.md` in W0, W1 and W2.
- [checks/tabletop-combined.md](checks/tabletop-combined.md): `combined/card.md`. Contained in all three worlds.
- [checks/tabletop-v2-status-tree.md](checks/tabletop-v2-status-tree.md): `card/v2-status-tree.md`. Restored safely in all three.
- [checks/tabletop-v1-qrh.md](checks/tabletop-v1-qrh.md): `card/v1-qrh.md`. Contained; its restore branch would have failed.
- [checks/results.md](checks/results.md): the table across cards and worlds, the gaps, and final scores.

Also here: [`prompt.md`](prompt.md), the prompt as it was run, and [`concepts.md`](concepts.md), the concepts it found.
