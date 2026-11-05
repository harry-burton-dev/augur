---
'@augur/service-kit': minor
'@augur/registry': patch
---

The registry tells AUGUR's services the role an app's manifest says a person needs (`requiredRole` in an app's grants), and the service kit reads it (`registryRequiredRole`), so models can check it for an AI app as the gateway does for the app's own API.
