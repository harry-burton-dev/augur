# Hand-off · V2 · The night, line by line

*A timeline written as you go, after Google SRE's incident document: one line per thing seen or done, with the time and the output pasted, never cleaned up. Kept as a file on the server outside the database, so a restore can't rewind it, and pasted to the morning when you stop.*

Where: `~/augur-night-2026-11-08.md` on the server, outside `infra/deploy` (so the updater never writes over it).

---

```
02:05  SAW    Notice: AUGUR went back to 0.18.0 by itself. "Back on 0.18.0: atlas didn't answer
              within 120 s. If 0.18.0 has trouble with data 0.18.1 changed, restore
              platform-2026-11-08T014012Z.sql.gz (docs/upgrade.md, Going back)."
02:09  SAW    Shell loads. Data Atlas unavailable.
02:11  READ   pc ps → all healthy at 0.18.0 except atlas: Restarting (1) 12 seconds ago
02:12  READ   updater check → "ok":false, "problems":["atlas doesn’t answer."]
02:13  READ   pc logs --since 15m atlas → [pasted]
02:15  READ   Activity since 01:40 → one save in Artifacts, 01:52, by [name]
02:16  CHOSE  Restore now. Loses the 01:52 save. Reason: nothing else saved since; costs more each hour.
02:17  KEPT   History steps and Activity copied into this file (below), because the restore rewinds them.
02:20  ONE-WAY pc stop; pc up -d postgres
02:21  ONE-WAY gunzip -c ...T014012Z.sql.gz | pc exec -T postgres psql ...  → no ERROR lines
02:24  ACT    pc up -d
02:27  READ   pc ps → all healthy. updater check → "ok":true. Data Atlas opens.
02:28  SAW    Notice: AUGUR 0.18.1 didn't install. Expected: the restored record closing itself.
02:30  ACT    AUGUR policy → Ask first.
02:31  STOP   Still wrong: nothing. Lost: the 01:52 save. Unknown: why 0.18.1's migration broke 0.18.0.
              Tell: [name] (their save); Harry (halt 0.18.1).
```

---

**Kept from AUGUR before the restore** (paste the History steps and Activity here).

**Rules for the timeline**
- Write the line before you do the thing, then add the output.
- Mark `ONE-WAY` before the line, not after.
- Never delete a line. A wrong turn stays, with "undone at" beside it.
- "Unknown" is a value. Write it.
