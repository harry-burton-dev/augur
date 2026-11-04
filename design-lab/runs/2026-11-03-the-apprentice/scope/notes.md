# Surface 4 · Scope and level

**The moment:** Ana Ferreira looks at what Survey reader may do and considers widening one kind of work: links from a vessel to its owner or manager, at rung 1 (asks each time) with 58 of 67 accepted as read and 11 in a row. Every variant shows scope and rung per **kind of work**, the cap each kind can't pass, and the ceiling no rung passes. Widening and narrowing are a person's decision with a reason; the agent can never change its own.

**Data:** `DATA.kinds` (six kinds, each with a cap, a rung, a weekly volume and a record), `DATA.scopeGrid` (floors × apps), `DATA.replay` (October's 180 checked details done again), `DATA.week`, `a1.history`, `DATA.permitWeeks`, `DATA.minutes` (a person's minutes per check). Keys: R, T, G.

---

## V1: The rung, previewed
*Idea.* Each kind of work on its own four-rung ladder, with its weekly volume and record. Point at another rung and last week is replayed at it, side by side with now: how many wait one by one, batches to sign, checks by sample, things done before you see them, and minutes of the supervisor's time a week. Widening or narrowing needs a reason written on the record. Rungs above a kind's cap are hatched and say why.

*Sources.* Consequence preview (cinematic run); SAE J3016's "who is doing what" per level; capacity planning in clinical supervision (how many delegates one nurse can supervise).

*What works.* It made an honest, unexpected finding visible: **for small volumes, batching saves nothing**. Links (25 a week) cost 25 minutes at rung 1 and about 25 at rung 2 once the sample and signatures are counted. Widening is worth it only where volume is high (class survey details, 230 a week). The rung becomes a workload decision with numbers, not a feeling about the agent. Caps are visible where you'd try to pass them.

*What fails or risks.* The minutes are estimates from fixed per-check times; real checks vary. Six kinds × four rungs is a dense control; an agent with fifteen kinds needs grouping. The preview replays last week, which may not look like next week.

*Principles.* Consequence preview: strong. Explain, never hide: caps shown and explained. Calm.

*Needs.* A level and cap per kind in the grant; a weekly volume per kind (from the runs service); per-check time estimates (could be measured from Triage).

*Scores.* Clarity 4 · Distinctiveness 4 · Feasibility 4 · Fit 4

## V2: The fence
*Idea.* Scope as a site plan: floors down, apps across. Each square says whether the agent reads, proposes, acts, tells its supervisor, or is outside (hatched). A dashed green fence is drawn round every square where it writes anything. A square says who could widen it: the supervisor on its own floor, the floor's lead above, the deployment admin for an app it isn't granted. W tries "propose on Marine Operations" and shows the reach (58 readers instead of 7) and that it would need a supervisor there.

*Sources.* Site hoarding and permit zones on a building site; the floor rule from docs/atlas.md ("a floor shows what's kept on it and on the floors above").

*What works.* **Reading upward, writing only on its own floor** becomes a picture, the same rule people already live by. "Tells its supervisor" as the only notification square makes the ceiling's "tell anyone but its supervisor" concrete. Who-could-widen-it names a person for every hatched square.

*What fails or risks.* Floors × apps hides kinds of work (Data Atlas "proposes" covers details, links and new vessels at different rungs), so it can't replace V1. With more floors and apps it becomes a big matrix.

*Principles.* Explain, never hide: strong. Many deployments: rows and columns are data.

*Needs.* Grants at start per workspace and scope (ADR 0014 has them); "notifications: supervisor only" as a scope.

*Scores.* Clarity 5 · Distinctiveness 3 · Feasibility 5 · Fit 4

## V3: Permits to work
*Idea.* Every rung above "asks each time" is a permit: holder, issued by, area, rung, hazards, precautions, its record, and an end date. Permits run twelve weeks. To renew, the supervisor sees the record since it was issued and signs again; if nobody renews, that kind drops back to rung 1 on the day, says so in the diary, and nothing is lost. A permit can be suspended at once with a reason (the Nordhavn permit carries a SUSPENDED stamp).

*Sources.* Industrial permit-to-work (HSE HSG250: area, hazards, isolations, validity, handback); access recertification in identity governance.

*What works.* **Trust lapses unless a person renews it.** That is the strongest new rule on this surface: no widening is for ever, so an agent nobody is watching drifts back to asking, not forward to acting. Hazards and precautions per kind of work capture what the supervisor learned (sister ships, issuer layouts) where the next supervisor will read it.

*What fails or risks.* Renewal reminders are another thing in the Inbox; twelve weeks per kind across many agents adds up. People rubber-stamp renewals. A lapse on a busy week suddenly multiplies the supervisor's checking.

*Principles.* Calm: a lapse is quiet and safe (back to asking). Explain, never hide: the stamp stays on a suspended permit.

*Needs.* `expiresAt`, `issuedBy`, hazards and precautions on each level grant; an expiry job (the jobs engine, ADR 0027) and an Inbox item a week before.

