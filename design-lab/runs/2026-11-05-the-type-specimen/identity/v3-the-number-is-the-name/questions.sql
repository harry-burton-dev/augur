-- Q1: Which suppliers exist today, under their current names?
-- expect: Harbour Line Logistics Ltd, Harbourline Freight Ltd, Kestrel Packaging, Marlow Chemicals, Ostrava Pallets, Pennine Cold Chain, Quayside Cranes, Redfern Tyres, Solent Marine Fuel, Tidewater Seals
WITH now AS (SELECT known_at AS k FROM runs WHERE id = 'r2'),
m AS (
  SELECT r.*, COALESCE((SELECT x.scheme || ':' || x.number FROM record_keys x WHERE x.record = r.id
           AND x.from_at <= now.k AND (x.to_at IS NULL OR x.to_at > now.k)), 'local:' || r.id) AS ident
  FROM records r, now WHERE r.stands_for = 'supplier' AND r.recorded_at <= now.k)
SELECT (SELECT m2.name FROM m m2 WHERE m2.ident = m.ident
        ORDER BY m2.registry DESC, CASE WHEN m2.registry = 1 THEN m2.recorded_at END DESC, m2.recorded_at LIMIT 1) AS nm
FROM m GROUP BY ident ORDER BY nm;

-- Q2: What did the saved question answer on 20 April, what does it answer now, and which of the five reasons moved it?
-- expect: 7, 9, 8, 1, Harbour Line Logistics Ltd +1 we learned about the past; Kestrel Packaging -1 something happened; Solent Marine Fuel +1 we learned about the past
WITH q AS (SELECT * FROM questions WHERE id = 'sq1'),
r1 AS (SELECT * FROM runs WHERE id = 'r1'), r2 AS (SELECT * FROM runs WHERE id = 'r2'),
frames(frame, valid_at, known_at, run) AS (
  SELECT 'A', r1.valid_at, r1.known_at, r1.id FROM r1
  UNION ALL SELECT 'A2', r1.valid_at, r1.known_at, r2.id FROM r1, r2
  UNION ALL SELECT 'B', r1.valid_at, r2.known_at, r2.id FROM r1, r2
  UNION ALL SELECT 'C', r2.valid_at, r2.known_at, r2.id FROM r2),
ids AS (
  SELECT f.frame, r.id AS record, r.stands_for, r.floor, r.name, r.registry, r.recorded_at,
    COALESCE((SELECT x.scheme || ':' || x.number FROM record_keys x WHERE x.record = r.id
      AND x.from_at <= f.known_at AND (x.to_at IS NULL OR x.to_at > f.known_at)), 'local:' || r.id) AS ident
  FROM frames f JOIN records r ON r.recorded_at <= f.known_at),
unit AS (
  SELECT DISTINCT i.frame, i.ident AS unit FROM ids i JOIN frames f ON f.frame = i.frame
  JOIN run_floors rf ON rf.run = f.run AND rf.floor = i.floor
  WHERE i.stands_for = (SELECT kind FROM q)),
heard AS (
  SELECT DISTINCT i.frame, i.ident AS unit FROM ids i JOIN frames f ON f.frame = i.frame
  JOIN facts x ON x.record = i.record
  JOIN run_floors rf ON rf.run = f.run AND rf.floor = x.floor
  WHERE x.property = (SELECT property FROM q) AND x.value >= (SELECT since FROM q) AND x.value <= f.valid_at
    AND x.recorded_at <= f.known_at AND (x.superseded_at IS NULL OR x.superseded_at > f.known_at)),
answer AS (SELECT u.frame, u.unit FROM unit u WHERE NOT EXISTS (SELECT 1 FROM heard h WHERE h.frame = u.frame AND h.unit = u.unit)),
steps(before, after, why) AS (VALUES ('A', 'A2', 'different access'), ('A2', 'B', 'we learned about the past'), ('B', 'C', 'something happened')),
moves AS (
  SELECT a.unit, '+1' AS d, s.why FROM steps s JOIN answer a ON a.frame = s.after
    WHERE NOT EXISTS (SELECT 1 FROM answer b WHERE b.frame = s.before AND b.unit = a.unit)
  UNION ALL
  SELECT b.unit, '-1', s.why FROM steps s JOIN answer b ON b.frame = s.before
    WHERE NOT EXISTS (SELECT 1 FROM answer a WHERE a.frame = s.after AND a.unit = b.unit)),
named AS (
  SELECT (SELECT i.name FROM ids i WHERE i.frame = 'C' AND i.ident = m.unit AND i.stands_for IS NOT NULL
          ORDER BY i.registry DESC, CASE WHEN i.registry = 1 THEN i.recorded_at END DESC, i.recorded_at LIMIT 1) AS name, m.d, m.why
  FROM moves m),
hidden AS (
  SELECT COUNT(DISTINCT a.unit) AS c FROM answer a JOIN ids i ON i.frame = 'C' AND i.ident = a.unit
  JOIN facts x ON x.record = i.record
  WHERE a.frame = 'C' AND x.property = (SELECT property FROM q) AND x.value >= (SELECT since FROM q) AND x.superseded_at IS NULL
    AND x.floor NOT IN (SELECT floor FROM run_floors WHERE run = 'r2'))
