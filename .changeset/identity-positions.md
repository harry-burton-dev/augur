---
'@augur/identity': minor
---

Positions (ADR 0089): each department now has positions, the jobs on it, and people stand on a department by holding one. Admins can name positions, make one lead or member, hand one over and take one away (`/v1/admin/departments/:id/positions`, `/v1/admin/positions/:id`, each audited). Upgrading makes a position for each place someone already had on a department, held from when they joined, so nobody moves. Who is on each department is still written the old way too, so going back a release finds it as it is now.
