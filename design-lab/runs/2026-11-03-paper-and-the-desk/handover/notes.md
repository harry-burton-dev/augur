# Surface 4 · Handover between people and floors

**The moment:** Amara Osei is on a course on Thursday and Friday. She hands intent M-207 ("Clear the damp backlog at Elm Court", 3 d 22 h past its deadline) to Tom Reyes. Separately she has a disputed fact (Elm Court Block C boiler install year: 2014 or 2017) that belongs with the data steward, Lena Fischer, on the Org floor. The handover card is SBAR. Situation and Background are filled from records, and Assessment and Recommendation are in Amara's words. The take happens on Tom's readback.

**Files:** built from `../_src/handover/v*.src.html`. R replays, and each page lists its own keys.

---

## V1: The SBAR card
*Idea.* A handover has one shape on every floor: four boxes, in order. S and B say "from records"; A and R say "Amara's words" and can't be skipped. Offering puts both names on the strip, and the strip moves only when the taker reads it back in his own words.

*Sources.* SBAR (situation, background, assessment, recommendation); I-PASS (Starmer et al. 2014: 23% fewer medical errors, with "synthesis by receiver" as its last step, and no longer handovers).

*What works.* The split between what the records know and what only the giver knows is the heart of it. AUGUR fills S and B, so the giver writes two short boxes, not a report. "A readback is not a tick" turns the take into an act of understanding. The rule list on the right is short enough to be the pattern entry.

*What fails or risks.* Four boxes for a trivial handover is heavy, so a "nothing to add" A and R may be needed for small things. The model gateway could draft S and B. If it does, they must be pencil until accepted (*pencil and ink*), and A and R must never be model-written.

*Principles.* Explain, never hide: strong. Calm: yes. It agrees with *pencil and ink* and *ask only what changes*.

*Needs.* An `offer` record with a card; a `readback` record.

*Scores.* Clarity 5 · Distinctiveness 4 · Feasibility 4 · Fit 5

## V2: Across the bays
*Idea.* Two bays side by side with a line between them. You drag a strip across (or press H), and it rests on the line, dashed and carrying both names, until the taker reads it back. Dropping it anywhere but a bay puts it back. It is never held by nobody.

*Sources.* Strips passed physically between sectors; the radar handoff "accept"; EFPS drag-to-hand-over.

*What works.* Resting on the line is the clearest picture of "offered, not moved". The custody line at the foot (held → offered → taken) reads in one glance.

*What fails or risks.* Dragging between two people's bays only works where both are on screen (a team board). From Home it has to be a command (H, then a person). Drag also fails keyboard users, so H must do everything drag does.

*Principles.* Calm: one movement. Explain, never hide: yes.

*Needs.* As V1.

*Scores.* Clarity 4 · Distinctiveness 4 · Feasibility 3 · Fit 4

## V3: The changeover zone
*Idea.* A handover is a zone in time, not an instant. From offer to take, both hold it: both can read it and ask on the card. Only the giver can change it or take the offer back, and only the taker can read it back. The giver sets an end to the zone. If it isn't taken by then, it stays with the giver and both are told: never dropped, never reassigned by a timer.

*Sources.* The relay baton changeover zone (the baton must pass inside the zone); the radar handoff, where the transferring controller keeps control until the receiver accepts.

*What works.* The table of who can do what in the zone is the most precise statement in the run of what "offered" means. "Nothing is reassigned by a timer" is a principle worth adopting.

*What fails or risks.* The day track is a lot of drawing for one handover. In the product the zone is a state on the strip, not a chart.

*Principles.* Explain, never hide: yes. Calm: no timer moves anything.

*Needs.* The zone's end on the `offer` record.

*Scores.* Clarity 4 · Distinctiveness 4 · Feasibility 4 · Fit 4

## V4: One token
*Idea.* Every thing that needs someone has one token. Whoever holds it can change the thing; everyone else who can see it can read it and add notes. The token moves in one step on the readback, and can't be copied. Locked actions stay in the list and say who has the token.

*Sources.* Railway token working (Tyer's electric tablet, 1878): the instruments in two signal boxes allow only one tablet out for a single line.

*What works.* It turns "one holder" into a permission rule that is easy to explain, and gives the server an invariant to enforce: one holder, moved atomically. The two lists of actions swapping is a clear "what changes when I hand over".

*What fails or risks.* Some things need two people to act at once (a fact under triage and its steward). The token is only for "who answers for it". Edit rights can still come from the floor rules (the Artifacts guide: the right to change files stays with whoever can edit them), so token and edit rights must not be confused.

*Principles.* Explain, never hide: locked actions stay and say why. Calm: yes.

*Needs.* A server invariant: exactly one holder per thing.

*Scores.* Clarity 4 · Distinctiveness 4 · Feasibility 4 · Fit 4

## V5: The handover sheet
*Idea.* Before you go, one sheet hands out everything you hold. Each row has the thing, to whom, S, B, R, and their readback. Tom's and Nkechi's readbacks arrive. Lena's is still open, and the approval stays with Amara because only she was asked to sign for those sections. A tally shows taken, offered and kept.

*Sources.* Ward shift handover sheets; I-PASS.

*What works.* It is the real use case: people go on leave. "Kept by you" with a reason is honest. "Anything not taken by the time you leave stays yours and shows on the lead's board as held by someone who is away" ties straight into the team board.

*What fails or risks.* Long rows at 1280 (the B column hides). The A box is missing from the sheet by design; it lives on each card.

*Principles.* Explain, never hide: yes. Calm: yes.

*Needs.* Bulk offer; presence (away until).

*Scores.* Clarity 4 · Distinctiveness 3 · Feasibility 4 · Fit 4

## V6: Point out or hand over
*Idea.* Two verbs, never blurred. **Point out**: they see it, you keep it, and a "seen" mark lands when they open it. **Hand over** (here, up a floor to the data steward): it becomes theirs after a readback, and needs an SBAR card. A floor stack shows the fact on the Team floor and Lena on the Org floor.

*Sources.* The air traffic "point-out" (making another sector aware of an aircraft without transferring control) versus the handoff.

*What works.* Most tools blur these: "assign", "@mention" and "share" all mean a bit of both. ATC keeps them apart, and so should AUGUR. The "seen" mark is a quiet receipt that needs nothing from the person.

*What fails or risks.* "Seen" marks can feel like read receipts. They should be on the thing, not pushed back to the pointer as a notification.

*Principles.* *Mine versus ours*: a seen mark is a shared fact on a shared thing. Calm: yes.

*Needs.* A `point_out` record with `seen_at`.

*Scores.* Clarity 5 · Distinctiveness 4 · Feasibility 5 · Fit 4

---

## Ranked
1. **V1 The SBAR card** with the readback.
2. **V6 Point out or hand over**: two verbs.
3. **V3 The changeover zone**: what "offered" allows, and no timer.
4. V4 One token (the server invariant).
5. V5 The handover sheet.
6. V2 Across the bays (drag only on the team board; H everywhere).

**What I'd build first.** The `offer` → `readback` pair with the SBAR card (V1), the rules of the zone from V3, and the two verbs from V6. That is three records (offer, readback, point_out) and one invariant (one holder). Combined V1 shows it end to end from both desks.
