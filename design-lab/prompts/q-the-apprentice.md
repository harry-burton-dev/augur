---
batch: 4
kind: steered
concepts: [consequence-preview, the-workings-show, visible-repair, question-and-answer]
---

# Prompt Q: The apprentice. Agents that work alongside people.

Read `design-lab/brief.md` first; it holds the rules, kit, critique format
and run shape. When you start, move this file to
`design-lab/runs/<date>-the-apprentice/prompt.md`.

---

Batch 4 is about the platform underneath the screens: the services every
app relies on. These prompts are not about styling. Each asks how a
platform behaviour (who may do what, who is told, what is found, what an
agent may do, how settings and usage work) should behave, and how a person
sees and steers that behaviour. Prototypes may be behaviour models,
simulators and service blueprints as much as screens.

AUGUR has a model gateway (every call audited before it is made, daily
limits per app, off until an admin turns it on) and a proposed agent
runtime (ADR 0014, Proposed). Agents will draft, extract facts, file
things and propose changes. This run asks how an **agent should behave as
a colleague**: what it may do on its own, what it must ask about, how its
work is checked, how trust in it grows or shrinks, and how a person sees
what it did while they were away. Crafts have trained apprentices this way
for centuries. Work in `design-lab/runs/<date>-the-apprentice/`.

## Direction
- **An agent works under someone:** every agent has a supervisor, a
  scope and limits, visible to everyone affected.
- **Ask before the irreversible:** anything that can't be undone, or
  reaches other people, waits for a person (standby and go).
- **Its work is marked as its work** until a person accepts it, and
  shows its workings.
- **Trust is earned and recorded:** scope widens as work is accepted
  and narrows after mistakes, by a person's decision, never silently.
- Many deployments; calm at rest (from the brief).

## References and what to take from each
- **Apprenticeship and guild practice** (apprentice, journeyman, master;
  the masterpiece). Take: graded scope with a visible level.
- **Clinical supervision and delegation** in nursing and medicine
  (who may delegate what to whom, and stays accountable). Take: the
  supervisor stays responsible.
- **Autonomy levels** (SAE driving levels; Sheridan and Verplank's
  levels of automation). Take: a small, named ladder of autonomy.
- **The clerk of works and the site diary.** Take: a daily record of what
  was done, checked by someone else.
- **Aviation automation surprises** (mode confusion research). Take:
  always show what the automation is doing now and will do next.

## Surfaces (6 variants each)
1. **Apprentice sheet** (grammar): supervisor, scope, level, proposal,
   accept, undo, standby and go; mapped to ADR 0014 terms.
2. **What the agent did while I was away**: the site diary.
3. **A proposal waiting**: agent work marked as such, with workings and
   accept, change or reject.
4. **Scope and level**: what an agent may do, and widening it.
5. **Standby and go**: the moment an agent asks before something
   irreversible.
6. **A mistake**: an agent's error found, undone, repaired visibly, and
   its scope reviewed.

Round 2: combine into 3-4 screens. One must follow an agent extracting facts
from documents into Data Atlas Triage over a week, with its level changing.

## Questions the shortlist must answer
- Which actions an agent must never take alone in AUGUR.
- What ADR 0014 needs to add (supervisor, levels, site diary).
- How agent proposals differ from people's in Triage and the Inbox.
