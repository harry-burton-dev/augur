# Surface 5 · The app owner’s view

**The moment:** Rui Costa owns Repairs tracker, an app the organisation runs on its Team floors. He sees where its notices went last week and what stopped them. Of 18 sends, 17 people were told. 41 people the notices named were never told: 40 because the app isn’t allowed to send on the Housing and Estates floor (the empty-homes list, every weekday at 09:30), and 1 because Planned works has team notices off.

**Today (docs/notifications.md):** a refused send fails with 403 and only the app’s service log says so (“check Admin, Apps”). There is no delivery view at all.

**Privacy rule used throughout:** an owner sees counts and routes, never who: not who muted the app, whose hours held a notice, or who hasn’t opened it. The one exception is whoever can change a block (a Department admin, a team lead), because that is an admin rule, not a person’s preference.

**Shared data and files:** see the grammar notes. The owner view reads the same routes as every other surface, filtered to the app.

---

## V1: Delivery report
*Idea.* A flow diagram in people, not notices. People it named (58) split into not allowed on this floor (40), team notices off (1) and delivered (17). Delivered splits into told live (9), held for quiet hours (4), on a “while you were out” card (2) and urgent (2). Those flow into seen (11) and not seen yet (6). Three plain findings sit underneath.

*Sources.* Sankey diagrams. Royal Mail tracking. Email delivery reports (delivered, bounced, opened).

*What works.* The proportion is the finding: most of the app’s reach was blocked, and the owner didn’t know. Counting people, not notices, is what makes the block’s size visible (5 sends, 40 people).

*What fails or risks.* Sankeys are hard for non-specialists. Flows that are a single person become hairlines. “Held” and “not seen” are normal routing, not faults, and the diagram can make them look like loss. The middle finding says so.

*Principles.* Explain, never hide: strong. Calm: the flows draw once.

*Needs.* Delivery and receipt counts per app from the events service.

*Scores.* Clarity 3 · Distinctiveness 4 · Feasibility 4 · Fit 4

## V2: Returned to sender
*Idea.* A dead letter office. Every send that reached nobody is grouped by reason, with when, how many people it would have reached, and who can change it (“Dana Whitfield, Head of Housing and Estates · Admin, Apps · Ask Dana”). Two softer entries follow: 5 sent without a key (a retry would tell everyone twice), and 1 delivered but opened by nobody.

*Sources.* The dead letter office. Bounce messages. Monitoring “dead letter queues”.

*What works.* It is the direct fix for the 403-only-in-the-log problem, and it is actionable: each entry has one button for the one person who can change it. The no-key entry turns a contract rule (ADR 0044 keys) into advice at the moment it matters.

*What fails or risks.* An “Ask Dana” button needs a request flow (an Inbox item for Dana with the reason), which is more Inbox items. Grouping by reason hides the timeline; V4 shows it.

*Principles.* Explain, never hide: the strongest of the six. Calm.

*Needs.* Recording refused sends in the events service (today they are only 403s). A request-to-allow Inbox item.

*Scores.* Clarity 5 · Distinctiveness 4 · Feasibility 5 · Fit 4

## V3: By kind of notice
*Idea.* One row per kind of notice (from the key’s first part: works order approvals, empty-homes list, contractor updates…). Each row has its levels, how many were sent, a bar of every person it named split by route, seen, acted (needs you only) and the median time to act.

*Sources.* Tufte’s small multiples. Email campaign reports.

*What works.* It tells the owner which kinds work. Works order approvals: 4 of 4 told live and acted, median 4 h 10 min. Emergency repairs: acted in 36 min. Empty-homes list: all 40 never told. Contractor updates are flagged “no key”. Using the key’s prefix as the kind means no new field for apps.

*What fails or risks.* Kinds only exist if apps use keys consistently. A free-form key prefix is a convention, not a contract. Small counts make the medians noisy.

*Principles.* Explain, never hide. Calm.

*Needs.* Either a `kind` field on notices, or a documented key convention (`<kind>:<id>`).

