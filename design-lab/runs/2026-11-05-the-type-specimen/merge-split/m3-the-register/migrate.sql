-- From identity V2 (the type specimen) to merge and split V3 (the register).
-- Each names row becomes entries, in time order: an accepted name is a 'name' entry; a
-- synonym under another entity is a 'placed under' entry and, if it ended, a 'released'
-- entry; any other synonym is an 'other name'. Each entry cites the one record its row cited.
-- Sortings can't be found: V2 never said which facts a split moved.

CREATE TABLE register (
  entity TEXT NOT NULL REFERENCES entities(id), seq INTEGER NOT NULL, entered_at TEXT NOT NULL, entered_by TEXT NOT NULL,
  kind TEXT NOT NULL CHECK (kind IN ('name', 'other name', 'placed under', 'released', 'fact sorted')),
  name TEXT, other TEXT REFERENCES entities(id), fact TEXT, closes INTEGER, note TEXT NOT NULL DEFAULT '',
  PRIMARY KEY (entity, seq), CHECK (closes IS NULL OR closes < seq));
CREATE TABLE entry_evidence (entity TEXT NOT NULL, seq INTEGER NOT NULL, record TEXT NOT NULL REFERENCES records(id),
  PRIMARY KEY (entity, seq, record), FOREIGN KEY (entity, seq) REFERENCES register(entity, seq));

CREATE TEMP TABLE ev AS
SELECT entity, from_at AS at, opened_by AS by, CASE WHEN synonym_of IS NOT NULL THEN 'placed under' WHEN status = 'accepted' THEN 'name' ELSE 'other name' END AS kind,
  CASE WHEN synonym_of IS NULL THEN name END AS name, synonym_of AS other, evidence, id AS src, 0 AS ending, 1 AS ord
FROM names
UNION ALL
SELECT entity, to_at, closed_by, 'released', NULL, synonym_of, NULL, id, 1, 0 FROM names WHERE synonym_of IS NOT NULL AND to_at IS NOT NULL;

CREATE TEMP TABLE numbered AS
SELECT ev.*, ROW_NUMBER() OVER (PARTITION BY entity ORDER BY at, ord, src) AS seq FROM ev;

INSERT INTO register (entity, seq, entered_at, entered_by, kind, name, other, fact, closes, note)
SELECT n.entity, n.seq, n.at, COALESCE(n.by, 'unknown'), n.kind, n.name, n.other, NULL,
  CASE
    WHEN n.kind = 'released' THEN (SELECT o.seq FROM numbered o WHERE o.src = n.src AND o.ending = 0)
    WHEN n.kind = 'name' THEN (SELECT o.seq FROM numbered o JOIN names nm ON nm.id = o.src
                               WHERE o.entity = n.entity AND o.kind = 'name' AND o.ending = 0 AND nm.to_at = n.at)
  END,
  'migrated'
FROM numbered n;

INSERT INTO entry_evidence SELECT n.entity, n.seq, n.evidence FROM numbered n WHERE n.evidence IS NOT NULL;
-- The released entry cites the record of the name that came back with it.
INSERT INTO entry_evidence
SELECT n.entity, n.seq, a.evidence FROM numbered n
JOIN names s ON s.id = n.src
JOIN names a ON a.entity = s.entity AND a.status = 'accepted' AND a.from_at = s.to_at
WHERE n.kind = 'released' AND a.evidence IS NOT NULL;

DROP TABLE numbered;
DROP TABLE ev;
