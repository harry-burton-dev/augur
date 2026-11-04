# Shortlist: paper and the desk

Ranked by what I'd build first. The headline: **everything that needs someone has one named holder, it moves only when the taker reads it back, and every mark says what it covers.** Ownership and state are carried by ink and position. Light keeps urgency. Nothing another person holds is ever blurred.

| # | Build | Look at | Why it ranks here |
|---|---|---|---|
| 1 | **The strip and one holder**: one shape for a thing someone holds (floor band, kind and id, what and state, holder, time). Six states from outline and offset, never colour. A server rule allows exactly one holder per thing, never nobody | [The strip](grammar/v1-strip-anatomy.html), [One token](handover/v4-one-token.html), [What to record](grammar/v6-what-to-record.html) | Every other item uses it. It needs three proposed tokens and no new colour. Today AUGUR has no holder shared across apps. |
| 2 | **The readback moves it**: a handover is an offer with an SBAR card (S and B from records, A and R in the giver's words) that moves on the taker's readback. In the changeover zone both names show and the giver still answers; nothing is reassigned by a timer | [The handover, both sides](combined/v1-handover-both-sides.html), [SBAR card](handover/v1-sbar-card.html), [Changeover zone](handover/v3-changeover-zone.html) | It is the prompt's required screen, and the clinical evidence for it is strong: I-PASS cut errors by 23% without making handovers longer. |
| 3 | **Say what you sign for**: every initial and stamp carries its scope ("sections 3 and 5"), built from ticks, never typed. The row always names what nobody has signed for. A correction later finds exactly the stamps that covered the old value | [The bay and the stamp](combined/v2-the-bay-and-the-stamp.html), [What you sign for](approvals/v2-signing-for.html), [Nothing erased](combined/v4-nothing-erased.html) | Section 6, Costs, would have been published unchecked. The scope is also what makes a correction precise instead of a broadcast. |
| 4 | **Home as a strip bay**: three bays (you hold, coming to you, pointed out to you), strict time order, C to cock a strip with a private note, and the back of the strip as the place to act. AUGUR adds strips; it never rearranges them while you work | [Strip bay](home/v1-strip-bay.html), [The bay and the stamp](combined/v2-the-bay-and-the-stamp.html) | "What is mine?" is answered before anything else, and the cock is a reminder that costs one key. |
| 5 | **Marks are added, never changed**: one line through the old value, the new one beside it, initials, a time and a reason, where the value is read. Behind it is an account with "value after" per entry, and a correction slip (why and evidence, or it is just an edit) | [Nothing erased](combined/v4-nothing-erased.html), [Strike in place](ledger/v2-strike-in-place.html), [The account](ledger/v1-the-account.html), [Correction slip](ledger/v5-correction-slip.html) | This is *visible repair* made concrete, with one rule for facts and documents. |
| 6 | **The team wall**: a row per person with presence, a slot per job up to the team's own limit, the round's dated mark on every card, "held by nobody" waiting in plain sight. One warning only: held by someone who is away | [The team wall](combined/v3-the-team-wall.html), [T-card board](board/v1-t-card-board.html), [In and out](board/v5-in-and-out.html), [The round](board/v6-the-round.html) | It shows capacity as empty slots, and status as a person's mark rather than an automatic colour. It depends on presence, which needs a decision. |

**Worth keeping as options:**
- [Point out or hand over](handover/v6-point-or-hand.html): two verbs, never blurred. Fold it into #2.
- [The levelling box](board/v4-levelling-box.html): "below the rim" for a team that keeps daily capacity.
- [The stamp book](approvals/v5-stamp-book.html): a numbered stub for every mark you made.
- [The printed board](home/v6-printed-board.html): the expert layer, with a closed shorthand.
- [The routing slip](approvals/v3-routing-slip.html)'s dwell ruler, kept on the document only.
- [The handover sheet](handover/v5-shift-sheet.html): everything you hold, handed out before leave.

**Not worth pursuing:**
- [The desk top](home/v5-the-desk-top.html): free placement is skeuomorphism for its own sake, and fails keyboard and screen-reader users. Keep only its in-tray rule.
- [Pull columns](board/v2-pull-columns.html): a generic kanban that loses ownership.
- [Pigeonholes](home/v4-pigeonholes.html): a personal limit turns into a target.
- [The card drawer](ledger/v6-card-drawer.html) as a view. Branch numbering is a good data model for disputed facts, but not something operators should read.

## Answers to the prompt's questions

**Which paper gestures map to a mouse and keyboard without feeling like skeuomorphism for its own sake?** Five do, because each carries meaning that software usually loses:
- **Hand over with a readback** (H, then the taker's own words);
- **cock** (C, a still offset with a private note);
- **initial with a scope** (tick, then hold S);
- **strike in place** (Correct… opens a slip, and the mark shows where the value is read);
- **point out** (P, which leaves a "seen" mark).

Two work only partly:
- **slots** work as a team rule, but not as a personal limit;
- **the stamp** works as the final mark with authority, with stamps upright and rank in the order of the row.

These don't map:
- free placement on a desk;
- drag as the only way to hand over (H must do everything drag does);
- magnets;
- bowing or upside-down stamps;
- the paper look itself.

The test was: does the gesture record *who* and *what*, in a way a person can read later? If it only looks like paper, drop it.

**Where does this agree or clash with focal planes and the light language?** They agree on four things:
- urgency stays with light (the beacon and the Letterbox, unchanged);
- dark when normal (a cock is a still offset, and nothing moves at rest);
- the cinematic run's "words always alongside" (every mark is also a sentence);
- the near plane may lift *your own* open strip.

They clash on one: **focal planes must not blur other people's work.** Controllers read a neighbour's strips out of the corner of an eye, and that is how they see a handover coming (MacKay 1999). [Ink and light](grammar/v5-ink-and-light.html) racks focus and loses three of Tom's strips, including the one he has offered to you. The proposed rule: ink (initials, outline, position) carries holder and state; light carries urgency only; and depth is for one person's focus, never for a shared bay or board. A streak of light may draw a handover's move once, as a cue, but never carries its meaning.

**What would AUGUR need to record that it doesn't today?** Grammar V6 lists them. 9 are new and 3 extend what exists.
- **New:**
  - `held_since`;
  - `offer` (to whom, when, the end of the zone, the SBAR card);
  - `readback` (the taker's words and time; moves the holder);
  - `point_out` (to whom, when, `seen_at`);
  - `stub` (the person's own numbered copy of every mark);
  - `cock` (private, and kept out of the audit log);
  - `desk_layout` (only if V5 is ever built: don't);
  - `presence` (in, out, off, until when);
  - `slots` (the team's own limits).
- **Extend:**
  - `holder` (one person per thing across apps; today Artifacts names an owning floor, not a person);
  - `mark` (add what it covers);
  - `correction` (Data Atlas keeps observations per source; add a correction entry with a reason, evidence and a countersign).
- **Also needed:** per-section addressing in Artifacts (for scoped initials), and which facts a document quotes (for combined V4).

## Where this pushes back

- **On focal planes** (see above): no blur on shared work. This is the wildcard's main push-back.
- **On "a need is a notification":** a handover is not a notification. Nothing becomes yours until you read it back, and nothing is reassigned by a timer.
- **On approvals as yes/no:** there is no reject stamp. A return is a handover back to the sender with a note, and "noting" replaces the reluctant approver's upside-down stamp.
- **On automatic status colours:** the team board's on track and needs help are a person's dated mark (the round), and a card nobody checked says so.
- **On the brief's paper references themselves:** ringi stamps bow by rank. This run keeps stamps upright and puts rank in the order of the row.

## Decisions for Harry (none taken)
1. **One holder for everything that needs someone**, enforced by the server, across apps? I recommend yes. It is the base of the whole run.
2. **Should a handover move on the readback, not on send?** I recommend yes, with the giver able to set the zone's end and no timer reassigning anything.
3. **Do marks carry their scope** (what an initial or stamp covers) as a required field? I recommend yes for approvals and sign-offs, with "the whole" as one tick.
4. **The focal-plane rule:** no blur on anything another person holds. It changes the cinematic shortlist's #1 for shared views, so it needs a Proposed record if accepted (ADR 0001).
5. **Presence:** may a team see each other's in, out and off, and what each holds? If yes, the reason ("sick") should be lead-only. This is also *mine versus ours*.
6. **Are cocks private and kept out of the audit log?** I recommend yes: a cock is a person's memory, not a record.
7. **Team limits (slots):** should they be a team setting, shown with who set it and when, and never a personal target? I recommend yes.

## Needs token
- `--x-proposed-strip`, a strip's ground.
- `--x-proposed-strip-edge` (3px), the floor band.
- `--x-proposed-cock` (= `--space-5`), the offset.
- `--x-proposed-transit`, the dashed outline for offered.
- `--x-proposed-slot`, the dashed empty slot.
- `--x-proposed-strike`, the line through a corrected value.
- `--x-proposed-stamp-weight` (1.5px), the stamp border.
- `--x-proposed-past`: past its time. A warm ink that is not an alarm, mixed from `--danger` and `--ink`.

These are carried from earlier runs and still proposed: `--x-proposed-quiet`, `--x-proposed-type-micro`, `--x-proposed-lit`, `--x-proposed-pencil`, `--x-proposed-unseen` (hatch), and `--x-proposed-disagree`. `--font-mono` still needs its ADR, and the printed board and every id rely on it.

## Gaps
- A strip part in Quill, with six states.
- An SBAR card part, and a readback input.
- A stamp part with scope.
- A ledger row part with "value after".
- A team board layout (rows × slots).
- A working calendar per deployment (dwell ruler, weekend hatching).
- Section ids in the Artifacts reader.
- A quotes link from documents to fact values.
- A rule for folding old struck values (the page uses a placeholder setting).

## Data the shell doesn't have yet
- holder, offer, readback and point-out for every app's needs;
- presence;
- team slots;
- marks with scope;
- correction entries;
- per-person stubs;
- which marks are private.
