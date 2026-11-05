---
'@augur/gateway': minor
'@augur/admin': minor
---

The database can be restored to any moment in the last 7 days (ADR 0064). Postgres archives its changes (WAL) as it makes them, the backup container takes a base backup each night, copies both off the server every hour once the off-server copy is set up, and replays them in the weekly restore test; `backup/restore-to-time.sh` goes back to a moment. Admin → Status shows how far back the database can go and the last replay test, and says why when it can't be relied on (`backups.pointInTime`, gateway contract 1.8.0).
