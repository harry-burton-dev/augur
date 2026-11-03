# Combined V4: More like this one

`v4-more-like-this-one.html` · source in `_src/b/` (`python3 _src/b/build.py`; the same
Halden Regional Services sample as V3: 24 contracts you can see on Facilities and above,
some more on the Finance team floor).

Combines **example/V2 pin what matters** (the record card with a pin per detail, near
misses kept), **example/V6 loosen the sentence** (the example said as a sentence, the
answer coming back in it), **example/V3 like these, not that** (a counter-example and
“what tells them apart”, found from the record), **workings/V6 two hands** (the model’s
matches as a separate lane, proposed to Triage), and **saved/V2 + V6** (the kept question,
“same count, different rows”, the five reasons).

## V4: More like this one

*Idea.* Rosa is on contract C-114 and wants “more like this one”. The sentence at the top
starts as the record’s own (“C-114 is a general waste contract with Northgate Haulage in
the North, worth £140k a year, ending 30 Nov 2026”), every word a pin. Pinning a detail
on the card (same / same year / about this / any, each showing the count it would leave)
**loosens the sentence into a question**, with the count inside it: “**2** more contracts
like C-114: waste, in the North, ending this year”. Unpinned details are listed as
*Loosened: any kind · any amount · any supplier*. The answers come back in the same
shape, one sentence per contract, differing words dotted. Pointing at C-131 as **not like
that one** makes the desk say what the record can tell apart (kind of waste: general vs
clinical, *tells them apart*; worth £140k vs £160k, *too close*) and adds “but not clinical
like C-131”. Pinning *in their own words → alike by meaning* is the only model step:
a pencil clause in the sentence and a pencil lane in the answer (C-188 grass cuttings,
C-138 sanitary bins), not counted, not saved, with “propose it to Triage” as the only way
in. **G** removes the clause and the lane; the count stays 2. **Save** freezes the
example as it was (sepia slip: “C-114: general waste · the North · ends 30 Nov 2026 ·
£140k”, “this year” fixed as 2026). A week later C-114 is extended to March 2027 (*something
happened*): the kept question offers **as it was** (C-207, C-150) or **as it is now**
(C-163, C-171): same count, different rows, with who leaves and who joins.

*Sources.* Zloof’s Query by Example (1975: the example element); Shneiderman’s
HomeFinder (every control shows what it would leave); identification keys (the
counter-example narrows); the catalogue’s “said in a sentence”; double reading in
screening (the model as a second, separate reader); bitemporal “as at” dates.

*What works.*
- **One shape for record, question and answer.** The record’s sentence, the loosened
  question and each answer row read the same way, so there is nothing new to learn.
  Pins on the card and words in the sentence are the same controls seen twice.
- **Counts before choices.** Each pin shows how many would be left (same 2, any 7)
  before it is pressed; the count in the sentence rolls as pins change.
- **Every contract on exactly one line.** Example + alike + can’t tell + set aside + one
  way + more = 24 of 24 ✓; the model’s 2 sit *outside the sum* and say so. C-198 (end date
  not known yet) is “can’t tell”, with Priya Shah named in a corner-ticked blank inside its
  sentence, never dropped.
- **The counter-example finds the missing detail from the record**, with no model:
  the pins couldn’t separate C-114 from C-131; the record can (waste stream). It is also a
  neutral question in disguise: the person never had to know “waste stream” existed.
- **Freezing is visible and the alternative is offered, not imposed.** “As it was” is the
  default and sepia; “as it is now” is one press away with the difference stated. Because
  the count is the same (2 and 2), it shows why a watch must compare rows.

*What fails or risks.*
- Ranking by number of differing details treats every detail as equally important; a
  supplier difference and a £2k value difference count the same.
- “About this” (half to double) is a hidden rule; it is in the T line but should be
  editable by an admin per detail.
- The counter-example picks the *first* categorical detail that separates; with several
  candidates it needs to ask (“kind of waste, or supplier?”), only if they give different
  rows.
