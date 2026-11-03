---
"@augur/identity": major
---

Keycloak 26.8.1, with the realm kept as code (ADR 0057). A new `keycloak-config` container, built from identity's image, sets the realm up on every `up`: a 15-character password floor checked against a breached-password list, a code app or passkey as a second step for admins and deployment admins, passkeys in the sign-in form, 8-hour idle and 10-hour sessions, sign-in and admin events kept, the declared profile fields, the services' sign-ins and identity's rights. Identity loses `manage-realm` and no longer touches the realm's settings when it starts. Breaking: Keycloak's database migrates and can't go back without a restore, so take a backup first (docs/upgrade.md, "Keycloak 26.8 and the realm job").
