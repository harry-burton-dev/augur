---
"@augur/identity": minor
"@augur/admin": minor
---

People shows who is **Locked** after repeated wrong passwords (and an admin can unlock them), who is **Leaving** on a last day an admin set (the leaver flow then runs on its own once that day is over, and can be cancelled until then), and who is **Idle**. A person's dialog lists their account's facts: state, last sign-in, invite, lockout, when an idle sign-in is warned and turned off or why it never is, and their last day. Identity: `POST /admin/people/{id}/unlock`, `lastDay` on the leaver flow and `DELETE /admin/people/{id}/leave`, `locked`, `leaving` and `idle` on a person (contract 1.27.0), migration `lifecycle_003_locked_leaving`.
