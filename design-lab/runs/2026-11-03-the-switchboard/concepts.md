# Concepts found by this run

Each is bigger than one prototype and could steer a future run. They are also filed in `design-lab/concepts/`.

## The route is a trace (`the-route-is-a-trace`)
Routing is one function that returns, for every notice and every person it names, the rule that decided, the channel, the time, what held it and every escalation step, each with its owner. Every “why” view (the postmark, the trace, the replay, the delivery report) renders that one trace, so no explanation can drift from what happened. Evidence: grammar V4, why V1 and V2, combined V1 and V2. Could steer: the events service’s routing ADR, the control room (E), the constitution (R).

## Returned to sender (`returned-to-sender`)
Nothing an app sends fails silently. A notice that reached nobody comes back to its sender with the reason, the people it would have reached and the one person who can change it. A dry run finds the same answer before the send. Evidence: owner V2, V5 and V6, combined V4. Could steer: Admin, Apps; the groundskeeper (K); keys and doors (N).

## No gap between owners (`no-gap-handover`)
Ownership passes only when the next person takes it, as in an air traffic handoff. Offering, escalating or naming a cover never moves it by itself. Everyone else is stood down by name, a pass-on carries a half-written handover note, and a cover must say yes. Evidence: escalation V2 and V4, switchboard V4, combined V3. Could steer: Mandate, the case file (U), paper and the desk (W1).

## The next step is shown (`the-next-step-is-shown`)
Every item that waits on someone says who is asked next and when, from a policy the team can read. Escalation becomes a schedule on the card, the team board and the morning edition. Evidence: why V6, escalation V1 and V5, digests V1. Could steer: Home, Mandate deadlines, the score (F).

## News waits for the edition (`news-waits-for-the-edition`)
Only what needs someone interrupts. Info, and whatever comes in quiet hours, waits for an edition at the start of the person’s day, in a fixed order, with every source entered even at zero. Urgent is the only stop press, and the emailed copy is a pointer, not a copy. Evidence: grammar V2, digests V1, V3, V4 and V5. Could steer: Home, the edition (S), the minute (T), the control room (E).

## Quiet has named keys (`quiet-has-named-keys`)
Quiet hours are trusted because every route through them is listed with who cut that key and when it was last used, and what waited is counted. Evidence: switchboard V5 and V1, escalation V6. Could steer: keys and doors (N), the account area.

## Rehearse on last week (`rehearse-on-last-week`)
Every setting is previewed by running the person’s own last week through it again, so changes are judged against what actually arrives. Evidence: why V3, switchboard V2 and V3, owner V6, combined V2. Could steer: the constitution (R), the meter (W4), feature flags.

## Concepts this run moved forward
- `shell-owns-loudness`: explored. The four classes (urgent, needs you, tell me, for the record) are the shell’s loudness table. An app sets only the level and the address; the class decides channel, quiet, away, mute, receipt and escalation.
- `answer-not-announce`: explored for notices. Info never pulses and waits for the edition. Last week that kept 15 deliveries from interrupting anyone.
- `question-and-answer`: explored. Told, seen, taken and acted are separate receipts. Taking stops escalation and seeing doesn’t: 27 deliveries were seen, 4 were taken.
- `earned-sound`: advanced. Budgets move from sounds per person to an urgency budget per app per floor (2 a week) and a proposed rate of 6 sends an hour per app per floor. The ledger edition is the silence ledger for notices.
- `consequence-preview`: advanced. Rehearsed on the person’s own last week (`rehearse-on-last-week`).
- `reach-before-act`: advanced. An app owner’s dry run shows reach and routes before the send.
- `six-ways-to-be-empty` / `honest-blank`: advanced. An edition enters every source, even at zero (“checked, nothing for you”).
- `frame-for-urgency` and `the-signal-is-the-control`: used. Urgent at night in the Letterbox, with the bars carrying the escalation schedule; the lit “I have it” is the answer.
- `watches-say-what-they-cant-see`: advanced. Escalation needs the same clock in the events service that watches need (limits passing, working hours).
