---
'@augur/registry': patch
'@augur/updater': patch
'@augur/events': patch
'@augur/models': patch
---

Every deployment setting is described once, in infra/deploy/settings.schema.json, and CI checks compose.yml, .env.example, the guides and the services' code against it (`pnpm check:settings`). Settings the guides named but compose never passed now reach their services: FEED_SIGNER (registry), IMAGE_SIGNER, IMAGE_SIGNER_ISSUER and AUGUR_DEV_SIGNER (updater), DOMAIN_EVENTS_KEEP_DAYS (events), MODEL_TIMEOUT_SECONDS (models), CALLER_SIGNING_KEY (gateway), and OTEL_EXPORTER_OTLP_HEADERS, OTEL_TRACES_SAMPLER and OTEL_TRACES_SAMPLER_ARG (every service). An empty DOMAIN_EVENTS_KEEP_DAYS or MODEL_TIMEOUT_SECONDS keeps its default, and AUGUR_DEV_SIGNER follows the repository a fork's IMAGE_SIGNER names.
