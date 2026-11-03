# Combined V1: Three readers, one briefing (`v1-three-readers.html`)

This is the required round-2 screen: one briefing for three readers, each at their own height, all built from the same data. Built by `_src/a/build.py` from `_src/a/` (`common.css`, `data.js`, `lib.js`, `v1-three-readers.src.html`). It shares one `DATA` object with V4 (Vale Regional Services: Facilities, its Site compliance team, Depot operations, three other departments).

Keys: **1 / 2 / 3** bring one reader's copy forward (press again, or **S**, for side by side). **D** swaps in the Org copy published on 27 Oct. **T** shows the technical words, **G** turns the assistant off, and **R** replays. The moment plays about 1.2 s after load: the three copies settle, then the same-digits check ticks row by row.

Checked at 1600×900 and 1280×800, with each reader brought forward, with D, T and G, and with reduced motion. It has no console errors and no sideways scroll.

## Idea
Sam Okafor, an operator on the Site compliance team, has one query: "inspections that fell due at Facilities sites since 1 Oct, and what has been recorded for each". It is drawn three times, once per reader, as that reader's own copy:
- **Sam (the records):** every row, grouped by state. Every gap names who could fill it, with an Ask button.
- **Priya Nair, his team lead (the minute):** the bottom line, a picture in the sentence's terms (one square per inspection, sites with the most overdue first), one line of what we can't say, and "if Priya asks" folded below. The minute is budgeted at 60 s and comes to 26 s.
- **The Org floor (the headline):** "At least 6 site inspections are overdue this quarter, all of them at Facilities sites", with one picture across departments. Two departments show as "some", hatched, naming whom to ask, and Parks and Leisure shows "none, checked by Tom Ashby". The headline is budgeted at 20 s and comes to 20 s.

A strip at the foot **checks that all three add up**. It counts the marks each copy actually drew (6 overdue rows, 6 lit squares and the word "six" in the bottom line, 6 lit squares and "at least 6" in the headline). It also checks that the one item with two answers is shown at every height and counted in none, that the two "can't say" items are named and never counted as done, and that "not yours to see" is never a number to a reader. Each copy's footer says what that reader can open behind it, and each claim carries a chip that is either open or locked with whom to ask.

## Sources
BLUF and the staff appreciation (the order of the minute). The lead's questions and "if asked" (heights named by the questions a lead would ask). Isotype (one square per inspection, counted, never scaled). Bret Victor's ladder of abstraction (one query, three heights). Printer's proofs and "View as" (each reader's own copy, from action V3). The catalogue's six ways to be empty, with "some" for hidden counts. The reference desk's "the answer has a base" ("at least 6") and five reasons an answer moves (D).

