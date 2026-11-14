---
"@augur/gateway": minor
---

AUGUR's services' open streams (any GET /v1/<resource>/stream) get a pool of their own at the gateway, so open tabs never hold up their other calls, and a service that has stopped answering is named in a 504 or 502 (GATEWAY_SERVICE_CONNECT_TIMEOUT_MS, GATEWAY_SERVICE_RESPONSE_TIMEOUT_MS, GATEWAY_SERVICE_CONNECTIONS, GATEWAY_STREAM_CONNECTIONS).
