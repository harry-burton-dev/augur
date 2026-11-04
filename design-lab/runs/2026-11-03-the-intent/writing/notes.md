# Surface 2 · Writing an intent

**The moment:** early October. Dana Whitlock, Head of Network Operations, writes DEP-14 under the Org's ORG-07. Her first draft, as she'd say it, mixes purpose, measures, method and a rota in seven sentences; one limit is too vague to test ("don't cut anyone off for long") and one freedom has no condition ("use Ryecroft if you have to").

**Data:** `DATA.draft` (the seven sentences with the rule that sorts each), `DATA.whyLadder`, `DATA.catchball` and `DATA.draftRounds`, `DATA.premortem`, `DATA.lastWinter`, and DEP-14 itself. Dana is the viewer. R replays, T shows doctrine words; G turns the model gateway off on pages where a model has a part (V1, V2, V6), and every page still works.

**Rule common to all six:** the intent is written by a person. Rules sort, check and fill; a model may suggest in pencil only what no rule can place, and nothing a model writes enters the intent until the owner accepts it. The method is never asked for, and when it is written anyway it is set aside, not deleted.

---

## V1: Purpose, not method
*Idea.* Dana writes as she'd talk. Each sentence is sorted by rule into a field (a number and a date is done-looks-like; "so", "the point is" is purpose; "don't" is a limit; a verb of doing is a key task, or method if it names people or a rota) and tagged in the text. The one sentence no rule places ("Kit and Mo should alternate the Kelda shifts") is sorted by a model in pencil; with the gateway off it waits for her. The vague limit gets a fix: "How long is long? The Org says 12 hours. Use L2 as written."

*Sources.* Klein's intent statements; plain-language drafting; the reference desk's pencil and ink.

*What works.* It removes the blank form, the thing people hate, and teaches the difference between purpose and method by showing it on their own words. Method struck through in the draft and kept in "Left to the teams" is the right tone: not wrong, just not the intent. The tally (5 of 5 fields, 1 vague limit, 2 sentences of method) is a quick read of the draft's health.

*What fails or risks.* Keyword rules are brittle ("so" appears everywhere; "fix" is a task here, method elsewhere). People who write in bullets or fragments will get poor sorting. The strike-through on a manager's words may feel like marking homework.

*Principles.* Pencil and ink: strong. Explain: every tag says why on selection. Calm: sorts once.

*Needs.* A small rule set per language; the gateway for the leftovers; a "set aside" note attached to the intent.

*Scores.* Clarity 4 · Distinctiveness 4 · Feasibility 4 · Fit 4

## V2: Ask "so that?"
*Idea.* Start from what you want done and keep answering "so that?". "Run Ashby flat out…" → "so Thornley draws less" → "so Thornley can refill before spring" → "so we get through without household restrictions", which meets ORG-07's key task K1. The climb stops there: the rung below the meeting is the purpose, the one below that is done-looks-like, and the first line was method. A model may point at the likely task above in pencil; she chooses.

*Sources.* Five whys; why-how laddering; ADP 6-0 nesting ("in order to").

