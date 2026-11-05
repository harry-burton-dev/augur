# The type specimen (data track, run 1)

What Data Atlas's identity model looks like if it works like biological
nomenclature: each entity hangs on one record, names are dated, a merge
places one entity under another, and a split brings it back. Read
[`SHORTLIST.md`](SHORTLIST.md) first, then [`grammar.md`](grammar.md).

## Every variant and its check score
`check.py` runs schema, seed and the six questions. The migration check
(`check-migration.py <from> <to>`) loads the earlier variant's data, applies
`migrate.sql`, and runs this variant's questions on the result.

| Surface | Variant | check.py | Fails | Migration check |
|---|---|---|---|---|
| Identity | [V1 label and key (today)](identity/v1-label-and-key/) | 3/6 | Q2 Q3 Q6 | (the baseline) |
| Identity | [V2 the type specimen](identity/v2-type-specimen/) | 5/6 | Q6 | |
| Identity | [V3 the number is the name](identity/v3-the-number-is-the-name/) | 5/6 | Q6 | |
| Identity | [V4 same as](identity/v4-same-as/) | 2/6 | Q1 Q2 Q5 Q6 | |
| Merge and split | [M1 redirect and move](merge-split/m1-redirect-and-move/) | 5/6 | Q6 | 2/6 from identity V1 |
| Merge and split | [M2 synonymy by rule](merge-split/m2-synonymy-by-rule/) | 6/6 | | 5/6 from identity V2 |
| Merge and split | [M3 the register](merge-split/m3-the-register/) | 6/6 | | 5/6 from identity V2 |
| Merge and split | [M4 evidence and conclusion](merge-split/m4-evidence-and-conclusion/) | 6/6 | | 4/6 from identity V4 |
| Across time | [T1 keep the answer](across-time/t1-keep-the-answer/) | 5/6 | Q2 | |
| Across time | [T2 valid time only](across-time/t2-valid-time-only/) | 3/6 | Q2 Q3 Q6 | |
| Across time | [T3 two clocks](across-time/t3-two-clocks/) | 6/6 | | |
| Across time | [T4 replay the log](across-time/t4-replay-the-log/) | 6/6 | | |
| Round 2 | [Combined](combined/) | **6/6** | | 2/6 from today (identity V1) |

Critiques: [identity](identity/notes.md), [merge and split](merge-split/notes.md),
[across time](across-time/notes.md), [combined](combined/notes.md).

## The case, as seeded
Sample names and floors only. One Department floor (Freight) with two Team
floors (Inbound, Contracts). Priya leads the Department; Sam is in the
Department and Inbound, not Contracts. Alex and Morgan are keepers.

- Ten suppliers. Harbourline Freight Ltd (registry record, 9 January) and
  Harbour Line Logistics (an invoice, 14 January). The invoice quotes
  04417721, which is in fact the parent's company number.
- 10 March: Alex merges them on the shared number. Name by priority:
  Harbourline Freight Ltd.
- 2 April: a delivery note from the subsidiary gives "Unit 3, Dock Road",
  said of the merged entity.
- 8 April: a model proposes that "Harbor Line" in an email is Harbourline
  Freight Ltd. Nobody has decided it.
- 20 April: Priya asks "which suppliers have we not heard from since
  spring?" (spring is from 1 March). Answer: 7. A briefing quotes it.
- 12 May: Morgan splits them. Companies House lists Harbour Line Logistics
  Ltd as 09812345, a subsidiary. The invoice is marked wrong; the delivery
  note's address is sorted to the subsidiary.
- 20 May: Inbound notes a delivery site; Contracts notes the subsidiary's
  own contract (a Team floor Sam can't see).
- 10 June: Solent's 30 March contact turns out to be another firm's.
  18 June: Kestrel gets in touch. 9 July: Contracts logs a contact with
  Marlow (hidden from Sam). 4 August: Pennine Cold Store is renamed Pennine
  Cold Chain.

## The answer key (worked out from the case before any query)
1. Ten names: Harbour Line Logistics Ltd, Harbourline Freight Ltd, Kestrel
   Packaging, Marlow Chemicals, Ostrava Pallets, Pennine Cold Chain,
   Quayside Cranes, Redfern Tyres, Solent Marine Fuel, Tidewater Seals.
2. `7, 9, 8, 1, ...`: 7 as asked; 9 as it stood on 20 April, knowing what
   we know now; 8 now; 1 of the 8 has a fact Sam can't see that bears on it.
   Moves: Harbour Line Logistics Ltd +1 and Solent Marine Fuel +1 (we
   learned about the past), Kestrel Packaging -1 (something happened).
   Access changes nothing here, and no guess was settled.
3. Harbour Line Logistics since 14 January; Harbourline Freight Ltd since
   10 March (the merged entity's name); Harbour Line Logistics Ltd since
   12 May. Not "Harbor Line": that is a guess.
4. "Harbor Line", proposed against Harbourline Freight Ltd on 8 April,
   open. (The accepted phone number from a model in February is not listed.)
5. `5, 1`: five facts Sam can see (contact, company number, parent, site
   address, delivery site), one hidden (the contract on Contracts).
6. Merge, 10 March, Alex, citing the Companies House record and the
   invoice; split, 12 May, Morgan, citing the subsidiary's Companies House
   record.

## About the check
- `check.py --apply-migrate` applies `migrate.sql` on top of the variant's
  own schema, so it fails on any migration written "from the variant
  before" (`table records already exists`). `check-migration.py` here does
  it the other way round.
- Queries name case ids (`e-hll`, `sq1`, `r1`, `r2`), so they could be tuned
  to this seed. The combined notes record four hand probes against that.
- Queries use SQLite's `json_extract` and `group_concat(... ORDER BY)`;
  in Postgres those are `->>` and `string_agg`. The DDL is portable.
