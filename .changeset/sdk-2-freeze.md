---
'@augur/registry': patch
'@augur/contract-tests': patch
---

After SDK 2.0's release, Home, Admin and the Upgrade Centre ask for `^2.0.0`, and the contract tests keep the reference app built against 2.0 (`frozen/sdk-2.0`). The Lockfile workflow can keep a frozen build where no package token can make one (**freeze**).
