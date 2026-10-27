---
"@augur/service-kit": minor
---

A pull request's preview (`APP_PREVIEW=pr-<n>`, set by the app runner) says so in what it sends: `notify` puts "Preview #<n>:" before the title, and `recordAudit` adds `preview: <n>` to the entry's detail.
