-- Q1: Which suppliers exist today, under their current names?
-- expect: Harbour Line Logistics Ltd, Harbourline Freight Ltd, Kestrel Packaging, Marlow Chemicals, Ostrava Pallets, Pennine Cold Chain, Quayside Cranes, Redfern Tyres, Solent Marine Fuel, Tidewater Seals
SELECT (SELECT n.value FROM events n WHERE n.type = 'named' AND n.entity = e.entity ORDER BY n.at DESC, n.seq DESC LIMIT 1) AS nm
FROM events e
WHERE e.type = 'entity made' AND e.value = 'supplier'
  AND NOT EXISTS (SELECT 1 FROM events m WHERE m.type = 'merged' AND m.entity = e.entity
                  AND NOT EXISTS (SELECT 1 FROM events s WHERE s.type = 'split' AND s.ref = m.seq))
ORDER BY nm;

-- Q2: What did the saved question answer on 20 April, what does it answer now, and which of the five reasons moved it?
-- expect: 7, 9, 8, 1, Harbour Line Logistics Ltd +1 we learned about the past; Kestrel Packaging -1 something happened; Solent Marine Fuel +1 we learned about the past
WITH q AS (SELECT * FROM questions WHERE id = 'sq1'),
r1 AS (SELECT * FROM runs WHERE id = 'r1'), r2 AS (SELECT * FROM runs WHERE id = 'r2'),
frames(frame, valid_at, known_at, run) AS (
  SELECT 'A', r1.valid_at, r1.known_at, r1.id FROM r1
  UNION ALL SELECT 'A2', r1.valid_at, r1.known_at, r2.id FROM r1, r2
  UNION ALL SELECT 'B', r1.valid_at, r2.known_at, r2.id FROM r1, r2
  UNION ALL SELECT 'C', r2.valid_at, r2.known_at, r2.id FROM r2),
seen AS (SELECT f.frame, f.run, f.valid_at, e.* FROM frames f JOIN events e ON e.at <= f.known_at),
unit AS (
  SELECT s.frame, s.entity,
    COALESCE((SELECT m.other FROM seen m WHERE m.frame = s.frame AND m.type = 'merged' AND m.entity = s.entity
              AND NOT EXISTS (SELECT 1 FROM seen x WHERE x.frame = s.frame AND x.type = 'split' AND x.ref = m.seq)), s.entity) AS unit
  FROM seen s JOIN run_floors rf ON rf.run = s.run AND rf.floor = s.floor
  WHERE s.type = 'entity made' AND s.value = (SELECT kind FROM q)),
said AS (
  SELECT s.frame, s.run, s.valid_at, s.fact, s.property, s.value, s.floor,
    COALESCE((SELECT o.entity FROM seen o WHERE o.frame = s.frame AND o.type = 'fact sorted' AND o.fact = s.fact ORDER BY o.at DESC, o.seq DESC LIMIT 1), s.entity) AS about
  FROM seen s WHERE s.type = 'fact said'
    AND NOT EXISTS (SELECT 1 FROM seen w WHERE w.frame = s.frame AND w.type = 'fact withdrawn' AND w.fact = s.fact)),
heard AS (
  SELECT DISTINCT u.frame, u.unit FROM unit u JOIN said x ON x.frame = u.frame AND x.about = u.entity
  JOIN run_floors rf ON rf.run = x.run AND rf.floor = x.floor
  WHERE x.property = (SELECT property FROM q) AND x.value >= (SELECT since FROM q) AND x.value <= x.valid_at),
answer AS (SELECT DISTINCT u.frame, u.unit FROM unit u WHERE NOT EXISTS (SELECT 1 FROM heard h WHERE h.frame = u.frame AND h.unit = u.unit)),
steps(before, after, why) AS (VALUES ('A', 'A2', 'different access'), ('A2', 'B', 'we learned about the past'), ('B', 'C', 'something happened')),
moves AS (
  SELECT a.unit, '+1' AS d, s.why FROM steps s JOIN answer a ON a.frame = s.after
    WHERE NOT EXISTS (SELECT 1 FROM answer b WHERE b.frame = s.before AND b.unit = a.unit)
  UNION ALL
  SELECT b.unit, '-1', s.why FROM steps s JOIN answer b ON b.frame = s.before
    WHERE NOT EXISTS (SELECT 1 FROM answer a WHERE a.frame = s.after AND a.unit = b.unit)),
