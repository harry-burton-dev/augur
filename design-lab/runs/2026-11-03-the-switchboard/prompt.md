---
batch: 4
kind: steered
concepts: [shell-owns-loudness, answer-not-announce, earned-sound, question-and-answer]
---

# Prompt O: The switchboard. Who is told, how, and when.

Read `design-lab/brief.md` first; it holds the rules, kit, critique format
and run shape. When you start, move this file to
`design-lab/runs/<date>-the-switchboard/prompt.md`.

---

Batch 4 is about the platform underneath the screens: the services every
app relies on. These prompts are not about styling. Each asks how a
platform behaviour (who may do what, who is told, what is found, what an
agent may do, how settings and usage work) should behave, and how a person
sees and steers that behaviour. Prototypes may be behaviour models,
simulators and service blueprints as much as screens.

AUGUR already separates three things: **domain events** tell services,
**notifications** tell a person (ADR 0044: levels needs, failed, done,
info; the shell decides loudness), and the **Inbox** holds what waits for
someone to act (ADR 0026). Email goes through the organisation's relay
(ADR 0035). This run asks how routing should behave across a working
week: who gets told, on which channel, in what order, what happens when
nobody answers, and how a person shapes it, the way an exchange operator,
a postal service and a hospital's on-call system do. Work in
`design-lab/runs/<date>-the-switchboard/`.

## Direction
- **Routing is visible:** a person can see why they were told, and an
  app owner can see where their notice went and what stopped it.
- **Escalation is designed, not accidental:** when nobody acts, the
  next person is asked on a schedule everyone can see.
- **Quiet is a feature:** away, quiet hours and digests are normal, and
  urgent still gets through by a known route.
- **Delivery has a receipt** for anything that matters (told, seen,
  acted).
- Many deployments; calm at rest (from the brief).

## References and what to take from each
- **Telephone switchboards and exchange operators**: routing, busy
  lamps, transfer, "hold the line". Take: routing a person can watch.
- **The postal service**: classes of post, recorded delivery,
  redirection, "while you were out" cards. Take: classes and receipts.
- **Hospital on-call and bleep systems**, and **PagerDuty-style
  escalation policies**. Take: rotas, escalation levels and handover.
- **Air traffic "handoff"**: responsibility passed explicitly between
  sectors. Take: no gap between one owner and the next.
- **Newspaper editions and digests.** Take: batching news into a
  predictable rhythm.

## Surfaces (6 variants each)
1. **Routing sheet** (grammar): event, notice, inbox item, channel,
   class, receipt, escalation, quiet; how each maps to ADRs 0026 and 0044.
2. **Why was I told?**: a notice that explains its route.
3. **My switchboard**: a person's channels, quiet hours, away, digests,
   and what still gets through.
4. **Escalation**: an unanswered "needs" moving along a rota, with
   handover.
5. **The app owner's view**: where an app's notices went this week, and
   what was blocked (permissions, mute, away).
6. **Digests**: the daily and weekly roll-up as an edition.

Round 2: combine into 3-4 screens. One must replay one week of a team's
notices through the routing rules, showing every route taken.

## Questions the shortlist must answer
- What the events service and notifications contract would need
  (rotas, receipts, escalation policy) and which need an ADR.
- Where routing settings live: person, team lead, floor admin, app.
- How this agrees or clashes with room tone's budgets and the control
  room run (E).
