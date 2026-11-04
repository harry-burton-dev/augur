# Surface 1 · Desk language (grammar)

**The job:** name the desk's vocabulary (strip, bay, cock, hand over, stamp, initial, strike, slot, board), give each a token recipe, and say what each must never mean. This is a wildcard, so the sheets also set out where the desk agrees and where it clashes with the light language and the focal planes.

**Shared data, one object (`DATA`) per page:** a housing association with three floors (Org, a Property Services Department of 86 people, and a Repairs North Team of 8). Amara Osei, a repairs coordinator, is "you". There are 8 things that need someone, 17 team jobs, one disputed fact with 6 ledger entries, one approval route of four people, and one handover with an SBAR card. Every page reads that one object, so every count and name comes from data.

**Files:** `v1-strip-anatomy.html` to `v6-what-to-record.html` are built by `../_src/build.py` from `../_src/common.css`, `../_src/data.js`, `../_src/lib.js` and `../_src/grammar/v*.src.html`. The built pages link the kit as the brief says.

**Research that shaped the run** (all sources are named in the captions and the README):
- MacKay, *Is paper safer? The role of paper flight strips in air traffic control* (ACM TOCHI, 1999). Four months with Paris en-route controllers. Controllers keep strips because the physical handling carries meaning: cocking (pulling a strip out of line as a reminder or a signal), annotating, passing strips, and reading a neighbour's bay from the corner of an eye. Her conclusion was "we do not know enough to simply get rid of paper strips", and she proposed augmenting the strips rather than replacing them.
- NATS electronic flight progress strips (EFPS) and the electronic strip systems that followed. Electronic strip bays kept the shape of a strip, the bays and drag-to-hand-over. The thing digital systems struggle with most is the offset, or cocked, strip.
- Wears and Perry, studies of emergency department status boards (2007). The boards are "densely encoded in idiosyncratic but locally meaningful ways", grew up over years for coordination inside a group, and became useful between groups. Computerising them had unplanned effects on how people coordinate.
- SBAR and I-PASS. I-PASS (Starmer et al., NEJM 2014) cut medical errors by 23% and preventable adverse events by 30% across nine programmes, without making handovers longer. Its last step is "synthesis by receiver", the readback.
- Good documentation practice (ALCOA+): a correction is one line through the old entry so it stays legible, then initials, a date and a reason. Never correction fluid, never obliterated, never pencil.
- Ringi-sho and hanko: an approval paper circulates and collects stamps in boxes, in order. Lower stamps are tilted to "bow" to the one above. A reluctant approver may stamp upside down. Both are status sent by angle, which this run rejects (approvals V1, V6).
- Railway token working (Tyer's electric tablet, 1878): the instruments make sure only one token can be out for a single line. Handover V4 takes the rule.
- Sellen and Harper, *The Myth of the Paperless Office* (2002), and Malone, *How do people organize their desks?* (1983). Piles and positions are a memory, and paper survives because of spatial layout, annotation and handover.

---

## V1: The strip
*Idea.* There is one shape for "a thing someone holds", made of five fields in a fixed order: floor band, kind and id, what it is and its state, who holds it, and its time. Six states are drawn from the same strip: held, cocked, offered, coming to you, pointed out and selected. Each has its token recipe and one line saying what it must never mean.

*Sources.* Flight progress strips (fixed fields in fixed places, read across a bay); MacKay 1999.

*What works.* Fixed fields make a bay scannable down a column: the holder's initials always sit in the same place, so "is any of this not mine?" takes one look. The "never means" lines are the most useful part of the sheet. "Cocked never means priority" and "offered never means moved" are the two rules every later page leans on. All six states come from outline, offset and opacity, so no new colour is needed.

*What fails or risks.* Five fields at 1280 leave the title about 30 characters before it truncates. Kind words had to shorten to one word ("Fact", "Share"). Using the floor colour as the left band competes with the floor colour in the holder's initials ring, and two colours on one row is one too many. Selected uses the lit green edge, which comes close to the light language's "lit next step".

*Principles.* Explain, never hide: strong, because every state is drawn and none is hidden. Calm: the cock is a still offset with no motion at rest. Focus stacking: not used.

*Needs.* `--x-proposed-strip`, `--x-proposed-strip-edge`, `--x-proposed-cock`, `--x-proposed-transit` (needs token).

*Scores.* Clarity 5 · Distinctiveness 4 · Feasibility 5 · Fit 4

## V2: Nine verbs
*Idea.* A grid of the nine words. Each entry has the paper gesture, how it works here (mouse and key), its token, and "never".

*Sources.* The prompt's list; strip and stamp practice; T-card boards.

*What works.* It is the reference card a kit page would need. Stating "never" for every verb stops the commonest drift: a board turning into a performance dashboard, a stamp read as agreement with the whole, a cock read as a flag for others.

*What fails or risks.* Small specimens can't show motion or the private/shared split. The stamp specimen had to shrink to fit. It is a reference, so it does less work than V1.

*Principles.* Calm: yes. Explain, never hide: describes it, but doesn't show it.

*Needs.* Nothing beyond V1.

*Scores.* Clarity 4 · Distinctiveness 3 · Feasibility 5 · Fit 4

## V3: A strip's day
*Idea.* Marks are additive. One strip (Tom's gas certificates, handed to Amara) is followed through a day. Each gesture adds a mark to the back of the strip: offered, read back, cocked, pointed out, a note, an initial, uncocked. None replaces another, and the back reads like a story, oldest first. Two marks (the cock and its note) are private and shown as such.

*Sources.* Controllers' strip annotations (shorthand added through a flight's life); the ward day book.

*What works.* The private mark matters most. A cock is useful because it is yours alone, and the sheet makes that a rule: it lives on your copy, never in the shared record or the audit. Separating "back of the strip as anyone reads it" from "your copy" is the line between memory and surveillance.

*What fails or risks.* A strip held for weeks would have a long back, which needs folding by day. "Uncocked" leaving no shared trace may surprise an auditor; the rule needs Harry's sign-off.

*Principles.* Explain, never hide: strong. Calm: marks arrive once. The private-mark rule agrees with *mine versus ours*.

*Needs.* A `mark` record with kind, who, when and covers; a private flag.

*Scores.* Clarity 4 · Distinctiveness 4 · Feasibility 4 · Fit 4

## V4: The desk, in plan
*Idea.* Position is meaning. A plan of a desk has nine places (in-tray, bay, cock lane, out-tray, clip, stamp rack, stamp book, ledger, wall). Each place is one state and one place in AUGUR. A strip walks the path in-tray → bay → cock lane → bay → out-tray, and every move is a mark.

*Sources.* Sellen and Harper (spatial layout as memory); Malone 1983 (piles and files); office in- and out-trays.

*What works.* It shows that the desk's states are a small, closed set, and that a thing is in exactly one place for each person who sees it. The key's third column maps every place to a real AUGUR surface, so nothing on the desk is decoration. Places 3 and 7 being private while 9 is the only shared one is a clear rule.

*What fails or risks.* A plan drawing can be read as "build a skeuomorphic desk", which is not the proposal; the plan is a model. The walker strip is small at 1280.

*Principles.* Calm: the walk plays once. Explain, never hide: a map of where things can be.

*Needs.* None for the sheet. The places need the holder and offer records (V6).

*Scores.* Clarity 4 · Distinctiveness 4 · Feasibility 4 · Fit 3

## V5: Ink and light (argues against focal planes)
*Idea.* The wildcard's argument, drawn. Ink (initials, outlines, position) says who holds a thing and its state. Light (beacon, Letterbox) says how urgent it is. Depth may lift the one strip you are working on, but must never blur other people's work. Two panes show it. On the left, rack focus blurs Tom's bay, including the strip he has offered to you. On the right, both bays are on one plane and the offer is readable. A table gives the verdict for seven kinds of meaning.

*Sources.* MacKay 1999 (peripheral awareness of neighbours' strips is how controllers anticipate); Wears and Perry 2007 (boards for coordination between groups); the cinematic run's focal planes and light language.

*What works.* It makes the clash concrete. In the racked pane the line reads "3 strips beside you can no longer be read, including M-212, which Tom has offered to you". The table splits cleanly: holder, state, urgency and rest all agree with the cinematic language. Only "other people's work" clashes, and "a handover" takes light only as a one-off cue.

*What fails or risks.* The comparison is staged: focal planes were never proposed for a shared board. The point holds for Home if a team's items appear there. Fair use of focal planes (one person's reading focus) survives.

*Principles.* Focus stacking: argues that it is right for one person's focus and wrong for shared work. Light language: kept for urgency only. Calm: yes.

*Needs.* The cinematic run's far-plane values, used here only for the demo (`--x-proposed-far-blur`, `--x-proposed-far-sat`).

*Scores.* Clarity 5 · Distinctiveness 4 · Feasibility 5 · Fit 4

## V6: What the desk needs recorded
*Idea.* Five rules (one holder; offered is not moved; marks are added; say what a mark covers; away is visible) are each checked live against the sample. Beside them is a table of the records AUGUR would need, marked new or extend.

*Sources.* The other five sheets; the Artifacts guide (Artifacts keeps an owning floor and a publish chain), the Data Atlas guide (Data Atlas keeps observations per source and shows disagreement).

*What works.* It answers the prompt's third question in one place: 9 new records (held_since, offer, readback, point_out, stub, cock, desk_layout, presence, slots) and 3 to extend (holder, mark, correction). The two open checks (1 uncovered section, 2 jobs held while away) are things AUGUR would show and today can't.

*What fails or risks.* "Today" is from the docs, not the code; a few items may already exist in a service. Presence is sensitive: in, out and off are personal data.

*Principles.* Explain, never hide: the rules are visible. Many deployments: every count comes from data.

*Needs.* The record list itself is the need.

*Scores.* Clarity 4 · Distinctiveness 3 · Feasibility 4 · Fit 4

---

## Ranked
1. **V1 The strip**: the kit part everything else uses.
2. **V5 Ink and light**: the run's main push-back, and the rule that keeps the desk and the cinematic language apart.
3. **V3 A strip's day**: additive marks and the private cock.
4. **V6 What to record**: the data answer.
5. V4 The desk plan.
6. V2 Nine verbs (reference only).

**What I'd build first.** The strip as a Quill part with its six states (V1), and the one rule from V5: ink for holder and state, light only for urgency, and no blur on anything another person holds. That costs three proposed tokens and no new colours. It also gives Home, approvals and the team board one shape to share.
