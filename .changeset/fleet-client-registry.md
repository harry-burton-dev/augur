---
'@augur/registry': minor
'@augur/upgrades': patch
---

The fleet's machine client (platform-fleet, ADR 0100) may upgrade AUGUR, set a unit's desired state and ask for app installs with nobody signed in, within the server's ring (production: only stable releases nobody halted), recorded under its name. FLEET_CLIENT_SECRET makes the client. A server's first upgrade no longer has to be run by hand.
