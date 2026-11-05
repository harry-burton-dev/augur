# 0009. Files go in S3-compatible object storage, run with Garage

- **Status:** Accepted; the amendment of 2026-11-05 is Proposed
- **Date:** 2026-10-17
- **Decided by:** Harry

## Context

Artifacts and other apps store documents and renditions. Deployments run on an organisation's own servers, so storage must not depend on one cloud.

## Decision

Files are stored through the S3 API, behind AUGUR's storage service. The default stack runs Garage. Any S3-compatible store can replace it by configuration.

## Consequences

- Apps never talk to the store directly; the storage service handles access per floor.

## Amended 2026-11-03

The code outran the consequence above: apps call the S3 API directly with credentials the storage job makes for them (PER-224). For the alpha, Harry accepted that as the rule, provisionally:

- **Apps use S3 directly,** each with credentials that reach only its own bucket. The storage service makes the bucket and the credentials, and nothing else.
- **The floor check lives in the service kit's storage helpers.** An app reads and writes files only through them, and a contract test proves a person can't reach a file their floor doesn't allow.
- **Still open:** how this scales when large data moves between apps, or when work needs graph-style traversal across many entities. That needs a design note before beta. Until then this amendment is provisional.

## Amended 2026-11-05 (Proposed)

The amendment of 3 November describes a floor check the code doesn't have yet (PER-224):

- **Apps use S3 directly, each with credentials that reach only its own bucket.** True as written: the storage job makes the bucket and the key, and the service kit's `appStorageFromEnv` hands an app its settings.
- **The floor check is the app's own.** The service kit has no file helpers: an app makes its own S3 client (Artifacts: `service/src/objects.ts` in `augur-folio`) and checks who may read a file in its own routes, as it does for every other record it keeps. No contract test covers files yet.
- **Recommended:** accept this as the rule for the alpha, and keep "a kit helper that checks the floor, held by a contract test" as the target, built when a second app keeps files. The design note on large data and traversal is still owed before beta.

## Links

- docs/app-storage.md
- Linear PER-245, PER-278 (alpha milestone spec and its Step 0 records)
