# Surface 3 · My switchboard

**The moment:** a person shapes how AUGUR reaches them: working and quiet hours, away with a cover, muted apps, toasts, editions and email. They also see what still gets through. Ana Ruiz is the main person. Owen Price (away Wednesday to Monday) shows away and cover, and Tom Ashby (team lead, on call at the weekend) shows night keys.

**Shared data and files:** see the grammar notes. Every count on these pages comes from rerunning last week’s notices through the person’s settings (`whatIf` in `lib.js`), so “with these settings, last week…” is worked out, never typed.

**What is in AUGUR today (ADR 0039, 0044):** away, muted apps and toasts (off by default, #220). Everything else here is proposed: hours, editions, cover, email for urgent and the test call.

---

## V1: The console
*Idea.* A board of lamps: four classes down the side, eight channels across (Letterbox, band, Inbox, list, toast, email now, edition, emailed edition). Each lamp is on, off, or fixed. A fixed lamp has a lock and says who fixed it, for example “Only urgent opens the Letterbox (PDR-009)”. Beside it: what happens tonight after your hours, per class, and last week’s count with these lamps (9 band pulses while you worked, 5 toasts, 2 waited for morning, 2 editions, 0 emails).

*Sources.* Cord switchboards and busy lamp fields. Mixing desk routing matrices.

*What works.* It shows the whole contract at once, and the fixed lamps carry explain-never-hide into settings: nobody wonders why they can’t turn email on for needs you, because the lamp says “so nobody can be paged by an app at night”. The tally makes each change concrete.

*What fails or risks.* 32 lamps, of which only 6 are choices. That is a lot of chrome for six switches. A matrix is a power-user view; most people want V3’s sentence.

*Principles.* Explain, never hide: strong (fixed lamps say why). Calm: the lamps light once on load.

*Needs.* Preferences in identity for toasts per level, email for urgent and emailed editions.

*Scores.* Clarity 4 · Distinctiveness 4 · Feasibility 4 · Fit 4

## V2: The week strip
*Idea.* Seven rows (Monday to Sunday) by 24 hours. Your working hours are lit, quiet is dark, on-call days are underlined in the team colour and your edition is a blue tick. Last week’s notices to you sit where they arrived; a held one draws a hatched bar to when it was told. ← → moves the end of your day and ⇧ ← → the start, and the dots and the tally move with them.

*Sources.* Rota charts. Railway timetables. Calendar working-hours shading.

*What works.* You see your own week, so a change of hours has a visible cost: end at 16:00 and 3 more things wait for your start (5 instead of 2), with 3 fewer live. It is the best way to set quiet hours, because you set them against what actually arrives.

*What fails or risks.* Only one set of hours for every day. Part-timers (Mei, Monday to Thursday) need per-day hours, which the strip shows but can’t yet edit. One week is a small sample; a month would be fairer.

*Principles.* Calm. Explain, never hide: held items stay on the strip.

*Needs.* Per-day working hours in identity. `--x-proposed-night` and `--x-proposed-held`.

*Scores.* Clarity 5 · Distinctiveness 4 · Feasibility 4 · Fit 5

## V3: The sentence
*Idea.* Your settings as one paragraph you can read back: “On Mon to Fri, from 08:00 to 17:30, tell me when it happens, with a toast for needs you. Outside those hours, hold everything until I start. Urgent emails me as well, and always gets through…” Underlined words are yours and change on click. Dashed words are someone else’s and say whose (the rota, the policy). Five numbers below rerun last week through the words. The moment changes 17:30 to 16:00 by itself, so the numbers visibly answer (−3 live, +3 waited).

*Sources.* Bret Victor’s reactive documents. Standing orders. The catalogue run’s “said in a sentence”.

*What works.* Everyone can read it, it reads aloud for screen readers, and it is cheap in Quill (text plus listboxes). The dashed words tell the truth about on-call: you can’t write yourself out of it, and you can see whose rule it is. This is the variant I’d ship as the default settings page.

*What fails or risks.* The sentence must be translated as whole templates per language. Cycling choices by click is quick for 3 options and poor for times; times want a small picker.

*Principles.* Explain, never hide: strong. Calm.

*Needs.* Sentence templates as kit parts. The same preferences as V1.

*Scores.* Clarity 5 · Distinctiveness 4 · Feasibility 5 · Fit 5

## V4: Away and cover
*Idea.* Away as postal redirection. Owen sets away (Wednesday to Monday) and names Leila as cover; Leila said yes on Tuesday at 17:12. Last week’s results: 2 needs-you went to Leila, 1 she took, 1 the policy passed to others, 2 tell-me and 1 for-the-record waited on his card, and the urgent went to whoever was on call. On the right is the card he sees on Monday at 08:00: “While you were out”, grouped into Leila covered, finished by others, waiting for you, and for the record.

*Sources.* Royal Mail redirection. Hospital and office “while you were out” cards. Shift handover.

*What works.* Cover is an agreement, not a setting: the cover has to say yes, which is air-traffic handoff applied to absence. The card on return is the strongest artefact of the surface. It separates what was dealt with (and by whom) from what still waits, so a person back from two weeks off starts from four lines, not 60 notifications. AUGUR also checks that cover doesn’t stack on top of the rota.

*What fails or risks.* If the cover is also away, or says no, needs-you falls to the policy. The page should say so before you leave. The card’s “finished by others” shows other people’s actions to Owen, which is fine for his own items but needs the same privacy rule as the trace.

*Principles.* Explain, never hide: strong. Calm: one card, once.

*Needs.* Cover and cover acceptance in identity. A card view on Home on the first working hour after away.

*Scores.* Clarity 5 · Distinctiveness 4 · Feasibility 4 · Fit 5

## V5: Night keys
*Idea.* Who has a key to your night. Outside your hours the door is shut, and the only keys are listed with who cut them: urgent on your on-call days (cut by the rota’s keeper and by the admin who gave the app its urgency budget), urgent nobody took in 15 minutes (team lead and Department admin only), email for urgent (yours), and people you let through (yours). Each key says when it was used last week. Ana and Tom side by side: Tom’s urgent key and email key glow, used Saturday at 02:14.

*Sources.* Locksmith keying charts. Hospital bleep and on-call policies.

*What works.* Quiet hours become trustworthy because the exceptions are enumerated and owned. Ana’s night had no key used; Tom’s had one, and he can see which rule and whose setting let it in. The “shut out until 08:00” list counts what waited, so the cost of quiet is visible too.

*What fails or risks.* “People you let through” isn’t backed by any notice in the data (notices have no human sender yet), so it shows as unused. Is it needed at all? Two columns is a comparison for this page only; in the product it is one person.

*Principles.* Explain, never hide: strong. Calm: the used keys glow once.

*Needs.* `letThrough` would need notices to carry a person who asked. Today they carry only an app.

*Scores.* Clarity 4 · Distinctiveness 5 · Feasibility 4 · Fit 4

## V6: Test call
*Idea.* Send yourself a test notice at any day and time, in any class, and see exactly where it lands: channels, held until when, which lamps light (band, toast, Letterbox, email). The moment sends four tests at Wednesday 19:00 and one at 12:00, which shows the whole contract in five lines.

*Sources.* Fire alarm tests. The phone line “test call”. Rota dry runs.

*What works.* Trust by trying: “what happens if something urgent comes at 7 p.m. on a day I’m on call?” has a direct answer, with the Letterbox and email lamps lit. It is also the right test tool for admins setting up a deployment.

*What fails or risks.* A test of urgent must never really page anyone. It runs the rules without sending, which the page says. People may test once and never again: it is a setup tool.

*Principles.* Calm: nothing is sent. Explain, never hide.

*Needs.* A dry-run endpoint on the events service (shared with the app owner’s dry run).

*Scores.* Clarity 5 · Distinctiveness 3 · Feasibility 5 · Fit 4

---

## Ranking
1. **V3 The sentence**: the default settings page.
2. **V4 Away and cover**: cover that accepts, and the card on return.
3. **V2 The week strip**: the way to set hours.
4. **V5 Night keys**: makes quiet hours trustworthy.
5. **V6 Test call**: a setup and support tool.
6. **V1 The console**: power users only.

**What I’d build first.** The sentence (V3) over a preference schema in identity: hours per day, toasts per level, email for urgent, edition time and email copy, cover. Below it, “What still gets through” as V5’s list. Away with a cover who must say yes (V4) comes next, because it is where people lose things today.
