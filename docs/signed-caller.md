# Signed caller

Who is calling a service comes from the gateway. The gateway checks the person's sign-in, then passes them on. Before this, it passed them on only in `x-user-*` headers, and a service believed whatever those said. Anything on the compose network, an app's container included, could send them and act as anyone, an admin too.

Now the gateway also signs the caller. Every request it forwards carries `x-augur-caller`: a token with the person, their roles and departments, and the floor the gateway checked them onto. It is signed with the gateway's Ed25519 key, lasts a minute, and names one service as its audience, so a token sent to an app can't be replayed to identity.

## In a service

Add the service kit's hook before any route, with your service's name as the gateway reaches it (your app's id):

```ts
import Fastify from 'fastify';
import { callerCheckFromEnv, callerFromHeaders, signedCallers } from '@augur/service-kit';

const app = Fastify();
app.addHook('onRequest', signedCallers(callerCheckFromEnv('expenses')));

app.get('/v1/claims', async (req, reply) => {
  const caller = callerFromHeaders(req.headers); // only ever the person the gateway signed
  if (!caller) return reply.code(401).send({ error: 'unauthenticated', message: 'Sign in to see claims.' });
});
```

The hook drops every `x-user-*` header a request brings, the floor's kind and role, and the acting-app headers of a delegated caller (below). It puts back the caller from a valid signed token, so `callerFromHeaders` reads only what the gateway said. A request with a bad, expired or someone else's token gets 401. One with no token has no caller, which is how another service's own calls arrive: they prove who they are with their own sign-in, as before.

New apps made from augur-app-template have the hook already (the service kit's `appServer`). An app that hasn't added it keeps working, because the gateway still sends the plain headers beside the token, but it is trusting the network.

## Acting for a person: the delegated caller

Under the app contract (contract 3, ADR 0075) the shell's host makes an app's calls for the person, with the person's token and `x-augur-app: <id>`. The host sets it; the sandbox an app runs in has no network of its own, so nothing it says reaches the gateway except through the host. The gateway checks the app is on for the person on that floor and, for a call to one of AUGUR's APIs, that the call is within the app's grant, refusing one outside it with the scope it lacks ("Notes isn’t allowed to send notifications (notifications:send)"). It then signs the caller with two more claims, `app` (the app acting) and `scopes` (what it is granted on that floor):

- to the app's own part (`/api/<id>/*`), a **delegated caller**: signed for the app's own client `app-<id>` and lasting `APP_DELEGATION_SECONDS` (default 300) rather than a minute, because the part carries it on its own later calls for the person;
- to one of AUGUR's services, the usual one-minute caller for that service, with `app` and `scopes` beside the person. The service treats the call as the app's (`identifyServiceCaller` in the service kit: a service by its token, or an app acting for a person by the delegated caller alone) and applies the smaller of the two: the app's grant where the call is for, as for the app's own calls, and the scopes the delegation carries (`delegationRefusal`), refusing outside them in words that name the app, the scope and the person. Events (notifications, events, the Inbox), identity (people) and models (chat, to the app's own agent) do this; a route meant for the person alone is not reachable for an app, which the gateway's route table holds to.

A part checks its callers with the hook above, naming its client:

```ts
app.addHook('onRequest', signedCallers(callerCheckFromEnv('app-expenses')));
```

`callerFromHeaders` then gives the person with `app` and `scopes` beside them (`isDelegated`, `delegationAllows(caller, 'people:read')`), and a part applies the smaller of the two. When the part calls AUGUR for that person it sends its own app token (a client-credentials grant at `POST /api/identity/v1/token`, the only grant the gateway passes on to the sign-in service) and the delegated caller it received in `x-augur-delegation`; the gateway checks the delegation is for that app and still valid (`delegationCheck`), holds the call to the scopes the delegation carries as well as the app's grant, then signs a fresh one-minute caller for the target. No token for the person reaches a part.

An app's own token, with no delegation, is admitted only for an app the registry knows and has on ("Notes isn’t installed here", "Notes is turned off"), and only for the routes its grant covers, its own routes and its own registry entry; the caller the gateway signs then names the app (`app:<id>`, with `app` and `scopes`) and the app's own token goes on with the call, so a service still reads which app is calling the way it did before.

## AUGUR calling your part

AUGUR's own services reach each other inside the deployment, never through the gateway, with one exception: the events service pushes events to each subscribing app's inbound part (`POST /augur/events`, see docs/domain-events.md). That call carries a signed caller like any other, named after the service: `isServiceCaller(caller)` says it is AUGUR, and `serviceOfCaller(caller)` which service (`events`). No person's token is behind it, so `caller.roles` and `caller.departments` are empty; a part that needs a person refuses it.

## Where the key comes from

The gateway publishes its public key at `/api/gateway/v1/caller-keys`, with no sign-in needed. `callerCheckFromEnv` fetches it from `CALLER_KEYS_URL` when set (an app hosted outside the compose network sets this to `https://<your platform>/api/gateway/v1/caller-keys`), otherwise from `GATEWAY_URL` plus that path. `GATEWAY_URL` defaults to `http://gateway:8080`.

It fails closed. A service checks callers unless it is told plainly not to, so a container that lost a setting still believes only the gateway. It believes `x-user-*` headers as they come only:

- with `AUGUR_INSECURE_DEV_CALLERS=1`, which `pnpm dev:app` sets for the app's service, so the stand-in shell's person gets through;
- inside Vitest (`NODE_ENV=test` and `VITEST`, which it sets). `NODE_ENV=test` alone is not enough.

In production (`NODE_ENV=production`, which every image, every compose service and the app runner set, and `scripts/production-env.test.mjs` holds them to) it always checks, whatever else is set. Never put `AUGUR_INSECURE_DEV_CALLERS` in a deployment's `.env`: it does nothing there, and nothing passes it on.

The gateway makes a new key each time it starts. A service sees a key id it doesn't know and fetches the key again, so nothing needs restarting. More than one gateway behind a load balancer must sign with the same key: give each the same `CALLER_SIGNING_KEY` (`openssl rand -hex 32`, in `.env`), which also keeps the key the same across the gateway's restarts.

## From inside a container

A call from the service's own container (`localhost`) is believed as it comes. Only someone who can already run commands there can make one, and it is how a server admin acts when nobody can sign in, as in [deploy.md](deploy.md)'s command for removing an app.
