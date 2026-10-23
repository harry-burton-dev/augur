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

New apps from `pnpm create-app` have the hook already. An app that hasn't added it keeps working, because the gateway still sends the plain headers beside the token, but it is trusting the network.

## Where the key comes from

The gateway publishes its public key at `/api/gateway/v1/caller-keys`, with no sign-in needed. `callerCheckFromEnv` fetches it from:

- `CALLER_KEYS_URL`, when set. An app hosted outside the compose network sets this to `https://<your platform>/api/gateway/v1/caller-keys`.
- Otherwise, in production (`NODE_ENV=production`, which every image sets), `GATEWAY_URL` plus that path. `GATEWAY_URL` defaults to `http://gateway:8080`.
- Otherwise (local dev and tests), nothing is checked and `x-user-*` headers are believed, as `pnpm dev:app` sends them.

The gateway makes a new key each time it starts. A service sees a key id it doesn't know and fetches the key again, so nothing needs restarting. More than one gateway behind a load balancer must sign with the same key: give each the same `CALLER_SIGNING_KEY` (`openssl rand -hex 32`).

## From inside a container

A call from the service's own container (`localhost`) is believed as it comes. Only someone who can already run commands there can make one, and it is how a server admin acts when nobody can sign in, as in [deploy.md](deploy.md)'s command for removing an app.
