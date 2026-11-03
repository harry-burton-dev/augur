# Combined V4: The decision sets the bar (`v4-the-decision-sets-the-bar.html`)

A briefing that feeds a Mandate decision: **"Close Northgate Depot?"** (intent M-361, owner Dana Whitfield, due 15 Dec 2026, kind "Close or open a site"). It is built by `_src/a/build.py` from the same `DATA` object as V1, so Northgate's "at least 3 overdue" here is the same query as in the three-readers briefing.

> **Needs Harry's decision:** a **standard of proof on Mandate decisions is new**. Mandate has nothing like it today. The screen labels it "proposed" next to the bar. Questions: does each kind of decision carry a bar, who sets it, and may anyone lower it for one decision? (I recommend it is set per kind by the kind's owner, never per decision.)

Keys: **L** lowers the roof claim's word (or undoes it), **X** takes out the struck phrase, **I** inks the bottom line, **B** previews another bar (almost certain, likely, back), **T** shows the technical words, **G** turns the assistant off, and **R** replays. Clicking **Lower** on any word card opens the same panel. The moment: about 1.2 s after load the cards settle and the bar line draws. At 2.2 s Sam opens "Lower" on the roof claim and gives a reason. At 3.2 s the card moves from "Clear the bar" to "Below the bar", signed. Checked at 1600×900 and 1280×800, with L, X, I, B, T and G, and with reduced motion. It has no console errors and no sideways scroll.

## Idea
The decision carries a **standard of proof**: "Close or open a site" asks for *highly likely or surer*. Each claim in the briefing is placed by rule into one of three columns: **Clear the bar** (rely on these), **Below the bar** (use them, and say the word) and **Needs someone first** (nobody can meet any bar until a named person acts). The verdict is a template: "Not ready to decide. 4 things need someone before 15 Dec 2026; 3 claims are below the bar…".

Every card carries a **card-size yardstick** with the bar marked as a lit tick, so a reader sees *why* a claim sits where it does:
- **A weak fact** sits *on* the scale, low. "Eastfield Yard has room for Northgate's 14 vehicles" is *a realistic possibility* from one ungraded phone note, two steps under the bar.
- **A dispute** is *lifted off* the scale. The two answers ("12" and "35" minutes) float over the cells they would reach alone, joined by a bracket over an empty scale, with no word and "Ask to decide: Dana Whitfield".
- **A gap** sits *below* the scale. The scale's cells are dashed, a corner-ticked "nothing to weigh" box sits under them, there is no word, and the card names who could fill it (Jo Reyes).
- **Out of date** keeps its old place hatched ("was highly likely, checked Jun 2021"). **Not yours to see** gets a hatched scale ("can't be weighed from this floor").
- **A count takes no word.** Its card shows "recorded" with a coverage meter ("settled 3 of 6"), so it reads "at least 3".

The **bottom line** is the model's one pencil slot. Its confidence word is a **slot filled by rule**: the weakest claim any of its phrases points at. Here that is "Eastfield has room" (5), so the line reads "It is A REALISTIC POSSIBILITY that closing Northgate…". The side panel names that weakest claim. One phrase, "the move would save money", points at a claim with no word (the running cost is not known yet), so it is **struck and blocks inking** until someone takes it out (X). Then it can be inked (I).

**An operator lowers one word with a reason.** Sam lowers the roof claim from *highly likely* to *likely* because "the survey is from before the 2025 patch repairs, and the quote comes from a firm that wants the job." The rule's word stays visible but struck through, the lowered word sits next to it, and the reason is signed. The card moves under the bar and the verdict count changes. The panel only offers words below the rule's word; the higher ones are disabled with "raising takes another source".

## Sources
Standards of proof in law (balance of probabilities, beyond reasonable doubt). The UK PHIA probability yardstick (the seven words) and the IPCC evidence × agreement grid (grades × agreement give the word). Military decision points. Confidence V4 (the bar) and V1 (the yardstick beside the page). The three ways to be unsure from confidence V2, V3 and V6 (on, lifted off, below). The pencil and the struck phrase from minute V1. Reach before act from action V4.

## What works
- **The verdict reads in two seconds, and the columns are a task list.** "Needs someone first" is four named errands (decide, fill, check, ask).
- **The three ways to be unsure are told apart by position on one drawing, not by colour:** a word on the scale, two answers lifted off it, an empty box below it. A manager doesn't need the legend, because the bar tick goes through every card and shows "under it", "over it" or "nowhere near".
- **"No surer than its weakest claim" is computed, not asserted.** The model wrote the sentence, but the word in it came from the rule. When Sam lowers the roof claim the weakest claim doesn't change, so the summary keeps its word. If he lowered "Eastfield has room" to *unlikely*, the summary's word would follow it. The line can't drift above its evidence.
- **Lowering is a small, signed act that never erases.** "~~Highly likely~~ likely · Lowered by Sam Okafor, 3 Nov: '…'" keeps the rule's answer and the person's judgement side by side, with Undo. Raising is not offered at all, and the panel says why.
- **Reach before act is one sentence at the foot.** Feeding M-361 puts it in front of Dana Whitfield and 4 followers on the Facilities floor. Their copy opens what 7 of 9 claims rest on, and for (5), Sam's own phone note, and (9), Southmoor on Depot operations, it says whom to ask. "Feed the intent" stays disabled while the bottom line is pencil.
- **G (assistant off):** the bottom line becomes the template ("The briefing rests on 9 claims; 2 clear the bar. Your recommendation: [you write it]"). No word, card or count moves.