*What works.* Managers start from the plan; this meets them there and climbs out of it. "Stop climbing: above here is the Org's intent, not yours" sets the boundary every intent writer gets wrong (writing the Org's purpose as their own). It writes three fields from four short answers.

*What fails or risks.* A scripted climb looks cleaner than real answers will be; some people will climb past the meeting or answer "because I said so". Only works when the intent above has key tasks written well.

*Principles.* Two levels up: the meeting point is the floor above. Pencil: the model only points.

*Needs.* Key tasks above as selectable targets; `serves` with a task id.

*Scores.* Clarity 5 · Distinctiveness 4 · Feasibility 4 · Fit 4

## V3: Catchball
*Idea.* The draft is thrown down to the three team leads and back up to the Org. Each reply that moves a field leaves a seam on it with the round and the person's name: Lewis Baird (Trunk Mains) turns "50 Ml/d by 31 Dec" into "60 by 31 Jan" because Kelda can only carry 10 a night; Sam Okafor adds Ryecroft as standby and the branch plan; Rita Gomez drops "lend gangs between zones"; Priya Raman adds the rainfall assumption. The thread lives on the intent (ADR 0028).

*Sources.* Hoshin Kanri catchball; OKRs set both ways (Grove, Doerr); the wear-and-time run's visible repair.

*What works.* It answers "intent negotiated up and down, not only handed down" with a record: you can see that the 60 came from the people who run the link, which is why the teams will believe it. Seams make negotiation history visible without a diff tool. The round buttons replay the negotiation.

*What fails or risks.* Catchball takes days; for a fast-moving surprise it is too slow (that is what freedom and branches are for). The thread can become the place people argue instead of decide; the owner must close each round.

*Principles.* Visible repair. Explain: every change names its source. Calm: one change of round at a time.

*Needs.* ADR 0028's thread keyed by the intent's Ref; a field-level change record with author and round.

*Scores.* Clarity 4 · Distinctiveness 4 · Feasibility 4 · Fit 5

## V4: Limits from a premortem
*Idea.* "It is 1 Mar. Rest Thornley this winter failed. What happened?" Four people write five stories. Each becomes something on the record: a story already covered by an inherited limit is matched to it; a new one adds a Department limit (D1: no planned interruption during an amber; D2: £50k per change); one becomes a branch with a cap (B1); one becomes a freedom with its condition. A looser line ("allow 18 hours during a freeze") is refused, naming who owns L2 and where it can change.

*Sources.* Gary Klein, "Performing a project premortem" (HBR 2007); Klein's anti-goals; the label run's strictest wins.

*What works.* Limits are the hardest field to write and the most important; stories make them concrete and memorable, and each limit keeps its story ("why is D1 there? Hebden, last January"). The refusal is the rule "a floor may tighten, never loosen" shown at the moment someone tries.

*What fails or risks.* Premortems can produce dozens of stories; someone must merge them. Some stories become limits that are really method (the risk is over-constraining). It takes a meeting.

*Principles.* Explain: each limit says where it came from and who can lift it. Strictest wins.

*Needs.* A story field on limits; the inherit rule enforced on save.

*Scores.* Clarity 5 · Distinctiveness 5 · Feasibility 4 · Fit 4

## V5: Fill from above
*Idea.* The intent opens already holding the one above: Serves chosen first, the purpose seeded from it, five limits arriving locked, done-looks-like picked from facts in Data Atlas (each line becomes a live measure with its source), and only the difference typed. A count shows 112 words typed against 74 that came from ORG-07 and Data Atlas; rule checks tick as she goes.

*Sources.* GOV.UK form patterns (start from what you know); the label run's strictest wins; the briefing's same digits at every height.

*What works.* The form people hate is the empty one. Here the boring parts (limits, measures) are given, and the parts only she can write are what's left. Picking measures as facts means drift can later be worked out, not argued about.

*What fails or risks.* Seeding the purpose from above encourages copy-paste purposes ("So the Org can…" every time). Not every end state has a fact yet; a line without one must still be allowed, marked "no measure".

*Principles.* Explain: every given line says where it came from. Calm. Many deployments: the fact list is the deployment's own.

*Needs.* Fact references on end-state lines; an `inherits` list; a fact picker from Data Atlas in Quill.

*Scores.* Clarity 5 · Distinctiveness 3 · Feasibility 5 · Fit 5

## V6: Rehearse on last winter
*Idea.* Before it is passed down, the draft is played against three surprises from last winter's control log. Each finds the lines that answer it (the Ashby failure: B1 and F2; the freeze: L2, F3, D1) and says what a controller at 03:00 would do. The third (a councillor asks to pause repairs for a market) finds no line: a gap. A model drafts a freedom line in pencil; Dana adds it or leaves the gap and says so.

*Sources.* Rehearsal of concept drills; wargaming; the switchboard run's rehearse on last week.

*What works.* It is the test from V3 ("could someone choose a new plan from this alone?") made concrete and run before anyone needs it. A gap found now costs a line; found at 03:00 it costs a phone call or a guess. Using the organisation's own log makes the cases undeniable.

*What fails or risks.* Only as good as last winter's log; new kinds of surprise won't be there. Choosing which cases to play is itself a judgement. Could become a box-ticking step if run on every small team intent.

*Principles.* Consequence preview, turned backwards. Pencil and ink for the suggested line.

*Needs.* A searchable event log with dates (Data Atlas or the control system); the refs from each case to intent lines.

*Scores.* Clarity 4 · Distinctiveness 5 · Feasibility 3 · Fit 4

---

## Ranking
1. **V5 Fill from above**: the form that isn't hated, because it isn't empty.
2. **V4 Limits from a premortem**: the hardest field, written from stories, with the inherit rule enforced.
3. **V1 Purpose, not method**: write it as you'd say it; rules sort, a model only the leftovers.
4. **V6 Rehearse on last winter**: finds the gap before 03:00.
5. **V3 Catchball**: the negotiation kept as seams.
6. **V2 Ask "so that?"**: a good teaching move, a worse daily tool.

**What I'd build first.** V5 as the intent editor in Mandate, with V1's sorting on the purpose box only (paste or type freely; rules split it), V4's refusal of looser limits as a save rule, and V6's rehearsal as an optional step before passing down when the deployment has a log to play. Catchball (V3) comes free once ADR 0028's thread is on the intent and changes record their author.

## Needs token
No new tokens on this surface beyond the grammar's: `--x-proposed-thread` (the meeting and highlights), `--x-proposed-freedom`, `--x-proposed-drift` (the gap). Carried: pencil, seam, ceiling, lit, quiet, micro type. Every page relies on `--font-mono`.
