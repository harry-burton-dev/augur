---
"@augur/mfe-sdk": minor
"@augur/registry": minor
"@augur/service-kit": minor
---

Apps declare the kinds of notification they send in `notifications.kinds` (id, label, detail; up to 10), and `NotifyMessage` gains `kind` (SDK 1.13). The registry names them in an app's grants, and the service kit's `registryNotificationKinds` looks them up, so the events service can check them and people can choose each kind in Account.
