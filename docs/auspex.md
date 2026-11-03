# Explorer

Explorer shows people where they are on AUGUR: the floors they can go to and why, who's on each, which apps they can use there, and why an app is off. It is a platform app, one of the apps for using and managing AUGUR itself, and ships with every deployment at `/auspex` ([ADR 0032](decisions/0032-platform-apps-and-pillar-apps.md)). Its code name is Auspex: its app id, route, intents, packages, container, image and `AUSPEX_*` keys stay `auspex`, so live servers keep working. It changes nothing: every screen says who can make a change instead.

There were two designs: a full explorer, and a quieter one for everyone. This first version builds the second, drawn rather than tabled.

## Screens

A rail on the left, as in every app (docs/app-patterns.md), goes to Where you are, the floor you're on and your own floor, and, for whoever they're for, the building and the plant room. Explorer's name at its top goes back to Where you are.

- **Where you are** (`/`): the org as a map, drawn left to right with d3-hierarchy's tidy tree. Your floors are lit in the floor colours, the one you're on is ringed, teams you see into (as a lead above them, or an admin) are dashed rings, and every other team is a closed mark that still says its name. A closed team's own teams fold into it ("Legal +2"). Your own floor sits under the map.
- **A floor** (`/floors/<id>`, or `/here`): the floor's orb, why you can come in and who leads it, three facts, its apps as tiles with where each one's state comes from, its people as discs (leads ringed), and the week as a line of days with what changed.
- **A closed team**: where it sits, the names of the teams inside it, and who to ask. Nothing about who's in it.
- **Why, or why not** (`/floors/<id>/apps/<app>`): the answer as the title, then the floors from the org down with the rule that decides it marked, who set it and when, and where else the app is on for you.
- **Home's card**, on team and org floors: the way up from here, why you're here, and three facts.
- **Who can open this** (`access.explain`), over another app: the thing's name, then each person or team that can open it with how many people that is, how it reaches them and since when, then "Everyone else at the org: can't open it". The count is only what the person may know: a team they're not on says its size isn't shown, and the total reads "At least". It ends with where a change is made and whether they may make it. Esc goes back.
- **The replay** (`/floors/<id>/replay`), for a floor's leads and admins: its last 30 days as a line of days, each a column of marks (people round, apps square, a block a red diamond, teams hollow). **Play the month** steps through it a day at a time, or pick a day: the days after it fade, chips add up what had changed by then, and that day's changes are told in words. Everyone else sees that the replay exists and who it's for.
- **The building** (`/building`), for leads and admins: the org in cross-section, drawn with d3-hierarchy's partition. The org is the roof, each team a room on the storey below the team it sits in and exactly as wide as the rooms beneath it. Rooms you go into are filled, rooms you see into are dashed, and closed rooms are outlines that keep their name and a lock. Headcounts show only where you may know them. Along the ground are everyone's own floors as doors (yours lit, and the only one that opens), and your way up from your door through each team you're on is lit as stairs. Admins get the plant room as the basement, with its lamp. Everyone else is told who it's for, and "Where you are" shows them the same teams.
- **The plant room** (`/plant`), for admins: every part AUGUR runs on as a machine with a lamp (answering, slow, not answering), its version, and a meter of how fast it answered, in three rooms (the way in, services, apps' services); the backups; and the running release against the newest one out. **Under way** shows an AUGUR upgrade and the app runner's installs and removals as tracks of steps, lit as far as each has got (every 5 seconds while one runs), then what finished this week, the pull request previews running, and when the updater and the app runner last asked for work. It reads what Admin's Status, Updates and Apps read, as the person, every 30 seconds, and changes nothing. Anyone else is told it's for admins.
- **Find** finds teams by name, closed ones included.

Every screen answers three questions: what am I looking at (the heading), what can I do (the "You can" line, at most two actions, often none), and why (a reason on every row, and who can change every "no"). Nothing is hidden for being out of reach, but nothing inside a closed team is shown: not its people, how many, or its apps. See [shell-principles.md](shell-principles.md).

## Where it reads from

| What | From | As |
| --- | --- | --- |
| Your floors, closed teams, members and leads | identity `GET /v1/me/map` | the person, through the gateway |
| Each app on a floor and why, and its kind (`category`, `ships`) | registry `GET /v1/me/apps?workspace=` | the person, on that floor (the gateway checks they can stand there) |
| What changed on a floor | Explorer `GET /v1/changes` | the person, on that floor |
| Names of whoever set a rule | Explorer `GET /v1/names` | the person |
| Each part's health, and the backups (plant room) | gateway `GET /v1/status` | an admin |
| The running release, the newest out, and the upgrade under way (plant room) | registry `GET /v1/platform/updates` | an admin |
| Installs and removals, and previews (plant room) | registry `GET /v1/app-runner/jobs` and `/v1/app-runner/apps` | an admin |

Explorer's own service keeps nothing on disk. It follows `platform.team.*` and `platform.app.*` ([domain-events.md](domain-events.md)) from the start of the events service's 30 days on every start, and remembers them in memory. It shows a floor only its own changes; the org floor also gets app changes made for everyone. Nobody's sign-in being turned on or off is ever shown.

Intents it handles: `floor.map` (open the map, or `{ floor }` to open on one), `auspex.open` (`{ path }`), and `access.explain`, a request any app can make with `ctx.request`:

```ts
await ctx.request({
  type: 'access.explain',
  payload: {
    thing: { app: 'folio', appName: 'Artifacts', id: 'd-1', title: 'Travel policy', kind: 'document' },
    audience: [{ principal: 'tree:<team>', name: 'Finance', level: 'read', since: '<iso>', via: 'its floor' }],
    change: { where: 'Share', allowed: false },
  },
});
```

The app sends who it lets in, as it already shows them; Explorer adds what it knows about the floors. `principal` is `person:<id>`, `team:<id>`, `tree:<id>` or `org`; entries it can't read are left out. Artifacts raises it from **Who can see it**. When no app handles it, the asking app says so and keeps its own list. Something published up the floors adds `chain` (the floors it came up through, from where it was made) and `shows` (the states it shows there) to its entry, and Explorer says "Up from Payroll through Finance, showing Complete and Issued".

## Running it

In a deployment it's the `auspex` container, with one setting: `AUSPEX_CLIENT_SECRET`, its sign-in, which identity makes in Keycloak. It needs the `people:read` and `events:subscribe` scopes, which apps that ship with AUGUR are given. It lives in its own repository, [augur-auspex](https://github.com/harry-burton-dev/augur-auspex), and every AUGUR release ships the release of it `release/shipped-apps.json` pins ([ADR 0049](decisions/0049-pillar-apps-shipped-from-their-releases.md)); run it locally from there.

## Next

Design 1 is built. Still open from its spec: app activity on rooms (an app opting in to say "a document was published here"), and the first-visit climb.
