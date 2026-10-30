# App patterns

Artifacts is the first app built all the way through, and the way it keeps its things is the way the next app should keep its own. People then meet the same ideas everywhere: what they can do with something, where it is in its life, who owns it, and how it reaches the floors above. This guide sets out those patterns. The rules live in [`@augur/records`](../platform/packages/records/README.md), so every app enforces them the same way.

Each app still owns its own tables, in its own schema ([App storage](app-storage.md)). The package gives the rules; the tables below are the shape to keep them in.

- [Records in a tree of levels](#records-in-a-tree-of-levels)
- [Who may do what](#who-may-do-what)
- [Lifecycle](#lifecycle)
- [Tags](#tags)
- [Relationships](#relationships)
- [Publishing up, and one owner](#publishing-up-and-one-owner)
- [One place only](#one-place-only)
- [Screens](#screens)
- [Checklist for a new app](#checklist-for-a-new-app)

## Records in a tree of levels

Give your records a fixed set of **levels** and say what each may hold. Artifacts has collection › subcollection › series › subseries › file. A level can be skipped (a file straight in a collection) but never turned round (a collection inside a series). That gives people a form to fill rather than an empty folder tree.

```ts
export const LEVELS = defineLevels([
  { id: 'collection', name: 'Collection', plural: 'Collections', holds: ['subcollection', 'series', 'file'] },
  …
], ['collection']);
```

- Check every move and every new record with `LEVELS.refusal(parentLevel, childLevel)` and send its words back as a 400.
- An org may call the levels something else. Keep the org's names in one table (`level`, `name`, `plural`), kept by the org's leads, and use `LEVELS.named(names)` wherever you show them. Floors can't rename them, because records move up between floors and the shape has to read the same on each.
- Every record has its own name, unique among its siblings.

Table shape: one row per record with `id`, `workspace_id` (its floor), `level`, `parent_id`, `name`, `description`, `state` (its lifecycle), `created_by`, `created_at`, `updated_at`.

## Who may do what

Three levels: **read**, **edit** (add to it and change it), **manage** (also share it, rename it, archive it, and the lifecycle moves only managers make).

- **The floor gives its own people a level.** Leads manage what's on their floor; everyone else on it reads (`floorLevel`). Say in your app if everyone on a floor may add things; Artifacts lets them.
- **Grants add to that**, on any record, for a person, a team, a team and the teams below it, or the whole org (identity's principals; see [Build an app, Sharing](build-an-app.md#sharing)).
- **A grant reaches down.** A grant on a collection lets you into everything in it. Work out a caller's level with `levelDown(grantsFromTheTopDown, principals, floorLevel)`.
- Keep, with each piece of content, the principals who may read it (a `readers text[]` column with a GIN index), so every list can filter with `&&` rather than walking the tree per row. Recompute it when a grant, a placement or the record's place changes.
- Something someone can't see is as good as not there: answer 404, not 403.

Table shape: `grants (record_id, principal, level, created_by, created_at)`, one per record and principal; every change goes in the audit log as `access.granted`, `access.changed` or `access.removed`.

## Lifecycle

Content has a **lifecycle**, and it lives on each **version**, so working on the next version never takes back the one people already have. Use `CONTENT_LIFECYCLE` unless your app truly needs other states:

| State | Means | Who moves it there |
| --- | --- | --- |
| In progress | Being worked on | edit |
| In review | Ready for others to look over | edit |
| Complete | Finished, and checked | edit |
| Issued | Put out as final | manage |
| Retired | Superseded or withdrawn: kept, no longer current | manage |

Containers (anything that holds content) use `CONTAINER_LIFECYCLE`: **open**, **closed** (nothing new goes in), **archived** (off the usual views, nothing deleted).

- Check every move with `lifecycle.check(from, to, level)`; it throws a `BadMoveError` with words to send back.
- Keep every move: `state_changes (record_id or version_id, from, to, by, at, note)`. Show it on the record.
- "Issued" is a state. "Publish" is what people do to put something on a floor above. Don't use one word for both.

## Tags

Two vocabularies: the **org's** tags, kept by the org's leads and shared by every floor, and each floor's (or collection's) **own**. A new org tag takes in the same-named local tags. A tag on a container counts for everything in it when people filter (`tagsDown`), so tagging a series tags its issues. Use `tagName` to tidy what people type and `sameTag` to compare.

## Relationships

Links from one record to another, in the same app or in another, kept by the app the link starts from. The other end is a `RecordRef` (`app`, `kind`, `id`, `label`), so a document can point at an entity in Data Atlas or an intent in Mandate without knowing those apps. The kinds are `RELATIONS`: relates to, supersedes, responds to, **about** (an entity), **serves** (an intent). `fits(relation, to, ownApp)` says which kind fits which end.

Table shape: `links (id, from_id, relation, to_app, to_kind, to_id, to_label, by, at)`. Show the inverse name ("Superseded by") on the other end when it's yours.

## Publishing up, and one owner

Something made on a floor is **published up** to a floor above it, through a **filter** of lifecycle states. That's a **placement**: a live window, not a copy, so what's added later shows through when it passes the filter.

- Up only: the teams it sits in and the org (`floorsAbove`). Sideways is sharing.
- A floor that received something can publish it further up, never with a wider filter than it received. `placementRefusal` checks all of this and says why not.
- **One owner.** Until it's published, its own floor owns it. After, the floor highest up that it reached owns it (`ownerOf`). Owning it means controlling its publication from there up (filter, where it lands, taking it back, publishing it further). It doesn't move the right to change the content: that stays where it was made.
- **Taking it back** from a floor takes it back from every floor it went on to from there (`above`). Say which before doing it.
- Keep every step for good (`chainOf`) and show it on the record.

Table shape: `placements (id, record_id, from_workspace, to_workspace, to_principal, rank, filter text[], via, landed_in, by, at, ended_at, ended_by, end_reason)`. Who may publish: anyone, for their own things, to a team they're on; a floor's leads for that floor's things and what it received; the org needs the `publisher` role or an org lead.

## One place only

Someone who reaches something through several floors sees it in **one place**: the highest floor that shows it to them (`viewFor`). On the lower floors it would have shown on, put a **signpost** that says where it is now and takes them there. Never hide it without saying why (see [shell principles](shell-principles.md)). In that one place, show everything any of their floors lets them see, and mark what only a lower floor shows ("Department only"). Your own floor's records always show on your own floor, where you work on them, marked with how far up they've gone.

## Screens

- Your app's own menu on the left, screens not records: **Home** first (what needs you on this floor, what's new since you looked), then your main screen, then **Shared with you** and **Find**.
- The main screen shows the tree as something to walk into: cards for what holds things, rows for content, a breadcrumb, and a details panel for the selected record (metadata, who can see it, tags, relationships, lifecycle, its chain up the floors).
- Use the kit's pieces for these (`ui-lifecycle`, `ui-chain`, `ui-details`), not your own.

## Checklist for a new app

1. Define your levels and lifecycle with `@augur/records`; keep the org's names for levels.
2. Keep the tables above in your schema: records, versions with a state, state changes, grants, readers, tags, links, placements.
3. Enforce every rule in the service with the package; send its refusals back as they are.
4. In the frontend, use the same package to offer only what will work, and the kit's pieces to show it.
5. Record access changes, lifecycle moves to issued or retired, and every placement in the audit log.
6. Publish domain events for what other apps follow (`<app>.record.published`, `<app>.record.withdrawn`).
