# 0024. Apps in the shell are trusted code until outside apps run sandboxed

- **Status:** Proposed
- **Date:** 2026-11-01
- **Decided by:** waiting on Harry

## Context

Apps are imported into the shell's own window (ADR 0003). `ctx.fetch` adds the person's token to any path, and `ctx.getToken()` hands the raw token to the app. Limiting `ctx.fetch` to an app's own upstreams wouldn't help: code in the same window can read the token or call the gateway directly. So an app opened by an admin can call admin routes as that admin. Today every app is written by AUGUR's own team, and the CSP limits scripts to the deployment's own origins, so the risk is latent.

## Options

1. **Treat apps as trusted code, and say so.** No code change now. Sandbox before the first app from outside.
2. **Remove `getToken` in SDK 2.0 and mark `ctx.fetch` requests,** so the gateway can refuse admin routes to them. This breaks every app, and an app in the same window can still get around it.
3. **Run outside apps in a sandboxed iframe** with a postMessage bridge and a token scoped to that app's upstreams.

## Decision (proposed)

Option 1 now, with option 3 as the rule for any app the deployment's own team didn't write:

- An app that runs in the shell's window is trusted with the person's session. Only apps the deployment's owners write or have reviewed may be installed that way.
- Before AUGUR installs an app from anyone else, it runs that app in a sandboxed iframe with a scoped token (option 3). That gets its own record.
- The other limits stay as they are: the gateway's floor rules, per-app scopes on the service side (ADR 0008), the CSP on script origins, and admin routes inside another app being refused.

## Consequences

- PER-138 ("limit ctx.fetch") closes as this record, not as code.
- docs/build-an-app.md says plainly what an app can reach.
- The sandbox needs a Linear issue before the first outside app is planned.

## Links

- Health check, 31 October 2026, finding D2 (was H2 on 23 October).
- PER-138.
