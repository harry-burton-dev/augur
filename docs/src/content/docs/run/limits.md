---
title: Limits and health
description: The limits AUGUR holds callers, containers and queries to, and how each part says it's healthy.
status: beta
checkedAgainst: 0.24.0
sidebar:
  order: 9
---

AUGUR's limits keep one caller, one app or one slow query from holding up everyone else. Each is set in
`.env` and applied by `pc up -d`. The defaults suit a server of the size in
[Install AUGUR](../install/#before-you-start).

## Limits at the front door

The front door (`web`) holds every caller to a few limits:

- **Keycloak's own console is closed.** `/sso/admin` and the `master` realm (which holds Keycloak's own admin)
  answer 404, so nobody on the network can try its admin password. To change realm settings by hand, set
  `KEYCLOAK_CONSOLE=open`, run `pc up -d`, make the change, then remove it and run `pc up -d` again.
- **Requests a second from one address.** The API takes `API_RATE_PER_SECOND` (30), with `API_RATE_BURST`
  (200) let through at once, since a page fires many calls together; sign-in takes `SSO_RATE_PER_SECOND` (10)
  with `SSO_RATE_BURST` (50). Past them the answer is 429, *Too Many Requests*. The address is the one the
  proxy in front saw, passed on in `X-Forwarded-For` and only believed from private addresses.
- **The largest upload**, `MAX_UPLOAD_MB` (2048). Each app has its own lower limit under it.
- **Calls to apps' parts.** The gateway waits `APP_CONNECT_TIMEOUT_MS` (5000) to reach an app's part and
  answers 502 when it can't. A part gets `APP_RESPONSE_TIMEOUT_MS` (60000) to start answering, and the same
  between one piece of its answer and the next, after which the gateway answers 504 and lets the connection
  go. One app may have `APP_CONCURRENT_CALLS` (64) calls in flight, the next answering 503 until one finishes.
  Each refusal names the app. AUGUR's own routes are never held by an app's limits.
- **Calls to AUGUR's own services.** The gateway keeps `GATEWAY_SERVICE_CONNECTIONS` (128) connections to each of
  AUGUR's services for ordinary calls. Their open streams (any `GET /v1/<resource>/stream`; each open tab holds two
  to the events service) have `GATEWAY_STREAM_CONNECTIONS` (4096) a service of their own, so a full office of open
  tabs never holds up the other calls. The gateway waits `GATEWAY_SERVICE_CONNECT_TIMEOUT_MS` (5000) to reach a
  service and answers 502 naming it when it can't; a service gets `GATEWAY_SERVICE_RESPONSE_TIMEOUT_MS` (300000) to
  start answering, and the same between one piece of its answer and the next, after which the gateway answers 504
  naming the service. It never cuts an open stream. Keep it above the services' own limits, such as
  `MODEL_TIMEOUT_SECONDS`, so a service's own words come first. The front door is the first limit on streams:
  each open stream uses two of its connections, and it holds 1,024 a CPU core, so about 250 tabs a core.
- **An app's own sign-in** (`POST /api/identity/v1/token`, where a part fetches its token with its client
  secret) is held to the sign-in rate above, not the API's.

## Logs, memory and health

- **Logs** are kept by Docker, at most three files of 10 MB per container (`LOG_MAX_SIZE`, `LOG_MAX_FILES`),
  so they can't fill the disk. `pc logs` reads them. For anything longer, look in the deployment's Grafana,
  which keeps 72 hours ([Observability](https://github.com/harry-burton-dev/augur/blob/main/docs/observability.md)).
- **Memory limits** on the containers that can take a lot: Keycloak (`KEYCLOAK_MEM_LIMIT`, 2g; it sizes its
  Java heap from it) and the observability stack (`OTEL_LGTM_MEM_LIMIT`, 2g), so a runaway container is
  restarted on its own instead of pushing AUGUR out. `pc ps` shows it restarting. Raise the limit and run
  `pc up -d` if it keeps happening; a server with 16 GB fits the defaults with room to spare.
- **Telemetry** goes over a network of its own: AUGUR's services send to `otel-lgtm` on it, and apps the runner
  installs aren't on it, so they can't reach `otel-lgtm` at all. Loki, Tempo and Prometheus answer only inside
  that container, to Grafana, so nothing on the networks can read what the services logged.
- **Health**: every AUGUR service, the front door, Postgres, Keycloak and Garage have a healthcheck, and
  `pc ps` shows each as `healthy`. Keycloak's is its own readiness check on its management port, which isn't
  reachable from outside the container. The front door, identity and the realm job wait for Keycloak to be
  healthy, and the storage job for Garage. Keycloak's first start after an upgrade can take a few minutes while
  it migrates its database; Compose waits up to five.
- **Ready, and stopping cleanly**: each AUGUR service answers `/readyz` only while its database (and, for
  permissions, OpenFGA) answers, and its healthcheck asks that, so `pc ps` shows `unhealthy` while a service
  can't reach what it needs. `/healthz` still says what is running. When Docker stops a service, as an upgrade
  does, it stops taking new calls, ends its open event streams (browsers open them again on their own), and
  lets the calls already in flight finish for up to `SHUTDOWN_GRACE_SECONDS` (20) before it cuts what is left.
  Docker waits 30 seconds (`stop_grace_period`), so a setting above 23 counts as 23: the rest is for closing
  its database connections and sending its telemetry.
- **Timeouts between services**: one AUGUR service waits at most 5 seconds for another
  (`SERVICE_CALL_TIMEOUT_SECONDS`) before it answers that the other can't be reached right now, so a hung
  service slows only what needs it. Identity waits up to 15 seconds for Keycloak's admin API, and calls to the
  model gateway up to 3 minutes. Raise it only if `pc logs` shows a slow but working server giving up.
- **Query time limits**: Postgres cancels any one query from an AUGUR service after a minute
  (`DATABASE_STATEMENT_TIMEOUT_SECONDS`; 0 for no limit), so a query stuck on a lock or a bad plan fails its
  request instead of holding a connection until the service runs out. Migrations are never limited.
- **Pages of the knowledge graph**: a read that lists, such as the entities in sight from a floor, gives at
  most `KNOWLEDGE_PAGE_LIMIT` (100) a page whatever it asks for, and says when it cut a page shorter. Callers
  page on with the cursor each answer gives. A subgraph, what links to an entity, goes at most
  `KNOWLEDGE_SUBGRAPH_DEPTH` (3) hops from it, and says when it stopped short.
- **Knowledge graph summaries**: with models turned on, the knowledge graph writes each floor's summary of an
  entity from that floor's own beliefs, once they have been quiet for `KNOWLEDGE_REFLECT_DEBOUNCE_SECONDS`
  (600). It writes at most `KNOWLEDGE_REFLECT_DAILY_BUDGET` (400) a day for the deployment and
  `KNOWLEDGE_REFLECT_FLOOR_BUDGET` (100) for any one floor; what waits is shown as older than its beliefs,
  never hidden. Each summary is a call to the models service, counted against its daily limit with
  extraction, so keep the daily budget under that limit (Admin → Models). As a guide, 2,000 people retaining
  six texts a day each need about 85,000 summaries and 12,000 extractions a day: raise the models limit to its
  highest, 100,000, and the daily budget to 85,000. A floor where models are refused shows its entities'
  beliefs without a summary.
