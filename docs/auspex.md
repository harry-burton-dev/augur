# Auspex

Auspex shows people where they are on AUGUR: the floors they can go to and why, who's on each, which apps they can use there, and why an app is off. It ships with AUGUR, like Folio (a pillar app), at `/auspex`. It changes nothing: every screen says who can make a change instead.

Specs: [design 1, the full explorer](https://claude.ai/artifact/YTnmWdHJXbajzrMLCD6NEf) and [design 2, for everyone](https://claude.ai/artifact/QJvHTzoiJZ7cgWaECP2HEH). This first version builds design 2, drawn rather than tabled.

## Screens

- **Where you are** (`/`): the org as a map, drawn left to right with d3-hierarchy's tidy tree. Your floors are lit in the floor colours, the one you're on is ringed, teams you see into (as a lead above them, or an admin) are dashed rings, and every other team is a closed mark that still says its name. A closed team's own teams fold into it ("Legal +2"). Your own floor sits under the map.
- **A floor** (`/floors/<id>`, or `/here`): the floor's orb, why you can come in and who leads it, three facts, its apps as tiles with where each one's state comes from, its people as discs (leads ringed), and the week as a line of days with what changed.
- **A closed team**: where it sits, the names of the teams inside it, and who to ask. Nothing about who's in it.
- **Why, or why not** (`/floors/<id>/apps/<app>`): the answer as the title, then the floors from the org down with the rule that decides it marked, who set it and when, and where else the app is on for you.
- **Home's card**, on team and org floors: the way up from here, why you're here, and three facts.
- **Who can open this** (`access.explain`), over another app: the thing's name, then each person or team that can open it with how many people that is, how it reaches them and since when, then "Everyone else at the org: can't open it". The count is only what the person may know: a team they're not on says its size isn't shown, and the total reads "At least". It ends with where a change is made and whether they may make it. Esc goes back.
- **Find** finds teams by name, closed ones included.

Every screen answers three questions: what am I looking at (the heading), what can I do (the "You can" line, at most two actions, often none), and why (a reason on every row, and who can change every "no"). Nothing is hidden for being out of reach, but nothing inside a closed team is shown: not its people, how many, or its apps. See [shell-principles.md](shell-principles.md).

## Where it reads from

| What | From | As |
| --- | --- | --- |
| Your floors, closed teams, members and leads | identity `GET /v1/me/map` | the person, through the gateway |
| Each app on a floor and why | registry `GET /v1/me/apps?workspace=` | the person, on that floor (the gateway checks they can stand there) |
| What changed on a floor | Auspex `GET /v1/changes` | the person, on that floor |
| Names of whoever set a rule | Auspex `GET /v1/names` | the person |

Auspex's own service keeps nothing on disk. It follows `platform.team.*` and `platform.app.*` ([domain-events.md](domain-events.md)) from the start of the events service's 30 days on every start, and remembers them in memory. It shows a floor only its own changes; the org floor also gets app changes made for everyone. Nobody's sign-in being turned on or off is ever shown.

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

The app sends who it lets in, as it already shows them; Auspex adds what it knows about the floors. `principal` is `person:<id>`, `team:<id>`, `tree:<id>` or `org`; entries it can't read are left out. Artifacts raises it from **Who can see it**. When no app handles it, the asking app says so and keeps its own list.

## Running it

In a deployment it's the `auspex` container, with one setting: `AUSPEX_CLIENT_SECRET`, its sign-in, which identity makes in Keycloak. It needs the `people:read` and `events:subscribe` scopes, which pillar apps are given. Locally: `pnpm dev:app auspex`.

## Next

For leads and admins, design 1's views: the replay of what changed, and the plant room.
