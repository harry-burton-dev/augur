-- Q1: Which suppliers exist today, under their current names?
-- expect: Harbour Line Logistics Ltd, Harbourline Freight Ltd, Kestrel Packaging, Marlow Chemicals, Ostrava Pallets, Pennine Cold Chain, Quayside Cranes, Redfern Tyres, Solent Marine Fuel, Tidewater Seals
SELECT label FROM entities WHERE type = 'supplier' AND state = 'active' AND redirect_to IS NULL ORDER BY label;

-- Q2: What did the saved question answer on 20 April, what does it answer now, and which of the five reasons moved it?
-- expect: 7, 9, 8, 1, Harbour Line Logistics Ltd +1 we learned about the past; Kestrel Packaging -1 something happened; Solent Marine Fuel +1 we learned about the past
WITH q AS (SELECT * FROM questions WHERE id = 'sq1'),
r1 AS (SELECT * FROM runs WHERE id = 'r1'), r2 AS (SELECT * FROM runs WHERE id = 'r2'),
frames(frame, valid_at, known_at, run) AS (
  SELECT 'A', r1.valid_at, r1.known_at, r1.id FROM r1
  UNION ALL SELECT 'A2', r1.valid_at, r1.known_at, r2.id FROM r1, r2
  UNION ALL SELECT 'B', r1.valid_at, r2.known_at, r2.id FROM r1, r2
  UNION ALL SELECT 'C', r2.valid_at, r2.known_at, r2.id FROM r2),
unit AS (
  SELECT f.frame, e.id AS entity,
    COALESCE((SELECT m.into_entity FROM merges m WHERE m.from_entity = e.id AND m.at <= f.known_at
              AND (m.undone_at IS NULL OR m.undone_at > f.known_at)), e.id) AS unit
  FROM frames f JOIN entities e ON e.type = (SELECT kind FROM q) AND e.created_at <= f.known_at
  JOIN run_floors rf ON rf.run = f.run AND rf.floor = e.floor),
heard AS (
  SELECT DISTINCT u.frame, u.unit FROM unit u JOIN frames f ON f.frame = u.frame
  JOIN facts x ON x.entity = u.entity JOIN run_floors rf ON rf.run = f.run AND rf.floor = x.floor
  WHERE x.property = (SELECT property FROM q) AND x.value >= (SELECT since FROM q) AND x.value <= f.valid_at
    AND x.recorded_at <= f.known_at AND (x.superseded_at IS NULL OR x.superseded_at > f.known_at)),
answer AS (SELECT DISTINCT u.frame, u.unit FROM unit u WHERE NOT EXISTS (SELECT 1 FROM heard h WHERE h.frame = u.frame AND h.unit = u.unit)),
steps(before, after, why) AS (VALUES ('A', 'A2', 'different access'), ('A2', 'B', 'we learned about the past'), ('B', 'C', 'something happened')),
moves AS (
  SELECT a.unit, '+1' AS d, s.why FROM steps s JOIN answer a ON a.frame = s.after
    WHERE NOT EXISTS (SELECT 1 FROM answer b WHERE b.frame = s.before AND b.unit = a.unit)
  UNION ALL
  SELECT b.unit, '-1', s.why FROM steps s JOIN answer b ON b.frame = s.before
    WHERE NOT EXISTS (SELECT 1 FROM answer a WHERE a.frame = s.after AND a.unit = b.unit)),
named AS (SELECT e.label AS name, m.d, m.why FROM moves m JOIN entities e ON e.id = m.unit),
hidden AS (
  SELECT COUNT(DISTINCT a.unit) AS c FROM answer a JOIN unit u ON u.frame = 'C' AND u.unit = a.unit
  JOIN facts x ON x.entity = u.entity
  WHERE a.frame = 'C' AND x.property = (SELECT property FROM q) AND x.value >= (SELECT since FROM q) AND x.superseded_at IS NULL
    AND x.floor NOT IN (SELECT floor FROM run_floors WHERE run = 'r2'))
SELECT (SELECT COUNT(*) FROM answer WHERE frame = 'A'), (SELECT COUNT(*) FROM answer WHERE frame = 'B'),
       (SELECT COUNT(*) FROM answer WHERE frame = 'C'), (SELECT c FROM hidden),
       (SELECT group_concat(name || ' ' || d || ' ' || why, '; ' ORDER BY name) FROM named);

-- Q3: What names has the subsidiary ever been known by, and since when?
-- expect: Harbour Line Logistics, 2026-01-14, Harbourline Freight Ltd, 2026-03-10, Harbour Line Logistics Ltd, 2026-05-12
SELECT COALESCE(r.label, (SELECT t.label FROM revisions t WHERE t.entity = r.redirect_to AND t.at <= r.at AND t.label IS NOT NULL ORDER BY t.at DESC LIMIT 1)),
       substr(r.at, 1, 10)
FROM revisions r WHERE r.entity = 'e-hll' ORDER BY r.at;

-- Q4: Which facts about "Harbourline" came from a model and are not accepted?
-- expect: Harbor Line, Harbourline Freight Ltd, 2026-04-08, open
SELECT json_extract(i.body, '$.text'), e.label, substr(p.created_at, 1, 10), 'open'
FROM proposal_items i JOIN proposals p ON p.id = i.proposal
JOIN entities e ON e.id = json_extract(i.matches, '$[0].entity')
WHERE json_extract(p.producer, '$.kind') = 'model' AND i.decision IS NULL AND e.label LIKE '%Harbourline%';

-- Q5: As the asker (who can't see the Team floor), how many facts are there about the subsidiary?
-- expect: 5, 1
SELECT SUM(CASE WHEN floor IN (SELECT floor FROM run_floors WHERE run = 'r2') THEN 1 ELSE 0 END),
       SUM(CASE WHEN floor IN (SELECT floor FROM run_floors WHERE run = 'r2') THEN 0 ELSE 1 END)
FROM facts WHERE entity = 'e-hll' AND superseded_at IS NULL;

-- Q6: Who merged and who split, and on what evidence?
-- expect: merge, 2026-03-10, alex, Companies House lists Harbourline Freight Ltd as 04417721; Invoice INV-2207 from Harbour Line Logistics quotes 04417721, split, 2026-05-12, morgan, Companies House lists Harbour Line Logistics Ltd as 09812345 with parent 04417721
SELECT 'merge', substr(at, 1, 10), by, summary FROM merges
UNION ALL SELECT 'split', substr(undone_at, 1, 10), undone_by, undo_summary FROM merges WHERE undone_at IS NOT NULL;
