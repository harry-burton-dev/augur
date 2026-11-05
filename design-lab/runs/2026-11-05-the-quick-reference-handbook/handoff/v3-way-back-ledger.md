# Hand-off · V3 · The way-back ledger

*For whoever picks it up next, a person or a coding agent: not the story, but the state. Each step taken is one line saying whether it can be undone, how, what it cost and what it depended on. An agent can't see the server, so every fact is a command and its pasted output, and every gap says what command would close it.*

---

## State now

| Fact | Command | Output (pasted) |
|---|---|---|
| Release | `grep PLATFORM_VERSION infra/deploy/.env` | `PLATFORM_VERSION=0.18.0` |
| Parts | `pc ps` | all `healthy` |
| Watch's look | `pc exec -T updater node dist/index.js check` | `"ok":true` |
| Backups | `ls infra/deploy/backups` | [pasted] |

## Steps taken

| Time | Step | Undo? | Way back | Cost | Depended on |
|---|---|---|---|---|---|
| 01:57 | Updater went back to 0.18.0 by itself | yes | upgrade again | none | the watch seeing atlas fail |
| 02:20 | Stopped everything but Postgres | yes | `pc up -d` | AUGUR off for 7 min | nobody working |
| 02:21 | **Restored** `platform-2026-11-08T014012Z.sql.gz` | **no** | none: the state between 01:40 and 02:20 is gone | the 01:52 Artifacts save; AUGUR's history, notices and Activity after 01:40 | that file restoring (tested at 01:42) |
| 02:24 | `pc up -d` | yes | | | |
| 02:30 | AUGUR policy to Ask first | yes | set it back | no automatic patches | |

## Still unknown, and what would tell us

| Unknown | Would be closed by | Who |
|---|---|---|
| Why 0.18.1's Data Atlas migration broke 0.18.0 | reading the migration in the Data Atlas release that 0.18.1 ships (`release/shipped-apps.json`) | Harry, or an agent in the Data Atlas repository |
| Whether other servers took 0.18.1 | the portal's records (ADR 0019) | Harry |
| What was in the 01:52 save | the person who made it | the admin |

## Not to do next

- Don't upgrade to 0.18.1 again here: the same thing will happen.
- Don't go back past 0.18.0 (Keycloak 26.8).
