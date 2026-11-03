---
batch: 2
kind: steered
concepts: [dark-when-normal, the-record-has-edges, changes-before-they-bite, attention-as-wear]
---

# Prompt E: Control room. Calm at scale, honest under load.

Read `design-lab/brief.md` first; it holds the rules, kit, critique format
and run shape. When you start, move this file to
`design-lab/runs/<date>-control-room/prompt.md`.

---

The cinematic run borrowed from the cockpit, where one or two people fly
one aircraft. This run borrows from **process control rooms** (refineries,
power grids, water plants), where a few operators watch thousands of
signals for twelve-hour shifts, and where bad screens and alarm floods have
caused real accidents. The industry rebuilt its screens around that
lesson: grey-scale displays, colour only for abnormal states, alarms that
are rationalised, prioritised and shelved, and overviews built for
situation awareness. Find out what AUGUR looks like when it is designed to
stay calm and readable on its worst day, not its best. Work in
`design-lab/runs/<date>-control-room/`.

## Direction
- **Colour is for abnormal.** Normal is grey; colour means something is
  off. Test how far AUGUR's water language can go before it competes with
  that rule.
- **Every alarm has an owner, a priority, a consequence and an action.**
  An alert without all four isn't one (alarm rationalisation).
- **Floods are designed for.** What does AUGUR show when 200 things go
  wrong at once (a failed upgrade, a source outage)?
- **Shelving is honest.** Muting something stays visible: who muted it,
  until when, why.
- Explain, never hide; many deployments; calm at rest (from the brief).

## References and what to take from each
- **ISA-101 (HMI design) and "high-performance HMI"** practice: grey-scale
  backgrounds, analogue indicators with normal ranges, a hierarchy of
  displays (level 1 overview to level 4 diagnostics). Take: the display
  hierarchy and the normal-range bar.
- **EEMUA 191 and ISA-18.2 (alarm management)**: alarm rationalisation,
  priority distribution targets, alarm rate limits per operator per hour,
  shelving and suppression, flood handling. Take: a rate budget for
  notifications and visible shelving.
- **Mica Endsley's situation awareness levels** (perception, comprehension,
  projection). Take: each view says what is happening, what it means, and
  what happens next.
- **Grid and ATC wall displays**: one shared overview for the room, detail
  on each desk. Take: Explorer as the room's wall, apps as desks.
- **Incident reports on alarm floods** (for example the Texas City and
  Milford Haven investigations) for what failed. Take: the failure cases
  as test scripts.

## Surfaces (6 variants each)
1. **Display hierarchy sheet** (grammar): levels 1-4 mapped to AUGUR
   (Explorer overview, floor Home, app, object), grey-scale rules, the
   normal-range bar, priority marks, the shelf.
2. **Notifications under load**: the same inbox at 3, 30 and 300 items;
   grouping, rate budget, flood mode.
3. **Shelving and muting**: shelve a noisy source; who, until when, why,
   and how it comes back.
4. **Admin status as a level 1 overview**: services, apps and floors with
   normal ranges, grey when fine.
5. **Upgrade rollout in trouble**: a failed rollout across rings, with
   projection ("if nothing changes, in 2 hours...").
6. **Explorer as the room's wall**: an org-wide overview readable across a
   room and on a laptop.

Round 2: combine into 3-4 screens. One must replay a scripted bad day (a
source outage that causes a flood of facts going stale and notices
firing) from calm to recovery.

## Questions the shortlist must answer
- What notification rate budget per person per hour should AUGUR set?
- Where does grey-scale clash with the water language, and which wins?
- What data each alarm needs (owner, priority, consequence, action) that
  apps don't send yet.
