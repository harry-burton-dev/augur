---
batch: 7
kind: steered
track: ops
concepts: [stop-dont-guess, the-way-back-is-recorded, consequence-preview, the-readback-moves-it]
---

# Prompt O1: The quick reference handbook. When an upgrade halts at 2am.

Read `design-lab/tracks/ops/brief.md` first; it holds the rules, the
check and the critique format. When you start, move this file to
`design-lab/runs/<date>-the-quick-reference-handbook/prompt.md`.

---

AUGUR upgrades itself through the Upgrade Centre, watches each upgrade
for ten minutes, and halts when something goes wrong. Most deployments
have one admin, who is also asleep. When the halt notice arrives, that
person needs to know in a minute whether to act now, what not to touch,
and how to get back to a working AUGUR. Pilots have faced this since the
1930s: a short, tested card for each failure in the Quick Reference
Handbook, memory items first. This run asks what AUGUR's **halted
upgrade procedure** looks like if it is written and tested like a QRH.
Work in `design-lab/runs/<date>-the-quick-reference-handbook/`.

## The case (the scenario every card is tested on)
Write `checks/scenario.md` from the real guides before any card:
- A single-server deployment (Docker Compose, Tailscale), one admin.
- An AUGUR minor upgrade starts in its window at 01:40. The schema
  migration for one platform service runs, then that service fails its
  healthcheck. The updater halts the install during the watch.
- The admin wakes at 02:05 to the notice on their phone, then opens a
  laptop. Shell loads, but one app shows as unavailable.
- Branches: the admin restarts the stack before reading anything; the
  admin tries to install the previous release over the migrated
  database; the backup from 01:00 failed silently; Tailscale is fine but
  the Upgrade Centre itself won't load.
Use only behaviour and commands the guides in `augur` describe. Where a
guide doesn't say what AUGUR does, the scenario says "not documented"
and the critique lists it.

## References and what to take from each
- **Boeing 737 Quick Reference Handbook** structure (memory items,
  condition statement, objective, then steps). Take: the card starts by
  confirming you're on the right card, then states its objective.
- **Asaf Degani and Earl Wiener, *Human Factors of Flight-Deck
  Checklists: The Normal Checklist* (NASA, 1990)**. Take: read-do versus
  do-confirm, and why checklists fail when they're long.
- **Atul Gawande, *The Checklist Manifesto* (2009)** and the WHO
  surgical safety checklist. Take: pause points and killer items only.
- **Fire service incident command (UK Incident Command System)**. Take:
  one person in command, a stated plan, a reassessment interval.
- **Google SRE book, "Emergency Response" and "Managing Incidents"**.
  Take: mitigate first, diagnose after; the runbook as a living record.
- **Nuclear plant symptom-based emergency procedures** (versus
  event-based). Take: act on what you see, not on the cause you guess.

## Surfaces (4 variants each)
1. **Grammar** (`grammar.md`): condition, objective, memory item,
   do-not, pause point, way back, hand-off; what each must never claim.
2. **The card**: the halted-upgrade procedure itself, in four forms.
3. **Before you need it**: what the admin checks or sets up in daylight
   so the 2am card is short (backup proof, the way back, contacts).
4. **The hand-off**: what the admin leaves for the morning (themselves,
   or Harry, or a coding agent): what happened, what was done, what's
   still unknown.

Round 2: combine into one card plus its daylight check, and run the full
scenario with all four branches on it.

## Questions the shortlist must answer
- Which steps can't be undone, and how does the card say so before you
  reach them?
- What should the Upgrade Centre or the halt notice show so the card can
  be shorter? (These are product asks; name them.)
- Where does the card live, and who keeps it true release after release?
