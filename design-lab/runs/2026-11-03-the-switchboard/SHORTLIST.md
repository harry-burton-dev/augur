# Shortlist: the switchboard

Ranked by what I’d build first. The headline: **routing should be one set of rules that returns a trace, so every person, lead and app owner can read why a notice went where it went.** Only what needs someone may interrupt; the rest waits for an edition. An item that waits on someone always shows who is asked next and when. Ownership moves only when someone takes it. In the replayed week, the 41 notices made 54 deliveries: 24 told live, 9 held for quiet hours or a return, 15 into an edition, 3 to the list only (muted) and 3 by the urgent route. Another 7 notices were stopped before anyone was told. Under ADR 0044 as it stands, all but the 3 muted would have pulsed the band when they arrived, night or day, and the 7 stopped ones would have shown only in a service log.

| # | Build | Look at | Why it ranks here |
|---|---|---|---|
| 1 | **The route is a trace**: one rule order in the events service (not allowed, team notices off, already told, urgent, away, muted, for the record, quiet hours, told live). It returns a trace per person, rendered as a postmark in the list and hops in the item | [Rulebook](grammar/v4-rulebook.html), [Postmark](why/v1-postmark.html), [Trace](why/v2-the-trace.html), [Why, and change it here](combined/v2-why-and-change-it.html) | Every other view in the run is a rendering of this trace. Without it, each “why” would be a second, drifting implementation. |
| 2 | **Four classes, and news waits for the edition**: urgent, needs you, tell me, for the record. The class, not the app, decides channel, quiet, away, mute, receipt and escalation. Info never pulses; it goes to the list and the person’s morning edition, which enters every source even at zero | [Classes of post](grammar/v2-classes-of-post.html), [Front page](digests/v1-front-page.html), [Ledger](digests/v5-the-ledger.html), [By email](digests/v3-by-email.html) | It is the biggest drop in interruptions for the least work, and it is the shell owning loudness, as room tone asked. |
| 3 | **Taken, offered, and the next step shown**: an Inbox item has an owner, people it is offered to, and a taker. Seeing it never stops the asking; taking it does, and stands everyone else down by name. Every card says who is asked next and when. Passing it on carries a handover note, half filled from the trail | [Life of a notice](grammar/v5-life-of-a-notice.html), [Bleep log and note](escalation/v4-bleep-and-sbar.html), [Board](escalation/v5-the-board.html), [Escalation with handover](combined/v3-escalation-with-handover.html) | The survey plan was seen by four people and taken by one, after 17 working hours. Only the “taken” state makes that visible, or stoppable. |
| 4 | **Returned to sender**: every refused send is recorded with its reason and who can change it, shown to the app owner with one Ask button, plus `dryRun` before sending | [Returned to sender](owner/v2-dead-letters.html), [Dry run](owner/v6-dry-run.html), [The owner’s report](combined/v4-the-owners-report.html) | 40 people never got the empty-homes list, and today only a 403 in the service log says so. |
| 5 | **My switchboard in a sentence**: hours per day, toasts per class, email for urgent, edition time and email copy, away with a cover who must say yes, and a list of what still gets through at night, each rehearsed on the person’s own last week | [The sentence](switchboard/v3-the-sentence.html), [Away and cover](switchboard/v4-away-and-cover.html), [Night keys](switchboard/v5-night-keys.html), [Week strip](switchboard/v2-week-strip.html) | It is cheap in Quill, honest about the rota (dashed words say whose), and the “while you were out” card fixes coming back from leave. |
| 6 | **The week replayed**: a train graph of a team’s week through the rules, for team leads and support | [The week replayed](combined/v1-the-week-replayed.html) | It is the proof that the model holds over a real week, and the tool for “why did this take two days?”. It depends on 1 to 3. |

**Worth keeping as options:**
- [Who sets what](grammar/v6-who-sets-what.html) as the docs page for settings ownership.
- [What would change it](why/v3-what-would-change-it.html) where a person is about to change a setting.
- [Five questions](why/v6-five-questions.html): “What if I don’t?” as one line on every needs-you card.
- [The handoff strip](escalation/v2-handoff-strip.html) for operator-style teams.
- [Test call](switchboard/v6-test-call.html) as an admin setup tool.
- [The weekly](digests/v2-the-weekly.html) and [team bulletin](digests/v6-team-bulletin.html) for leads and teams.
- [Urgent at night](escalation/v6-urgent-at-night.html) as the Letterbox’s urgent case.

**Not worth pursuing:**
- [The envelope](why/v5-the-envelope.html): charming, skeuomorphic; onboarding at most.
- [The exchange](grammar/v3-the-exchange.html) and [Delivery report](owner/v1-delivery-report.html): striking, but they don’t scale past a small team, and tables say the same thing more plainly.
- [The console](switchboard/v1-console.html) as the default settings page: 32 lamps for six choices.

**Answers to the prompt’s questions:**
- *What the events service and the notifications contract would need, and which need an ADR.*
  - **A routing ADR (new; amends ADR 0044):**
    - classes worked out from the level and an `urgent` flag;
    - the fixed rule order;
    - a trace per delivery, stored and returned;
    - info that no longer pulses;
    - refused sends recorded instead of only a 403;
    - `dryRun` on `notify`;
    - receipts per delivery (told, seen, taken, acted), where senders see counts, never names.
  - **A rotas and escalation ADR (new):**
    - team-owned rotas and policies in the events service, readable by the team;
    - a team clock (working hours) for waits;
    - skip rules (already asked, away);
    - an urgent policy (every 15 minutes, never louder);
    - stand-down when someone takes it;
    - a next-step prediction for cards and boards.
    - This needs the same clock that the briefing run’s watches need.
  - **Inbox states (a new ADR replacing part of ADR 0026):** `taken` with a taker, `offered to`, and a pass-on note. ADR 0026 has open, done, declined and handed on, but no taken.
  - **ADR 0044’s open decisions, answered:**
    - D3 (urgent flag): yes, for AUGUR’s own services and for apps an admin grants a budget;
    - D4 (urgency budget): per app per floor per week, granted by the Department admin;
    - D6 (toasts): stay off by default, on per class by the person;
    - D7 (email): a daily edition by email as a pointer, through the relay.
  - **No ADR needed:** hours per day, cover and its acceptance, and edition time are identity preferences (ADR 0039); update docs/notifications.md.
  - **Needs an ADR if chosen:** a channel that wakes someone at night (push or SMS through the organisation’s gateway), because it is a new dependency.
