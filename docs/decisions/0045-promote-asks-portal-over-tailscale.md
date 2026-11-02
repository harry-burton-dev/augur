# 0045. Promote to stable asks the portal for bake time over Tailscale

- **Status:** Accepted
- **Date:** 2026-11-02
- **Decided by:** Harry
- **Replaces:** none

## Context

[0018](0018-rollout-gates.md) makes **Promote to stable** refuse a release that hasn't run on a preview deployment for the bake time with no going back. What each deployment runs reaches the portal (Backstage) as signed records ([0019](0019-deployment-reporting.md)), and the portal now works out each deployment's bake (`GET /api/augur/bake`). The portal is only on the tailnet ([0010](0010-docker-compose-deployments.md)), and the workflow runs on GitHub's hosted runners, which aren't.

## Options

1. **The workflow joins the tailnet** with Tailscale's own GitHub Action (`tailscale/github-action`), as an ephemeral node tagged `tag:ci`, and asks the portal. One OAuth client in Tailscale and two repository secrets.
2. **The portal publishes bake time to GitHub** (a file beside the pipeline feed). The portal would need a write token for the repository, and bake time would be as old as its last publish.
3. **The owner types the bake evidence into the workflow.** Nothing to set up, and nothing checked.

## Decision

Option 1. The Promote workflow joins the tailnet only when `TS_OAUTH_CLIENT_ID` and `TS_OAUTH_SECRET` are set, and asks the portal at the repository variable `PORTAL_URL`.

- With them set, a release that hasn't baked is refused, and so is one when the portal can't be reached. The owner's **Skip the bake time** override is recorded in `promotion.json`.
- Without them, the promotion goes ahead, and `promotion.json` and the run say that bake time wasn't checked, and why.

## Consequences

- Promotions are gated on real records from deployments, not on what a ring takes.
- Tailscale's ACLs must let `tag:ci` reach the portal on 443, and nothing else is needed.
- Until a preview deployment reports, every gated promotion needs the override. Bake hours are counted from daily records, so they can be up to a day short.
- The check is held by `bakeVerdict` in `scripts/promote.mjs` and its tests.

## Links

- Linear PER-177
- backstage-hb: the bake endpoint
- docs/release-channels.md, Promote to stable
