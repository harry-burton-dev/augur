---
"@platform/mfe-sdk": minor
"@platform/shell": minor
"@platform/home": patch
"@platform/admin": patch
---

Apps know which floor they're on (SDK 1.1). `MountContext` gains `workspace` (the floor's id, kind, name, slug, path from the org and the person's role), `getWorkspace()` and `fetch(path, init)`, which calls the gateway with the person's token and `X-Workspace-Id`; the SDK exports `floorFetch` and the `Workspace` types. The shell loads the person's floors at sign-in, puts the floor at the start of every address (`/@me/…`, `/@finance/…`, `/@org/…`; an address without one opens on your own floor), shows "You're not on that floor" for one you can't go to, and mounts the open app again when the floor changes. The Account line shows the current floor instead of the first department. Home names the floor over its greeting, except on your own.
