---
'@augur/mfe-sdk': minor
'@augur/registry': minor
'@augur/service-kit': minor
'@augur/events': minor
---

Apps declare the kinds of work they put in people's inboxes in their manifest's `inbox.kinds` (SDK 1.12: `id`, `label`, `icon`, up to 10), and the events service refuses an item of a kind the app doesn't declare. The registry names them in an app's grants (`inboxKinds`), read with `registryInboxKinds` from the service kit. The SDK gains the Inbox's types (`InboxItem`, `InboxKind`, `InboxCounts`, `InboxChange`) and `INBOX_TOPICS`.
