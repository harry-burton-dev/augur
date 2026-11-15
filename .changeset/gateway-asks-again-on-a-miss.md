---
'@augur/gateway': patch
---

The gateway serves a just-installed app within moments instead of up to 30 seconds later. When someone opens an app the gateway's last answer from the registry doesn't have, it asks the registry again, at most once every 2 seconds, rather than saying "Nothing is served" until its cached answer runs out. Apps it already knows still use that answer, and a registry outage still keeps the last one.
