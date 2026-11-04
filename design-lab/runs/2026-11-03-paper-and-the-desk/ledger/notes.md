# Surface 6 · Corrections and audit

**The moment:** a Data Atlas fact, "Elm Court Block C · boiler install year", has six ledger entries:
1. Set to 2014 by an import from the asset register (12 Mar 2024).
2. Cited by the Gas safety plan 2026-27.
3. A contractor survey says 2017, and the fact turns disputed.
4. Held by Amara for triage.
5. Rui adds a photo of the boiler data plate: "06/2017".
6. Today at 10:41 Amara posts a correction to 2017, with a reason and Lena Fischer's countersign.

Two documents cite the fact. One of them was approved by Joe Park on the strength of 2014.

**Files:** built from `../_src/ledger/v*.src.html`. R replays, and each page lists its own keys.

---

## V1: The account
*Idea.* The fact is kept as an account. Every change is a numbered entry with a date, a name (or "an import" or "a rule"), a source, and the value after it, read like a running balance. The value is carried down from the last line, under a double rule. Documents that rely on the value are told with one line each.

*Sources.* Double-entry bookkeeping (Pacioli, 1494): entries are never erased, mistakes are put right by a new entry, and the balance is carried.

*What works.* "Value after" per line is the ledger idea that matters: anyone can see what the value was at any entry. The three rules ("never edited or removed", "every entry has a date, a name and a source", "the value shown everywhere is the last line's balance") fit on a card. "?" beside disputed balances is quiet and clear.

*What fails or risks.* A fact with hundreds of observations needs the overview rung (group by source, fold the cites). "Cited" entries are not changes to the value, so they could live in a separate column.

*Principles.* *Visible repair* and *history as a material*: yes. Explain, never hide: strong. Calm: yes.

*Needs.* Facts kept as entries (Data Atlas already keeps observations per source; this adds corrections as entries with a reason).

*Scores.* Clarity 5 · Distinctiveness 3 · Feasibility 4 · Fit 4

## V2: Strike in place
*Idea.* The correction sits where the value is read. One line through 2014, so it stays legible, 2017 beside it, then initials, a time and a reason. The same four-part mark works in a document paragraph (section 2's "48 h" struck for "24 h").

*Sources.* Good documentation practice (ALCOA+): a single line through, initials, date and reason; never obliterated, no correction fluid, no pencil.

*What works.* You see the correction where you read the value, not in a history tab. "A value that was never wrong has no mark at all, so a mark always means something happened" stops marks from turning into noise. One rule for facts and documents.

*What fails or risks.* Struck values pile up on a much-corrected field. The page proposes folding to a "corrected" tag after 90 days (the 90 is a placeholder and should be a setting). Strikethrough alone is a weak cue for screen readers; it needs "was 2014" in words.

*Principles.* *Visible repair*: this is it. Explain, never hide: yes.

*Needs.* `--x-proposed-strike`; a fold rule.

*Scores.* Clarity 5 · Distinctiveness 4 · Feasibility 4 · Fit 5

## V3: The custody balance
*Idea.* Every handover is written twice: given (in the giver's book) and taken (in the taker's). A trial balance per person totals gave, took, and offered to them. Four checks run under it: given = taken + offered, held by nobody = 0, held by two = 0, and still in the zone = 1. The moment: Amara takes M-212 and the balance closes by one.

*Sources.* Double entry and the trial balance.

*What works.* "The books prove themselves": the first three checks can only fail through a bug, and if they do the board says so in words. It is an audit view a non-accountant can read.

*What fails or risks.* Mostly a back-office view; few people need it daily. The balance per person can look like a scoreboard (Nkechi "gave 2").

*Principles.* Explain, never hide: yes. Calm: yes.

*Needs.* `offer` and `readback` records (the two halves).

*Scores.* Clarity 4 · Distinctiveness 4 · Feasibility 4 · Fit 3

## V4: The day book
*Idea.* One journal for the team's day, in time order and in sentences. Each line is posted to the thing it is about, so filtering to F-3301 dims the rest and shows the fact's own account beside it. A line is written once and appears in both. Private cocks appear in neither.

*Sources.* The journal and the ledger; the ward day book.

*What works.* It answers "what happened today?" for a lead in one read, and "how did this get here?" for one thing, from the same marks. It shows that AUGUR (the automatic posting) writes lines too, as itself.

*What fails or risks.* A busy team's day is hundreds of lines, so it needs grouping by hour or by thing. It overlaps with Home's activity, if there is one.

*Principles.* Calm: lines are added, nothing moves. Explain, never hide: yes. *Mine versus ours*: cocks are private.

*Needs.* A team journal query over marks.

*Scores.* Clarity 4 · Distinctiveness 3 · Feasibility 4 · Fit 4

## V5: The correction slip
*Idea.* There is no edit button on a fact. To change a value you fill a slip: from, to, why, evidence, countersign. A preview shows the one ledger line it will write and who is told, and where. Posting stays locked until why and evidence are filled.

*Sources.* Bank correction slips; journal vouchers.

*What works.* "A correction without why and evidence is just an edit" is a clear rule, and the slip makes it cheap to follow. The countersign by the steward fits Data Atlas's triage ("nothing skips it").

*What fails or risks.* A typo fix needs a lighter path. A slip for every change is too heavy, so the slip should apply to facts that are cited, disputed or past a set age.

*Principles.* Explain, never hide: the missing edit button says why. Consequence preview: yes.

*Needs.* A correction record with evidence and countersign.

*Scores.* Clarity 4 · Distinctiveness 4 · Feasibility 4 · Fit 4

## V6: The card drawer
*Idea.* One claim per card, numbered by where it branches, as in Luhmann's Zettelkasten. Card 1 is the import, 1a disputes it, 1a1 is the evidence, and 1b is the correction filed behind what it corrects. The value is the newest card that no later card corrects.

*Sources.* Niklas Luhmann's Zettelkasten (one idea per card, linked by number); library card catalogues.

*What works.* Branch numbering shows how a claim was argued, which a flat ledger hides: 1b rests on 1a1, which disputes 1. It is the right model for disputed facts with several sources.

*What fails or risks.* Branch numbers ("1a1") mean nothing to most operators. It is a model for the data, not a view people should read. The link drawing gets busy past five cards.

*Principles.* Explain, never hide: yes. Calm: yes.

*Needs.* Entries that point at what they answer.

*Scores.* Clarity 3 · Distinctiveness 4 · Feasibility 3 · Fit 3

---

## Ranked
1. **V2 Strike in place**: the four-part mark, where the value is read.
2. **V1 The account**: entries with value after.
3. **V5 The correction slip**: why and evidence, or it is just an edit.
4. V3 The custody balance (back office).
5. V4 The day book.
6. V6 The card drawer (a data model, not a view).

**What I'd build first.** V2's mark on every corrected value and paragraph, backed by V1's account and V5's slip for facts that are cited or disputed. Combined V4 adds the step none of these takes alone: the stamps that covered the old value are told precisely, because each stamp says what it covered.
