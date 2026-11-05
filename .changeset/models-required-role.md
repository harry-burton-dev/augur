---
'@augur/models': patch
---

Someone talking to an AI app's agent now needs the role that app's manifest asks for, the same rule the gateway applies to the app's own API. Without it, models refuses the call and says which role is needed.