SELECT (SELECT COUNT(*) FROM answer WHERE frame = 'A'), (SELECT COUNT(*) FROM answer WHERE frame = 'B'),
       (SELECT COUNT(*) FROM answer WHERE frame = 'C'), (SELECT c FROM hidden),
       (SELECT group_concat(name || ' ' || d || ' ' || why, '; ' ORDER BY name) FROM named);

-- Q3: What names has the subsidiary ever been known by, and since when?
-- expect: Harbour Line Logistics, 2026-01-14, Harbourline Freight Ltd, 2026-03-10, Harbour Line Logistics Ltd, 2026-05-12
-- The subsidiary is the invoice record's entity. Its name at each moment anything changed.
WITH pts AS (
  SELECT recorded_at AS t FROM records UNION SELECT from_at FROM record_keys),
ids AS (
  SELECT p.t, r.*, COALESCE((SELECT x.scheme || ':' || x.number FROM record_keys x WHERE x.record = r.id
    AND x.from_at <= p.t AND (x.to_at IS NULL OR x.to_at > p.t)), 'local:' || r.id) AS ident
  FROM pts p JOIN records r ON r.recorded_at <= p.t WHERE r.stands_for IS NOT NULL),
shown AS (
  SELECT p.t, (SELECT i.name FROM ids i WHERE i.t = p.t AND i.ident = (SELECT j.ident FROM ids j WHERE j.t = p.t AND j.id = 'r-inv-2207')
               ORDER BY i.registry DESC, CASE WHEN i.registry = 1 THEN i.recorded_at END DESC, i.recorded_at LIMIT 1) AS name
  FROM pts p WHERE p.t >= (SELECT recorded_at FROM records WHERE id = 'r-inv-2207')),
changes AS (SELECT t, name, LAG(name) OVER (ORDER BY t) AS before FROM shown)
SELECT name, substr(t, 1, 10) FROM changes WHERE before IS NULL OR before <> name ORDER BY t;

-- Q4: Which facts about "Harbourline" came from a model and are not accepted?
-- expect: Harbor Line, Harbourline Freight Ltd, 2026-04-08, open
WITH now AS (SELECT known_at AS k FROM runs WHERE id = 'r2'),
m AS (
  SELECT r.*, COALESCE((SELECT x.scheme || ':' || x.number FROM record_keys x WHERE x.record = r.id
           AND x.from_at <= now.k AND (x.to_at IS NULL OR x.to_at > now.k)), 'local:' || r.id) AS ident
  FROM records r, now WHERE r.stands_for = 'supplier')
SELECT rec.name,
  (SELECT m.name FROM m WHERE m.ident = p.scheme || ':' || p.number ORDER BY m.registry DESC, CASE WHEN m.registry = 1 THEN m.recorded_at END DESC, m.recorded_at LIMIT 1),
  substr(p.made_at, 1, 10), p.state
FROM proposals p JOIN records rec ON rec.id = p.record
WHERE p.producer_kind = 'model' AND p.state <> 'accepted'
  AND EXISTS (SELECT 1 FROM m WHERE m.ident = p.scheme || ':' || p.number AND m.name LIKE '%Harbourline%');

-- Q5: As the asker (who can't see the Team floor), how many facts are there about the subsidiary?
-- expect: 5, 1
-- A key is a fact here too, counted once, on its record's floor.
WITH now AS (SELECT known_at AS k FROM runs WHERE id = 'r2'),
mine AS (
  SELECT r.id, r.floor FROM records r, now WHERE COALESCE((SELECT x.scheme || ':' || x.number FROM record_keys x WHERE x.record = r.id
    AND x.from_at <= now.k AND (x.to_at IS NULL OR x.to_at > now.k)), 'local:' || r.id) = 'gb-ch:09812345'),
said AS (
  SELECT x.floor FROM facts x JOIN mine ON mine.id = x.record WHERE x.superseded_at IS NULL
  UNION ALL SELECT (SELECT floor FROM mine WHERE id = 'r-ch-hll'))
SELECT SUM(CASE WHEN floor IN (SELECT floor FROM run_floors WHERE run = 'r2') THEN 1 ELSE 0 END),
       SUM(CASE WHEN floor IN (SELECT floor FROM run_floors WHERE run = 'r2') THEN 0 ELSE 1 END) FROM said;

-- Q6: Who merged and who split, and on what evidence?
-- expect: merge, 2026-03-10, alex, Companies House lists Harbourline Freight Ltd as 04417721; Invoice INV-2207 from Harbour Line Logistics quotes 04417721, split, 2026-05-12, morgan, Companies House lists Harbour Line Logistics Ltd as 09812345 with parent 04417721
-- Nobody merges here: a key entry that lands on a number another supplier record holds is a merge.
SELECT CASE WHEN EXISTS (SELECT 1 FROM record_keys o WHERE o.record = k.record AND o.to_at = k.from_at) THEN 'split' ELSE 'merge' END,
       substr(k.from_at, 1, 10), k.entered_by, ev.says
FROM record_keys k JOIN records r ON r.id = k.record AND r.stands_for = 'supplier'
JOIN records ev ON ev.id = k.evidence
WHERE EXISTS (SELECT 1 FROM record_keys o JOIN records orr ON orr.id = o.record AND orr.stands_for = 'supplier'
              WHERE o.record <> k.record AND o.from_at < k.from_at AND (o.to_at IS NULL OR o.to_at > k.from_at)
                AND (o.scheme, o.number) = (k.scheme, k.number))
ORDER BY k.from_at;
