### Keycloak 26.8 (augur@0.18.0)

You must take this release by hand. It changes Keycloak's database, and you can't undo that without a restore.

| If | Then |
|---|---|
| you are about to upgrade | take a backup, test it, and keep its file name (`infra/deploy/backups/platform-<date>.sql.gz`) |
| you changed Keycloak's master admin password in the console | put the current one in `.env` as `KEYCLOAK_ADMIN_PASSWORD` before you upgrade. The realm job signs in with it on every `up` |
| you have an upgrade window set | don't leave this release to it. Upgrade by hand |
| Keycloak takes a minute or two longer to start | wait. It is migrating its database |
| `pc logs keycloak-config` ends with "The platform realm is up to date" and `pc ps -a keycloak-config` shows exit 0 | the upgrade worked |
| either shows something else | [open: the source doesn't say] |
| identity's log says it lacks rights | run `pc up -d keycloak-config identity` |
| you need to go back | restore the backup (below). You lose anything changed since it |
| you go back without the restore | [open: the source says going back "is a restore", but not what fails without one] |

**To go back:** set `PLATFORM_VERSION` back, check out that release's deploy files, then

```sh
pc stop tailscale web gateway identity registry events keycloak backup
gunzip -c infra/deploy/backups/platform-<date>.sql.gz | pc exec -T postgres psql -U platform -d postgres
pc up -d --remove-orphans
```

| If someone… | Then |
|---|---|
| chooses a new password | it needs 15 characters or more, and can't be the username, the email or a known breached password |
| keeps the password they have | nothing. Nobody is made to change it |
| is an admin or deployment admin without a passkey | they are asked to set up a code app at their next sign-in |
| wants a passkey or a code app | anyone can add one |
| leaves a session for 8 hours, or uses it for 10 | it ends |

Why: Keycloak moves from 26.0.8 to 26.8.1 and the realm is kept as code (ADRs 0037, 0038, 0057). Identity no longer holds `manage-realm` and can't change sign-in settings; `infra/deploy/identity-repair.yml` is gone.
