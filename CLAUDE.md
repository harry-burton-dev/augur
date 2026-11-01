# Working in this repository

- Open pull requests against `main` (`dev` until it is renamed), the only long-lived branch (docs/release-channels.md). A hotfix goes into its `release/<unit>-<major>.<minor>` branch, and then onto `main` too.
- Only the repository's owner makes a release stable (Actions → Promote to stable).
- Every pull request carries a changeset (`pnpm changeset`, or `pnpm changeset --empty`), see docs/versioning.md.
