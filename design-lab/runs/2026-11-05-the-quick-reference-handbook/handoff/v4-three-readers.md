# Hand-off · V4 · One night, three readers

*The same facts, told once to each reader, in what that reader needs first. Each part is short enough to send as one message. Written before anything one-way, finished after.*

---

## For you, in the morning (you'll have forgotten)

> Upgrade at 01:40 went back by itself; Data Atlas then wouldn't start. I restored the 01:40 backup at 02:21. Everything works. **One thing to do:** tell [name] their 01:52 save in Artifacts is gone. **One thing not to do:** don't upgrade to 0.18.1 again; AUGUR is on Ask first. The full night is in `~/augur-night-2026-11-08.md`.

## For Harry (the publisher)

> 0.18.1 broke Data Atlas on [deployment]: after its migration, 0.18.0's atlas wouldn't start on the tables, and the updater's go-back didn't notice because going back isn't watched. Restored the updater's 01:40 backup; fine now. **Please halt 0.18.1** (Actions → Halt rollout) until a fix. Two things the guides don't say that we hit: deploy.md's restore command stops fewer parts than its words; and after restoring the updater's backup, a second notice says 0.18.1 didn't install.

## For a coding agent (it can't see the server)

> Task: find why `atlas` 0.18.0 fails on the schema 0.18.1 migrated.
> Facts, each from a command on the server (output pasted below): `PLATFORM_VERSION=0.18.0`; before the restore `pc ps` showed `atlas` restarting, and `pc logs atlas` said [pasted]; after the restore every part is healthy.
> Don't assume: anything about the server beyond the pasted output. Ask for a command's output instead.
> Done when: the migration that broke going back is named, and a test in the atlas repository fails on it.

---

**Sent to each by:** ________ **Acknowledged by:** you ☐ Harry ☐ agent ☐
