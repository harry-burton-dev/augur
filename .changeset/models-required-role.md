---
'@augur/models': patch
---

Someone talking to an AI app's agent now needs the role that app's manifest asks for, as the gateway already holds the app's own API to it. Without it, models refuses the call and says which role is needed.
