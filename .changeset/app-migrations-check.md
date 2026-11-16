---
"@augur/app-tools": minor
---

`augur-app migrations sync|check` holds an app's own database migrations to AUGUR's rules: one that shipped in a stable release never changes or goes, and within a major a new one only adds, linted with Squawk and AUGUR's rules. The rules now live in the package, and AUGUR's `pnpm check:migrations` uses the same ones. Both checks now fail when they can't read what shipped from origin, instead of passing with nothing to compare, and where a release and the frozen branch disagree on a migration, the release's fingerprint wins.
