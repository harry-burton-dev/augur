---
"@augur/storage": minor
"@augur/updater": minor
---

Each app gets a database of its own (`app_<id>`), owned by its login and the only one it reaches through the apps’ relay, instead of a schema in AUGUR’s. Setting an app aside renames its database and dropping it drops the database. While an app installed the old way is still installed, the storage step stops and names it, so the release doesn't start until it is removed. Part of PER-456.
