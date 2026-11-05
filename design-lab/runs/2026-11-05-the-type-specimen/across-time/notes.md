# Answering across time: critique

The saved question "which suppliers have we not heard from since spring?"
was answered 7 on 20 April by Priya. Sam reruns it on 5 November. The
honest answer has three numbers, not two: **7** as asked, **9** as it stood
on 20 April knowing what we know now, and **8** now. The step from 7 to 9 is
"we learned about the past" (the split brought the subsidiary back, and
Solent's March contact turned out to be another firm's). The step from 9 to
8 is "something happened" (Kestrel got in touch in June). A fourth frame,
as asked but with Sam's access, isolates "different access"; here it moves
nothing. One of the 8 (Marlow) has a contact on a Team floor Sam can't see,
so the answer says "1 may move on a floor you can't see".

All four variants build on merge and split V2, so only the handling of time
differs.

## T1: Keep the answer
*Idea:* Facts are kept as they stand now; a correction edits or deletes
the row. To say what a run said, each run keeps the rows it returned.

*Sources:* the usual report snapshot; Artifacts' published copy as the
nearest AUGUR habit.

*Check result:* 5/6. Q2 fails: 7 and 8 are there, but "as it stood, as we
know now" can't be worked out, so every move is "reason not known".

*What works:* The simplest store. "What did it say?" is exact, because it is
a copy.

*What fails or risks:* It breaks *the question is the record*: the run
keeps rows, so the briefing's reader, and anyone who opens the run, sees
Priya's rows with Priya's access. The stored "Harbourline Freight Ltd" row
hides that it stood for two companies. No reason can be named, so a reader
can't tell a correction from news.

*Change from today:* Small: one table. Facts lose the recorded time Data
Atlas already has, so it is a step back.

*Score:* Honesty 2, Simplicity 5, Change cost 4, Fit 1.

## T2: Valid time only
*Idea:* Every row says when it was so in the world, nothing else. A
correction makes the table true: the wrong Solent contact is deleted, and
the wrong merge is deleted with its split, because it was never so.

*Sources:* Snodgrass 1999, ch. 2 (valid-time state tables).

*Check result:* 3/6. Q2 fails (9, 9, 8: the 7 that Priya saw can't be
replayed, and the only move found is Kestrel). Q3 fails (the months under
the parent's name are gone). Q6 fails (no merge left to say who did it).

*What works:* "What was true on 20 April?" is clean: 9. That is the number
a careful auditor would want.

*What fails or risks:* It can't explain the briefing. The briefing says 7
and the table says 9, with nothing between them. A wrong merge leaves no
trace, so the same wrong merge can be made again. This is the clearest
evidence in the run that identity needs recorded time.

*Change from today:* It would remove recorded time Data Atlas has today.

*Score:* Honesty 1, Simplicity 4, Change cost 2, Fit 1.

## T3: Two clocks
*Idea:* Snodgrass's bitemporal table, named plainly on every fact
(`valid_from`/`valid_to`, `recorded_from`/`recorded_to`). Names, merges and
splits carry recorded time; a *became one* merge also has a valid date. A
rerun is four frames, and each step between frames is one reason.

*Sources:* Snodgrass 1999, ch. 10 (bitemporal tables); SQL:2011 system- and
application-time periods; Data Atlas's own `facts` (two clocks already).

*Check result:* 6/6.

*What works:* The four frames turn the five reasons from labels into a
calculation: a reason is *which clock moved*. "Different access" is the
frame with today's floors; "we learned about the past" moves recorded time
only; "something happened" moves valid time. "A guess was settled" is a
recorded-time move whose cause is an accepted proposal, and "a word changed
meaning" is a change to the question's own choices; neither happens here,
and the query doesn't test them.

*What fails or risks:* This is merge and split V2 with two columns renamed
and `valid_to` added, so it is a control more than a new idea. Four frames
cost four evaluations of the question. A question whose words are vague
(what is "spring"?) needs its choices saved with it, or the frames compare
different questions.

*Change from today:* Small on facts (rename, one column); the rest comes
from the identity and merge surfaces.

*Score:* Honesty 5, Simplicity 4, Change cost 4, Fit 5.

## T4: Replay the log
*Idea:* One append-only list of events: entity made, named, merged, split;
fact said, withdrawn, sorted; guess made, accepted. All state at any time
is the events up to then, replayed.

*Sources:* event sourcing (Fowler, "Event Sourcing", 2005); the land
register's entries in order; Data Atlas's own outbox, which already writes
these events for other apps.

*Check result:* 6/6.

*What works:* There is nothing to keep in step: names, merges and facts
can't disagree, because they are one list. Data Atlas already emits
`atlas.entity.*` events, so the log half exists. The seed reads as the case
told in order.

*What fails or risks:* Every query is a replay with nested `NOT EXISTS`.
Q2 replays 52 events four times; at real sizes this needs snapshots, which
are T3's tables by another name. A wrong event can't be fixed, only
answered by a later one, which is right but makes simple reads long.
Checks are weak: one wide table with many nullable columns.

*Change from today:* Large for reads; small for writes (the outbox).

*Score:* Honesty 5, Simplicity 2, Change cost 2, Fit 4.

## Ranked
1. **T3 two clocks** (6/6). The five reasons become a calculation.
2. **T4 replay the log** (6/6). Same answers, costlier reads; keep the log
   as the outbox it already is, and query the tables.
3. **T1 keep the answer** (5/6). Exact about the past and silent about why;
   it also leaks rows past their floors.
4. **T2 valid time only** (3/6). Can't explain the briefing.

The finding to carry: **a rerun has three numbers**. Showing only "then 7,
now 8" hides that two of the changes were corrections, which is exactly
what the briefing's reader needs to know.
