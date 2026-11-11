---
"@augur/upgrades": minor
"@augur/admin": minor
"@augur/registry": minor
"@augur/updater": patch
"@augur/identity": patch
---

What the server runs for an installed app moves from Admin to its page in Deployment: rolling it back (installing an earlier release, which puts it on hold), its internet, its own settings saved as they change, its developers and previews, a new sign-in for its service, and removing it. Where apps load from moves to Deployment's Apps. Deployment may look people up (`people:read`) to name and find developers. Admin's Status and Dev to production pages go: Deployment's Health, Backups and Release channel show the same. Messages that sent people to Admin for these now name Deployment.
