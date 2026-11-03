---
batch: 5
kind: steered
concepts: [question-and-answer, one-now, time-as-address, the-workings-show]
---

# Prompt T: The minute. Decisions and actions as outputs.

Read `design-lab/brief.md` first; it holds the rules, kit, critique format
and run shape. When you start, move this file to
`design-lab/runs/<date>-the-minute/prompt.md`.

---

Batch 5 is about **work outputs**: what operators make with AUGUR and
hand to someone else (a published document, a decision, a case bundle, a
request fulfilled, a filled-in form). AUGUR's pillar apps hold the pieces
(Artifacts, Mandate, Data Atlas); these prompts ask how a finished piece of
work is made, checked, delivered, and trusted later, across apps.

Much of an organisation's real output is decisions: agreed in a meeting,
a thread or an approval, then lost in chat. Mandate holds intents
(discussion starts in an intent, ADR 0028) and the Inbox holds what waits
for someone. This run asks how a **decision** and the **actions** that
follow become first-class outputs: recorded once, with who decided, why,
what it rests on, who does what by when, and what later overturned it.
Parliaments, boards and courts keep records like this. Work in
`design-lab/runs/<date>-the-minute/`.

## Direction
- **A decision is a record,** not a sentence in a chat: what, who, when,
  why, on what evidence, and its status (in force, revisited, reversed).
- **Actions come out of decisions,** each with one owner and a date,
  traceable back.
- **Minutes are written as you go,** not afterwards, and agreed by those
  present.
- **Reversal is visible:** a decision overturned keeps its record and
  points to its successor.
- Explain, never hide; many deployments; calm at rest (from the brief).

## References and what to take from each
- **Board minutes and resolutions** (company secretary practice). Take:
  the resolution as a fixed form of words.
- **Hansard and the parliamentary record.** Take: a verbatim record with
  an agreed summary.
- **Court judgments and precedent** (ratio and obiter). Take: what was
  decided versus what was said.
- **Decision records in software** (ADRs; AUGUR's own). Take: context,
  decision, consequences, status, for operators.
- **Action logs and RAID logs** in project management. Take: one owner,
  one date, one status.

## Surfaces (6 variants each)
1. **Minute sheet** (grammar): motion, resolution, action, owner,
   evidence, in force, reversed.
2. **Minuting live**: recording decisions and actions during a meeting.
3. **A decision record**: one decision with its evidence and status.
4. **Actions out of decisions**: the owner's view and the chair's view.
5. **Revisiting**: a decision reopened, reversed, and what that changes.
6. **The decision log**: a floor's decisions over a year, searchable.

Round 2: combine into 3-4 screens. One must follow a decision from a
meeting, through three actions, to its reversal six months later.

## Questions the shortlist must answer
- Where decisions live: Mandate, Artifacts, or their own record type?
- How decisions link to the intents and facts they rest on.
- How this agrees with the score (F) and the switchboard (O).
