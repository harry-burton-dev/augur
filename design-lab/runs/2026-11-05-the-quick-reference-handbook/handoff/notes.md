# The hand-off: critique

Surface 4. What the admin leaves for the morning: themselves, Harry, or a coding agent. Each variant is shown filled in for the scenario's Ending A (restore at 02:21), so its shape can be judged on real content. The walk-throughs ([results](../checks/results.md)) tested the hand-off only through what each operator said they'd leave; step 11's question couldn't be asked. **What they left:** all three told Harry to halt 0.18.1, and all three would have written the night down before a restore. Both who contained wrote what they saw and did, but not that a restore was still needed and costs more each hour: the clock was missing from every hand-off. Scores below are my reading, adjusted for that.

**The finding that shaped all four.** A restore puts the whole database back as it was at the backup, and AUGUR's own record of the night is in that database: the Upgrade Centre's history row ("went back by itself"), the first notice, and Activity after 01:40. The updater's code then closes the restored, still-running upgrade as "stopped partway", so the history afterwards tells a different story from the one the admin saw. **So a hand-off written from AUGUR after a restore is wrong, and one written before it must live outside AUGUR.** Every variant here is written before the one-way step and kept off the database.

---

## V1: SBAR, read back (`v1-sbar.md`)
*Idea.* Situation, background (pasted from records), assessment (yours, with how sure), recommendation (in order). It moves only when the taker reads it back in their own words; until then the giver still answers for it.
*Sources.* SBAR clinical handover; "the readback moves it" (paper and the desk run).
*Tabletop result.* Not played directly. No walk-through used SBAR; one-admin operators wrote messages, not handovers.
*What works.* The shortest that is still complete. "Say how sure" separates what the log said from what you think. The readback gives a one-admin deployment something it otherwise lacks: a moment when "it's yours now" is true.
*What fails or risks.* For "yourself in the morning" the readback is theatre. SBAR's background wants records, and after a restore the records are gone; it only works if background was pasted before.
*Needs.* A place to put it that the taker will see first. AUGUR's own Inbox would be ideal, and is the one place a restore rewinds.
*Score.* Recovery 3 · Safety 3 · Upkeep 5 · Fit 4

## V2: The night, line by line (`v2-timeline.md`)
*Idea.* A timeline written as you go, one line per thing seen or done, with output pasted and never cleaned up. Kept as a file on the server outside `infra/deploy` and outside the database.
*Sources.* Google SRE, "Managing Incidents" (the living incident document); flight data recorders, loosely.
*Tabletop result.* Indirect: U-1's operator kept a log in the home directory, as the card's memory item said, and the V2 operator copied the record before the restore. Neither card's log said where the morning would find it.
*What works.* It's the only form that survives the restore by design, and the only one that keeps wrong turns ("never delete a line"). `ONE-WAY` written before the line makes the mark a pause point of its own. It is what V4's command card calls a log, made concrete.
*What fails or risks.* Writing before doing is real effort at 2am, and the first thing a tired person drops. A file in the admin's home directory is found by nobody else. The full timeline is too long for Harry.
*Needs.* `NOT DOCUMENTED`: a place AUGUR keeps an operator's notes outside its own database. A product ask: the updater writes its own timeline to a file beside `last-backup.json`, so the admin's lines can sit next to the server's.
*Score.* Recovery 4 · Safety 4 · Upkeep 4 · Fit 4

## V3: The way-back ledger (`v3-way-back-ledger.md`)
*Idea.* State, not story: facts as commands with pasted output; each step taken as one line with undo, way back, cost and what it depended on; unknowns with what would close each. Written so a coding agent, who can't see the server, can pick it up.
*Sources.* "The way back is recorded" (the annotated game run); AUGUR's rule that agents can't see Harry's servers.
*Tabletop result.* Not played directly.
*What works.* It's the hand-off an agent can act on without asking. The restore's line says, in one row, what was lost forever, including AUGUR's own record. "Not to do next" carries the do-nots into the morning.
*What fails or risks.* The longest to fill in, and tabular: hard to write on a phone. Needs the admin to know what each step depended on, which a tired person won't.
*Needs.* As V2.
*Score.* Recovery 4 · Safety 5 · Upkeep 3 · Fit 5

## V4: One night, three readers (`v4-three-readers.md`)
*Idea.* The same facts told three times, each to one reader, in what that reader needs first: yourself (one thing to do, one not to do), Harry (halt the release, two gaps in the guides), a coding agent (task, facts with commands, done when).
*Sources.* "Context names its reader" (the situation run); SBAR's recommendation, split by taker.
*Tabletop result.* Indirect: U-1's operator wrote all three messages as its step 4 asks, but the one to themselves said "restore at some time if wanted", without the cost. The message to yourself needs a fixed line for the clock.
*What works.* Each part is one message, so it gets sent. Harry's part carries the two guide gaps back to the person who can fix them, which is how the card stays true. The agent's part says what not to assume.
*What fails or risks.* Three things to write. Without V2's timeline beneath it, the facts are from memory. Pick one reader when tired.
*Needs.* Nothing new, beyond the timeline.
*Score.* Recovery 4 · Safety 4 · Upkeep 4 · Fit 5

---

## Ranked (after the tabletop)

1. **V2 + V4 together:** the timeline as you go (survives the restore), then the three short messages from it when you stop.
2. **V3: The way-back ledger,** as the form for a coding agent.
3. **V1: SBAR, read back,** when there is a second admin to take it.

The combined card uses V2's timeline as its log and V4's three messages as its last step.
