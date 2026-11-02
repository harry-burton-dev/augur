---
'@augur/registry': minor
---

Upgrading AUGUR, going back to an earlier release, taking back a waiting upgrade and changing how a unit takes updates (policy, pin, windows) need the `deployment-admin` role (ADR 0022). A refusal says so as `requiredRole: 'deployment-admin'`, so the Upgrade Centre can name the role.
