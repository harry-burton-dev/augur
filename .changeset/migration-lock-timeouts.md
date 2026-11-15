---
"@augur/service-kit": minor
---

A migration waits at most `DATABASE_MIGRATION_LOCK_TIMEOUT_SECONDS` (30) for a lock, then rolls back and throws `MigrationLockTimeout`, naming the migration, the lock and the session holding it where the login may see it; its transaction is ended if left idle for `DATABASE_MIGRATION_IDLE_TIMEOUT_SECONDS` (60). A pool from `steadyPool` waits at most `DATABASE_CONNECT_TIMEOUT_SECONDS` (10) for a connection and then throws `DatabaseUnavailable`, answered 503. Migrations and the audit outbox take their advisory locks in a namespace of their own (`LOCK_NAMESPACE`), so no other lock user can collide with them (PER-456).

Not breaking: everything is added; `runMigrations` takes two optional limits.
