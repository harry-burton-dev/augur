# Surface 6 · Digests

**The moment:** the daily and weekly roll-up as an edition, made at each person’s start of day (their `digest` time) from what arrived since their previous edition. An edition gathers what waits on you (open needs you), what came overnight (held by quiet hours), what is for the record, what was done, today’s rota and cover, and which apps had nothing to say.

**Shared data and files:** see the grammar notes. `edition(person, time)` in `lib.js` builds every edition from the routes, so an item appears in an edition only if the rules put it there.

**Proposals in this surface:** an edition at each person’s start; a weekly for the team lead; an emailed copy through the organisation’s relay (ADR 0035; ADR 0044 D7 recommends a daily email digest for people who are away); and info that never pulses, only waits for the edition.

---

## V1: The front page
*Idea.* Tom Ashby’s morning edition on Thursday at 08:30 as a newspaper front page. The lead story is what waits on him (“Two things wait for you this morning”), each with its limit and who the policy asks next if he doesn’t take it. The middle column has overnight, today (Ana on call; Owen away, Leila covers) and done since yesterday. The right column has for the record, items from apps he muted, and “Nothing from Data Atlas, Upgrade Centre: checked 08:30”. The footer gives the reading time (about 56 seconds) and the next edition.

*Sources.* Newspaper front pages. BLUF. The daily intelligence brief.

*What works.* It reads in under a minute and in the right order: what needs you, what happened, what didn’t. The lead story’s “if you don’t take it, the policy asks Dana Whitfield, Thu 10:55” puts escalation where it matters, at the start of the day. Muted apps still appear, quietly, so mute never makes things disappear.

*What fails or risks.* The masthead takes a fifth of the screen; on Home it would be one line. Three columns at 1280 wrap long titles.

*Principles.* Explain, never hide: honest blanks for silent apps. Calm: it sets once a day. Dark when normal: an empty edition is one line.

*Needs.* An edition time per person. A “checked” signal per app (the events service knows it was listening).

*Scores.* Clarity 5 · Distinctiveness 4 · Feasibility 4 · Fit 5

## V2: The weekly
*Idea.* The team lead’s Friday 16:00 edition: 13 things needed someone on the team, 8 were taken by the first person asked, 2 climbed the policy and 2 went to a cover. Then the two stories that climbed with who stepped in, what is still open going into next week (Mei’s plan, held until Monday 09:00), what was meant for the team but never sent, who carried the week (per-person counts by class), and next week’s rota.

*Sources.* Weekly news magazines. Shift handover reports.

*What works.* It gives the lead the routing week in one page, including the failures the team never saw (the empty-homes list blocked five times). The stories show the path person by person, which is the evidence a lead needs to adjust the rota or the policy.

*What fails or risks.* “Who carried the week” shows per-person load to the lead. That is useful for fairness, but it is surveillance if it ever shows response times. Keep it to counts of what reached people, never how fast they answered.

*Principles.* Explain, never hide. Calm.

*Needs.* A team-scope read of routes for the lead (counts only).

*Scores.* Clarity 4 · Distinctiveness 4 · Feasibility 4 · Fit 4

## V3: By email
*Idea.* The same 08:30 edition as Tom receives it by email from the organisation’s relay (“AUGUR at Westbrook District Council”): titles and “Open in AUGUR” links only. A side panel says what the email leaves out and why (details, actions, anything you can’t open, urgent), and that reading the email marks nothing as seen. E shows the relay switched off: email isn’t set up, so the emailed edition is unavailable and says whom to ask.

*Sources.* ADR 0035 (relay) and 0041 (templates follow the sign-in theme). Plain-text newsletters.

*What works.* It draws the line for email: **the email is a pointer, not a copy.** That keeps restricted titles and actions inside AUGUR, and keeps receipts honest: only opening in AUGUR counts as seen. The relay-off state follows ADR 0035’s “every screen that would send email says so and falls back”.

*What fails or risks.* Titles can themselves be sensitive (“Disciplinary hearing, J. Smith”). The rule should be per-library: some libraries send “1 item” instead of the title. People may want to act from email; this says no, deliberately.

