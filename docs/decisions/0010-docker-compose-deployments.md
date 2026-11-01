# 0010. Deployments run on Docker Compose; no Kubernetes for now

- **Status:** Accepted
- **Date:** 2026-11-01
- **Decided by:** Harry
- **Replaces:** the Kubernetes and Helm plan (U7) as the current direction

## Context

AUGUR runs on Harry's own server today, reached over Tailscale. The organisation's private cloud is VMware-based and it isn't yet known whether it offers Kubernetes. Planning a Helm chart now would be work for an unknown target.

## Decision

Every deployment runs from the same signed release images with Docker Compose (`infra/deploy/compose.yml`). Tailscale is the default way in, with an optional time-limited public switch. Kubernetes and Helm are not planned until a real target needs them.

## Consequences

- Deployment differences come from `.env` and configuration only, never from code changes.
- If the organisation target turns out to be Kubernetes, this record is superseded.

## Links

- docs/deploy.md
- Delivery design: https://claude.ai/artifact/5CRmFQHPyR9Fmu7213DRgn
