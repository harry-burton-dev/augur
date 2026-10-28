---
---

CI is quicker on our own runner: it uses the caches the runner keeps instead of downloading GitHub's, replays unchanged turbo tasks, stops a pull request's last run on a new push, and tests Folio's worker only when Folio changes.
