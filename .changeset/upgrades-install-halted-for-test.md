---
'@augur/upgrades': patch
---

The Upgrade Centre can install a halted AUGUR release for a test on Workbench and Preview servers (ADR 0051). Beside a halted release, "Install … for a test" says why the publisher halted it, asks for a reason for the audit log, and follows the upgrade step by step; the watch judges it and AUGUR goes back by itself if it fails. On a Production server, or with a registry too old for it, the action stays visible and says why it can't be used.
