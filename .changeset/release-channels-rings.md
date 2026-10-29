---
"@augur/registry": minor
"@augur/admin": minor
---

Server rings: `SERVER_RING=preview|production` in `.env` (required). A production server follows stable (production) releases only, for AUGUR and for every app, and runs pull requests' builds only with `ALLOW_PR_PREVIEWS=on`. Updates and Apps show the ring, and Admin calls the channels Production and Preview (docs/release-channels.md).
