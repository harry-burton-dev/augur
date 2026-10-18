# Changesets

Every change that should reach a release comes with a changeset: a small file
saying which packages it changes and how (major, minor or patch), with a line
for the changelog. Run `pnpm changeset` and answer the prompts. A change that
releases nothing (docs, CI) gets `pnpm changeset --empty`.

See [Versioning](../docs/versioning.md) for what counts as major, minor or patch here.
