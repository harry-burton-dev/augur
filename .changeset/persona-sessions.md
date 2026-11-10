---
'@augur/permissions': minor
---

The permissions service keeps persona sessions (ADR 0086, 0089). Someone who holds an admin persona can act as it after a sign-in from the last 5 minutes, with a reason, for at most an hour as a deployment admin or a working day as an org admin (`PERSONA_DEPLOYMENT_ADMIN_MINUTES`, `PERSONA_ORG_ADMIN_MINUTES`). Starting and ending a session goes in the audit log. The gateway can ask whether a session is live. Nothing acts as a persona yet: the gateway and the shell's "Act as" come next.
