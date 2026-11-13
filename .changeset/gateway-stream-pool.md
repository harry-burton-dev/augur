---
"@augur/gateway": minor
---

The events service's open streams get a pool of their own at the gateway, so open tabs never hold up its other calls, and calls to AUGUR's own services have a deadline that answers 504 naming the service (PLATFORM_CONNECT_TIMEOUT_MS, PLATFORM_RESPONSE_TIMEOUT_MS, PLATFORM_CONNECTIONS, PLATFORM_STREAM_CONNECTIONS).
