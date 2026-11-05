# Hand-off · V1 · SBAR, read back

*Four short parts, from the clinical handover (SBAR): situation and background from the records, assessment and recommendation in your own words. The hand-off moves only when the taker reads it back: until then it's still yours. Written before a restore, because a restore rewinds AUGUR's record of the night.*

---

**To:** ________ **From:** ________ **Written at:** ________

**S · Situation** (one line, what is true now)
> AUGUR runs 0.18.0. Data Atlas was down from 01:58 to 02:31; it works now. One save in Artifacts at 01:52 was lost in the restore.

**B · Background** (from the records, pasted)
> 01:40 Automatic upgrade 0.18.0 → 0.18.1. Backup `platform-2026-11-08T014012Z.sql.gz`, restored and checked.
> 01:54 watch failed: "atlas didn't answer within 120 s." 01:57 went back to 0.18.0 by itself.
> After that, atlas kept restarting: its log said its tables were newer than it expects.
> 02:24 restored `platform-2026-11-08T014012Z.sql.gz` (everything but Postgres stopped). 02:31 every part healthy; the updater's `check` ok.
> 02:32 a second notice, "AUGUR 0.18.1 didn't install": the restored database still held the upgrade as running, and the updater closed it.

**A · Assessment** (yours, and say how sure)
> 0.18.1 changed Data Atlas's tables in a way 0.18.0 can't read. Sure: the log said so, and the restore fixed it. Not known: why CI's migration rule let it through.

**R · Recommendation** (what the taker should do, in order)
> 1. Tell the person who saved at 01:52 that their save is gone (Activity before the restore showed who; it's pasted above).
> 2. Harry: halt 0.18.1 so other servers don't take it.
> 3. Leave AUGUR on Ask first until a fixed release is out.

---

**Read back.** The taker writes, in their own words, what they understood and what they'll do first:

> ______________________________________________

**Taken by:** ________ **at:** ________ *(until this is filled, the giver still answers for it)*
