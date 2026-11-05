---
"@augur/events": minor
"@augur/identity": minor
"@augur/service-kit": minor
"@augur/shell": minor
---

Choosing notifications per kind (ADR 0036). The events service keeps a notification's `kind` and refuses one the app's manifest doesn't declare (migration 008). Identity's preferences keep `quietKinds` (`<app>:<kind>`). Account, Notifications lists each app's kinds, On Home or Quiet, and the shell lands a quiet kind in the stream without a pulse, uncounted, off Home and with no toast (Aerie 0.7.0). The service kit's `NewNotification` and `AppNotice` take `kind`.
