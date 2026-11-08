---
"@augur/service-kit": minor
"@augur/events": minor
"@augur/identity": minor
"@augur/models": minor
"@augur/gateway": patch
---

AUGUR's services apply the smaller of a person's access and an app's scopes when an app acts for the person (contract 3, spec 8.5). The service kit's `identifyServiceCaller` tells a service who is calling, a service by its own token or an app acting for a person by the delegated caller the gateway signed, and `delegationRefusal` says in words when the delegation's scopes don't cover the call. Events (notifications, domain events, the Inbox), identity (people) and models (chat, to the app's own agent only) now take an app's call made for a person within the app's grant and the delegation's scopes, and refuse outside them naming the app, the scope and the person.
