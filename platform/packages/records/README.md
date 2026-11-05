# @augur/records

The shapes every app's records share, so the next app keeps its things the way Artifacts does and people meet the same rules everywhere. It's plain TypeScript with no dependencies, so an app's service and its frontend both use it: the service to enforce the rules, the frontend to offer only what will work.

[App patterns](https://drive.google.com/drive/folders/1L14-L3PNjl5OVlztzZCu3TjD2D5QLs24) is the guide: what each piece is for, the tables an app keeps for it, and Artifacts as the worked example.

| Module | What it gives |
| --- | --- |
| `levels` | `defineLevels`: the levels a tree of records is built from, what each may hold, what sits at the top, `refusal` in words people can act on, `named` for an org's own names. `pathTo`, `within` to walk a tree. |
| `lifecycle` | `defineLifecycle`: states, the moves between them and how far in you have to be for each, filters. `CONTENT_LIFECYCLE` (in progress, in review, complete, issued, retired) and `CONTAINER_LIFECYCLE` (open, closed, archived). `newestPassing` for "what a filter shows of something with versions". |
| `access` | `read` / `edit` / `manage`, identity's principals, `levelDown` for grants that reach down a tree, `floorPrincipal` and `floorLevel` for what a floor gives its own people. |
| `placements` | Publishing up the floors: `floorsAbove`, `placementRefusal`, `ownerOf` (one owner, the highest floor), `chainOf`, `above` (what taking one back takes with it), `viewFor` (the one place someone sees it, and every state they may). |
| `tags` | `tagName`, `sameTag`, `tagsDown` (a tag on a container counts for what's inside), `hasAll`. |
| `relations` | `RecordRef` to point at anything in any app, `RELATIONS` (relates to, supersedes, responds to, about, serves), `fits`, `isRecordRef`. |

```ts
import { CONTENT_LIFECYCLE, levelDown, placementRefusal } from '@augur/records';

const level = levelDown(grantsTopDown, principals, floorLevel(caller.workspace.role));
CONTENT_LIFECYCLE.check(version.state, 'issued', level); // throws BadMoveError with what to say
```
