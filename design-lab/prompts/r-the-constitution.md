---
batch: 4
kind: steered
concepts: [the-object-explains-itself, changes-before-they-bite, consequence-preview, visible-repair]
---

# Prompt R: The constitution. Settings, policy and who decides.

Read `design-lab/brief.md` first; it holds the rules, kit, critique format
and run shape. When you start, move this file to
`design-lab/runs/<date>-the-constitution/prompt.md`.

---

Batch 4 is about the platform underneath the screens: the services every
app relies on. These prompts are not about styling. Each asks how a
platform behaviour (who may do what, who is told, what is found, what an
agent may do, how settings and usage work) should behave, and how a person
sees and steers that behaviour. Prototypes may be behaviour models,
simulators and service blueprints as much as screens.

AUGUR's settings live at many levels: the deployment (env and Admin),
the organisation (ADR 0042), floors, apps, feature flags (ADR 0021) and
each person. Today a setting is a toggle on a screen; nobody can see who
set it, why, what it overrides, or what changes if it flips. This run asks
how **settings and policy** should behave as a readable constitution:
layered, each rule with an author, a reason and a date, changes proposed
and taking effect visibly. Governments and clubs have run layered rules
for centuries. Work in `design-lab/runs/<date>-the-constitution/`.

## Direction
- **Every setting answers "who set this, why, since when, and what
  does it override?"** in place.
- **Layers are drawn:** deployment, org, floor, app, person; what each
  inherits and where a lower layer may differ.
- **Changes have a reach and an effective date:** proposed, previewed,
  effective, with who it affects (changes before they bite).
- **Differences are findable:** which floors differ from the org default
  and why.
- Many deployments; calm at rest (from the brief).

## References and what to take from each
- **Constitutions, statutes and bylaws** (federal, state, local; what a
  lower level may vary). Take: inheritance with stated limits.
- **Legislation.gov.uk's point-in-time and "changes to legislation"
  views.** Take: a rule as it stood on any date, with pending changes.
- **Club rulebooks and Robert's Rules of Order**: motions, seconds,
  minutes. Take: proposing a change as a light process.
- **Group Policy in Windows domains** and **CSS's cascade**. Take:
  precedence people can trace.
- **Feature flag practice** (OpenFeature, flagd; ADR 0021). Take:
  rollouts as policy with an end.

## Surfaces (6 variants each)
1. **Constitution sheet** (grammar): layer, rule, author, reason,
   effective, override, variance, motion.
2. **One setting, traced**: from the person's view up to the deployment.
3. **The org's rulebook** (Admin): every rule in plain words, by layer.
4. **Proposing a change**: a motion with reach, effective date and who
   must agree.
5. **Variance**: floors that differ from the default, and why.
6. **Point in time**: the rules as they stood on a date, and pending
   changes.

Round 2: combine into 3-4 screens. One must follow one org-wide change
(for example two-step sign-in for everyone) from proposal to effect, as
seen by the admin, a floor lead and an operator.

## Questions the shortlist must answer
- Where AUGUR's settings live today and what a single settings model
  would need (an ADR, probably).
- Which settings a person may see but not change, and how that reads.
- How this agrees with the label run (L) and keys and doors (N).
