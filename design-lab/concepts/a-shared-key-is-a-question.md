---
name: a-shared-key-is-a-question
status: explored
track: data
---

# A shared key is a question

When a second record arrives with a key another entity already holds (a company number, an IMO number), Data Atlas asks a person "same thing?" in Triage. It never merges on the key alone. A key is a fact with evidence, and one wrong number on one invoice is enough to join two companies with nobody having decided it. The person's answer is the merge, and it cites both records.

First found in: [`2026-11-05-the-type-specimen`](../runs/2026-11-05-the-type-specimen/) (identity V3's failure, identity V1's January refusal, combined `p0`).

Could steer: Data Atlas matching (keys, names, spelling, meaning: all only suggest), Explorer (people with two accounts), imports into Artifacts.
