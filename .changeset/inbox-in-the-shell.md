---
'@augur/shell': minor
---

The Inbox in the shell (ADR 0026, PER-146): a function after Find whose label carries the count ("Inbox 3"), and a view with For you, Your teams and Done. Each row says which app and kind it's from, what it's about and when it's due, with Open (raising the item's intent, or opening its app at its path, on its own floor) and a menu to take it, give it back, hand it on to a person or team, decline it with a reason, or mark it done where the app allows. Anything that can't be done stays, disabled, saying why. Home lists the first five open items on its floor above the notifications that need you. The count and the list stay live from the notification stream's `inbox` events.
