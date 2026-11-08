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

The hook drops every `x-user-*` header a request brings, and the floor's kind and role. It puts back the caller from a valid signed token, so `callerFromHeaders` reads only what the gateway said. A request with a bad, expired or someone else's token gets 401. One with no token has no caller, which is how another service's own calls arrive: they prove who they are with their own sign-in, as before.

New apps made from augur-app-template have the hook already (the service kit's `appServer`). An app that hasn't added it keeps working, because the gateway still sends the plain headers beside the token, but it is trusting the network.

## Acting for a person: the delegated caller

Under the app contract (contract 3, ADR 0075) a call the shell makes for an app, and a call an app's part makes onward for the same person, carries a **delegated caller**: the same signed token with two more claims, `app` (the app acting) and `scopes` (what it is granted on that floor), signed for the app's own client `app-<id>` and lasting `APP_DELEGATION_SECONDS` (default 300) rather than a minute. A part checks it with the hook above, naming its client:

```ts
app.addHook('onRequest', signedCallers(callerCheckFromEnv('app-expenses')));
```

`callerFromHeaders` then gives the person with `app` and `scopes` beside them (`isDelegated`, `delegationAllows(caller, 'people:read')`). A service that receives a delegated caller applies the smaller of the person's access and the app's scopes. When the part calls AUGUR for that person it sends its own app token and the delegated caller it received in `x-augur-delegation`; the gateway checks the delegation is for that app and still valid (`delegationCheck`), then signs a fresh one-minute caller for the target. No token for the person reaches a part.

## Where the key comes from

The gateway publishes its public key at `/api/gateway/v1/caller-keys`, with no sign-in needed. `callerCheckFromEnv` fetches it from `CALLER_KEYS_URL` when set (an app hosted outside the compose network sets this to `https://<your platform>/api/gateway/v1/caller-keys`), otherwise from `GATEWAY_URL` plus that path. `GATEWAY_URL` defaults to `http://gateway:8080`.

It fails closed. A service checks callers unless it is told plainly not to, so a container that lost a setting still believes only the gateway. It believes `x-user-*` headers as they come only:

- with `AUGUR_INSECURE_DEV_CALLERS=1`, which `pnpm dev:app` sets for the app's service, so the stand-in shell's person gets through;
- inside Vitest (`NODE_ENV=test` and `VITEST`, which it sets). `NODE_ENV=test` alone is not enough.

In production (`NODE_ENV=production`, which every image, every compose service and the app runner set, and `scripts/production-env.test.mjs` holds them to) it always checks, whatever else is set. Never put `AUGUR_INSECURE_DEV_CALLERS` in a deployment's `.env`: it does nothing there, and nothing passes it on.

The gateway makes a new key each time it starts. A service sees a key id it doesn't know and fetches the key again, so nothing needs restarting. More than one gateway behind a load balancer must sign with the same key: give each the same `CALLER_SIGNING_KEY` (`openssl rand -hex 32`, in `.env`), which also keeps the key the same across the gateway's restarts.

## From inside a container

A call from the service's own container (`localhost`) is believed as it comes. Only someone who can already run commands there can make one, and it is how a server admin acts when nobody can sign in, as in [deploy.md](deploy.md)'s command for removing an app.
