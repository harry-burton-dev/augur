# 0021. Feature flags use OpenFeature with flagd

- **Status:** Accepted
- **Date:** 2026-11-01
- **Decided by:** Harry

## Context

Trunk-based development needs unfinished work merged dark. AUGUR's feature previews (manifest `previews`, Admin modes off, opt-in and everyone) are a home-made flag system with their own evaluation rules. Deployments may be air-gapped.

## Options

1. **OpenFeature (the CNCF flag API) with flagd's in-process provider.** It reads a JSON flag file and needs no server, so it works offline.
2. **Unleash, GrowthBook or Flagsmith.** Each is a server with its own database on every deployment, and Admin is already the UI.
3. **Keep our own.**

## Decision

Option 1. The registry writes the flag file from manifests' `previews` and Admin's choices, with floors and roles as targeting context. Frontends and services evaluate flags through OpenFeature, and apps get it through `@augur/mfe-sdk` and the service kit, so the provider can change without touching apps. GO Feature Flag is the fallback if flagd stops fitting.

## Consequences

- New dependencies: the OpenFeature web and server SDKs and the flagd provider.
- Feature previews move onto flags without changing the manifest format.

## Amended 2026-11-03

For the alpha, flags stay AUGUR's feature previews, with floor targeting added: Admin can turn a preview on for chosen floors as well as off, opt-in or everyone, without a release. OpenFeature and flagd are deferred to beta, so no new dependency or service lands now. Apps keep the same API (`ctx.previewOn` and the service kit), so the later move to OpenFeature changes nothing for them.

## Links

- Linear PER-177
- docs/release-channels.md (feature previews)
- Linear PER-245, PER-278 (alpha milestone spec and its Step 0 records)