## What works
- **Three heights side by side make "same digits" visible without a legend.** The same 6 appears as a row count, a row of lit squares and a word, and the check strip says so in one line. It is the first screen in the run where the "a headline whose heights don't agree can't be published" rule becomes a working check. It counts the drawn marks, not the data, so a template bug would show up.
- **D shows why the rule matters.** The Org copy from 27 Oct says 5, and the records now hold 6. The strip fails with a reason from the fixed list ("A date passed: Eastfield's fire alarm test fell due on 30 Oct. AUGUR can't notice a date passing yet…"). That is the honest reason a published headline goes stale, and it makes the case for a clock in the events service again.
- **Each reader's access shows up as differences in their own copy, not in a separate panel.** Priya can open all 14 visit records but not Sam's own site note, so her Eastfield chip is locked with "ask Sam". The Org copy can open 2 of 131 records (the intent and Parks' own briefing). Its "6 overdue" chip says "ask Dana Whitfield" and its two departments say "some". The publisher (Sam) sees exact counts in the footers, and the readers' copies say "some", which follows the catalogue rule.
- **Heights grow downward and nothing is thrown away.** The Org copy is the shortest, but its "at least" carries the two "can't say" items and the "and 1 with two answers" label carries the dispute. Nothing is cut from the minute: what it leaves out sits under "if Priya asks", and the assistant's suggested question ("Why is Northgate behind?") is in pencil with the answer "Nothing in the records answers why… it may not answer it."
- **G changes the route, not the numbers.** With the assistant off, the bottom line falls back to its template ("6 inspections are overdue at 3 of 5 sites…") and the pencil question disappears, but the check still passes on the same digits.

## What fails or risks
- **Three columns of different heights are a publisher's tool, not something a reader sees.** No real reader sees the other two copies. In the product this is the "before it goes" view, and each reader receives only their own column.
- **The records column at the operator's height is dense.** At 1280×800 in side-by-side, the "Done" group and "Not yours to see" scroll out of view. Pressing 1 makes the column wide enough to read.
- **The Org picture is honest but thin.** With two departments hidden, "which is biggest?" has one bar. A real Org floor would need departments to publish their own counts (as Parks has) before this picture says much. It should probably refuse the bar picture when fewer than half the rows have a number, and fall back to "no picture".
- **The check's wording is still a developer's.** "6 squares · 'six'" reads as debugging to an operator. In the product the strip should collapse to the verdict line ("Same digits at every height. It can go to all three"), with the table one step down.
- **The hover link from a bottom-line phrase to its squares** is done by matching titles in this prototype. A real build needs the `data-ref` handles from heights V3/V6 as a kit part.

## Principles
- **Explain, never hide:** strong. Every empty is drawn at every height with its own mark: the corner ticks, the wavy no-record mark, the 135° hatch with whom to ask, and the split square for two answers. Locked chips name a person.
- **Calm:** the check ticks once and then nothing moves.
- **Focus stacking:** the 1/2/3 view brings one copy near and hides the far copies' lower parts (`.deep`). It does not blur them, because round 1 found that blur reads as "disabled".
- **Letterbox:** not used. Nothing here is urgent.
- **Many deployments:** every name, floor, count, date and sentence part comes from `DATA`. Counts come from `q()` over `DATA.inspections`, and reading times come from `DATA.readWpm`.

## Needs
- **Tokens** (all mixes of kit tokens, at the top of `_src/a/common.css`): carried are `--x-proposed-gap*`, `--x-proposed-hatch`, `--x-proposed-stale`, `--x-proposed-unseen`, `--x-proposed-disagree(-wash)`, `--x-proposed-overdue(-wash)`, `--x-proposed-settled`, `--x-proposed-pencil(-edge/-wash)`, `--x-proposed-unbacked`, `--x-proposed-lit(-wash)`, `--x-proposed-unit`, `--x-proposed-stick-cell`, `--x-proposed-quiet` and `--x-proposed-type-micro`. **New** is `--x-proposed-reader`, the reader's floor colour, set per column from the existing `--floor-*-high` tokens. `--font-mono` is used for counts and keys and still needs an ADR.
- **Kit parts:** the unit square with its six states, the open or locked access chip, the reading-budget meter, and the same-digits verdict.
- **Artifacts:** a briefing that keeps one query and renders it per reader floor (three copies, one source). It also needs the published date on each copy, so D can say which copy is stale. Line-level provenance ("drafted by the assistant, inked by Sam Okafor").

## What Data Atlas and the model gateway would need to serve it
- **One query with three renderers.** Data Atlas has to return the rows once (`state per inspection`, with the six empties as states, not nulls). Then the headline template, the picture and the records are all drawn from that one result. A **same-digits check** runs before publish and again on every rerun, and it refuses to publish a copy whose heights differ.
- **Evaluate the query as each reader's floor** (the floor rule from `docs/atlas.md`), on the server: which sources each reader can open, and an exact count for the publisher with "some" for the reader. This is the "proof as floor X" endpoint from action V3.
- **"No record" as its own state per period** (Riverside's log didn't sync from 8 to 21 Oct), not zero and not a gap.
- **Expected items per site** (the inspection register), so "not known yet" exists at all (roof anchors at Northgate).
- **Counts other floors chose to publish** (Parks' "none, checked by Tom Ashby", kept on the Org floor), so the Org picture can show "none" as different from "some".
- **A rerun with a reason.** A copy published on 27 Oct must know which of the five reasons moved it. "A date passed" needs a clock in the events service, which does not exist yet.
- **Model gateway:** only the bottom line (one pencil slot) and suggested questions. It needs the claims, each with its ref and number, and a check that every phrase in the draft points at a claim and every number in it equals the claim's number (the check compares "six" with the 6 squares). With the gateway off, the template sentence stands in and the check is unchanged.

## Score
Clarity 4 · Distinctiveness 4 · Feasibility 4 (Quill: three renderers over one query, plus a server-side "as floor" evaluation) · Fit 4

## Where I went beyond the ask
- The **D key (a stale copy)** wasn't asked for. It shows the same-digits rule failing for a real reason, and it shows that the reason ("a date passed") is one AUGUR can't detect yet.
- I recommend that **the Org picture refuses to draw** when most departments are "some", and says "no picture: too little of the Org can be counted" instead. That is not built yet.