named AS (
  SELECT (SELECT n.value FROM events n WHERE n.type = 'named' AND n.entity = m.unit ORDER BY n.at DESC, n.seq DESC LIMIT 1) AS name, m.d, m.why
  FROM moves m),
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
WITH pts AS (SELECT DISTINCT at AS t FROM events WHERE entity = 'e-hll' AND type IN ('entity made', 'named', 'merged', 'split')),
shown AS (
  SELECT p.t,
    (SELECT n.value FROM events n WHERE n.type = 'named' AND n.at <= p.t
       AND n.entity = COALESCE((SELECT m.other FROM events m WHERE m.type = 'merged' AND m.entity = 'e-hll' AND m.at <= p.t
                                AND NOT EXISTS (SELECT 1 FROM events s WHERE s.type = 'split' AND s.ref = m.seq AND s.at <= p.t)), 'e-hll')
     ORDER BY n.at DESC, n.seq DESC LIMIT 1) AS name
  FROM pts p),
changes AS (SELECT t, name, LAG(name) OVER (ORDER BY t) AS before FROM shown)
SELECT name, substr(t, 1, 10) FROM changes WHERE before IS NULL OR before <> name ORDER BY t;

-- Q4: Which facts about "Harbourline" came from a model and are not accepted?
-- expect: Harbor Line, Harbourline Freight Ltd, 2026-04-08, open
SELECT g.mention,
  (SELECT n.value FROM events n WHERE n.type = 'named' AND n.entity = g.entity ORDER BY n.at DESC, n.seq DESC LIMIT 1),
  substr(g.at, 1, 10), 'open'
FROM events g
WHERE g.type = 'guess made' AND g.by_kind = 'model'
  AND NOT EXISTS (SELECT 1 FROM events d WHERE d.ref = g.seq AND d.type IN ('guess accepted', 'guess rejected'))
  AND EXISTS (SELECT 1 FROM events k WHERE k.type IN ('named', 'other name') AND k.entity = g.entity AND k.value LIKE '%Harbourline%');

-- Q5: As the asker (who can't see the Team floor), how many facts are there about the subsidiary?
-- expect: 5, 1
WITH said AS (
  SELECT s.fact, s.floor,
    COALESCE((SELECT o.entity FROM events o WHERE o.type = 'fact sorted' AND o.fact = s.fact ORDER BY o.at DESC, o.seq DESC LIMIT 1), s.entity) AS about
  FROM events s WHERE s.type = 'fact said' AND NOT EXISTS (SELECT 1 FROM events w WHERE w.type = 'fact withdrawn' AND w.fact = s.fact))
SELECT SUM(CASE WHEN floor IN (SELECT floor FROM run_floors WHERE run = 'r2') THEN 1 ELSE 0 END),
       SUM(CASE WHEN floor IN (SELECT floor FROM run_floors WHERE run = 'r2') THEN 0 ELSE 1 END)
FROM said WHERE about = 'e-hll';

-- Q6: Who merged and who split, and on what evidence?
-- expect: merge, 2026-03-10, alex, Companies House lists Harbourline Freight Ltd as 04417721; Invoice INV-2207 from Harbour Line Logistics quotes 04417721, split, 2026-05-12, morgan, Companies House lists Harbour Line Logistics Ltd as 09812345 with parent 04417721
SELECT CASE e.type WHEN 'merged' THEN 'merge' ELSE 'split' END, substr(e.at, 1, 10), e.by,
  (SELECT group_concat(r.says, '; ' ORDER BY r.recorded_at) FROM event_evidence ee JOIN records r ON r.id = ee.record WHERE ee.seq = e.seq)
FROM events e WHERE e.type IN ('merged', 'split') ORDER BY e.seq;
