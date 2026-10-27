---
"@augur/identity": minor
---

Identity manages the platform realm as its own Keycloak client, which can manage that realm alone, and uses Keycloak's master admin only at start to give it those rights. The realm now slows down repeated wrong passwords (brute-force protection), set in the realm import and turned on at start for existing servers.
