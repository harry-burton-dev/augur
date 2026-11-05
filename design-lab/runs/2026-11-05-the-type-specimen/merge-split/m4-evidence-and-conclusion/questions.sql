-- Q1: Which suppliers exist today, under their current names?
-- expect: Harbour Line Logistics Ltd, Harbourline Freight Ltd, Kestrel Packaging, Marlow Chemicals, Ostrava Pallets, Pennine Cold Chain, Quayside Cranes, Redfern Tyres, Solent Marine Fuel, Tidewater Seals
WITH RECURSIVE standing AS (
  SELECT c.* FROM conclusions c WHERE c.kind = 'same' AND NOT EXISTS (SELECT 1 FROM conclusions w WHERE w.withdraws = c.id)),
links(a, b) AS (SELECT a, b FROM standing UNION ALL SELECT b, a FROM standing),
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
standing AS (
  SELECT f.frame, c.* FROM frames f JOIN conclusions c ON c.stated_at <= f.known_at
  WHERE NOT EXISTS (SELECT 1 FROM conclusions w WHERE w.withdraws = c.id AND w.stated_at <= f.known_at)),
links(frame, a, b) AS (
  SELECT frame, a, b FROM standing WHERE kind = 'same' UNION ALL SELECT frame, b, a FROM standing WHERE kind = 'same'),
reach(frame, e, m) AS (
  SELECT f.frame, e.id, e.id FROM frames f JOIN entities e ON e.recorded_at <= f.known_at AND e.kind = (SELECT kind FROM q)
  JOIN run_floors rf ON rf.run = f.run AND rf.floor = e.floor
  UNION SELECT r.frame, r.e, l.b FROM reach r JOIN links l ON l.frame = r.frame AND l.a = r.m),
unit AS (
  SELECT DISTINCT r.frame, r.e AS entity, (SELECT r2.m FROM reach r2 JOIN entities x ON x.id = r2.m WHERE r2.frame = r.frame AND r2.e = r.e ORDER BY x.recorded_at, x.id LIMIT 1) AS unit
  FROM reach r),
subject AS (
  SELECT f.frame, x.*, COALESCE((SELECT s.a FROM standing s WHERE s.frame = f.frame AND s.kind = 'about' AND s.fact = x.id ORDER BY s.stated_at DESC LIMIT 1), x.entity) AS about
  FROM frames f JOIN facts x),
heard AS (
  SELECT DISTINCT u.frame, u.unit FROM unit u JOIN frames f ON f.frame = u.frame
  JOIN subject x ON x.frame = u.frame AND x.about = u.entity JOIN run_floors rf ON rf.run = f.run AND rf.floor = x.floor
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
  JOIN subject x ON x.frame = 'C' AND x.about = u.entity
  WHERE a.frame = 'C' AND x.property = (SELECT property FROM q) AND x.value >= (SELECT since FROM q) AND x.superseded_at IS NULL
    AND x.floor NOT IN (SELECT floor FROM run_floors WHERE run = 'r2'))
SELECT (SELECT COUNT(*) FROM answer WHERE frame = 'A'), (SELECT COUNT(*) FROM answer WHERE frame = 'B'),
       (SELECT COUNT(*) FROM answer WHERE frame = 'C'), (SELECT c FROM hidden),
       (SELECT group_concat(name || ' ' || d || ' ' || why, '; ' ORDER BY name) FROM named);

-- Q3: What names has the subsidiary ever been known by, and since when?
-- expect: Harbour Line Logistics, 2026-01-14, Harbourline Freight Ltd, 2026-03-10, Harbour Line Logistics Ltd, 2026-05-12
WITH RECURSIVE pts(t) AS (SELECT from_at FROM labels UNION SELECT stated_at FROM conclusions),
standing AS (
  SELECT p.t, c.* FROM pts p JOIN conclusions c ON c.kind = 'same' AND c.stated_at <= p.t
  WHERE NOT EXISTS (SELECT 1 FROM conclusions w WHERE w.withdraws = c.id AND w.stated_at <= p.t)),
links(t, a, b) AS (SELECT t, a, b FROM standing UNION ALL SELECT t, b, a FROM standing),
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
SELECT h.mention, l.label, substr(h.made_at, 1, 10), h.state
FROM hypotheses h JOIN labels l ON l.entity = h.about AND l.to_at IS NULL
WHERE h.producer_kind = 'model' AND h.state <> 'accepted'
  AND EXISTS (SELECT 1 FROM labels k WHERE k.entity = h.about AND k.label LIKE '%Harbourline%');

-- Q5: As the asker (who can't see the Team floor), how many facts are there about the subsidiary?
-- expect: 5, 1
WITH subject AS (
  SELECT x.*, COALESCE((SELECT c.a FROM conclusions c WHERE c.kind = 'about' AND c.fact = x.id
                         AND NOT EXISTS (SELECT 1 FROM conclusions w WHERE w.withdraws = c.id) ORDER BY c.stated_at DESC LIMIT 1), x.entity) AS about
  FROM facts x)
SELECT SUM(CASE WHEN floor IN (SELECT floor FROM run_floors WHERE run = 'r2') THEN 1 ELSE 0 END),
       SUM(CASE WHEN floor IN (SELECT floor FROM run_floors WHERE run = 'r2') THEN 0 ELSE 1 END)
FROM subject WHERE about = 'e-hll' AND superseded_at IS NULL;

-- Q6: Who merged and who split, and on what evidence?
-- expect: merge, 2026-03-10, alex, Companies House lists Harbourline Freight Ltd as 04417721; Invoice INV-2207 from Harbour Line Logistics quotes 04417721, split, 2026-05-12, morgan, Companies House lists Harbour Line Logistics Ltd as 09812345 with parent 04417721
SELECT CASE c.kind WHEN 'same' THEN 'merge' ELSE 'split' END, substr(c.stated_at, 1, 10), c.stated_by,
  (SELECT group_concat(r.says, '; ' ORDER BY r.recorded_at) FROM cites ci JOIN records r ON r.id = ci.record
   WHERE ci.conclusion = c.id AND ci.bearing = 'supports')
FROM conclusions c
WHERE c.kind = 'same' OR (c.kind = 'distinct' AND c.withdraws IN (SELECT id FROM conclusions WHERE kind = 'same'))
ORDER BY c.stated_at;
