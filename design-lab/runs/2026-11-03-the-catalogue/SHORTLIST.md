# Shortlist: the catalogue

Ranked by what I'd build first. The headline: **an operator can read Data Atlas's structure if every structure is said in a sentence and every empty slot says which kind of empty it is.** Four of six surfaces arrived at the same answer separately: the gap needs its own mark, apart from wear and time's "no record", and it must name who could fill it.

| # | Build | Look at | Why it ranks here |
|---|---|---|---|
| 1 | **Six ways to be empty**, one mark set in the kit: not known yet (corner ticks, who could fill it), none (who checked), doesn't apply, stale (45° hatch), no record (wavy break), not yours to see (135° hatch, lock, whom to ask). A thing nobody could place is a separate state, "Waiting in Triage" | [Two registers](grammar/v6-two-registers.html), [Operator's first day](combined/v2-operators-first-day.html), [When the structure changes](combined/v4-when-the-structure-changes.html) | Every other screen depends on it, and it is small: one kit part and six tokens. |
| 2 | **Statements for one record**: one plain sentence per detail; a gap is a blank inside the sentence that keeps the shape of its answer (date cells, a band, a "pick an organisation" slot); sources that disagree sit side by side | [Statements](card/v2-statements.html), [Honest form](card/v5-honest-form.html), [Card with a back](card/v6-card-with-a-back.html) | It passed the "new employee" test best of all 36. |
| 3 | **A sentence of facets over a table of one kind**: "Show me contracts about waste in the North that end this year", and every choice shows the count it would leave before you pick it | [Three ways to read](combined/v1-three-ways-to-read.html), [Sentence](facets/v3-sentence.html), [Facet map](facets/v5-facet-map.html) | The honest comparison: table fastest for comparing (3 steps), cards for one thing (2), facets slowest on five records (6) but the only one whose cost doesn't grow with more. So: table plus sentence header for lists, statements for one record. |
| 4 | **The contents page** as Data Atlas's front page: floors are parts, kinds are entries, "See:" lines are links, kinds nobody has made yet are dashed | [Contents page](shape/v4-contents-page.html), [Table of kinds](shape/v2-periodic-table.html) | It reads like a book an operator already knows how to use. |
| 5 | **Placing a new thing**: questions fill in "A ___ that ___"; near matches and a likely duplicate show as it fills; what fits nothing waits in Triage naming who decides, and the admin makes the kind from the operator's own words | [Placing and waiting](combined/v3-placing-and-waiting.html), [Sentence](placing/v6-sentence.html), [Questions](placing/v2-questions.html) | It stops "I can't find where this goes" turning into a lost record or a junk kind. |
| 6 | **Change arrives as work**: a consequence preview before an admin adds a detail (records by floor, gaps made, who will be asked), then rounds of small jobs per keeper, then one notice per person that folds to a seam | [When the structure changes](combined/v4-when-the-structure-changes.html), [Consequence](change/v4-consequence.html), [Round](change/v6-round.html) | 702 gaps became 31 short questions. Needed once the ontology starts to grow. |

**Worth keeping as options:**
- [Five questions side by side](facets/v1-five-questions.html) (Ranganathan's PMEST as columns) for admins.
- [Every record](shape/v6-every-record.html): one cell per record, with "show which lack Mileage".
- [Rewind trail](facets/v6-rewind-trail.html): undone filter steps wait as a branch.
- [Field guide](grammar/v1-field-guide.html) as the operator's printed key to the words.

**Not worth pursuing:** the [line map](shape/v5-line-map.html) and [readers' diagram](shape/v3-readers-diagram.html) (pretty, but operators read them as routes and flows); [live sliders](facets/v4-live-sliders.html) (quick for analysts, lost on operators); [shelf of spines](change/v5-shelf.html).

**Answers to the prompt's questions:**
- *Which ontology terms can operators see?* Three tiers ([Two registers](grammar/v6-two-registers.html)): plain words always (kind of thing, detail, link, filter, card, where it came from, kept on, should have); the admin word one line under it, which anyone may turn on with T; studio words (IRIs, OWL and SHACL terms, raw ids, grade letters on their own) never reach an operator's view. Search understands both registers.
- *Is the gap the same as "no record"?* No. The gap is about space (this card should hold it, nobody has recorded it) and can close; "no record" is about time the system lost and can't. Stale is about age; "not yours to see" is about access. Only the gap is drawn with corners.
- *What Data Atlas would need:* expected details per kind (a minCount or "expected" flag; without it a gap is only an absence); who fills each detail per floor; a sentence template per detail plus groups and order per kind; a value format per detail (date, band, unit) to draw the shaped blank; counts per kind and per facet value, safe across floors; detail-level Used by (Mandate binds intents to entities, not details); restricted details that say they exist without showing their value; a "waiting" state in Triage with who decides; and change rounds (who keeps which site).

**Where these push back:**
- Facet counts for records on floors you can't open can leak what exists. The prototypes show "some", not a number. **Needs your decision:** exact, "some", or a count for a whole kind only.
- Lists mixing kinds are where the table breaks. Data Atlas should default to a list of one kind.

**Decisions for Harry** (none taken):
1. Hidden counts across floors: "some" (as built), exact for admins, or kind-level only.
2. Default lists to one kind at a time.
3. May a keeper confirm a whole site's answers with one "yes", or must each row be confirmed?
4. Whether the six empty marks go into the kit (Quill and Common) as one part, which needs a small record because Artifacts and Mandate would use it too.

**Gaps:** `--x-gap` (corner ticks) and the other mark tokens; `--font-mono` still needs an ADR (every variant used it); a shell preference for "show admin words".
