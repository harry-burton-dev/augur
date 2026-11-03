---
batch: 4
kind: wildcard
concepts: []
---

# Wildcard W4: The meter. Usage, limits and cost you can see.

Read `design-lab/brief.md` first; it holds the rules, kit, critique format
and run shape. When you start, move this file to
`design-lab/runs/<date>-the-meter/prompt.md`.

---

Batch 4 is about the platform underneath the screens. This wildcard looks
at something platforms usually hide until it bites: **consumption**.
AUGUR has real limits (model calls a day per app, storage per bucket,
jobs in Runs, seats), and an organisation's private cloud has real costs.
Utilities learned to make invisible consumption visible: the gas meter,
the smart meter's in-home display, the household bill that compares you
with your neighbours. This run asks what AUGUR gains if usage and limits
read like a well-designed meter, for a person, a team and the deployment.
It may argue against any existing concept, including calm at rest, if the
research supports it. Work in `design-lab/runs/<date>-the-meter/`.

## Direction
- **Usage is visible before the limit:** nobody meets a limit as a
  surprise error.
- **The bill explains itself:** what used it, when, and what would
  change it.
- **Limits have owners**, and asking for more is one step.
- Explain, never hide; many deployments (from the brief).

## References and what to take from each
- **Utility meters and smart meter in-home displays** (UK SMETS). Take:
  a live reading, a running total, and a simple traffic light.
- **Opower's home energy reports** and the research on social
  comparison nudges. Take: comparison as information, and its risks.
- **Mobile data allowances and roaming warnings.** Take: warnings at
  sensible points, never a cliff.
- **Household budgeting envelopes.** Take: allocation people understand.
- **Cloud cost tools** (FinOps practice). Take: cost by owner and purpose.

## Surfaces (6 variants each)
1. **Meter sheet** (grammar): reading, allowance, rate, bill, owner, top-up.
2. **The app's meter**: model calls and storage for one app, before the limit.
3. **The team's bill**: what a floor used this month, and why.
4. **Meeting a limit**: the moment, the explanation, and asking for more.
5. **The deployment's meter** (Admin): capacity and cost across apps.
6. **Comparison**: how a team compares, if at all, and whether it helps.

Round 2: combine into 3-4 screens. One must follow one month of model use
by a team from first call to its limit, without a surprise.

## Questions the shortlist must answer
- What AUGUR measures today (the gateway's call counts, storage) and what
  it would need to.
- Whether comparison helps or harms in a workplace.
- Who owns each limit, and what the default should be.
