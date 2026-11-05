---
---

Deployments run Grafana's otel-lgtm 0.39.0 and pgvector 0.8.7 (Postgres 16.15, still on Debian 12) for the
critical vulnerabilities the 0.22.0 deploy test found. Two that no published image fixes yet, and that AUGUR can't
reach, are accepted in .trivyignore: gosu's Go standard library in every Postgres image, and openssh in the restic
image, which only lends its binary.
