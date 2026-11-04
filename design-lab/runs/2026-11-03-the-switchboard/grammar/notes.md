# Surface 1 · Routing sheet (grammar)

**The moment:** one notice, “Sign off the winter damp survey plan” (Mandate, needs you, to Owen Price by name, limit Wed 12:00), lights up each word of the grammar in turn. Owen goes away, Leila Haddad covers, nobody takes it by the limit, Ana Ruiz (on call) passes it on with a note, and Tom Ashby (team lead) takes it.

**Shared data, one object (`DATA`) for the whole run:** one week (26 Oct to 1 Nov 2026) of Westbrook District Council’s Estates repairs team (Team floor) inside Housing and Estates (Department floor). There are five people on the team, plus the Department lead (also its admin), the deployment admin, the owner of a Repairs tracker app, and the lead of Planned works. There are 41 notices from five apps. Each notice records only what people did (opened, took it on, passed it on, acted). `lib.js` works out the rest from the rules in `DATA`: who is told, on which channel, when, what held it, the receipts and every escalation step. That gives 54 times someone was told, 7 notices stopped before anyone was told, 9 held, 15 into editions and 2 urgent. No page types a route by hand.

**Keys on every page:** R replays, T shows the technical words (two registers). Each page has its own keys, shown in the top bar.

**Files:** every page in this run is built by `../_src/build.py` from `../_src/common.css`, `../_src/data.js`, `../_src/lib.js` and `../_src/<surface>/v*.src.html`. The built pages link the kit as the brief says.

---

## V1: Eight words
*Idea.* A reference sheet that names the eight words (event, notice, Inbox item, class, channel, quiet, receipt, escalation). For each it gives a mark, a plain meaning, and where it lives today: the ADR it maps to and whether it is in AUGUR, proposed, or needs a record. Beside it, one notice passes through all eight, so each definition has a concrete example.

*Sources.* ADR 0026, 0035 and 0044, and the domain events guide. The cinematic run’s shot list (a named vocabulary first). Royal Mail service classes. PagerDuty escalation policies.

*What works.* It is the honest map of what exists and what doesn’t. Event, notice and channel are built. Class, receipt and escalation are not, and the sheet says so in one column. The tally at the foot (41 notices, 54 deliveries, 9 held, 7 stopped) shows the grammar covers a whole real week, not one example.

*What fails or risks.* It is a document, not a tool, and works best as a page in docs/notifications.md. “Class” is a new word that people may not need to see: in the product it may stay the shell’s word, while people see “Needs you”, “Tell me” and “For the record”.

*Principles.* Explain, never hide: strong, because it marks what isn’t built. Calm: it lights once. No letterbox.

*Needs.* Nothing beyond the run’s shared proposed tokens.

*Scores.* Clarity 5 · Distinctiveness 3 · Feasibility 5 · Fit 4

## V2: Classes of post
*Idea.* The four classes as postal classes, side by side: Urgent (special delivery), Needs you (recorded delivery), Tell me (first class), For the record (second class). Each row is one question: which level, what quiet does, what away does, what mute does, which receipt is kept, what happens if nobody acts, and who may send it. Last week’s notices drop into their class as ticks. A hatched tick means it was held for at least one person.

*Sources.* Royal Mail classes and recorded delivery. ADR 0044 levels. The room tone run’s “the shell owns loudness”.

*What works.* It turns ADR 0044’s levels into a contract a person can read, and makes one strong proposal visible: **For the record never pulses.** Today every level pulses the band once (ADR 0044). In this run, info goes to the list and the next edition only. Last week that kept 15 deliveries from interrupting anyone. It also shows the asymmetry that matters most: mute can never silence urgent, because an admin granted the budget.

*What fails or risks.* Postal names (“second class”) can read as “less important” rather than “less urgent”. Keep them as the analogy in docs, not as labels. Urgent has 2 ticks, so the class is rare enough to be trusted, but only if the budget holds.

*Principles.* Calm: the class decides loudness, never the app (shell owns loudness). Explain, never hide: the “can’t be muted” cell says who granted it.

*Needs.* An `urgent` flag (ADR 0044 D3), and a change to ADR 0044 so that info doesn’t pulse.

*Scores.* Clarity 5 · Distinctiveness 4 · Feasibility 4 · Fit 5

## V3: The exchange
*Idea.* An operator’s switchboard. Apps are jacks on the left and people are lamps on the right. In the middle are the operator’s rules, tried in order. Every delivery is a cord from an app, through the rule that decided it, to a person, and a stopped notice is a cord that ends at its rule. Keys 1 to 7 pick a day. Lamps show lit (told live), hatched (held), red (urgent), plus “on call”, “away” and “off” tags.

*Sources.* Cord switchboards and the busy lamp field. Exchange operator practice (“hold the line”, transfer).

*What works.* It is the only view where you see the rules as a funnel: on Wednesday, 7 cords pass through “Told live”, 3 through “Away”, 3 through “For the record” and 1 through “Not allowed on this floor”. A cord sent on Tuesday that asks someone on Wednesday (the survey plan) shows up on Wednesday with an asterisk, which is the honest way to show escalation in a day view.