- *Where routing settings live.* See [Who sets what](grammar/v6-who-sets-what.html).
  - **The person** (identity preferences, ADR 0039): working hours per day, away and cover, muted apps, toasts per class, email for urgent, edition time and email copy.
  - **The team lead** (events service, new): the rota, the escalation policy within the Department’s limits, and team notices (identity, as today).
  - **The Department admin, as floor admin** (Admin, Apps): `notifications:send` per floor, urgency budgets per app, and the policy limits (the longest wait, the last step).
  - **The deployment admin:** the relay, defaults for new people, the per-app rate limit.
  - **The app:** only the level, the key (with a kind prefix) and the address: people, team, or on call. Never loudness, channel or timing.
- *How this agrees or clashes with room tone’s budgets and the control room run (E).*
  - **Room tone agrees on the core:**
    - the shell owns loudness (the four classes are its levels);
    - info is silent (L0);
    - urgent is an open question until taken.
  - **Room tone’s budgets move:** with editions, Ana’s week had 9 band pulses and 5 toasts, far under room tone’s 40 sounds a day. So the budget that matters is not per person but **per app**: an urgency budget (2 a week) and a rate limit (6 an hour per floor).
  - **One clash with room tone:** room tone asks again on the same screen (3 s apart, then doubling, then pages the person on call). This run pages people. They fit together if room tone’s repeats happen within one person’s 15-minute turn and this run’s steps happen between people. Decide that once.
  - **Control room (E), not yet run:** E’s “every alarm has an owner, a priority, a consequence and an action” is three-quarters met: a needs-you item now has a taker (owner), a class (priority) and an action, and “What if I don’t?” is its consequence. E’s shelving is this run’s mute: it stays visible (list only) and the owner sees a count. E should replay a flood script through this same model: the replay screen is built for it.

**Where these push back:**
- **ADR 0044 says every level pulses once.** This run says info never pulses and waits for the edition. It is a change to an Accepted-track contract, so it needs a Proposed record.
- **ADR 0044 says a person never sees who else got a notification.** This run shows a needs-you item’s earlier holders (the trace, the strip, the board), because handover needs it. News keeps the rule. **Needs your decision.**
- **The owner keeps an item while away until someone takes it** (no gap). That is accountability, but Owen “owned” the survey plan on leave for two days. The alternative is to move ownership to the cover the moment away begins, if the cover said yes. I recommend the latter.
- **Night is email only.** AUGUR can’t wake anyone at 2 a.m. except by email. Tom saw the leak 17 minutes after it was sent. For organisations with on-call duty, that is too weak a bleep.
- **Muting never takes you off a rota.** Several pages say so. It may surprise people, but the alternative is an escape hatch from on-call.

**Decisions for Harry** (none taken):
1. Info stops pulsing and waits for a morning edition per person? I recommend yes (Proposed record amending ADR 0044).
2. Urgent for apps: only AUGUR’s own services, or apps with an urgency budget granted per floor by the Department admin? I recommend the budget, 2 a week by default.
3. Add `taken`, `offered to` and a pass-on note to Inbox items (replacing part of ADR 0026)?
4. Rotas and escalation policies in the events service, owned by team leads, readable by the team, timed on the team’s working hours? And does the clock wait for the on-call person’s quiet hours? This model says yes.
5. Show a needs-you item’s earlier holders to everyone it passed through (a change to ADR 0044’s privacy rule for needs only)?
6. Does ownership move to the cover when away begins (if they said yes), or stay with the absent owner until someone takes it?
7. A night channel for urgent (push or SMS through the organisation’s gateway), or email only? A new channel needs an ADR.
8. Editions by email: titles and links only, with a per-library “never put titles in email” setting?

**Gaps (needs token):**
- `--x-proposed-night` (quiet time on any strip; navy at 16%).
- `--x-proposed-held` (45° hatch for held).
- `--x-proposed-blocked` with its wash (amber edge for never told).
- `--x-proposed-urgent-wash`.
- `--x-proposed-receipt`.
- `--x-proposed-bar` (letterbox bar height from `--letterbox-ratio`).
- Carried from earlier runs: `--x-proposed-lit` and `-lit-wash`, `--x-proposed-unseen`, `--x-proposed-quiet`, `--x-proposed-type-micro`.
- Every page relies on `--font-mono` (IBM Plex Mono, still needs an ADR).

**Gaps (decisions and kit parts):**
- A postmark line and a hop list as kit parts.
- A sentence-settings part in Quill.
- A key convention (`<kind>:<id>`) or a `kind` field on notices.
- Per-library “title in email”.
- A person sender on notices, so “let through” has something to match.

**Data AUGUR doesn’t have yet:**
- per-person working hours by day;
- cover and cover acceptance;
- rotas and policies;
- receipts beyond read;
- taken and offered on Inbox items;
- refused sends;
- the per-app “listening” status that makes “nothing from” honest;
- a clock that turns a passed limit into an event.
