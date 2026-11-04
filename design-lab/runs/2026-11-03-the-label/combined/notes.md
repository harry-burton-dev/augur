# Round 2 · Combined screens

Four screens that combine the strongest round 1 variants into something that could ship. All four share the run's one sample (`_src/data.js`): Halden Estuary Ports, the Marlow Star grounding, the pilot's time on duty, Leah Morgan's briefing and the Pilotage safety records collection. Every marking word, use, rule and count comes from the deployment's policy object; **S** swaps in a second deployment's policy on every screen and nothing else changes. Built by `_src/build.py` from `_src/combined/v*.src.html`.

Checked by screenshot at 1600×900 and 1280×800 with no console errors or warnings and no sideways scroll (`_src/check.js`). Reduced motion swaps movement for crossfades.

---

## V1: One fact, four places (the end-to-end flow the prompt asked for)
*Idea.* One sensitive fact, the pilot's time on duty, followed through four places side by side: the **source** (Kofi's initial report §3 in Artifacts, the value underlined by what it contains), the **fact** in Data Atlas (same label, plus share SR-0193 to Leah), the **answer** in Explorer ("2 of 5 groundings over 12 hours": PERSONAL comes off by rule 3, it stays OFFICIAL-SENSITIVE, the per-grounding hours are "counted, not shown", and it was never sent to the model gateway) and the **briefing** shared with the Safety committee (banner raised by ¶3, ¶4 "One of them was the Marlow Star" stopped by the label). Under each place: its label, its uses, and **what changed on the way in**, as small chips ("label unchanged", "− PERSONAL by rule 3", "¶4 stopped by the label", "+ receipt SR-0201"). The custody chain runs along the foot and fills in as the value travels. The moment lights the path station by station.

*Taken from.* Record V4 (marked in the ink), record V3 (margin label and copies), record V2 (as a count), sharing V1 and V2 (the paragraph check), custody V1 (the chain, with its break), grammar V1 (portion marks and banner), the reference desk's pencil and ink, the briefing run's lit path.

*What works.* It answers the prompt's hardest question in one picture: the label is never lost, only **said another way by a rule that names itself**, and every change of label is a chip you can read. The answer's "−PERSONAL, stays O-S" is the strictest-wins rule with its one exception stated. The model gateway line shows enforcement where AUGUR can actually enforce.

*What fails or risks.* Four columns at 1280 are tight; the source paragraph and the briefing scroll. It is a story view for training and audit, not a working screen; in daily use each place shows only its own label and its diff from the last hop.

*Principles.* Explain, never hide: strong (every change named). Focus stacking: the current place lit, others desaturated, never blurred, because you compare them. Calm: the path lights once.

*Needs.* Labels per value in Data Atlas; label-carrying quotes in Artifacts and Explorer; a shared combine rule; custody events from all three apps; the model gateway honouring "model use: may not".

## V2: Not for you, and the way to yes
*Idea.* Sam Ito (VTS) on the Marlow Star record. Every value he can't open says **which kind of no** (said another way; ask someone; only the person it's about), why, who can change it and **when it opens** ("in counts from 12 Nov 2026, in Fatigue and groundings, 2026"; "never to you; kept until 31 Mar 2034"). The radar blind sector is his (VTS keeps it). Picking a locked value opens the ask as one sentence: whom to ask is worked out, the purpose is checked as he picks it, and "Or wait" offers the date it reaches him anyway.

*Taken from.* Not for you V4 (four kinds of answer), V6 (ask in a sentence), V5 (closed until and the embargo), V3 (the always-present "not told" line), record V5 (seen as).

*What works.* The "or wait" line is the run's best small find: many asks are unnecessary because the value is already on its way as a count. Nothing says "access denied".

*What fails or risks.* The kind-of-no line under each value is long; in a dense record it should collapse to the icon and open on focus.

*Principles.* Explain, never hide: strong. Calm: yes.

*Needs.* Purpose-bound requests; embargo dates on shares; "when it opens" worked out from keep rules and embargoes.

## V3: Share with the reach and the label
*Idea.* Sharing the briefing. A reach ruler on top shows the audience on one scale with each paragraph's limit drawn on it ("¶4 stops" before the committee, "¶3 stops" before the whole department). Below, a distribution slip with one line per recipient and the label's verdict per line, and the paper as the selected recipient would get it. Adding All-staff news (the moment) marks two paragraphs that can't go; F sends it without them, with the reason kept for the receipt. Adding the coastguard (4) opens the letterbox, because leaving the organisation is the one share that earns it.

*Taken from.* Sharing V4 (ruler), V2 (slip), V6 (letterbox at the edge), V5 (receipt), record V1 (portion marks).

*What works.* Limits before choice, verdicts per recipient, no silent partial sends, and the letterbox reserved for the irreversible act. One rule (`shareCheck`) drives the ruler, the slip, the copy and the letterbox, so they can't disagree.

*What fails or risks.* The log ruler places a 9-person group in the Team band, which reads oddly. The slip needs a "for" and "until" per line (shown in sharing V2, left out here for space).

*Principles.* Reach before act: strong. Letterbox: only at the organisation's edge. Explain, never hide: strong. Calm: yes.

*Needs.* The same paragraph check on the server at send time; receipts; lawful basis on outside shares.

## V4: The collection's label
*Idea.* Pilotage safety records, read before use. Left: the dataset facts panel with parts by weight, % of expected, contains, consent, licence and the marking (worked out from the parts). Right: "I want to …", with the six uses as pills; each part's row shows its coverage by year (with its kind of empty) and its verdict for that use; the total says what you can take ("283 of 312 records, some only as counts").

*Taken from.* Dataset V1 (panel), V6 (by weight; consent), V4 (coverage), V5 (fit for use).

*What works.* What it is, where it's thin and whether it fits your use, on one screen. Choosing "reporting" fades the fatigue diaries and says why (consent is for the investigation only).

*What fails or risks.* The panel's black-rule style is a quotation and may sit oddly beside the water language. "You'd be missing" (dataset V5) didn't fit and should come back.

*Principles.* Explain, never hide: strong. Calm: yes.

*Needs.* Expected counts per source, coverage notes, consent counts per part, and a collection label computed from its parts.

---

## What I'd build from round 2
V1 is the reference: it proves the model end to end and should become the spec for the label object, the combine rule and custody events. V3 is the first working screen to build (sharing is where labels pay for themselves), then V2's kinds of no and "or wait", then V4 as the collection page in Data Atlas.
