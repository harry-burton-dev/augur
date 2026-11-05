---
"@augur/updater": patch
---

The updater no longer rolls back a release that moves a running part onto AUGUR's own image (Keycloak in 0.19.0). It used to pull that part before writing the new compose.yml, so it fetched the old image (Keycloak's own) and stopped with "The keycloak image pulled for … isn't the one the release names". Such a part is now pulled once the new compose.yml names AUGUR's image, and going back puts it on the old image again.
