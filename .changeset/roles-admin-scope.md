---
'@augur/gateway': patch
---

Admin's calls to the permissions service's roles and grants routes are allowed with `people:manage`, the platform scope it already holds. "Act as" stays the shell's alone: no app reaches the persona routes.
