# Grammar: the parts of a 2am card

One sheet. Every card, daylight check and hand-off in this run is built from these parts, in this order. Each part has a job, a form, and a thing it must never claim.

Sources: the Boeing 737 QRH layout (condition, objective, memory items, then steps); Degani and Wiener (1990) on read-do and do-confirm; Gawande and the WHO checklist (pause points, killer items only); UK incident command (one person in command, a stated plan, a time to look again); Google SRE (mitigate first; the runbook is a living record); symptom-based emergency procedures (act on what you see).

## The parts

| Part | Job | Form | Must never claim |
|---|---|---|---|
| **Condition** | Prove you're on the right card before step 1 | What you see, in the words the screen uses: "Notice: *AUGUR went back to … by itself*" | A cause. "A migration failed" is a guess; "atlas doesn't answer" is what you see |
| **Objective** | Say what done looks like, so you know when to stop | One sentence: "AUGUR running, every app open, nothing lost that you didn't choose to lose, and a note for the morning" | That AUGUR will be fixed tonight. Sometimes the objective is "safe until morning" |
| **Memory items** | What to do (or not do) before you can read anything | Three lines at most, boxed, imperative | That they're complete. They buy time; the steps do the work |
| **Do-not** | Name the moves that make it worse | "Don't X: Y happens" | That the move is impossible. Say what it costs instead |
| **Check** | Read the server without changing it | A real command from the guides, and what its output looks like when all is well | That a check proves more than it reads. `pc ps` healthy doesn't mean the data is right |
| **Branch** | Go by what you saw, not by what you think caused it | "If you see X, go to N" | Every case. End with "anything else: stop, hand off" |
| **Pause point** | A fixed stop before a step that can't be undone | A line across the card: "STOP. Before you go on, say out loud:" and two or three items | That pausing is optional. A skipped pause point is written in the hand-off |
| **One-way** | Mark a step that can't be undone, before you reach it | `ONE-WAY` in the margin, what it costs, and the way back if there is one | That there's a way back when there isn't |
| **Way back** | Name exactly what you'd return to | The file or version by name, from the notice or history: `platform-2026-11-08T014012Z.sql.gz` | "The newest backup". The newest moves each time anything takes one |
| **Clock** | Say what gets dearer with time | "A restore loses everything saved since 01:40, more each hour people work" | A deadline nobody set |
| **Hand-off** | Leave the morning a true picture | What happened, what was done, what is still unknown, who to tell, what to do next | That something is fine because it was quiet. Unknown is written as unknown |
| **Who can help** | Name a person or role, and what only they can do | "Harry: halt 0.18.1 (Actions → Halt rollout; only the repository's owner)" | That anyone is on call. Most deployments have one admin |

## Marks used on the cards

| Mark | Means |
|---|---|
| `READ` | Changes nothing. Safe to run as often as you like |
| `ACT` | Changes the server, but can be undone |
| `ONE-WAY` | Can't be undone. Always after a pause point |
| `PASTE` | Copy the output into the hand-off |
| `NOT DOCUMENTED` | AUGUR's guides don't say. The card says who could add it |

## Two ways to use a card (Degani and Wiener)

- **Read-do:** read a line, do it, read the next. For things done rarely, in order, under stress. The 2am card is read-do.
- **Do-confirm:** do it from memory, then read the list to confirm nothing was missed. For things done often. The daylight check is do-confirm.

A card that mixes the two fails both ways: the tired person skips lines meant to be read, and the practised person stops reading.

## Rules for every card

1. One A4 page for the 2am card; the daylight check may take two.
2. Every command is from AUGUR's guides, word for word. Where a guide has none, the card says `NOT DOCUMENTED` and who could add it.
3. The first line after the condition is the objective. The memory items come before any reading.
4. A step that can't be undone sits after a pause point, never before.
5. The card names the release it is true for, and the guide it was written from, at the foot.
