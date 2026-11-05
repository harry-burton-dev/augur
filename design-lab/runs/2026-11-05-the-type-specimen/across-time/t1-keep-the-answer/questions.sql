-- Q1: Which suppliers exist today, under their current names?
-- expect: Harbour Line Logistics Ltd, Harbourline Freight Ltd, Kestrel Packaging, Marlow Chemicals, Ostrava Pallets, Pennine Cold Chain, Quayside Cranes, Redfern Tyres, Solent Marine Fuel, Tidewater Seals
SELECT n.name
FROM entities e
JOIN names n ON n.entity = e.id AND n.status = 'accepted' AND n.to_at IS NULL
WHERE e.kind = 'supplier'
  AND NOT EXISTS (SELECT 1 FROM merges m WHERE m.junior = e.id AND m.withdrawn_at IS NULL)
ORDER BY n.name;

-- Q2: What did the saved question answer on 20 April, what does it answer now, and which of the five reasons moved it?
-- expect: 7, 9, 8, 1, Harbour Line Logistics Ltd +1 we learned about the past; Kestrel Packaging -1 something happened; Solent Marine Fuel +1 we learned about the past
-- Then: the rows kept with the run. Now: worked out live. "As it stood, as we know now"
-- can't be worked out (facts have no recorded time), so no move can be given a reason.
WITH q AS (SELECT * FROM questions WHERE id = 'sq1'),
r2 AS (SELECT * FROM runs WHERE id = 'r2'),
unit AS (
  SELECT e.id AS entity, COALESCE((SELECT m.senior FROM merges m WHERE m.junior = e.id AND m.withdrawn_at IS NULL), e.id) AS unit
  FROM entities e JOIN run_floors rf ON rf.run = 'r2' AND rf.floor = e.floor WHERE e.kind = (SELECT kind FROM q)),
heard AS (
  SELECT DISTINCT u.unit FROM unit u JOIN facts x ON x.entity = u.entity JOIN run_floors rf ON rf.run = 'r2' AND rf.floor = x.floor
  WHERE x.property = (SELECT property FROM q) AND x.value >= (SELECT since FROM q) AND x.value <= (SELECT valid_at FROM r2)),
now AS (SELECT DISTINCT unit FROM unit WHERE unit NOT IN (SELECT unit FROM heard)),
moves AS (
  SELECT n.unit, '+1' AS d FROM now n WHERE n.unit NOT IN (SELECT entity FROM run_rows WHERE run = 'r1')
  UNION ALL SELECT k.entity, '-1' FROM run_rows k WHERE k.run = 'r1' AND k.entity NOT IN (SELECT unit FROM now)),
named AS (SELECT n.name, m.d FROM moves m JOIN names n ON n.entity = m.unit AND n.status = 'accepted' AND n.to_at IS NULL),
hidden AS (
  SELECT COUNT(DISTINCT n.unit) AS c FROM now n JOIN unit u ON u.unit = n.unit JOIN facts x ON x.entity = u.entity
  WHERE x.property = (SELECT property FROM q) AND x.value >= (SELECT since FROM q)
    AND x.floor NOT IN (SELECT floor FROM run_floors WHERE run = 'r2'))
SELECT (SELECT COUNT(*) FROM run_rows WHERE run = 'r1'), 'unknown', (SELECT COUNT(*) FROM now), (SELECT c FROM hidden),
       (SELECT group_concat(name || ' ' || d || ' reason not known', '; ' ORDER BY name) FROM named);

-- Q3: What names has the subsidiary ever been known by, and since when?
-- expect: Harbour Line Logistics, 2026-01-14, Harbourline Freight Ltd, 2026-03-10, Harbour Line Logistics Ltd, 2026-05-12
SELECT name, substr(from_at, 1, 10) FROM (
  SELECT n.name, n.from_at FROM names n WHERE n.entity = 'e-hll' AND n.status = 'accepted'
  UNION ALL
  SELECT a.name, s.from_at FROM names s
  JOIN names a ON a.entity = s.synonym_of AND a.status = 'accepted'
    AND a.from_at <= s.from_at AND (a.to_at IS NULL OR a.to_at > s.from_at)
  WHERE s.entity = 'e-hll' AND s.synonym_of IS NOT NULL)
ORDER BY from_at;

-- Q4: Which facts about "Harbourline" came from a model and are not accepted?
-- expect: Harbor Line, Harbourline Freight Ltd, 2026-04-08, open
SELECT p.mention, n.name, substr(p.made_at, 1, 10), p.state
FROM proposals p
JOIN names n ON n.entity = p.target AND n.status = 'accepted' AND n.to_at IS NULL
WHERE p.producer_kind = 'model' AND p.state <> 'accepted'
  AND EXISTS (SELECT 1 FROM names k WHERE k.entity = p.target AND k.name LIKE '%Harbourline%');

-- Q5: As the asker (who can't see the Team floor), how many facts are there about the subsidiary?
-- expect: 5, 1
SELECT SUM(CASE WHEN x.floor IN (SELECT floor FROM run_floors WHERE run = 'r2') THEN 1 ELSE 0 END),
       SUM(CASE WHEN x.floor IN (SELECT floor FROM run_floors WHERE run = 'r2') THEN 0 ELSE 1 END)
FROM facts x WHERE x.entity = 'e-hll';

-- Q6: Who merged and who split, and on what evidence?
-- expect: merge, 2026-03-10, alex, Companies House lists Harbourline Freight Ltd as 04417721; Invoice INV-2207 from Harbour Line Logistics quotes 04417721, split, 2026-05-12, morgan, Companies House lists Harbour Line Logistics Ltd as 09812345 with parent 04417721
SELECT 'merge', substr(m.decided_at, 1, 10), m.decided_by,
  (SELECT group_concat(r.says, '; ' ORDER BY r.recorded_at) FROM merge_evidence me JOIN records r ON r.id = me.record WHERE me.merge = m.id)
FROM merges m
UNION ALL
SELECT 'split', substr(s.decided_at, 1, 10), s.decided_by,
  (SELECT group_concat(r.says, '; ' ORDER BY r.recorded_at) FROM split_evidence se JOIN records r ON r.id = se.record WHERE se.split = s.id)
FROM splits s;
