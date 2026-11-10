---
'@augur/identity': minor
'@augur/sign-in-theme': minor
'@augur/shell': patch
'@augur/admin': patch
---

Sign-in no longer asks admins and deployment admins for a one-time code. The realm job takes the two-step role out of `admin` and `deployment-admin`; code apps and passkeys stay on offer to everyone, and Admin → Organisation can still ask everyone for one ("Optional" or "Everyone"). Account and Admin say so in those words. The sign-in pages and emails move to the Endstate look on Common 0.15: the shell's still horizon and band, one solid square panel, Keycap buttons, Well fields and Instrument Sans, in the horizon greys.
