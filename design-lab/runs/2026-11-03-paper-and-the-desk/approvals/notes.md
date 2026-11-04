# Surface 3 · Approvals: publish a document to a Department

**The moment:** "Damp and mould response standard" v3, drafted by Rui Costa, will be published to the Property Services standards library: 86 readers on the Department floor. Its route has four boxes:
1. Dev Kapoor, compliance officer, initialled sections 2 and 3 on Fri 30 Oct after holding it 3 days.
2. Nkechi Bello, team lead, initialled section 2 on Mon 2 Nov.
3. Amara Osei is next, asked to sign for sections 3 and 5.
4. Helen Marsh, Head of Property Services, stamps it to publish.

Section 6, Costs, is new in v3, and **nobody on the route was asked to check it**. Every variant has to bring that up.

**Files:** built from `../_src/approvals/v*.src.html`. R replays, and each page lists its own keys.

---

## V1: The stamp row
*Idea.* Four boxes in a row, in order, as on a ringi-sho. Each holds an upright stamp with a name and a date. Under each box are how long its holder kept it and what they signed for. Hold S (or press and hold) to put your initial in the third box. A warning names section 6 and whom to ask.

*Sources.* Ringi-sho and hanko (a paper circulates and collects stamps in order); approval boxes on office forms.

*What works.* The order and who is next are clear at a glance, which is what a manager wants from an approval. "Signed for" under each stamp is the strongest addition, and the start of V2's idea. Hold-to-stamp makes it deliberate without a confirm dialog.

*What fails or risks.* Ringi stamps "bow": lower stamps tilt towards the one above to show rank, and a reluctant approver may stamp upside down. Both send status by angle, and neither is used here: the page says rank is in the order of the row, not the angle of anyone's mark. Four boxes fit; nine would not.

*Principles.* Explain, never hide: the uncovered section is named. Calm: yes. Letterbox: no.

*Needs.* `--x-proposed-stamp-weight`; a route with "covers" per step.

*Scores.* Clarity 5 · Distinctiveness 4 · Feasibility 4 · Fit 4

## V2: What you sign for
*Idea.* The stamp is built from what you checked. You tick sections, and the stamp writes its own scope: "I checked 3 inspection and 5 records against how Repairs North works, and I stand by them". Under it is a line naming what nobody on the row has checked. The others' scopes are listed beside it.

*Sources.* Laboratory and engineering "checked by / approved by" blocks; good documentation practice (a signature means a stated thing).

*What works.* This is the run's answer to "what am I signing for?". An approval in AUGUR stops meaning "agree with everything" and says exactly what it covers. That is what makes a later correction precise (combined V4): when a value changes, AUGUR knows whose stamp covered it. The "not checked by anyone" line turns a gap into a fact everyone can see.

*What fails or risks.* Ticking sections takes longer than one button. For a one-paragraph document, "the whole" must be a single tick. The scope sentence must be a template, never free text, so it reads the same in every deployment.

*Principles.* Explain, never hide: strongest of the six. Calm: yes.

*Needs.* A `mark.covers` field (section ids); sections addressable in Artifacts.

*Scores.* Clarity 5 · Distinctiveness 5 · Feasibility 3 · Fit 4

## V3: The routing slip
*Idea.* A slip clipped to the front: to whom, for what, in, out, held, and an initial box per line. Under it, a dwell ruler shows how long the document sat with each person, the weekend hatched, and Helen's time left before it is due.

*Sources.* Office routing slips; the civil service registry docket.

*What works.* The dwell ruler is the only view that shows where an approval slowed down. It is fair, because the weekend is hatched and not counted against anyone. "Helen has 25 h left, less whatever you keep it" makes your own delay visible to you, not to a manager.

*What fails or risks.* Dwell bars can become a league table of slow approvers. Keep them on the document, never aggregated per person. The ruler needs working-hours data per deployment.

*Principles.* Explain, never hide: yes. Calm: yes. It agrees with *history as a material* and *time as an address*.

*Needs.* `in` and `out` times per route step; a working calendar.

*Scores.* Clarity 4 · Distinctiveness 3 · Feasibility 4 · Fit 4

## V4: Initials in the margin
*Idea.* The document itself, with changes since v2 marked (struck old words, underlined new). A margin column carries initials level with each section, as on each page of a contract. Your initial boxes sit beside 3 and 5. Pass it on stays locked until both are initialled, and the lock says why.

*Sources.* Initialling each page of a contract; legal mark-ups.

*What works.* Reading and signing happen in one place: you initial where you read. The margin shows coverage at a glance (DK NB beside 2, nothing beside 6). "The document can't leave you half-signed" is a clear rule.

*What fails or risks.* A long document needs the margin to stay level while scrolling (it is positioned from the text). Initialling a section you weren't asked about is allowed, which needs a rule about what it means.

*Principles.* Explain, never hide: the locked button says why. Calm: yes.

*Needs.* Section-level marks in the Artifacts reader.

*Scores.* Clarity 4 · Distinctiveness 4 · Feasibility 3 · Fit 4

## V5: The stamp book
*Idea.* Every mark is written twice: on the object, and as a numbered stub in your own stamp book. Stub 42 writes itself when your initial lands. The numbers run on without gaps, so a missing stub would show.

*Sources.* Cheque-book stubs and receipt books; double entry.

*What works.* "What have I put my name to?" gets one place to look. Gap-free numbering is a cheap integrity check people understand. It also gives the handover screen its "both books get a line".

*What fails or risks.* Gap-free numbers per person need care in a distributed system. The book is private as a whole, while each mark stays public on its object; that split must be stated.

*Principles.* *Mine versus ours*: the book is mine, the marks are ours. Calm: yes.

*Needs.* A `stub` record per mark.

*Scores.* Clarity 4 · Distinctiveness 4 · Feasibility 3 · Fit 4

## V6: Three stamps
*Idea.* Three stamps on the rack: **Initialled**, **Initialled, noting** and **Returned**. Picking one previews where the strip goes and what is recorded. A return goes back to the person who passed it to you, with your note, and keeps everyone's initials. There is no reject stamp, and no stamp upside down.

*Sources.* Rubber-stamp racks; "returned for amendment" in registry practice; the cinematic run's consequence preview.

*What works.* "Noting" gives the reluctant approver a voice in words instead of an upside-down stamp. "Return is a handover back, never a dead end" removes the reject state. The preview ("When it comes back, the row starts again from Nkechi, not from Dev") answers the question people ask after a return.

*What fails or risks.* Three choices where most people want one. The default must be the plain initial, with 2 and 3 a key away.

*Principles.* Consequence preview: yes. Explain, never hide: yes. Calm: yes.

*Needs.* Route rules for a return (where it restarts).

*Scores.* Clarity 4 · Distinctiveness 4 · Feasibility 4 · Fit 4

---

## Ranked
1. **V2 What you sign for**: the scope of a mark, and the uncovered line.
2. **V1 The stamp row**: order and who is next, upright.
3. **V6 Three stamps**: noting and return-as-handover.
4. V5 The stamp book.
5. V4 Initials in the margin.
6. V3 The routing slip (keep the dwell ruler on the document only).

**What I'd build first.** The V1 row with V2's scope: every stamp and initial carries "signed for: sections 3 and 5", built from ticks, and the row always names what nobody has signed for. Add V6's "noting" and "return to sender" as the two other stamps. Record each mark with `covers`, so a later correction can find the stamps it touches.
