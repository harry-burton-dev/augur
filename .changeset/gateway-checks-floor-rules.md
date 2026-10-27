---
"@augur/gateway": minor
---

The gateway refuses a call to an app that isn't on for the caller where they are. It checks the floor the call names in `X-Workspace-Id`, or the organisation's when it names none. An app is off for someone if it's turned off, blocked on that floor, or needs a role they don't have. Such calls get a 403. Before this, only the shell hid such apps, and a call that named no floor skipped floor rules entirely. The check reads the same catalogue the shell gets from the registry, remembered for 30 seconds per person and floor, and it also supplies each app's upload limit as before.
