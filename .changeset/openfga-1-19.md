---
---

OpenFGA moves from 1.11.2 to 1.19.0, which fixes critical flaws in the gRPC and pgx libraries it was built with (the deploy test's Trivy scan). The scan's exceptions also accept the newest restic image's openssh client, which backup-tools never runs.
