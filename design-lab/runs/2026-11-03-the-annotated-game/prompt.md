---
batch: 6
kind: wildcard
concepts: []
---

# Wildcard W6: The annotated game. Judgement marked by people, after the fact.

Read `design-lab/brief.md` first; it holds the rules, kit, critique format
and run shape. When you start, move this file to
`design-lab/runs/<date>-the-annotated-game/prompt.md`.

---

Batch 6 is about thinking made visible. This wildcard comes from a field
no earlier prompt has drawn on: **chess annotation**. For two centuries
players have reviewed games with a tiny shared notation (`!` good move,
`?` mistake, `!?` interesting, `?!` dubious, `±` better for White) and a
few lines of commentary at the critical moments. Masters learn by
replaying annotated games, not by reading rules. Engines now add a
computed evaluation bar beside the human marks, and the two often
disagree in useful ways.

This run asks how people could **review a finished piece of work or a
decision the same way**: replay it move by move, mark the critical
moments with a small shared notation, and keep the annotations as
something the next person learns from. It may argue against
`confidence-is-worked-out` (which forbids typed confidence words): an
annotator's `?!` is a human judgement, and chess suggests that is worth
keeping beside any computed score. Work in
`design-lab/runs/<date>-the-annotated-game/`.

## Direction
- **Replay, then judge.** Review moves through the record in order, the
  way a game is replayed; judgement is added at moments, not as one
  grade at the end.
- **A small notation** everyone learns in a minute, applied to decisions
  and steps in an output.
- **Critical moments are found, then marked**: where the outcome turned.
- **Two voices**: a computed view (what the records say) beside a human
  annotation (what a reviewer judged), with their disagreement shown.
- **Annotated work is teaching material**, findable later by kind of
  situation, like an opening book.
- Explain, never hide; many deployments; calm at rest (from the brief).

## References and what to take from each
- **Chess annotation symbols** (the Informator system and its
  language-free symbols). Take: a notation small enough to learn at
  once and dense enough to carry judgement.
- **Annotated game collections** (Nimzowitsch, Kasparov's *My Great
  Predecessors*). Take: commentary only at the moments that matter.
- **Adriaan de Groot, *Thought and Choice in Chess* (1946/1965)**. Take:
  experts see patterns and critical positions, which review can teach.
- **Engine analysis and evaluation bars** (open-source analysis boards,
  "learn from your mistakes" modes). Take: a computed curve over the
  game with the turning points marked, beside the human view.
- **Opening theory and ECO codes**. Take: situations named and
  catalogued so the next person can find "games like this one".
- **After-action reviews** (what was supposed to happen, what happened,
  why, what to keep). Take: the review as a routine, not a blame
  exercise.

## Surfaces (6 variants each)
1. **Notation sheet** (grammar): the marks, what each means for work,
   the computed view, critical moment, line of commentary.
2. **Replaying a decision**: stepping through a Mandate decision's
   history move by move.
3. **Marking**: a reviewer annotates the critical moments of a finished
   output.
4. **Two voices**: the computed view and the human marks side by side,
   disagreeing.
5. **The collection**: annotated work found by kind of situation.
6. **Learning from it**: a new starter facing a similar situation is
   shown the annotated precedent.

Round 2: combine into 3-4 screens. One must take a contract decision
that went badly from replay to annotation to the moment a new colleague,
facing the same kind of renewal a year later, meets the annotated game.

## Questions the shortlist must answer
- Does a human mark of judgement belong beside worked-out confidence, or
  does it undermine it? Argue it.
- Where reviews live, who may annotate whose work, and what stays
  private (see mine versus ours).
- What AUGUR would need to record during work to make replay possible.

## Carry from earlier runs
Read `concepts/README.md`, `confidence-is-worked-out.md`,
`history-as-material.md` and `visible-repair.md`.
