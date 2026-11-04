---
---

The deploy test now scans every image a release runs for critical vulnerabilities with a fix, third-party ones included (Keycloak's base, Postgres, Garage, Tailscale, the docker proxy), not only AUGUR's own. CI tests on Postgres 16, the major servers run, and the new `pnpm check:repo-security` keeps workflows pinned by SHA and scoped, keeps untrusted text out of their scripts, and keeps CI on the servers' Postgres major. Tailscale moves from v1.76.6 to v1.104.4; Renovate pins base images by digest (PER-219).