*Principles.* Explain, never hide: what’s left out is listed. Calm: one email a day at most.

*Needs.* Edition templates in the events service, through the relay. A per-library “title in email” setting.

*Scores.* Clarity 5 · Distinctiveness 3 · Feasibility 5 · Fit 4

## V4: The rhythm
*Idea.* The team’s week of editions on one chart: a dot at each person’s start time, sized by what’s in it; a dashed ring when there’s nothing (and it says so); a hatched dot when the person is away (held for the card); a square for the lead’s weekly; and a red line for the only thing that breaks the rhythm, urgent. Click any edition to read it.

*Sources.* Newspaper editions. Shipping forecast times. Train timetables.

*What works.* It shows that the rhythm is predictable, which is what makes editions trustworthy: news comes at your start, every working day, and only urgent comes between. It also surfaces the fair-load question: Tom’s Thursday edition is the biggest.

*What fails or risks.* It is a designer’s or admin’s view; people only need their own next edition. Dot size encodes count, which Isotype would forbid. Counts in the dot would be better.

*Principles.* Dark when normal: empty editions are visible as empty. Calm.

*Needs.* Nothing beyond editions.

*Scores.* Clarity 4 · Distinctiveness 4 · Feasibility 4 · Fit 4

## V5: The ledger
*Idea.* Leila Haddad’s Wednesday 07:30 edition as counted lines: waiting on you (0), then every app since your last edition with its count, including the zeros (“Repairs tracker: checked, nothing for you · 0”), then today (on call: 0; you cover Owen Price until Mon 2 Nov: 1), and a total. ← → moves through her week.

*Sources.* Double-entry ledgers. The shipping forecast’s fixed order (every area, every time). Military “nothing to report” returns.

*What works.* It is the honest blank made into a format: every source is entered every day, so “nothing” is a checked zero, not a broken pipe. It is the most compact edition (about 23 seconds to read), and it tells Leila the one thing that matters this morning: she covers Owen from today.

*What fails or risks.* Zeros for five apps is noise on most days. Fold them into one line (“Nothing from 4 apps, checked 07:30”) unless one has been silent longer than usual.

*Principles.* Explain, never hide: the strongest of the six. Dark when normal.

*Needs.* Per-app “listening” status in the events service.

*Scores.* Clarity 4 · Distinctiveness 4 · Feasibility 5 · Fit 4

## V6: The team bulletin
*Idea.* One shared Friday edition for everyone on Estates repairs, on a noticeboard: asked of the team (28: 13 needs you, 7 tell me, 8 for the record), handed on (3), who stepped in (with the path person by person), carried into next week, next week’s rota, meant for us but never sent, and the rules this week (the policy, generated from its settings). Nobody’s hours, mutes or editions appear.

*Sources.* Ward noticeboards. Parish newsletters. Shift handover boards.

*What works.* It makes routing a shared, visible practice rather than a private setting: the team sees the policy, the rota and who covered whom, every week. “The rules this week” means a policy change can’t go unnoticed.

*What fails or risks.* Credit by name (“who stepped in”) can be welcome or awkward. It is the team’s choice whether the bulletin names people or only counts.

*Principles.* Explain, never hide. Calm: weekly.

*Needs.* A team edition, addressed with `toTeam` (team notices on).

*Scores.* Clarity 4 · Distinctiveness 4 · Feasibility 4 · Fit 4

---

## Ranking
1. **V1 The front page**: the morning edition on Home.
2. **V3 By email**: the same edition as a pointer, through the relay.
3. **V5 The ledger**: its honest blanks folded into V1.
4. **V2 The weekly**: for team leads.
5. **V6 The team bulletin**: the shared version of V2.
6. **V4 The rhythm**.

**What I’d build first.** One edition per person at their start of day, on Home: waiting on you, overnight, for the record, nothing from. It goes with the change that makes it necessary: info never pulses and waits for the edition. The emailed copy (titles and links, via the relay) is the same template, and it is ADR 0044’s D7 for people who are away.
