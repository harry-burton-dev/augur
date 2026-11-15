/**
 * The first half of each advisory lock key the service kit takes, one per purpose:
 * `pg_advisory_lock(namespace, hashtext(name))`. Every AUGUR service and installed app shares one Postgres, so a single key from `hashtext()` alone
 * could land on another lock user's key by chance; with a namespace, two purposes can't block each other however
 * their names hash (PER-456). The values start 0x4155 ("AU"), out of the way of small numbers others pick.
 * A namespace, once shipped, never changes: an instance on the old value and one on the new wouldn't exclude each other.
 */
export const LOCK_NAMESPACE = {
  /** `runMigrations`: one instance migrates a schema at a time; the second half is `hashtext(schema)`. */
  migrations: 0x4155_0001,
  /** `auditOutbox`: one instance sends a table's entries at a time; the second half is `hashtext(table)`. */
  auditOutbox: 0x4155_0002,
} as const;
