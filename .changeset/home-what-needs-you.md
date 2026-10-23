---
"@platform/mfe-sdk": minor
"@platform/ui-kit": minor
"@platform/shell": minor
"@platform/home": minor
"@platform/contract-tests": minor
---

Home shows what needs you (SDK 1.2). Under the greeting, a count ("3 things need you"), then every unread notification that needs you, with its actions inline (muted apps left out), then up to six glance cards in recent-app order; with nothing at all, "Nothing needs you right now". A card is an app's `card` surface for the kind of floor: the manifest's `module` names a key of the new `surfaces` on the entry's default export (`MicroFrontend.surfaces`, `Surface`, and `AppManifestEntry.surfaces` and `floors` in the SDK), and the shell mounts it with the app's own context; a card that's missing or fails says so in its tile. Home is still an app: it hears from the shell on its own `shell.home.*` bus events. The kit gains `ui-list` (rows with a lead mark, detail, time and up to two actions; groups, the first that needs you pings, loading, empty and error) and `ui-state` (empty, loading after 300ms, error, offline), and `ui-shell` fires `ui-notifications` whenever its notifications or mutes change. `pnpm dev:app` puts Home in the stand-in catalogue so an app's card can be seen, and the contract tests check Home's actions and a glance card.
