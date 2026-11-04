# Surface 2 · The label on a record

**The moment:** the Marlow Star grounding (Data Atlas record E-2207, kept by Marine Operations) carries eight values with five different labels: the time and place and vessel (OFFICIAL), the pilot's name and his time on duty (OFFICIAL-SENSITIVE · PERSONAL, caveat "count only beyond Pilotage"), his fatigue diary (PERSONAL, given by consent), the tug's refloat charge (COMMERCIAL, kept by Commercial) and the radar blind sector (PORT SECURITY, kept by VTS, existence hidden). Each variant shows the label on the record and what happens when a value is quoted elsewhere. Leah Morgan (Marine safety officer) sees the pilot's name and hours through share SR-0193 from Kofi Mensah, and the diary through consent CR-0042.

**Keys:** R, T, S as everywhere; each page lists its own.

---

## V1: Banner and portion marks
*Idea.* GSC practice on a record. Every value starts with its portion mark ((OFF), (O-S P), (O-S C)); the record's banner at head and foot is the strictest value **this reader can see**. Quoting a value (Q) into a draft carries its portion mark with it, and the draft's banner rises, with the reason written under it: "Raised to OFFICIAL-SENSITIVE by the quote 'pilot's time on duty'. Remove it, or quote it as a count, and it drops back." X removes the last quote.

*Sources.* UK GSC banner and portion marking; Microsoft Purview sensitivity labels as software prior art (labels that follow content between documents).

*What works.* The strictest-wins rule becomes visible and, more importantly, **says which part caused it and the way back down**. Portion marks are tiny and scan well in a list. Locked values stay in place with whom to ask; the radar sector is absent and the general line ("some details are kept from you without a mark…") is on every record.

*What fails or risks.* Portion marks are jargon until learned; the deed fixes that per mark, but the first week will be confusing. A banner that depends on the reader means two people see different banners on the same record, which must be said ("the strictest value *you* can see").

*Principles.* Explain, never hide: strong. Calm: the banner changes once per quote. No letterbox.

*Needs.* Labels per value in Data Atlas; label-carrying quotes in Artifacts; a combine rule shared by both (see SHORTLIST).

*Scores.* Clarity 4 · Distinctiveness 3 · Feasibility 4 · Fit 4

## V2: Quote it as
*Idea.* Quoting asks how to say the value: **as it is** (keeps O-S PERSONAL; only Pilotage's 14 readers of the draft's 86 see the figure, the rest get "counted, not shown"), **as a count** ("2 of 5 groundings over 12 hours": PERSONAL comes off by rule 3, it stays O-S, all 86 read it) or **as a link** (the draft holds no value and stays OFFICIAL; each reader who follows it gets their own view). Each option previews the sentence, the draft's label and a bar of who reads what.

*Sources.* Creative Commons deed; Ted Nelson's quotation versus transclusion; statistical disclosure control (counts over a minimum group).

*What works.* It turns the label from a blocker into a choice made at the right moment, and the "who reads what" bar is the reach before the act. "As a link" is a real answer to over-classification: the document stays OFFICIAL and the value keeps its own access.

*What fails or risks.* A dialog on every quote is too much: it should appear only when the value's label is stricter than the destination's. "As a count" needs an answer behind it (here A-77); quoting a single value as a count only works when that count already exists.

*Principles.* Explain, never hide: strong. Reach before act: yes. Calm: yes.

*Needs.* Transclusion (live links that render per reader) in Artifacts; a count-making path from Data Atlas.

*Scores.* Clarity 5 · Distinctiveness 4 · Feasibility 3 · Fit 4

## V3: Margin labels
*Idea.* The record reads clean, like an object in a case, and each value's label hangs in the margin beside it, the way a museum hangs its labels, joined by a dotted tie. Each margin label also lists **where the value's copies went** ("D-1186 §3 (source) · Answer A-77 as a count · B-31 ¶3 as a count").

*Sources.* V&A gallery label guidelines and Beverly Serrell's *Exhibit Labels*; marginalia.

*What works.* The best reading layout in the set: values first, handling second, never mixed. Copies in the margin answer "if I change this, what else changes?" before you ask.

*What fails or risks.* Twice the width of a plain record; at 1280 the margin crowds. Use symbols without words are unreadable at margin size. Two columns that must stay row-aligned are fragile in a responsive layout.

