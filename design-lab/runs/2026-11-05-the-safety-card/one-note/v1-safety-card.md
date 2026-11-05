### Keycloak moves to 26.8: take this release by hand

**From augur@0.18.0** · **Do this by hand** · **Can't go back without a restore**

| | Before you upgrade | |
|---|---|---|
| **1** | **Back up and test it.** Use the backup step in "Before you start" (step 4). | Write down the file name: `infra/deploy/backups/platform-<date>.sql.gz`. You need it to go back. |
| **2** | **Check the Keycloak password.** `KEYCLOAK_ADMIN_PASSWORD` in `.env` must be Keycloak's master admin password today. | Changed it in the console? Put the current one in `.env`. The realm job signs in with it on every `up`. |

| | Upgrade | |
|---|---|---|
| **3** | **Upgrade as usual, by hand.** Not in an upgrade window. | Keycloak's first start takes a minute or two longer. A new container, `keycloak-config`, runs once, sets the realm up and stops. Identity starts after it. |

| | Check | |
|---|---|---|
| **4** | `pc logs keycloak-config` | Ends with "The platform realm is up to date", and lists what it changed. |
| **5** | `pc ps -a keycloak-config` | Shows it exited with 0. |

[open: what to do if step 4 or 5 doesn't show this.]

| | If identity's log says it lacks rights | |
|---|---|---|
| **6** | `pc up -d keycloak-config identity` | |

---

**STOP before you go back.** Keycloak changes its database on its first start on 26.8. That can't be undone. Going back is a restore of the backup from step 1. Anything changed since that backup is lost.

To go back:
1. Set `PLATFORM_VERSION` back, and check out that release's deploy files.
2. Restore:
   ```sh
   pc stop tailscale web gateway identity registry events keycloak backup
   gunzip -c infra/deploy/backups/platform-<date>.sql.gz | pc exec -T postgres psql -U platform -d postgres
   pc up -d --remove-orphans
   ```

---

**What changes for people**

| Who | What |
|---|---|
| Everyone | A new password needs 15 characters or more, and can't be the username, the email or a known breached password. Nobody has to change the password they have now. |
| Admins and deployment admins | Asked to set up a code app at their next sign-in, unless they sign in with a passkey. |
| Everyone | Can add a passkey or a code app. |
| Everyone | Sessions end after 8 hours unused, or 10 hours at most. |

**Why:** Keycloak goes from 26.0.8 to 26.8.1, and the realm is kept as code (ADRs 0037, 0038, 0057). Identity no longer holds `manage-realm`: it can't change sign-in settings, and `infra/deploy/identity-repair.yml` is gone.
