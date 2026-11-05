### Keycloak 26.8: back up first, take it by hand, and know that it can't be undone

This release (augur@0.18.0) changes Keycloak's database on its first start, and that can't be undone, so take a backup you have tested and upgrade by hand, not in an upgrade window.

**Before you upgrade**
1. Take a backup and test it ("Before you start", step 4). Keep the file name: `infra/deploy/backups/platform-<date>.sql.gz`.
2. Check that `KEYCLOAK_ADMIN_PASSWORD` in `.env` is still Keycloak's master admin password. If you changed it in the console, put the current one in `.env`. The realm job signs in with it on every `up`.

**Upgrade** as usual. Keycloak's first start takes a minute or two longer while it migrates. A new container, `keycloak-config`, runs once Keycloak is up, sets the realm up and stops. Identity starts after it.

**Check** that `pc logs keycloak-config` ends with "The platform realm is up to date" and lists what it changed, and that `pc ps -a keycloak-config` shows it exited with 0. [open: what to do if it doesn't.] If identity's log says it lacks rights, run `pc up -d keycloak-config identity`.

**Going back** is a restore of that backup. It puts Keycloak's database back as it was before 26.8. Anything changed since the backup is lost. Set `PLATFORM_VERSION` back, check out that release's deploy files, then:

```sh
pc stop tailscale web gateway identity registry events keycloak backup
gunzip -c infra/deploy/backups/platform-<date>.sql.gz | pc exec -T postgres psql -U platform -d postgres
pc up -d --remove-orphans
```

**What changes for people.** New passwords need 15 characters or more and can't be the username, the email or a known breached password; nobody has to change the one they have. Admins and deployment admins are asked to set up a code app at their next sign-in, unless they use a passkey; anyone can add either. Sessions end after 8 hours unused or 10 hours at most.

**Why.** Keycloak moves from 26.0.8 to 26.8.1 and the realm is kept as code (ADRs 0037, 0038 and 0057). Identity no longer holds `manage-realm`, so it can't change sign-in settings, and `infra/deploy/identity-repair.yml` is gone.
