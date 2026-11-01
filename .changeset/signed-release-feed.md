---
"@augur/registry": minor
"@augur/admin": minor
---

The registry checks the release feed's cosign signature and expiry before it believes it, and turns down an unsigned, tampered or expired feed (ADR 0017). Releases can be halted with the new Halt rollout workflow: a halted release is listed with its reason but never offered, chosen or installed, and a server running one is told where to go. The Upgrade Centre says how far the feed is trusted and shows halted releases. Mirrors pass halt marks on.
