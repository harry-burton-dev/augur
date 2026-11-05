-- Q1: Which suppliers exist today, under their current names?
-- expect: Harbour Line Logistics Ltd, Harbourline Freight Ltd, Kestrel Packaging, Marlow Chemicals, Ostrava Pallets, Pennine Cold Chain, Quayside Cranes, Redfern Tyres, Solent Marine Fuel, Tidewater Seals
SELECT n.name FROM entities e
JOIN names n ON n.entity = e.id AND n.status = 'accepted' AND n.to_at IS NULL
WHERE e.type = 'supplier' AND e.state = 'active'
  AND NOT EXISTS (SELECT 1 FROM merges m WHERE m.junior = e.id AND m.withdrawn_at IS NULL)
ORDER BY n.name;

-- Q2: What did the saved question answer on 20 April, what does it answer now, and which of the five reasons moved it?
-- expect: 7, 9, 8, 1, Harbour Line Logistics Ltd +1 we learned about the past; Kestrel Packaging -1 something happened; Solent Marine Fuel +1 we learned about the past
WITH q AS (SELECT * FROM questions WHERE id = 'sq1'),
r1 AS (SELECT * FROM runs WHERE id = 'r1'), r2 AS (SELECT * FROM runs WHERE id = 'r2'),
-- As asked; as asked with today's access; as it stood, as we know now; now.
frames(frame, valid_at, known_at, run) AS (
  SELECT 'A', r1.valid_at, r1.known_at, r1.id FROM r1
  UNION ALL SELECT 'A2', r1.valid_at, r1.known_at, r2.id FROM r1, r2
  UNION ALL SELECT 'B', r1.valid_at, r2.known_at, r2.id FROM r1, r2
  UNION ALL SELECT 'C', r2.valid_at, r2.known_at, r2.id FROM r2),
unit AS (
  SELECT f.frame, e.id AS entity,
    COALESCE((SELECT m.senior FROM merges m WHERE m.junior = e.id AND m.decided_at <= f.known_at
              AND (m.withdrawn_at IS NULL OR m.withdrawn_at > f.known_at)
              AND (m.valid_from IS NULL OR m.valid_from <= f.valid_at)), e.id) AS unit
  FROM frames f JOIN entities e ON e.type = (SELECT kind FROM q) AND e.created_at <= f.known_at
  JOIN run_floors rf ON rf.run = f.run AND rf.floor = e.floor),
said AS (
  SELECT f.frame, f.run, f.valid_at, x.*,
    COALESCE((SELECT s.about FROM sortings s WHERE s.fact = x.id AND s.sorted_at <= f.known_at ORDER BY s.sorted_at DESC LIMIT 1), x.entity) AS about
  FROM frames f JOIN facts x ON x.recorded_at <= f.known_at AND (x.superseded_at IS NULL OR x.superseded_at > f.known_at)),
heard AS (
  SELECT DISTINCT u.frame, u.unit FROM unit u JOIN said x ON x.frame = u.frame AND x.about = u.entity
  JOIN run_floors rf ON rf.run = x.run AND rf.floor = x.floor
  WHERE x.property = (SELECT property FROM q) AND x.value >= (SELECT since FROM q) AND x.value <= x.valid_at
    AND (x.valid_to IS NULL OR x.valid_to > x.valid_at)),
answer AS (SELECT DISTINCT u.frame, u.unit FROM unit u WHERE NOT EXISTS (SELECT 1 FROM heard h WHERE h.frame = u.frame AND h.unit = u.unit)),
steps(before, after, why) AS (VALUES ('A', 'A2', 'different access'), ('A2', 'B', 'we learned about the past'), ('B', 'C', 'something happened')),
moves AS (
  SELECT a.unit, '+1' AS d, s.why FROM steps s JOIN answer a ON a.frame = s.after
    WHERE NOT EXISTS (SELECT 1 FROM answer b WHERE b.frame = s.before AND b.unit = a.unit)
  UNION ALL
  SELECT b.unit, '-1', s.why FROM steps s JOIN answer b ON b.frame = s.before
    WHERE NOT EXISTS (SELECT 1 FROM answer a WHERE a.frame = s.after AND a.unit = b.unit)),
