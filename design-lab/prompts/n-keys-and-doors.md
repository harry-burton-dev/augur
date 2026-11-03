---
batch: 4
kind: steered
concepts: [mine-versus-ours, the-object-explains-itself, consequence-preview, data-wears-its-label]
---

# Prompt N: Keys and doors. Identity and access people can reason about.

Read `design-lab/brief.md` first; it holds the rules, kit, critique format
and run shape. When you start, move this file to
`design-lab/runs/<date>-keys-and-doors/prompt.md`.

---

Batch 4 is about the platform underneath the screens: the services every
app relies on. These prompts are not about styling. Each asks how a
platform behaviour (who may do what, who is told, what is found, what an
agent may do, how settings and usage work) should behave, and how a person
sees and steers that behaviour. Prototypes may be behaviour models,
simulators and service blueprints as much as screens.

Access in AUGUR is Keycloak (realm, roles, two-step sign-in, ADRs 0006,
0038), floors (ADR 0007: what is kept on a floor and those above),
per-app identity (ADR 0008), and the account lifecycle (ADR 0040: join,
move, leave). Most people only meet it as "you don't have access". This run
asks how **who may do what** can be as legible as a building's key system:
a person can see what their key opens, why, who issued it and until when,
and an admin can see the consequence of a change before making it. Work in
`design-lab/runs/<date>-keys-and-doors/`.

## Direction
- **Your key ring:** every person can see what they can open, and why
  (role, floor, team, a grant from someone), in plain words.
- **Doors explain themselves:** a closed door says who holds keys and how
  to ask (explain, never hide), and hides only what you may not know
  exists.
- **Every grant has an owner and an end.** Temporary access ends on its
  own, and delegation while away is a first-class thing.
- **Change shows its reach first:** an admin sees who gains and loses
  what before saving (consequence preview).
- Many deployments; calm at rest (from the brief).

## References and what to take from each
- **Master key systems and keying charts** (locksmiths' hierarchy of
  grand master, master and change keys). Take: a hierarchy you can draw
  on one page.
- **Hotel key cards and visitor badges**: access that expires, escorts,
  "visitor" visible to everyone. Take: temporary and guest access that
  shows itself.
- **Power of attorney and delegation of authority** (signing limits in
  finance). Take: lending your authority, with limits and an end date.
- **Access recertification** (periodic access reviews in banking,
  SOX). Take: a light, regular "do they still need this?" round.
- **Break-glass procedures** in hospitals (emergency access to records,
  always reviewed after). Take: an exception that is allowed, loud and
  audited.

## Surfaces (6 variants each)
1. **Key sheet** (grammar): key, door, ring, grant, lend, expire, break
   glass, review; plain words and the Keycloak or floor term beneath.
2. **My key ring**: what I can open across floors and apps, and why.
3. **A closed door**: what someone sees at something they can't open,
   and the ask that follows.
4. **Lending while away**: delegate approvals and access for a holiday,
   with limits and an end.
5. **The keying chart** (Admin): roles, floors and teams as one drawable
   hierarchy, with a change previewed before saving.
6. **Access review and break glass**: the quarterly round, and an
   emergency grant reviewed afterwards.

Round 2: combine into 3-4 screens. One must follow a person joining, moving
team and leaving (ADR 0040), showing what their key ring was at each step.

## Questions the shortlist must answer
- What Keycloak and the identity service already know that could feed
  "why can I open this?", and what they don't.
- Which access facts a person may see about others (mine versus ours).
- Which of these need an ADR (delegation, break glass).