*What fails or risks.* At more than about 15 cords a day it turns to spaghetti. A real Org floor would need grouping by app or by rule. It is a picture for admins and designers, not for people. Cords crossing the rule boxes need the opaque key background, or the text is struck through.

*Principles.* Explain, never hide: strong (stopped cords stay visible). Calm: the cords plug in once. Focus: hover dims the other cords, without blur.

*Needs.* Nothing new beyond the route data the run proposes.

*Scores.* Clarity 3 · Distinctiveness 5 · Feasibility 3 · Fit 4

## V4: The rulebook
*Idea.* The routing rules as an ordered rulebook, first match wins, like mail filters or a firewall chain. Each rule says when it applies, what it does, and whose setting it is. A test bench beside it runs any notice from last week for any person it reached. It walks down the rules, says why each one did or didn’t apply, and stops at the one that decided.

*Sources.* Email filter rules (Sieve, Outlook rules). Firewall chains. The sorting office’s order of checks.

*What works.* It is the most precise specification in the run, and the one an engineer would build from. Order matters, and the bench makes that visible: Ana’s “Contractor finished” at 18:40 passes rules 1 to 7 and stops at Quiet hours. It also documents the important orderings: urgent comes before away and mute, and mute comes before For the record.

*What fails or risks.* A first-match list hides interactions. A person can be both away and muted, and only “away” shows. People won’t read nine rules: this is for admins and the docs.

*Principles.* Explain, never hide: every rule names its owner. Calm: nothing moves.

*Needs.* The rule order as a single function in the events service, with the trace returned for “why” views.

*Scores.* Clarity 4 · Distinctiveness 3 · Feasibility 5 · Fit 3

## V5: The life of a notice
*Idea.* A state diagram: raised, routed, held, told, seen, taken, acted. The side doors are stopped, passed on, asked next and stood down. Each state says what the person sees and what the sender sees, with last week’s count. Below it, the survey plan’s four people step through told, seen, taken and acted, so you can see that everyone saw it and only one person took it.

*Sources.* Recorded delivery (signed for). The room tone run’s question and answer (acknowledge is not resolve). Air traffic handoff.

*What works.* It makes the run’s most important rule visible: **seen is not taken, and taken is not done.** Last week, 27 deliveries were seen, 4 taken and 13 acted. The table shows Owen, Leila and Ana all saw the plan and nobody took it until Tom did. “Taken” is the new state that ADR 0026 lacks (it has open, done, declined, handed on). Without it, escalation can’t know when to stop.

*What fails or risks.* Twelve boxes is a lot. The sender-side lines (counts only) disappear at 1280 to fit. “Stood down” needs a kind message, not a silent removal from the Inbox.

*Principles.* Explain, never hide: the stopped state stays visible to the sender. Calm.

*Needs.* A `taken` state and taker on Inbox items (ADR 0026 change). Receipts in the events service.

*Scores.* Clarity 4 · Distinctiveness 4 · Feasibility 4 · Fit 4

## V6: Who sets what
*Idea.* A table of every routing setting against who owns it: person, team lead, Department admin, deployment admin, app. It says “sets”, “default” or “sees”, and where each lives (identity preferences, organisation settings, the events service, Admin, Apps). Beside it, three notices show the chain of settings that decided their route, in order.

*Sources.* ADR 0039 (preferences in identity), 0042 (organisation settings), 0044. Delegation of authority schedules. PagerDuty schedules (team-owned).

*What works.* It answers the prompt’s question “where do routing settings live?” in one view. The split is clean: **a person owns how they are reached; a team lead owns who covers; an admin owns what may be sent; an app owns only the level and the address.** The chain for the urgent repair at 2 a.m. crosses five owners (Dana’s budget, the app’s address, Tom’s rota, Tom’s email choice, the deployment’s relay), which is why a single “why” sentence is not enough for urgent.

*What fails or risks.* It is dense for anyone but an admin. “Default” from a deployment admin needs a precedence rule (person wins, except where marked).

*Principles.* Explain, never hide: each new setting is marked “new”.

*Needs.* A preference schema in identity for hours, editions and cover. A rota and policy store in the events service.

*Scores.* Clarity 4 · Distinctiveness 3 · Feasibility 4 · Fit 4

---

## Ranking
1. **V2 Classes of post**: the contract people can learn.
2. **V5 The life of a notice**: “taken” is the missing state.
3. **V4 The rulebook**: the engineer’s specification and the docs page.
4. **V6 Who sets what**: answers where settings live.
5. **V1 Eight words**: the map from ADRs to words.
6. **V3 The exchange**: memorable, but a picture rather than a tool.

**What I’d build first.** The rulebook’s order (V4) as one function in the events service. It should return a trace with every route, so every “why” view in this run is a rendering of that trace, not a second implementation. With it come the four classes (V2) as the shell’s loudness table, and the `taken` state (V5) on Inbox items. The postal names stay in the docs.
