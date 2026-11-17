# Signed caller

Who is calling a service comes from the gateway. The gateway checks the person's sign-in, then passes them on. Before this, it passed them on only in `x-user-*` headers, and a service believed whatever those said. Anything on the compose network, an app's container included, could send them and act as anyone, an admin too.

Now the gateway also signs the caller. Every request it forwards carries `x-augur-caller`: a token with the person, their roles and departments, and the floor the gateway checked them onto. It is signed with the gateway's Ed25519 key, lasts a minute, and names one service as its audience, so a token sent to an app can't be replayed to identity.

## In a service

Add the service kit's hook before any route, with your service's name as the gateway reaches it (your app's id):

```ts
import Fastify from 'fastify';
import { callerCheckFromEnv, callerFromHeaders, signedCallers } from '@augur/service-kit';

const app = Fastify();
app.addHook('onRequest', signedCallers(callerCheckFromEnv('expenses'))); // on the app contract, 'app-expenses': callerAudienceOf(manifest)

app.get('/v1/claims', async (req, reply) => {
  const caller = callerFromHeaders(req.headers); // only ever the person the gateway signed
  if (!caller) return reply.code(401).send({ error: 'unauthenticated', message: 'Sign in to see claims.' });
});
```

The hook drops every `x-user-*` header a request brings, the floor's kind and role, and the acting-app headers of a delegated caller (below). It puts back the caller from a valid signed token, so `callerFromHeaders` reads only what the gateway said. A request with a bad, expired or someone else's token gets 401. One with no token has no caller, which is how another service's own calls arrive: they prove who they are with their own sign-in, as before.

New apps made from augur-app-template have the hook already (the service kit's `appServer`). An app's part gets only the signed token, never the plain `x-user-*` headers, so a part without the hook sees nobody signed in. AUGUR's own services still get the plain headers beside the token.

## Acting for a person: the delegated caller

Under the app contract (contract 3, ADR 0075) the shell's host makes an app's calls for the person, with the person's token and `x-augur-app: <id>`. The host sets it; the sandbox an app runs in has no network of its own, so nothing it says reaches the gateway except through the host. The host always names the floor the person stands on (`X-Workspace-Id`), and the gateway refuses such a call that names none with a 400. It checks the app is on for the person on that floor and, for a call to one of AUGUR's APIs, that the call is within the app's grant, refusing one outside it with the scope it lacks ("Notes isn’t allowed to send notifications (notifications:send)"). It then signs the caller with two more claims, `app` (the app acting) and `scopes` (what it is granted on that floor):

- to the app's own part (`/api/<id>/*`), a **delegated caller**: signed for the app's own client `app-<id>` and lasting `APP_DELEGATION_SECONDS` (default 300) rather than a minute, because the part carries it on its own later calls for the person;
- to one of AUGUR's services, the usual one-minute caller for that service, with `app` and `scopes` beside the person. The service treats the call as the app's (`identifyServiceCaller` in the service kit: a service by its token, or an app acting for a person by the delegated caller alone) and applies the smaller of the two: the app's grant where the call is for, as for the app's own calls, and the scopes the delegation carries (`delegationRefusal`), refusing outside them in words that name the app, the scope and the person. Events (notifications, events, the Inbox), identity (people) and models (chat, to the app's own agent) do this; a route meant for the person alone is not reachable for an app, which the gateway's route table holds to.

A call to a contract 3 app's part that no host makes for the app (a direct call to `/api/<id>/…` with a person's token, as the run suite makes) is signed for `app-<id>` too, so the same check admits it; it carries no `app` or `scopes`, because no app is acting. The gateway reads which contract an app is on from the registry's grants (`GET /v1/apps/:id/grants`, `contract`), and answers 503 while the registry can't say rather than sign for the wrong client.

A part checks its callers with the hook above, naming its client:

```ts
app.addHook('onRequest', signedCallers(callerCheckFromEnv('app-expenses')));
```

`callerFromHeaders` then gives the person with `app` and `scopes` beside them (`isDelegated`, `delegationAllows(caller, 'people:read')`), and a part applies the smaller of the two. When the part calls AUGUR for that person it sends its own app token (a client-credentials grant at `POST /api/identity/v1/token`, the only grant the gateway passes on to the sign-in service) and the delegated caller it received in `x-augur-delegation`; the gateway checks the delegation is for that app and still valid (`delegationCheck`), reads the app's grant on the floor the person stood on, which the delegation carries (a part that names another floor in `X-Workspace-Id` gets 400), checks the person is still on that floor and the app is still on for them there (turned off or blocked for them is refused with 403; their roles are the ones the delegation was signed with), holds the call to the scopes the delegation carries as well as the app's grant, then signs a fresh one-minute caller for the target. No token for the person reaches a part.

An app's own token, with no delegation, is admitted only for an app the registry knows and has on ("Notes isn’t installed here", "Notes is turned off"), and only for the routes its grant covers, its own routes and, on its own registry entry, reading its settings, grants and events, registering itself and giving it a version's frontend (anything else there, such as its scopes, floors or pin, needs an admin's platform scope); the caller the gateway signs then names the app (`app:<id>`, with `app` and `scopes`) and the app's own token goes on with the call, so a service still reads which app is calling the way it did before.

### The organisation

A caller can carry the claim `org`: the organisation's floor's id, which identity gives as `id` on `GET /v1/organisation`. `callerFromHeaders` gives it as `caller.org` (`x-user-org` for AUGUR's own services). It is what a call names in `X-Workspace-Id` for the whole organisation. A deployment has one organisation today, so the principal `org` means this one. The gateway signs it on every caller it passes on. It reads the id from identity in the background, so no call waits for it: a call made before identity first answers goes without `org`, and a failed read is tried again at the first call five seconds later. A known id is read again at the first call ten minutes after the last read, so a re-seeded identity is caught without restarting the gateway.

### Acting as an admin persona

While someone acts as an admin persona (ADR 0086, PDR-024 "Act as"), the shell sends `x-augur-persona: <id>` on their calls. On every call the gateway asks the permissions service whether that person has a live session for that persona (`POST /access/v1/persona-session`). If they do, the caller it signs carries the claim `persona` beside the person, whose id stays in `sub`, so both are recorded; `callerFromHeaders` gives it as `caller.persona` (`x-user-persona`). A session that has ended is refused with `persona_ended`, and the call is refused with 503 when the permissions service can't say. Only AUGUR's own frontends (the apps with platform scopes, ADR 0083: Admin and Deployment) carry the persona, and only to AUGUR's services; a call for any other app, or to an app's part, is refused while acting as one. A client can't claim a persona itself: like every caller header, `x-user-persona` and `x-augur-persona` are stripped before forwarding.

## AUGUR calling your part

AUGUR's own services reach each other inside the deployment, never through the gateway, with one exception: the events service pushes events to each subscribing app's inbound part (`POST /augur/events`, see docs/domain-events.md). That call carries a signed caller like any other, named after the service: `isServiceCaller(caller)` says it is AUGUR, and `serviceOfCaller(caller)` which service (`events`). No person's token is behind it, so `caller.roles` and `caller.departments` are empty; a part that needs a person refuses it.

One client from outside the deployment also reaches a platform service through the gateway: the fleet's machine client, `platform-fleet` (ADR 0100), which runs deployments from files. It reaches only the registry's routes that read and change what the server runs, and the gateway refuses it everywhere else. Its signed caller is `client:platform-fleet` (named `platform-fleet`), so `isServiceCaller(caller)` is false: it is not AUGUR. A service recognises it with `isFleetCaller(caller)`, and the registry holds it to the server's ring.

## Where the key comes from

The gateway publishes its public key at `/api/gateway/v1/caller-keys`, with no sign-in needed. `callerCheckFromEnv` fetches it from `CALLER_KEYS_URL` when set (an app hosted outside the compose network sets this to `https://<your platform>/api/gateway/v1/caller-keys`), otherwise from `GATEWAY_URL` plus that path. `GATEWAY_URL` defaults to `http://gateway:8080`.

It fails closed. A service checks callers unless it is told plainly not to, so a container that lost a setting still believes only the gateway. It believes `x-user-*` headers as they come only:

- with `AUGUR_INSECURE_DEV_CALLERS=1`, which `pnpm dev:app` sets for the app's service, so the stand-in shell's person gets through;
- inside Vitest (`NODE_ENV=test` and `VITEST`, which it sets). `NODE_ENV=test` alone is not enough.

In production (`NODE_ENV=production`, which every image, every compose service and the app runner set, and `scripts/production-env.test.mjs` holds them to) it always checks, whatever else is set. Never put `AUGUR_INSECURE_DEV_CALLERS` in a deployment's `.env`: it does nothing there, and nothing passes it on.

The gateway signs with `CALLER_SIGNING_KEY` (64 hex characters, `openssl rand -hex 32`, in `.env`). A deployment's gateway won't start without it, because a key it made up for itself would change at every restart and no second gateway could share it. The install preflight makes one (`--fill-secrets`), and an upgrade through Deployment makes one when `.env` hasn't got it. Every gateway behind a load balancer is given the same key. Only a gateway run outside production (without `NODE_ENV=production`, as in `pnpm dev:app` and tests) still makes a new key each start when it has none.

## Changing the key

The set at `/api/gateway/v1/caller-keys` can hold two keys: the one the gateway signs with, then the one that comes next. A service fetches the set at least once a minute, and again whenever a token names a key id it doesn't have, so a service believes a token signed with either key of the set within a minute of the gateway publishing it. To change the key without refusing a call:

1. Put the new key in `CALLER_SIGNING_KEY_NEXT` and run `pc up -d gateway`. Callers are still signed with the old key; the new one is only published.
2. Wait two minutes, so every service has fetched the set with both keys, then swap them: the new key into `CALLER_SIGNING_KEY` and the old one into `CALLER_SIGNING_KEY_NEXT`, then `pc up -d --force-recreate gateway` (the key reaches the gateway as a file, and Compose doesn't start it again for a changed file on its own). Tokens already signed with the old key keep working until they expire.
3. After `APP_DELEGATION_SECONDS` (five minutes unless set), the longest any signed caller lasts, empty `CALLER_SIGNING_KEY_NEXT` and run `pc up -d gateway` again.

A key you think has leaked is changed the same way, without waiting in step 3: anyone holding the old one can sign callers until it is gone from the set and a minute has passed.

## Break-glass

A call from inside a service's own container (`localhost`) is checked like any other: someone who can run commands there still can't act as a person by sending `x-user-*` headers. When AUGUR can't sign anyone in and an admin must act as someone, as in the command for [removing an app](src/content/docs/run/day-to-day.md#remove-an-app-from-the-catalogue), turn break-glass on for the time it takes:

1. Set `CALLER_BREAK_GLASS=on` in `.env` and run `pc up -d` (or `pc up -d <service>` for the one you need).
2. Make the call from inside that service's container. Each one it believes is written to the service's log as a warning ("break-glass"), with the id it named.
3. Remove `CALLER_BREAK_GLASS` from `.env` and run `pc up -d` again.

Break-glass never reaches past the container: a call from the compose network or an app's container is checked whatever it says. Apps' own parts never get it.
