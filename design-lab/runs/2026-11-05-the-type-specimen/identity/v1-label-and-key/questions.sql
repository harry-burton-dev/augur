-- Q1: Which suppliers exist today, under their current names?
-- expect: Harbour Line Logistics Ltd, Harbourline Freight Ltd, Kestrel Packaging, Marlow Chemicals, Ostrava Pallets, Pennine Cold Chain, Quayside Cranes, Redfern Tyres, Solent Marine Fuel, Tidewater Seals
SELECT label FROM entities WHERE type = 'supplier' AND state = 'active' ORDER BY label;

-- Q2: What did the saved question answer on 20 April, what does it answer now, and which of the five reasons moved it?
-- expect: 7, 9, 8, 1, Harbour Line Logistics Ltd +1 we learned about the past; Kestrel Packaging -1 something happened; Solent Marine Fuel +1 we learned about the past
-- Nothing keeps a saved question, its runs or whose access they used. Which entities were active
-- on 20 April isn't kept either (state has no history). Only "now" can be worked out.
WITH reader(floor) AS (VALUES ('org'), ('tree:dept-freight'), ('tree:team-inbound'))
SELECT 'unknown', 'unknown',
  (SELECT COUNT(*) FROM entities e WHERE e.type = 'supplier' AND e.state = 'active'
     AND NOT EXISTS (SELECT 1 FROM facts x WHERE x.entity = e.id AND x.property = 'contact'
       AND x.value >= '2026-03-01' AND x.superseded_at IS NULL AND x.floor IN (SELECT floor FROM reader))),
  'unknown', 'no reasons kept';

-- Q3: What names has the subsidiary ever been known by, and since when?
-- expect: Harbour Line Logistics, 2026-01-14, Harbourline Freight Ltd, 2026-03-10, Harbour Line Logistics Ltd, 2026-05-12
-- The new entity doesn't know the retired one was it. Aliases have no dates.
SELECT label, substr(created_at, 1, 10) FROM entities WHERE id = 'e-hll2'
UNION ALL SELECT alias, 'no date' FROM entity_aliases WHERE entity = 'e-hll2';

-- Q4: Which facts about "Harbourline" came from a model and are not accepted?
-- expect: Harbor Line, Harbourline Freight Ltd, 2026-04-08, open
SELECT json_extract(i.body, '$.text'), e.label, substr(p.created_at, 1, 10), 'open'
FROM proposal_items i
JOIN proposals p ON p.id = i.proposal
JOIN entities e ON e.id = json_extract(i.matches, '$[0].entity')
WHERE json_extract(p.producer, '$.kind') = 'model' AND i.decision IS NULL AND e.label LIKE '%Harbourline%';

-- Q5: As the asker (who can't see the Team floor), how many facts are there about the subsidiary?
-- expect: 5, 1
WITH reader(floor) AS (VALUES ('org'), ('tree:dept-freight'), ('tree:team-inbound'))
SELECT SUM(CASE WHEN floor IN (SELECT floor FROM reader) THEN 1 ELSE 0 END),
       SUM(CASE WHEN floor IN (SELECT floor FROM reader) THEN 0 ELSE 1 END)
FROM facts WHERE entity = 'e-hll2' AND superseded_at IS NULL;

-- Q6: Who merged and who split, and on what evidence?
-- expect: merge, 2026-03-10, alex, Companies House lists Harbourline Freight Ltd as 04417721; Invoice INV-2207 from Harbour Line Logistics quotes 04417721, split, 2026-05-12, morgan, Companies House lists Harbour Line Logistics Ltd as 09812345 with parent 04417721
-- The best guess: whoever last touched the retired row, and whoever made the new one. No evidence is kept.
SELECT 'retired', substr(updated_at, 1, 10), updated_by, 'no evidence kept' FROM entities WHERE id = 'e-hll'
UNION ALL
SELECT 'created', substr(created_at, 1, 10), created_by, description FROM entities WHERE id = 'e-hll2';