*Scores.* Clarity 4 · Distinctiveness 4 · Feasibility 4 · Fit 4

## V4: The logbook
*Idea.* A pilot's logbook for the agent: a ruled line a day with rung, proposed, accepted, corrected, rejected, sample size and minutes of a person's time, totals carried forward, every line counted from Triage. Beside it, endorsements: each widening and narrowing as a signed entry with its reason, and the next endorsement it could earn.

*Sources.* The pilot's logbook (hours carried forward, instructor endorsements); the nurse's competency book; the apprentice's record of work.

*What works.* The minutes column tells the real story of the week: 46 and 41 minutes a day at rung 1, 18 and 14 at rung 2, then 52 on the day of the mistake. Endorsements make "trust is earned and recorded" literal, with names. It is the page an auditor wants.

*What fails or risks.* A table of numbers is not where decisions are made; it supports V1 and V5. Counting "accepted as read" rewards easy kinds of work.

*Principles.* Explain, never hide; calm (one new line, once).

*Needs.* Daily counts of Triage verdicts per agent and kind; the audit's level changes with reasons.

*Scores.* Clarity 4 · Distinctiveness 3 · Feasibility 5 · Fit 3

## V5: The masterpiece
*Idea.* Before widening, the agent does last month's work again in the shadow (rung 0), and every result is marked against what people decided: 180 squares, 173 agree, 7 differ, grouped by why (5 survey dates read month first; 2 sister ships). The decision panel is the supervisor's: "Widen class survey details to asks for the batch?", with a reason filled from the replay by template. AUGUR's suggestion to run a replay is in pencil and never widens anything. G: a replay needs the model and costs calls (360), so it can't run with the gateway off.

*Sources.* The guild masterpiece (a journeyman's proof piece judged by masters before promotion); shadow mode in vehicle automation (the system drives in parallel without acting, and is compared).

*What works.* **Widening needs evidence from work people have already checked**, which is the fairest test there is: the same inputs, people's answers as the key. The differences are grouped by cause, so the decision is about whether each cause is fixed, not about a percentage. It costs budget and says so.

*What fails or risks.* A replay is only as good as last month's mix: Nordhavn's old layout wasn't in October's sample, so the replay passed and the mistake still happened. Replays on large months are expensive. People's past decisions contain mistakes too; a "difference" may be the person's error.

*Principles.* Pencil and ink: AUGUR suggests in pencil; the reason is template ink. Calm: the month is marked once.

*Needs.* Shadow runs in the runs service (rung 0: read grants only, outputs compared, then discarded), Triage verdicts as a key, a replay budget.

*Scores.* Clarity 5 · Distinctiveness 5 · Feasibility 3 · Fit 4

## V6: Delegation in a sentence
*Idea.* The delegation as one sentence from a schedule of delegated authority: "Survey reader may [propose] links… on [Vessel Records], [asking each time], using up to [500 model calls] a day, for [12 weeks], under Ana Ferreira. It stands by for a person before the 10 things on the ceiling." Each choice opens with what it changes before you pick it; options over a cap, over the gateway's limit or "no end date" are shown and refused with the reason. The supervisor and the ceiling are fixed in the sentence.

*Sources.* Schedules of delegated authority in companies and the civil service (what may be decided, by whom, up to what limit); the catalogue run's "said in a sentence".

*What works.* It reads aloud, so anyone affected can understand the delegation. Fixed parts (the supervisor, the ceiling) show what this page can't change. Refused options teach the rules at the point of trying ("only Malik Haddad can raise an app's daily limit"; "every widening ends").

*What fails or risks.* One sentence per kind of work means six sentences for Survey reader. Slots in prose are fiddly with a keyboard. The sentence hides the record; it needs V1's numbers beside it.

*Principles.* Said in a sentence; explain, never hide (refused options stay visible). Calm.

*Needs.* The same grant fields as V1 and V3; a renderer from grant to sentence (template, never the model).

*Scores.* Clarity 4 · Distinctiveness 3 · Feasibility 4 · Fit 4

---

## Ranking
1. **V5 The masterpiece**: widening needs evidence from work people already checked.
2. **V1 The rung, previewed**: the rung as a workload decision with numbers.
3. **V3 Permits to work**: trust lapses unless renewed.
4. **V2 The fence**: scope as the floor rule people already know.
5. **V6 Delegation in a sentence**: the readable summary of the grant.
6. **V4 The logbook**: the audit record behind the others.

**What I'd build first.** The grant as rung, cap and end date per kind of work (V1 and V3 share the data), shown as V1 with the week replayed. "Widen" offers a replay first (V5) and saves a reason; every widening ends after twelve weeks unless renewed. The fence (V2) is the scope tab of the same page.

## Needs token
Same set as the grammar. V3's suspended stamp uses `--x-proposed-disagree`; V2's fence uses `--x-proposed-lit`. All pages rely on `--font-mono`.
