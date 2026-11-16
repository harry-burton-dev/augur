---
"@augur/registry": patch
"@augur/gateway": patch
---

An app can no longer act as the admin who opened it on the registry's admin routes. A call made for an app passes no admin or deployment-admin check unless the app is one of AUGUR's own frontends (it carries a platform scope), and the gateway lets an app call its own registry entry without a scope only to read it, register itself and give it a version's frontend. Changing its own scopes, floors, upload limit, pin or entry, or removing it, needs the admin scope as for any other app.
