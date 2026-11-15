---
'@augur/shell': minor
---

The front door believes a caller's address (X-Forwarded-For) only from `TRUSTED_PROXIES`, a new optional setting: the proxy in front's addresses or ranges. Unset, it is the private ranges and loopback it always believed.
