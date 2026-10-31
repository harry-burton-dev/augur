# Working in this repository

- Open pull requests against `dev`, never `preview` or `production` (docs/release-channels.md). Promote to preview is the only way into `preview`, and the Promote workflow the only way into `production`.
- Never merge a pull request into `production`: only the repository's owner does.
- Every pull request carries a changeset (`pnpm changeset`, or `pnpm changeset --empty`), see docs/versioning.md.