*Principles.* Explain, never hide: good. Calm: very. Hierarchy without containers: yes.

*Needs.* A reverse index of quotes per value (Artifacts and Explorer must report where they quoted from).

*Scores.* Clarity 4 · Distinctiveness 4 · Feasibility 3 · Fit 5

## V4: Marked in the ink
*Idea.* In a document, the label is in the ink: a PERSONAL value is underlined dotted, a COMMERCIAL one double, each with a tiny superscript letter, and the paragraph has its portion mark. Nothing else: no chips, no colour. Selecting a section copies it (C), and the clipboard says what it carries ("OFFICIAL-SENSITIVE · PERSONAL from pilot on board and pilot's time on duty").

*Sources.* Allergen emphasis in ingredient lists; GSC portion marking; spell-check underlines as a familiar in-text mark.

*What works.* The quietest label in the run, and the only one that works inside prose. An author sees which words make the paragraph sensitive, which is exactly what they need to rewrite it down.

*What fails or risks.* Underlines compete with links and spelling marks; the styles must be reserved. Detecting labelled values inside prose only works when the value was inserted as a value (a quote), not typed; typed values have no label (custody V6 shows the cost).

*Principles.* Explain, never hide: good. Calm: the best.

*Needs.* `--x-proposed-ul-personal`, `--x-proposed-ul-commercial` (needs token). Values inserted into Artifacts documents as labelled inline objects.

*Scores.* Clarity 4 · Distinctiveness 4 · Feasibility 3 · Fit 5

## V5: Seen as
*Idea.* One record, four readers (Kofi in Pilotage, Leah in Marine Operations, Sam in VTS, Owen in Commercial). Switching reader turns each value, in place, into what that reader gets: the value, the value said another way ("a pilot"), a locked slot with whom to ask, or nothing at all. The banner follows the reader.

*Sources.* Printer's proofs; "View as" in social network privacy settings.

*What works.* The clearest demonstration of the caveat at work, and the right tool for the person who sets a label ("what will Commercial see?"). The tally is honest about what the design view knows and the reader doesn't ("this count is for the design only").

*What fails or risks.* For the keeper and admins only: an operator never needs to see others' views. "View as" needs server-side rendering per reader, or it lies.

*Principles.* Explain, never hide: strong, including the honest "not told" tier. Calm: one crossfade per switch.

*Needs.* A "render as reader" endpoint in Data Atlas, permission-checked.

*Scores.* Clarity 5 · Distinctiveness 3 · Feasibility 3 · Fit 4

## V6: At the edge
*Idea.* AUGUR can carry a label anywhere inside it; once text leaves, nothing follows. So copying out is decided at the moment of copying: the hours themselves can't leave (struck, with the clause), the count can (it lands with "OFFICIAL-SENSITIVE" written first, as GSC asks of emails), and a link can (it opens only for people who may see it). Inside AUGUR the same paste keeps its label.

*Sources.* GSC handling of marked email; data loss prevention practice.

*What works.* It is honest about the system's edge, the place labels usually fail silently. Marking in words on what leaves is cheap and real.

*What fails or risks.* Clipboard control in a browser is weak: AUGUR can offer a marked copy, not prevent a plain one (select and copy still works). It must be framed as help, not enforcement, or it promises what it can't keep.

*Principles.* Explain, never hide: strong. Calm: yes.

*Needs.* A copy handler per app (Quill), and the "outside" use wired to it.

*Scores.* Clarity 4 · Distinctiveness 4 · Feasibility 3 · Fit 3

---

## Ranking
1. **V1 Banner and portion marks**: the rule that must ship: strictest wins, names its cause, shows the way down.
2. **V2 Quote it as**: as it is, as a count, as a link; only when the label is stricter than the destination.
3. **V4 Marked in the ink**: for Artifacts documents.
4. **V3 Margin labels**: for Data Atlas records, with copies listed.
5. **V5 Seen as**: for keepers and admins.
6. **V6 At the edge**: as help, not as a promise.

**What I'd build first.** Portion marks on every value and a reader-relative banner (V1), with the "raised by" line and its way down. Then the quote dialog (V2), shown only when a quote would raise the destination's label. Values quoted into Artifacts carry their label in the ink (V4).
