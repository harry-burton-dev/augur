---
---

Every note under "Release notes that need you" in docs/upgrade.md now starts with the release it came in (`**From** augur@0.15.0`), so an admin can tell which apply to their server: before, 3 of 37 did. A new note says `**From** unreleased`, the Version packages pull request writes its release in, and `pnpm check:upgrade-notes` fails a note without one (PER-318).
