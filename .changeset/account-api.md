---
"@augur/identity": minor
---

Identity serves each person's own account under `/v1/me/*` for the shell's Account area (ADR 0036, PER-190): their profile from Keycloak's user profile, how they sign in and the `kc_action` that changes each credential, where they're signed in (sign out of one, everywhere else or everywhere), and their recent sign-ins. Preferences gain a time zone, an away message with an end, and notification choices. The realm job turns on Keycloak's update-email action and gives identity's client `view-events` and `view-identity-providers`, which only read.
