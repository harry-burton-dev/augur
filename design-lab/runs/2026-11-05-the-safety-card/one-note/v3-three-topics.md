### Keycloak 26.8

Three kinds of text, kept apart: a task to do, a concept to understand, a reference to look up.

#### Task: upgrade to Keycloak 26.8
*Applies from augur@0.18.0. Do by hand. One-way: see "Going back" in the reference.*

1. Take a backup and test it ("Before you start", step 4).
2. Write down the backup's file name.
3. Open `.env`. Check `KEYCLOAK_ADMIN_PASSWORD` is Keycloak's master admin password now.
4. If it isn't, put the current one in `.env`.
5. Upgrade as usual, by hand.
6. Wait. Keycloak's first start takes a minute or two longer.
7. Run `pc logs keycloak-config`.
   **Result:** it ends with "The platform realm is up to date".
8. Run `pc ps -a keycloak-config`.
   **Result:** it exited with 0.

[open: what to do when step 7 or 8 shows something else.]

#### Concept: what changes
- Keycloak changes its own database on its first start on 26.8. That can't be undone. Going back means restoring the backup from step 1, and losing anything changed since.
- The realm is now kept as code. A new container, `keycloak-config`, sets it up on every `up`, signing in with `KEYCLOAK_ADMIN_PASSWORD`, then stops. Identity starts after it.
- Identity no longer holds `manage-realm`. It can't change sign-in settings.
- For people: new passwords need 15 characters or more, and can't be the username, the email or a known breached password. Existing passwords stay. Admins and deployment admins are asked to set up a code app at next sign-in unless they use a passkey; anyone can add either. Sessions end after 8 hours unused or 10 hours at most.
- Why: ADRs 0037, 0038 and 0057.

#### Reference
| Item | Value |
|---|---|
| Keycloak version | 26.0.8 → 26.8.1 |
| Backup file | `infra/deploy/backups/platform-<date>.sql.gz` |
| Setting checked | `KEYCLOAK_ADMIN_PASSWORD` (Keycloak's master admin password) |
| New container | `keycloak-config` (runs once per `up`, then stops) |
| Success line | "The platform realm is up to date" |
| Removed | `infra/deploy/identity-repair.yml` |
| Identity lacks rights | `pc up -d keycloak-config identity` |

**Going back** (a restore; anything changed since the backup is lost). Set `PLATFORM_VERSION` back, check out that release's deploy files, then:

```sh
pc stop tailscale web gateway identity registry events keycloak backup
gunzip -c infra/deploy/backups/platform-<date>.sql.gz | pc exec -T postgres psql -U platform -d postgres
pc up -d --remove-orphans
```
