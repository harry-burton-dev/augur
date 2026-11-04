# Surface 2 · Why was I told?

**The moment:** Ana Ruiz, repairs coordinator, opens a notice and AUGUR says why it reached her, by which route and when. The main example is “Sign off the winter damp survey plan”. It was meant for Owen Price, went to his cover while he was away, and reached Ana at 12:00 Wednesday because she was on call and nobody had taken it by its limit.

**Shared data and files:** see the grammar notes. Every sentence on these pages comes from `viaWords()` and `ruleWords()` in `lib.js`, which read the route that the rules produced, so the explanation can’t drift from what happened.

**Privacy rule used throughout:** for news you see only your own hop, as ADR 0044 says (“never who else got one”). For a needs-you item you see its earlier holders, because it passed through them. That is a proposal, and the shortlist lists it as a decision.

---

## V1: The postmark
*Idea.* Every notice in the list carries a one-line postmark: when it reached you (held times hatched), by which route (by name, team, on call, asked next), its class and the rule. Selecting one opens the full franking: from, addressed to, how it reached you, class, route, channels and receipts, with a plain “because” sentence on top.

*Sources.* Postmarks and franking. The “Why am I seeing this?” menu on ad and feed sites, taken here as a postmark that is always visible rather than a menu.

*What works.* The reason is in the list, before you open anything. Scanning Ana’s week, you can see which items were held overnight (“TUE 08:00 · quiet hours”), which came through the team, and the two she was asked as on call. It is cheap: one line per item from the trace.

*What fails or risks.* The postmark is mono uppercase, which is tiring over 50 items. It could collapse to the time and the route word, with the rest on hover. Mute in place is offered from the detail. That is fine for news, but muting an app that sends you needs-you items doesn’t take you off a rota, so the button needs the consequence (see V3).

*Principles.* Explain, never hide: strong. Calm: nothing moves after the first open.

*Needs.* A route trace per delivery from the events service.

*Scores.* Clarity 5 · Distinctiveness 3 · Feasibility 5 · Fit 4

## V2: The trace
*Idea.* The notice opened in the Inbox, with every hop listed in time order, like email “Received:” headers in plain words. Each hop names the rule that decided it. “You are here” marks Ana’s hop. Hops after now are faded, and ← → moves now through the item’s life while the card on the left changes: open and waiting on you, then you passed it on, then Tom has it, then signed off.

*Sources.* Email Received headers. Recorded delivery tracking pages. Flight progress strips (each hop annotated with a time).

*What works.* It is the fullest answer to “why me, and why now?”. It shows the policy’s hops as events (“Nobody had taken it by 12:00”, “Ana passed it on”), not as configuration. Moving now changes the actions: “I have it” is disabled once someone else has it, with the reason. T shows each hop’s technical line (rule, via, channels).

*What fails or risks.* Showing hops after now only works for history; live, the trace ends at now. It shows earlier holders’ names, which ADR 0044 avoids for notifications (see the privacy note above).

*Principles.* Explain, never hide: strong. Focus stacking: the past is sharp, the future faded. No blur.

*Needs.* The trace, and Inbox history with taken and passed-on states.

*Scores.* Clarity 5 · Distinctiveness 4 · Feasibility 4 · Fit 5

## V3: What would change it
*Idea.* A “because” sentence with numbered clauses (on call Wednesday, nobody took it by 12:00, live with a toast, Mandate not muted). Four cards each change one thing, run last week’s rules again, and report the result. Someone else on call: Mei is asked at 12:00, not you. Leila takes it when she sees it: 2 people asked, not 4. Your day ends at 12:00: held to Thursday 08:00, and Tom asked at 10:00. You mute Mandate: you are still asked (muting never takes you off a rota), only quieter. Each card names whose setting it is and offers the one action that is yours.

*Sources.* Counterfactual explanations (Wachter et al.). The cinematic run’s consequence preview.

*What works.* It is the variant that teaches the system. The mute card gives the answer people most need: muting doesn’t get you off the hook. The hours card shows a real design question: should the policy’s clock wait for the on-call person’s quiet hours? In this model it does. The answers are computed (`whatIf`), not written, so they stay right in every deployment.

*What fails or risks.* Four counterfactuals is the limit. It needs picking the right ones per kind of notice (for news, mute and editions; for needs, rota and hours). Rerunning a week per card is cheap in the prototype; on a server it means replaying a person’s recent notices, which needs the receipts store.

