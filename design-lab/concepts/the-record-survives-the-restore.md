---
name: the-record-survives-the-restore
status: explored
track: ops
---

# The record survives the restore

A restore rewinds everything in the database, including the system's own record of why the restore was needed: history, notices, audit. So the record of the incident is written before the one-way step and kept outside what it rewinds, and afterwards the system says plainly that its record was rewound. In AUGUR today the updater closes the restored, still-running upgrade as "stopped partway", so the history tells a second, different story.

First found in: [`2026-11-05-the-quick-reference-handbook`](../runs/2026-11-05-the-quick-reference-handbook/) (hand-off V2 and V3, combined U-1's pause point; scenario step 10, from the updater's code). Tabletopped by walk-through: see the run's `checks/results.md`.

Could steer: an updater-run restore, an audit export, [the wake](the-wake.md), any go-back in Mandate or Data Atlas.

Related: [the way back is recorded](the-way-back-is-recorded.md), [history as a material](history-as-material.md).
