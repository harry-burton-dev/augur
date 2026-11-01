# 0009. Files go in S3-compatible object storage, run with Garage

- **Status:** Accepted
- **Date:** 2026-10-17
- **Decided by:** Harry

## Context

Artifacts and other apps store documents and renditions. Deployments run on an organisation's own servers, so storage must not depend on one cloud.

## Decision

Files are stored through the S3 API, behind AUGUR's storage service. The default stack runs Garage. Any S3-compatible store can replace it by configuration.

## Consequences

- Apps never talk to the store directly; the storage service handles access per floor.

## Links

- docs/app-storage.md
