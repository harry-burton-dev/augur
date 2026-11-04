# Round 2 · Combined screens

Four screens that could ship, each built from the strongest round-1 variants and the same `DATA` object. Built by `../_src/build.py` from `_src/v*.src.html`. Keys are shown in each page's top bar; R replays, T shows the ADR 0014 words, G turns the model gateway off where the model has a part.

---

## V1: A week in Triage (`v1-a-week-in-triage.html`)
The required screen: Survey reader extracting facts from survey reports into Data Atlas Triage from Mon 2 to Fri 6 Nov, with its rung changing.

*What it shows, day by day (1–5 or ← →).*
- **Mon:** rung 1 for every kind; 41 details, each waiting on its own; Ana checks them one by one (37 ticked, 3 corrected, 1 crossed for a sister ship). 46 minutes.
- **Tue:** the same; then AUGUR, in pencil, notes 60 in a row accepted as read and suggests a replay. Ana books it for the night (360 model calls, outside the agent's day).
- **Wed:** the replay: 173 of 180 agree, the 7 grouped by cause. Ana widens class survey details to rung 2 with that reason (a 12-week permit); links and new vessels stay at 1. The first batch: 44, sample of 7, signed. 18 minutes.
- **Thu:** 52 in a batch; the sample of 8 holds one Nordhavn certificate, in the new layout (shown in lavender, outlined). All right, signed. 14 minutes. Nothing looks wrong, and the page doesn't pretend otherwise.
- **Fri:** Rhiannon flags Arctic Dawn's tonnage (11:20) and pulls the cord on Nordhavn Class only (11:24; the mode line's Next box changes to Hold); Ana recalls the lot (9 made the same way, 6 wrong, all old layout); repairs with seams and tells the two owners (13:05); narrows Nordhavn to rung 1 with the reason and the way back, keeping class survey details at 2 but sampled across issuers and layouts (15:40). 52 minutes.

A side column shows the rung per kind that day, the supervisor's minutes per day (46, 41, 18, 14, 52) and the record to that day, counted from Triage.

*From.* Grammar V6 (mode line) and V4 (marks), proposal V6 (agent proposals in Triage), diary V5 (signed by sample), scope V5 (the masterpiece) and V3 (permits), mistake V6 (cord), V2 (recall), V1 (seam), V5 (scope review).

*What works.* It tells the whole apprenticeship in one week, and every change of trust is a dated, named decision with a reason. The minutes column is the business case: widening saved two thirds of the checking time, and one bad day cost it back, but only for a few hours. The Thursday sample is the heart of the story: the check passed honestly, and the mistake still got through, which is why stratifying by layout is the lesson rather than "check more".

*What fails or risks.* A week is a long story for one screen; in the product this is the agent's logbook with each day opening its Triage view, not a page of its own. The cells on Wed and Thu are illustrative (which cells were sampled isn't real data). Five beats on Friday crowd at 1280.

*Principles.* Explain, never hide: strong. Calm: the week fills once, then still. Focus: the selected day is the near plane; others are dimmed until visited.

*Scores.* Clarity 4 · Distinctiveness 5 · Feasibility 3 · Fit 4

## V2: Monday morning (`v2-monday-morning.html`)
Ana's first screen after the weekend: the agent's mode line, the weekend on one time scale (two lanes, the limit gap, the standby line still lit), her night orders answered line by line ("Nobody was called"), and what waits, by whose it is: the agent's suggested order (pencil), Survey reader's batches and one-by-ones (pencil rows with the maker's mark), the out-of-scope survey (Tell Rhiannon), Filing clerk's standby (Tom's, not hers, shown with its lamp) and its done work (Tom's diary).

*From.* Diary V2, V4, V3; proposal V6; standby V1.

*What works.* "What waits, and whose it is" is the answer to the Inbox question: agent work arrives as one row per run, other supervisors' standbys are visible but not actionable, and nothing is hidden. The orders and the strip answer "did it behave?" before "what do I do?".

*What fails or risks.* Three sources of the same counts (strip, orders, waits) on one page is redundant; in the product the strip may be a tab. With five agents on a floor the page needs one row per agent, collapsed.

*Scores.* Clarity 4 · Distinctiveness 4 · Feasibility 4 · Fit 5

## V3: From standby to go (`v3-standby-to-go.html`)
One standby end to end, as five frames (← → or 1–5): the log records the fault; the agent prepares (three reversible steps done) and holds before two it can't undo; the lamp in the band and Rhiannon's "standing by"; because the go-by (10:30) falls before her next look, the Letterbox, with the time out filled in pencil and confirmed, and a read-back only for the email, which leaves the organisation; go, the lamp out, and the diary line, with the one undo left (withdraw the notice).

*From.* Standby V1, V2, V3, V5, V6; grammar V6.

*What works.* Each mechanism is used where it earns its place: the lamp always; the Letterbox only because of the deadline; the read-back only for the irreversible external step; the time out because the reach is the whole Org. The final diary line records who said go and what can still be undone.

*What fails or risks.* Five mechanisms is a lot to build; the minimum is the lamp, the split and the lapse (V1, V6 left half, V5). The Letterbox inside a framed stage is a simulation; the real one is full screen (standby V2).

*Scores.* Clarity 4 · Distinctiveness 5 · Feasibility 3 · Fit 5

## V4: The agent's page (`v4-the-agent-page.html`)
The agent's page in Admin, written to be read by anyone it affects: the indenture as one sentence (errand, supervisor, deputy, schedule, limit), the mode line, what it may do kind by kind (rung, until when, record), where (the fence as a small grid), the ceiling, and its record (bound, widened, narrowed, with reasons; today's diary). Numbered pins mark the nine things ADR 0014 would have to add; the side list names them.

*From.* Grammar V1, V2, V6; scope V1, V2, V3, V4.

*What works.* It is the page that makes "every agent has a supervisor, a scope and limits, visible to everyone affected" true, and the pins turn it into a checklist for the ADR. It reads top to bottom as who, now, what, where, never, history.

*What fails or risks.* Dense at 1280. The fence and the kinds table overlap in meaning. Pins are for this review; the product page has none.

*Scores.* Clarity 4 · Distinctiveness 3 · Feasibility 5 · Fit 4

---

## Checks
Every page was rendered at 1600×900 and 1280×800 and read; console errors and sideways scroll were checked by script (see the run README). The moment plays about 1.2 s after load; V1 and V3 finish their sequence by about 3 s.

## Needs token
The run's set: carried `--x-proposed-pencil`, `--x-proposed-pencil-wash`, `--x-proposed-seam`, `--x-proposed-seam-wash`, `--x-proposed-disagree`, `--x-proposed-disagree-wash`, `--x-proposed-lit`, `--x-proposed-lit-wash`, `--x-proposed-unseen`, `--x-proposed-quiet`, `--x-proposed-type-micro`; new `--x-proposed-standby`, `--x-proposed-standby-wash`, `--x-proposed-ceiling`, `--x-proposed-mark-size`. All pages rely on `--font-mono`.
