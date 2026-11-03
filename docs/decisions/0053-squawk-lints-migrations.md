# 0053. Squawk lints every new migration, and one runner in the service kit applies them

- **Status:** Proposed
- **Date:** 2026-11-03
- **Decided by:** Harry
- **Replaces:** none

## Context

A deployment can always roll back to the release before, so within a major version migrations only add (ADR 0005, docs/versioning.md). `pnpm check:migrations` held that rule with a handful of regular expressions. They missed common forms: `alter table a drop b`, `rename b to c` and `alter b type int` written without `column`, `drop index`, a bulk `update`, and `add column … not null` with no default (PER-214). There was no way to let through a statement a reviewer had agreed was safe, other than a major changeset.

The runner that applies migrations was copied into each service (events, identity, models, registry) and into apps in their own repositories. The alpha's app-service starter (PER-266) gives apps one service kit to build on, and the alpha plan names Squawk for the guard.

## Options

1. **Squawk.** The most used open-source linter for Postgres migrations: it parses the SQL with Postgres's grammar rather than matching text, has a rule for each kind of break with a page explaining it, and an ignore comment per statement. It ships as `squawk-cli` on npm, a prebuilt binary per platform, so `pnpm install` brings it with no build step and no extra service.
2. **Better regular expressions.** No dependency, but each new form of a statement needs a new pattern, and a regex can't tell a statement from a comment or a string.
3. **A migration framework (such as node-pg-migrate or Graphile Migrate).** Brings its own runner and file layout; a larger change than the guard needs, and it still wouldn't lint for rollback safety.

## Decision

Option 1:

- `scripts/check-migrations.mjs` lints each migration that hasn't shipped (not in the last release's lock, nor on the branch `MIGRATIONS_FROZEN_AT` names) with Squawk, pinned in the root `package.json`. `.squawk.toml` at the root picks the rules: the ones that catch what the release before can't run on (drops, renames, type changes, columns made required, new constraints on a table, and Squawk's opt-in `ban-drop-index`, `ban-drop-default` and the like), and leaves out, saying why, the rules about locks and timeouts (every migration runs at start, inside one transaction, before the service serves) and about column style.
- What Squawk has no rule for (`truncate`, `delete from`, an `update` with no `where`) the script checks itself, under rule names of its own (`augur-truncate`, `augur-delete-rows`, `augur-bulk-update`). That is the only regex left.
- A violation needs a major changeset for its service, as before. A statement a reviewer agreed the release before can live with carries `-- squawk-ignore <rule>` on the line above it, with the reason on a comment line of its own; the pull request is where that's reviewed.
- The lock file and the rules that a shipped migration never changes, goes or moves stay as they were.
- `runMigrations(pool, { schema, migrations })` in `@augur/service-kit` is the one runner: in one transaction, under an advisory lock on `hashtext('<schema>.migrate')`, it makes the schema if it's missing, keeps `<schema>.migrations`, and applies the missing migrations in order. Every service uses it, and keeps exporting its list as `migrations` from `src/store.ts` for the check.

## Consequences

- The guard now catches the forms PER-214 found, and names the rule and the line, which Squawk's rules page explains.
- A new Squawk version can add rules, so it's pinned exactly and moves with Renovate's updates (ADR 0033), which run CI.
- An app in its own repository can drop its copied runner for `runMigrations` once it takes the service kit version that has it, and can lint its own migrations with a copy of `.squawk.toml`.
- `pnpm check:migrations` needs `pnpm install` first, which brings Squawk; it fails, saying so, if Squawk isn't there, rather than passing a migration unlinted.
- Held by: `pnpm check:migrations` in CI, `scripts/check-migrations.test.mjs`, and `platform/packages/service-kit/src/migrate.test.ts` on real Postgres.

## Links

- Linear PER-214, PER-266
- Squawk: https://squawkhq.com/docs/rules
