---
"@augur/updater": patch
"@augur/registry": patch
"@augur/storage": patch
"@augur/service-kit": patch
---

`release/shipped-apps.json` is now the one list of the apps that ship with AUGUR. The updater reads it from its image to restart them in order and check each comes back, and refuses an upgrade with an image for a part the server runs that it doesn't know, instead of restarting it unchecked. `pnpm check:release` fails when a compose file disagrees with it. The registry refuses an app whose id a part of AUGUR answers to (a platform service, a platform app, a deployment service or a path the front door serves), saying which, and storage makes no schema under such an id (`RESERVED_APP_IDS` in the service kit).

The updater restarts AUGUR's own Keycloak image first, giving it up to five minutes to be ready, and keeps it running when going back to a release from before that image.