- Long answers: sentences take room. Past ~20 alike rows it needs a table toggle with the
  sentence as header (catalogue finding).
- At 1280×800 the card and the keep panel scroll; the sentence wraps to two lines.
- “Same year” is a relative pin anchored on the example. Frozen, it reads “this year
  (2026)”; that must be shown on the kept card or a reader in January misreads it.

*Principles.* Explain, never hide: near misses and set-asides stay visible with their
reason; Finance’s contracts are “some” with whom to ask. Consequence preview: counts on
every pin, and the as-it-was / as-it-is-now choice. Calm: one roll of the count per change,
nothing loops. Focus: the example card carries a faint beacon glow (light language);
no letterbox (not urgent).

*Needs.*
- Tokens (mixes, top of `_src/b/common.css`): `--x-proposed-pencil`, `-pencil-wash`,
  `-beacon`, `-beacon-glow`, `-then`, `-then-wash` (sepia “as it was”), `-lit`,
  `-lit-wash`, `-here`, `-here-wash`, `-gap*`, `-unseen`, `-quiet`, `-type-micro`. The
  counter-example uses `--danger` at 45% (a mix, not a new colour); it may deserve its own
  token so “not like” isn’t read as an error. `--font-mono` relied on.
- Kit parts: a pin chip with a count; a sentence template per kind; a frozen-record slip.

*New employee test.* **Passes** (judgement). “Pin what has to match; the sentence says
what you asked” lands at once. The counter-example needs its first use to be shown.

*Score.* Clarity 4 · Distinctiveness 4 · Feasibility 4 · Fit 5

### What Data Atlas would need (against docs/atlas.md)
- **A sentence template per kind** (contract: “{id} is a {stream} {category} contract
  with {supplier} in {area}, worth {value} a year, ending {end}”), kept with the ontology
  and translated by admins, so the sentence is never written by the model.
- **A “same / near” rule per detail type**, owned by admins: exact for categories, same
  year for dates (and “still running”), a band for money.
- **Counts per pin before it is chosen**, fast enough to price 7 details × 2–3 options on
  every change (one count query per option, or a small facet index per kind).
- **A “tells them apart” step**: given example and counter-example, list the details
  that differ, mark which separate the current answer, and which are too close to use.
- **A saved question that stores the example’s pinned values as they were** (not a
  pointer to C-114), the counter-example likewise, relative words fixed to their value,
  the time asked and whose access; never the rows. A rerun “as it is now” re-reads the
  example’s current values and reports the change with one of the five reasons.
- **Two dates on every fact** (when it happened, when it arrived), so “as it was on 3
  Nov” is exact even after C-114’s variation.
- **“Some” across floors** for Finance’s contracts, with the floor lead to ask.

### What the model gateway would do (and what works without it)
| Step | Without the gateway | With it |
|---|---|---|
| Pins on category, area, dates, money, supplier | All of them | No change |
| Counter-example: what tells them apart | From the record’s details | Adds “their words read differently” in pencil |
| Alike by meaning (in their own words) | Unavailable; says who can turn it on | pgvector over `rdfs:comment`; a pencil lane, never counted, never saved |
| The sentence and the answer’s words | Template | Template, never the model |
| Rerun of the saved question | Always without | Never called; the meaning step is not kept |
| Making a meaning match a fact | — | Only by proposing it to Triage, where it keeps “proposed by the model” |

## Open questions for Harry
1. When a saved example has changed, should “as it was” stay the default (as built), or
   should the question ask once and remember the choice?
2. May “alike by meaning” ever be kept with a saved question (as a stored list of
   matches, rerun without the model), or is it always dropped (as built)?

**Where I went beyond the ask:** “same count, different rows” as the frozen-vs-now
comparison; the counter-example reporting which differences are *too close* to use; and
the model’s matches pointed at Triage, never at the answer.
