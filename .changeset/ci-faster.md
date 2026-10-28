---
---

CI is quicker on our own runner: it uses the caches the runner keeps instead of downloading GitHub's, replays unchanged turbo tasks, stops a pull request's last run on a new push, and tests Folio's worker only when Folio changes. Its builds, typechecks and tests run as many turbo tasks at once as the runner's memory and CPUs allow, so the 8 GB runner no longer has builds killed or tests time out.