## What fails or risks
- **Who sets the bar is governance, not design.** If anyone can lower the bar for one decision, it means nothing. B only previews, and the note says "the decision still asks for highly likely". Mandate has no such field, so this is the decision Harry has to make.
- **The columns lose the argument's order.** A decision brief also needs the prose in order (the minute's form). The columns are the readiness check that sits above it, not a replacement for it.
- **Lowering can be gamed downward to push a claim under the bar on purpose**, for example to stall a decision. The signed reason is the guard: it is visible to the decision owner and kept with the claim. A lead may want to see "3 words lowered by the author" in the verdict.
- **The card-size yardstick is wider than the word-size stick** and needs a new token. At 1280 the label beside it wraps. The two answers' pills overlap if they sit one cell apart with long values, so pills show only the number and the full answers are in the line below.
- **The "Needs someone first" column scrolls at 900 px** (the fourth card, "Not yours to see", is below the fold), as does "Clear the bar" when the lowering panel is open. A real build would need the column to say "+1 more" at its foot.
- **Grouping out-of-date and not-yours-to-see with disputes and gaps** is right for readiness ("someone must act"), but they are different in kind. The cards keep their own marks so the difference survives.

## Principles
- **Explain, never hide:** strong. Nothing below the bar is dropped: it is said with its word. Empties keep their marks and a named person. Disabled actions (Ink, Feed, raising a word) stay visible and say why.
- **Calm:** one sort and one move, then still.
- **Letterbox:** not used. The deadline is six weeks away. "Not ready to decide" with a deadline a few days off would be a PDR-009 moment, with the verdict as the urgent sentence and the frame decided by Mandate from the intent's due date, not by the author.
- **Focus stacking:** the moved card is lit for a few seconds after it lands.
- **Many deployments:** words, grades, the bar, names, floors and reasons all come from `DATA`. The word rule is one function (`wordOf`).

## Needs
- **Tokens:** everything V1 carries, plus **new** `--x-proposed-yard-cell` (one cell of the card-size yardstick, wide enough for two answers to sit over it). The bar tick reuses `--x-proposed-lit`. `--font-mono` still needs an ADR.
- **Kit parts:** the card-size yardstick (word, lifted, below, was, locked), the word with its rule-word struck (lowered), the slot word inside a pencil sentence, and the reach sentence.
- **Mandate:** a **standard of proof per kind of decision** (new; needs Harry), its owner, and the decision's readiness (counts per column) as something the intent can show. "Ask to decide" creates a request to a named person.

## What Data Atlas and the model gateway would need to serve it
- **A `derive()` per claim** returning `{kind, word, why, next, who}` from the observations' grades and agreement. It is the same rule everywhere and versioned like the ontology, and it is never stored on the claim. It must also return the **position each side would reach alone** for a dispute, so the two answers can be drawn over the scale.
- **Grades on every observation**, where ungraded counts as weak. **Independence**: two records copied from one origin count once.
- **Who decides a dispute and who could fill a gap**, per floor and detail. **A review age per detail** for "out of date".
- **A person's lowered word as its own observation**: the claim, the from-word, the to-word, who, when and why. It never overwrites the rule's word, it can be undone, and it is never allowed above the rule.
- **Claims in Artifacts bound to Data Atlas facts**, so the slot word is recomputed when a source is withdrawn or a word is lowered, and the bottom line's weakest claim follows.
- **Model gateway:** drafts the bottom line's prose only. It receives the claims with their ids and must return phrases tagged with the claim each points at. It never fills the word slot. Any phrase whose claim has no word (gap, dispute, hidden, stale) is struck by the check and blocks inking. With the gateway off, a template stands in and the recommendation is a blank for a person.

## Score
Clarity 5 · Distinctiveness 4 · Feasibility 4 (Quill: three lists plus a FLIP move; the hard part is Mandate's new field and `derive()`) · Fit 4

## Where I went beyond the ask
- **The bottom line's word is a slot filled by rule.** The ask said "no surer than its weakest claim". I made the word itself computed, so the model can't write it at all.
- **Reach before act sits on the same screen** (who on the intent's floor can open what), because feeding an intent is the action this briefing exists for.
