---
'@augur/service-kit': minor
'@augur/events': minor
'@augur/identity': minor
---

Apps hear more of what changes about people (PER-148). `platform.person.joined` when an admin adds someone, and `platform.person.changed` (`{ person, changed }`, naming which of `name`, `email`, `roles` and `teams` changed, never the values) when an admin changes their details. Every team someone joins or leaves is now `platform.team.member-added` or `-removed` on that team's floor, also when it happened by adding the person or changing their list of teams, which before sent nothing; each is in that floor's Activity too. `PLATFORM_TOPICS` names the two new topics. See docs/domain-events.md.
