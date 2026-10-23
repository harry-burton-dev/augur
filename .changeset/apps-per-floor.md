---
"@platform/service-kit": minor
"@platform/identity": minor
"@platform/registry": minor
"@platform/shell": minor
"@platform/admin": minor
---

An app can be on for one floor and off for another. The registry keeps three separate things: whether an app is turned on at all (as before), installs per floor in a new `registry.installs` table (on or off, carrying on to the teams below unless told not to), and guardrails in `registry.guardrails`, where a block on a floor wins over anything below it. Everyone's own floor follows the org. Manifests gain `floors` (the kinds of floor an app works on) and a checked `surfaces` block (page, card, panel, settings or admin per kind of floor, with an optional role and roll-up). `GET /v1/manifest?workspace=` lists the apps on for the floor the gateway checked, and grants now hold only where an app is on. Admins set floors with `PUT /v1/apps/{id}/floors/{workspace}` and see them with `GET /v1/apps/{id}/floors`; a new version asking for more scopes is served but gets them only after `PUT /v1/apps/{id}/scopes`. Identity tells platform services where a floor sits (`GET /v1/workspaces/{id}`, read with the service kit's `floorPlaces`) and offers the roll-up `GET /v1/me/workspaces/{id}/rollup`. The shell asks for the catalogue of the floor you're on and asks again when you move. Admin, Apps shows where each app is on, floor by floor, with a choice for each, and lets an admin allow scopes a new version asks for. Services need `IDENTITY_URL` (set in both compose files).
