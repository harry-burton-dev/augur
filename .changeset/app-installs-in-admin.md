---
"@augur/registry": minor
"@augur/admin": minor
---

Admin → Apps installs apps from their releases and keeps them up to date: the registry reads app releases every 15 minutes, lists those not installed with what each asks for, and for each installed app follows stable or beta releases, Automatic (fixes and features that ask for nothing new install by themselves), Ask first or Hold. Versions that wait for an admin show under Needs you with why, and each install and removal is followed step by step.