*Principles.* Explain, never hide: the strongest of the six (whose setting, what changes). Calm.

*Needs.* A server-side “what if” over a person’s last week of routes.

*Scores.* Clarity 4 · Distinctiveness 5 · Feasibility 3 · Fit 4

## V4: The lit path
*Idea.* A section through the floors (Org, Department, Team, You). The notice starts at its app on its floor and passes gates in order: may send here, addressed, reaches you, away, muted, for the record, your hours. It ends in the channels at you. A streak of light runs along the path, and the gate that decided is lit. ← → steps through six of Ana’s notices.

*Sources.* The cinematic light language (streak) and lit path. Architectural sections. The briefing run’s section through floors.

*What works.* It is the most AUGUR-looking variant, and it makes floors part of the answer: a notice from Data Atlas on the Department floor visibly travels down to you. The deciding gate stands out (“Your hours: out, held to Tue 08:00”).

*What fails or risks.* Most rows of the diagram are empty: Org is rarely involved. The gates repeat the rulebook, so it is heavier than V1 for the same facts. Good for learning, too much for every notice.

*Principles.* Light language: on-model. Calm: the streak runs once. Focus: the deciding gate is the near plane.

*Needs.* Nothing beyond the trace.

*Scores.* Clarity 3 · Distinctiveness 4 · Feasibility 4 · Fit 5

## V5: The envelope
*Idea.* Four of Ana’s notices as envelopes: the address it was sent to (“To: whoever is on call, Estates repairs, Wed 28 Oct: you”), a class stamp, the post office’s ink marks (“Not taken by 12:00, forwarded to on call”, “Held, quiet hours, delivered Tue 08:00”, “Second class, 08:00 edition”) and a recorded-delivery slip with the receipts.

*Sources.* Royal Mail redirection labels and “while you were out” cards. Recorded delivery slips. Postal cancellation marks.

*What works.* The address-not-list rule becomes natural: an envelope shows who it was addressed to, never who else got one. The ink marks are memorable, and a person learns the three ways a notice is delayed in one glance.

*What fails or risks.* It is skeuomorphic, and the rotated stamps are decoration. As a pattern it belongs in onboarding or the docs, not the list. The ink colours reuse level colours (green for forwarded), which competes with “needs you”.

*Principles.* Explain, never hide: good. Calm: the stamps land once.

*Needs.* Nothing new.

*Scores.* Clarity 4 · Distinctiveness 5 · Feasibility 4 · Fit 2

## V6: Five questions
*Idea.* A fixed set of five questions on every needs-you item, answered from the route: Why me? Why now? Why like this? What if I don’t? How do I change it? The example is the gas safety returns past their deadline, which asked Ana at 16:00 Thursday as on call. “What if I don’t?” answers “At Fri 08:30 the policy asks Dana Whitfield, the Department admin. Skipped: the team lead, Tom Ashby, was already asked.”

*Sources.* The five Ws of a news story. SBAR. Help-desk “why” articles.

*What works.* “What if I don’t?” is the question nobody else answers, and it is the one that makes escalation feel fair: you can see the next step and its time. “Why like this?” lists the channels that weren’t used and why (“Not urgent. Only urgent opens the Letterbox”), which is explain-never-hide applied to channels.

*What fails or risks.* Five tabs is a click per answer. Two (why me, what if I don’t) could live on the card itself. The answers are long for a toast-sized moment.

*Principles.* Explain, never hide: strong. Calm.

*Needs.* Next-step prediction from the policy (`nextAsk` in this run).

*Scores.* Clarity 5 · Distinctiveness 3 · Feasibility 4 · Fit 4

---

## Ranking
1. **V1 The postmark**: the reason in the list, cheap and always there.
2. **V2 The trace**: the full answer, one click down.
3. **V6 Five questions**: “What if I don’t?” belongs on every needs-you card.
4. **V3 What would change it**: the best teacher. Use it where the person is about to change a setting (combined V2).
5. **V4 The lit path**.
6. **V5 The envelope**: onboarding only.

**What I’d build first.** The postmark line in the notification list and the trace one level down, both rendered from the same route trace the events service returns. Then add “What if I don’t?” as a single line on needs-you cards: “If nobody takes it, Dana Whitfield is asked at Fri 08:30.”