*Scores.* Clarity 5 · Distinctiveness 3 · Feasibility 5 · Fit 4

## V4: The week’s tape
*Idea.* Every send on one time line per kind, with the team’s off-hours shaded. Above it are three meters: urgency budget (1 of 2 this week, granted by Dana for “emergency repairs reported out of hours”), busiest hour against a proposed limit of 6 an hour per app per floor, and sends that reached nobody.

*Sources.* Ticker tape. Train graphs. EEMUA 191 alarm rate limits (the control room prompt).

*What works.* The rhythm shows things the tables don’t: the empty-homes list knocks every weekday at 09:30 and is turned away every time; contractor updates come in the evening and are held. The urgency budget becomes something an owner can watch spend, with what happens to a third one (sent as needs you, and it says why).

*What fails or risks.* The off-hours shading uses the team’s hours, but each person’s are different, so it is an approximation. The rate limit is a guess until the control room run sets one.

*Principles.* Calm. Explain, never hide: the budget’s grantor is named.

*Needs.* Urgency budgets per app per floor (ADR 0044 D4). A rate limit.

*Scores.* Clarity 4 · Distinctiveness 4 · Feasibility 4 · Fit 4

## V5: Floors and doors
*Idea.* The building in section: Org, Department, and the two teams under it. Each floor has a door for this app: open (allowed), shut (not allowed, with who can open it), or “the bell is off” (allowed, but team notices are off). Each send is a dot by its door, green if it went in and amber if it was turned away. Two suggestions sit beside it: ask Dana to open the door, or send lower, to each team that needs the list.

*Sources.* Architectural sections. Keying charts. The briefing run’s floors-as-a-section.

*What works.* It joins permission (ADR 0044’s `notifications:send` per floor) and team notices into one picture. “Send lower” is a real alternative the other variants miss: the open doors would do.

*What fails or risks.* With many teams it grows tall. Doors are a metaphor; the 403 is a permission. It doesn’t show people-level routing (by design).

*Principles.* Explain, never hide: shut doors stay visible with whom to ask. Calm.

*Needs.* A per-floor permission read for owners.

*Scores.* Clarity 4 · Distinctiveness 4 · Feasibility 4 · Fit 5

## V6: Dry run
*Idea.* Compose a notice (kind, level, address, time) and see every route before it is sent. The page also shows the `notify` call it would make with `dryRun: true`. The moment runs three: emergency repairs as needs you to the team at 19:00 (all held), then to the Department (reaches nobody, and why), then urgent to whoever is on call (Ana emailed now; if nobody takes it, Tom at 19:15 and Dana at 19:30).

*Sources.* The briefing run’s “reach before act”. The cinematic consequence preview. “Send test email” in mailing tools.

*What works.* An owner can find the 403 before shipping, not after. It makes the urgent budget’s cost concrete (“Uses 1 of 2 urgent this week”). People reached through a team aren’t named, only their route.

*What fails or risks.* It uses last week’s people and settings, so it predicts, it doesn’t promise. A dry run that reveals routes per person, even unnamed, could leak quiet hours on small teams. Keep it to counts when a team has fewer than 3 people.

*Principles.* Explain, never hide. Calm: nothing is sent.

*Needs.* `dryRun` on the events service’s notify endpoint.

*Scores.* Clarity 4 · Distinctiveness 4 · Feasibility 4 · Fit 4

---

## Ranking
1. **V2 Returned to sender**: fixes today’s silent 403.
2. **V3 By kind of notice**: the owner’s weekly table.
3. **V6 Dry run**: catches the block before shipping.
4. **V5 Floors and doors**.
5. **V4 The week’s tape**: once budgets and rate limits exist.
6. **V1 Delivery report**.

**What I’d build first.** Record refused sends in the events service, with the reason and who can change it, and show them in Admin, Apps, as “Returned to sender” (V2) with one Ask button. Then add per-kind counts (V3) and `dryRun` (V6). The other views are renderings of the same counts.
