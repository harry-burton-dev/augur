---
"@augur/updater": patch
---

The app runner takes a backup before an app's first release from another repository, such as an app moving into its own (ADR 0047). That release takes over the data the old one left. The install's first step names the backup file. Later releases from that repository install as before.
