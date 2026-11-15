---
"@augur/events": minor
---

An event an app's part answers but can't take no longer holds every event behind it: it is tried up to DOMAIN_EVENTS_DELIVERY_ATTEMPTS times (5), DOMAIN_EVENTS_RETRY_SECONDS apart (30) and doubling, with later events on its topic waiting behind it while events on other topics go on, then set aside. What is set aside is kept, recorded in Activity as delivery.set-aside, and listed for admins by GET /v1/deliveries/set-aside; GET /v1/deliveries counts it (retrying, setAside). A part that is down (no answer, 401, 403, 404, 408, 429, 502 to 504, or server errors on two different events) still holds everything for up to a day, and the event then is set aside rather than passed over.

Not breaking: the route and fields are added; nothing is removed or renamed.
