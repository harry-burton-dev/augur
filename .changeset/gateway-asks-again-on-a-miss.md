---
'@augur/gateway': patch
---

The gateway serves a just-installed app within moments instead of up to 30 seconds later. It keeps three answers from the registry for 30 seconds: where apps' services are, each person's apps on a floor, and each app's grants. When the answer it has doesn't have the app someone is opening, it now asks the registry again, at most once every 2 seconds, and keeps "not installed" for only those 2 seconds, rather than saying "Nothing is served" or "That app isn't available to you" until the 30 seconds run out. Apps it already knows still use the kept answer, and a registry outage still keeps the last one.