named AS (SELECT n.name, m.d, m.why FROM moves m JOIN names n ON n.entity = m.unit AND n.status = 'accepted' AND n.to_at IS NULL),
-- Counted as hidden: answers that facts the reader can't see bear on.
hidden AS (
  SELECT COUNT(DISTINCT a.unit) AS c FROM answer a JOIN unit u ON u.frame = 'C' AND u.unit = a.unit
  JOIN said x ON x.frame = 'C' AND x.about = u.entity
  WHERE a.frame = 'C' AND x.property = (SELECT property FROM q) AND x.value >= (SELECT since FROM q)
    AND x.floor NOT IN (SELECT floor FROM run_floors WHERE run = 'r2'))
SELECT (SELECT COUNT(*) FROM answer WHERE frame = 'A'), (SELECT COUNT(*) FROM answer WHERE frame = 'B'),
       (SELECT COUNT(*) FROM answer WHERE frame = 'C'), (SELECT c FROM hidden),
       (SELECT group_concat(name || ' ' || d || ' ' || why, '; ' ORDER BY name) FROM named);

-- Q3: What names has the subsidiary ever been known by, and since when?
-- expect: Harbour Line Logistics, 2026-01-14, Harbourline Freight Ltd, 2026-03-10, Harbour Line Logistics Ltd, 2026-05-12
WITH pts AS (
  SELECT from_at AS t FROM names WHERE entity = 'e-hll'
  UNION SELECT decided_at FROM merges WHERE junior = 'e-hll'
  UNION SELECT withdrawn_at FROM merges WHERE junior = 'e-hll' AND withdrawn_at IS NOT NULL),
shown AS (
  SELECT p.t, (SELECT n.name FROM names n WHERE n.status = 'accepted' AND n.from_at <= p.t AND (n.to_at IS NULL OR n.to_at > p.t)
     AND n.entity = COALESCE((SELECT m.senior FROM merges m WHERE m.junior = 'e-hll' AND m.decided_at <= p.t
                              AND (m.withdrawn_at IS NULL OR m.withdrawn_at > p.t)), 'e-hll')) AS name
  FROM pts p),
changes AS (SELECT t, name, LAG(name) OVER (ORDER BY t) AS before FROM shown)
SELECT name, substr(t, 1, 10) FROM changes WHERE before IS NULL OR before <> name ORDER BY t;

-- Q4: Which facts about "Harbourline" came from a model and are not accepted?
-- expect: Harbor Line, Harbourline Freight Ltd, 2026-04-08, open
SELECT json_extract(i.body, '$.text'), n.name, substr(p.created_at, 1, 10), 'open'
FROM proposal_items i JOIN proposals p ON p.id = i.proposal
JOIN names n ON n.entity = json_extract(i.matches, '$[0].entity') AND n.status = 'accepted' AND n.to_at IS NULL
WHERE json_extract(p.producer, '$.kind') = 'model' AND i.decision IS NULL
  AND EXISTS (SELECT 1 FROM names k WHERE k.entity = n.entity AND k.name LIKE '%Harbourline%');

-- Q5: As the asker (who can't see the Team floor), how many facts are there about the subsidiary?
-- expect: 5, 1
WITH said AS (
  SELECT x.*, COALESCE((SELECT s.about FROM sortings s WHERE s.fact = x.id ORDER BY s.sorted_at DESC LIMIT 1), x.entity) AS about
  FROM facts x WHERE x.superseded_at IS NULL)
SELECT SUM(CASE WHEN floor IN (SELECT floor FROM run_floors WHERE run = 'r2') THEN 1 ELSE 0 END),
       SUM(CASE WHEN floor IN (SELECT floor FROM run_floors WHERE run = 'r2') THEN 0 ELSE 1 END)
FROM said WHERE about = 'e-hll';

-- Q6: Who merged and who split, and on what evidence?
-- expect: merge, 2026-03-10, alex, Companies House lists Harbourline Freight Ltd as 04417721; Invoice INV-2207 from Harbour Line Logistics quotes 04417721, split, 2026-05-12, morgan, Companies House lists Harbour Line Logistics Ltd as 09812345 with parent 04417721
SELECT 'merge', substr(m.decided_at, 1, 10), m.decided_by,
  (SELECT group_concat(r.says, '; ' ORDER BY r.recorded_at) FROM merge_cites c JOIN records r ON r.id = c.record WHERE c.merge = m.id AND c.bearing = 'supports')
FROM merges m
UNION ALL
SELECT 'split', substr(s.decided_at, 1, 10), s.decided_by,
  (SELECT group_concat(r.says, '; ' ORDER BY r.recorded_at) FROM split_cites c JOIN records r ON r.id = c.record WHERE c.split = s.id AND c.bearing = 'supports')
FROM splits s;
