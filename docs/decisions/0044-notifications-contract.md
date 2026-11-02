# 0044. One notifications contract: floor or global, sent by services, kept by events, shown by the shell

- **Status:** Proposed
- **Date:** 2026-11-02
- **Decided by:** Harry
- **Replaces:** none

## Context

The parts are built but nothing joins them up for the things Harry wants to hear about first: a new AUGUR or app version, and how an update ended.

What exists today:

- The **events service** keeps one notification per person (`events.notifications`), with a level (`needs`, `info`, `done`, `failed`), title, detail, link into the app, up to two intent actions and, when it came from a floor, that floor and its path. People read their unread list and a live server-sent stream; they mark one read or unread. Services send with `notify` from the service kit: an app only for itself, with `notifications:send` on the floor it names. A team's lead can turn on team notices, so an app can send `toTeam`.
- The **shell** reads that list and stream through the gateway (`NotificationFeed`), shows notifications from other floors with "On Finance" and a count on the gauge, and lets people mute an app or go away. `ctx.notify` from an app's frontend adds one in that browser only. A new notification changes the band's words and pulses the point once; toasts are a setting, off by default (#220). The Letterbox (PDR-009) is built in Common but nothing uses it yet.
- The **Inbox** (ADR 0026) is separate: it holds work that waits on someone. Notifications tell people things.

Why it doesn't work end to end:

1. **No platform service sends a notification.** The registry and the updater record every upgrade and install in the audit log, and the Upgrade Centre shows "needs you" on its own page, but nothing reaches the shell. A new release, a finished upgrade and an automatic go-back are silent.
2. **A platform service can't say who should hear it.** Notifications go to person ids or to one team. "Everyone who can install updates" has no address.
3. **Nothing stops a repeat.** A service that looks again (a feed check, a restart) would tell people the same news again.
4. **It is easy to miss.** With toasts off, a new notification is one pulse.

Apps' own notifications (Artifacts, Mandate) do use the pipe. When one doesn't arrive, the usual cause is the app lacking `notifications:send` on that floor: the events service answers 403 and only the app's log says so.

## Options

1. **Each feature shows its own news on its own page.** No contract, and people have to go and look. This is the situation today.
2. **The shell polls each service for news.** Every service would grow a news endpoint and the shell would need to know about each one. This breaks the rule that the shell has no special cases.
3. **One contract through the events service.** Every service, platform or app, sends notifications to the events service. The events service keeps them per person, works out the audience and makes sure each piece of news is sent only once. The shell shows them by one set of rules.

## Decision

Option 3. The contract has these rules:

**Scope: a floor or global.** A notification carries a floor only when the thing it is about lives on a floor: a document in Finance, an intent on a team. It is **global** when it is about the deployment or the person: updates, their account, the platform. A global notification has no floor, shows on every floor and never moves you when you open it. A floor notification is tagged with its floor when you are elsewhere, and opening it takes you there. The sender decides by naming the floor (`X-Workspace-Id`, `workspace` in the service kit) or by naming none.

**Addressing: one of three.**
- `recipients`: person ids, at most 500 per call. Apps and platform services.
- `toTeam`: everyone on the team the call's floor names, only when the team has turned team notices on.
- `audience`: principals, worked out by identity when the notification is sent: `person:`, `team:`, `tree:`, `org` and `role:<realm role>`. **Platform services only.** Apps name the people they mean, so that an app never tells "every admin". Identity also refuses `role:` principals from apps on `/members`.

**Once per piece of news.** A notification may carry a `key`, the sender's own name for the news (`available:augur:0.15.0`, `result:upgrade:<id>`). The events service adds it only for people who have no notification from that app with that key, read or not. A sender can then look again, or restart, without telling anyone twice. A change worth hearing about again gets a new key.

**Delivery.** The events service is the only store. The shell loads the unread list, then follows the stream, and loads the list again after each reconnect, so nothing missed while offline is lost. `ctx.notify` stays a browser-only confirmation ("Saved"). Anything that has to survive a reload is sent from the app's service.

**Read state.** Read state is per person: read, or unread again with Undo. Opening a notification or pressing one of its actions marks it read. A person sees only their own notifications, never who else got them, and never the key.

**Levels and how loud.** The level says what the notification is: `needs` (you have to act), `failed`, `done`, `info`. The shell decides how loud it is, by rules, not by app. `needs` counts in the band's words and on Home. Every level changes the band's words and pulses once. Toasts follow the person's setting (#220). The Letterbox is for platform news that stops work (decision D3), not for apps until an urgency budget exists (decision D4).

**Preferences** stay in identity (ADR 0039): away, muted apps and toasts. Muting an app silences its toasts and pulses, but its notifications stay in the list.

**The first sender: updates.** The registry looks at the Upgrade Centre's overview every minute and tells people:

| News | Audience | Level | Key |
| --- | --- | --- | --- |
| A new release Automatic will install | `role:deployment-admin` | info | `available:<unit>:<version>` |
| A new release that waits for someone (Ask first, a major release, past the pin) | `role:deployment-admin` | needs | `available:<unit>:<version>` |
| An upgrade or install finished | `role:deployment-admin`, `role:admin` | done | `result:<kind>:<id>` |
| It failed, or went back by itself after the 10-minute watch | `role:deployment-admin`, `role:admin` | failed | `result:<kind>:<id>` |
| The publisher halted the release this server runs | `role:deployment-admin` | needs | `halted:<unit>:<version>` |

These are global notifications from the Upgrade Centre (`upgrades`), and opening one goes to the unit's page. Nothing is offered while a unit is on hold, or while an upgrade is under way. A result older than a day is history, not news, so a restart doesn't retell last week.

## Open decisions (defaults taken; Harry to confirm)

| # | Question | Options | Recommended (built) |
| --- | --- | --- | --- |
| D1 | Who hears how an update ended? | a) deployment admins only · b) deployment admins and admins | **b**: admins run the organisation and field "it looks different" |
| D2 | Tell people about a release Automatic will install anyway? | a) only when it waits for someone · b) always, as `info` | **b**: you asked to hear when a version is available. Muting the Upgrade Centre makes it quiet |
| D3 | When does the Letterbox open by itself? | a) never · b) platform news that stops work, such as a halted release or a failed go-back · c) any `needs` | **b**, later. Not built yet; it needs an `urgent` flag that only platform services may send |
| D4 | Urgency budget per app (opportunities 8)? | a) now · b) when three or more apps send `needs` | **b**: today only Artifacts and Mandate send, and rarely |
| D5 | How long are notifications kept? | a) forever · b) read ones 90 days, unread ones a year | **b**, as a prune job in a later PR. Today nothing is deleted |
| D6 | Toasts by default? | a) off for everything (#220) · b) on for `needs` and `failed` from the platform | **a** for now, as #220 has it. Revisit when D3 lands |
| D7 | Email for `needs` when someone is away? | a) never · b) a daily digest through the relay (ADR 0035) | **b**, later, as its own PR |

## Consequences

- Any platform service can tell the people who act on something without knowing who they are, and new deployment admins are included from the next notification on.
- A sender has to choose a key for news it might send again. Without one, every call tells everyone it names.
- `role:` addressing sits in identity's `/members`, so who holds a role is never cached in events.
- Deployment admins who never hold the role hear nothing. The realm import gives the first admin the role. The guide says to check this in Admin, People.
- Checks: tests in `platform/services/events` (audience, key, one per person), `platform/services/identity` (role principals for the platform only) and `platform/services/registry/src/notices.test.ts`. Migration `006_notification_keys` only adds.
- The guide is [docs/notifications.md](../notifications.md).

## Links

- ADR 0020 (desired state and watch), 0022 (deployment-admin role), 0026 (Inbox), 0035 (email relay), 0039 (preferences).
- PDR-009 (Letterbox) in the handbook.
- #220 (toasts setting).
- The opportunities note of 2 November 2026 (urgency budget, item 8).
