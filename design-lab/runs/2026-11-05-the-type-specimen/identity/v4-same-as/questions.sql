-- Q1: Which suppliers exist today, under their current names?
-- expect: Harbour Line Logistics Ltd, Harbourline Freight Ltd, Kestrel Packaging, Marlow Chemicals, Ostrava Pallets, Pennine Cold Chain, Quayside Cranes, Redfern Tyres, Solent Marine Fuel, Tidewater Seals
WITH RECURSIVE now AS (SELECT known_at AS k FROM runs WHERE id = 'r2'),
links(a, b) AS (
  SELECT a, b FROM same_as, now WHERE state IN ('asserted', 'withdrawn') AND asserted_at <= now.k AND (closed_at IS NULL OR closed_at > now.k)
  UNION ALL SELECT b, a FROM same_as, now WHERE state IN ('asserted', 'withdrawn') AND asserted_at <= now.k AND (closed_at IS NULL OR closed_at > now.k)),
reach(e, m) AS (SELECT id, id FROM entities WHERE kind = 'supplier' UNION SELECT r.e, l.b FROM reach r JOIN links l ON l.a = r.m),
unit AS (SELECT DISTINCT (SELECT r2.m FROM reach r2 JOIN entities x ON x.id = r2.m WHERE r2.e = r.e ORDER BY x.recorded_at, x.id LIMIT 1) AS u FROM reach r)
SELECT l.label FROM unit JOIN labels l ON l.entity = unit.u AND l.to_at IS NULL ORDER BY l.label;

-- Q2: What did the saved question answer on 20 April, what does it answer now, and which of the five reasons moved it?
-- expect: 7, 9, 8, 1, Harbour Line Logistics Ltd +1 we learned about the past; Kestrel Packaging -1 something happened; Solent Marine Fuel +1 we learned about the past
WITH RECURSIVE q AS (SELECT * FROM questions WHERE id = 'sq1'),
r1 AS (SELECT * FROM runs WHERE id = 'r1'), r2 AS (SELECT * FROM runs WHERE id = 'r2'),
frames(frame, valid_at, known_at, run) AS (
  SELECT 'A', r1.valid_at, r1.known_at, r1.id FROM r1
  UNION ALL SELECT 'A2', r1.valid_at, r1.known_at, r2.id FROM r1, r2
  UNION ALL SELECT 'B', r1.valid_at, r2.known_at, r2.id FROM r1, r2
  UNION ALL SELECT 'C', r2.valid_at, r2.known_at, r2.id FROM r2),
links(frame, a, b) AS (
  SELECT f.frame, s.a, s.b FROM frames f JOIN same_as s ON s.state IN ('asserted', 'withdrawn') AND s.asserted_at <= f.known_at AND (s.closed_at IS NULL OR s.closed_at > f.known_at)
  UNION ALL
  SELECT f.frame, s.b, s.a FROM frames f JOIN same_as s ON s.state IN ('asserted', 'withdrawn') AND s.asserted_at <= f.known_at AND (s.closed_at IS NULL OR s.closed_at > f.known_at)),
reach(frame, e, m) AS (
  SELECT f.frame, e.id, e.id FROM frames f JOIN entities e ON e.recorded_at <= f.known_at AND e.kind = 'supplier'
  JOIN run_floors rf ON rf.run = f.run AND rf.floor = e.floor
  UNION SELECT r.frame, r.e, l.b FROM reach r JOIN links l ON l.frame = r.frame AND l.a = r.m),
unit AS (
  SELECT DISTINCT r.frame, r.e AS entity, (SELECT r2.m FROM reach r2 JOIN entities x ON x.id = r2.m WHERE r2.frame = r.frame AND r2.e = r.e ORDER BY x.recorded_at, x.id LIMIT 1) AS unit
  FROM reach r),
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
named AS (SELECT l.label AS name, m.d, m.why FROM moves m JOIN labels l ON l.entity = m.unit AND l.to_at IS NULL),
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
WITH RECURSIVE pts(t) AS (SELECT from_at FROM labels UNION SELECT asserted_at FROM same_as WHERE asserted_at IS NOT NULL UNION SELECT closed_at FROM same_as WHERE closed_at IS NOT NULL),
links(t, a, b) AS (
  SELECT p.t, s.a, s.b FROM pts p JOIN same_as s ON s.state IN ('asserted', 'withdrawn') AND s.asserted_at <= p.t AND (s.closed_at IS NULL OR s.closed_at > p.t)
  UNION ALL SELECT p.t, s.b, s.a FROM pts p JOIN same_as s ON s.state IN ('asserted', 'withdrawn') AND s.asserted_at <= p.t AND (s.closed_at IS NULL OR s.closed_at > p.t)),
reach(t, m) AS (SELECT t, 'e-hll' FROM pts WHERE t >= (SELECT recorded_at FROM entities WHERE id = 'e-hll')
  UNION SELECT r.t, l.b FROM reach r JOIN links l ON l.t = r.t AND l.a = r.m),
shown AS (
  SELECT p.t, (SELECT l.label FROM labels l WHERE l.entity = (SELECT r.m FROM reach r JOIN entities x ON x.id = r.m WHERE r.t = p.t ORDER BY x.recorded_at, x.id LIMIT 1)
     AND l.from_at <= p.t AND (l.to_at IS NULL OR l.to_at > p.t)) AS name
  FROM (SELECT DISTINCT t FROM reach) p),
changes AS (SELECT t, name, LAG(name) OVER (ORDER BY t) AS before FROM shown)
SELECT name, substr(t, 1, 10) FROM changes WHERE before IS NULL OR before <> name ORDER BY t;

-- Q4: Which facts about "Harbourline" came from a model and are not accepted?
-- expect: Harbor Line, Harbourline Freight Ltd, 2026-04-08, open
SELECT lm.label, lt.label, substr(s.made_at, 1, 10), CASE s.state WHEN 'proposed' THEN 'open' ELSE s.state END
FROM same_as s
JOIN labels lm ON lm.entity = s.b AND lm.to_at IS NULL
JOIN labels lt ON lt.entity = s.a AND lt.to_at IS NULL
WHERE s.made_by_kind = 'model' AND s.state IN ('proposed', 'rejected') AND lt.label LIKE '%Harbourline%';

-- Q5: As the asker (who can't see the Team floor), how many facts are there about the subsidiary?
-- expect: 5, 1
SELECT SUM(CASE WHEN floor IN (SELECT floor FROM run_floors WHERE run = 'r2') THEN 1 ELSE 0 END),
       SUM(CASE WHEN floor IN (SELECT floor FROM run_floors WHERE run = 'r2') THEN 0 ELSE 1 END)
FROM facts WHERE entity = 'e-hll' AND superseded_at IS NULL;

-- Q6: Who merged and who split, and on what evidence?
-- expect: merge, 2026-03-10, alex, Companies House lists Harbourline Freight Ltd as 04417721; Invoice INV-2207 from Harbour Line Logistics quotes 04417721, split, 2026-05-12, morgan, Companies House lists Harbour Line Logistics Ltd as 09812345 with parent 04417721
SELECT 'merge', substr(asserted_at, 1, 10), made_by, summary FROM same_as WHERE made_by_kind = 'person' AND asserted_at IS NOT NULL
UNION ALL
SELECT 'split', substr(closed_at, 1, 10), closed_by, closed_summary FROM same_as WHERE state = 'withdrawn';
