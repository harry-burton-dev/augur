-- From identity V2 (the type specimen) to merge and split V2 (synonymy by rule).
-- Every synonym row that points at another entity was a merge. It becomes a merge act.
-- What V2 never stored can't be made up: a merge keeps the one record its name row cited,
-- its kind is taken as 'found the same', and its split's reason says it was not kept.

ALTER TABLE names ADD COLUMN merge TEXT;

CREATE TABLE merges (
  id TEXT PRIMARY KEY,
  junior TEXT NOT NULL REFERENCES entities(id),
  senior TEXT NOT NULL REFERENCES entities(id),
  kind TEXT NOT NULL CHECK (kind IN ('found the same', 'became one')),
  valid_from TEXT,
  name_rule TEXT NOT NULL,
  decided_by TEXT NOT NULL,
  decided_at TEXT NOT NULL,
  withdrawn_at TEXT,
  withdrawn_by TEXT,
  CHECK ((kind = 'became one') = (valid_from IS NOT NULL))
);
CREATE TABLE merge_evidence (merge TEXT NOT NULL REFERENCES merges(id), record TEXT NOT NULL REFERENCES records(id), PRIMARY KEY (merge, record));
CREATE TABLE splits (id TEXT PRIMARY KEY, merge TEXT NOT NULL UNIQUE REFERENCES merges(id), decided_by TEXT NOT NULL, decided_at TEXT NOT NULL, why TEXT NOT NULL);
CREATE TABLE split_evidence (split TEXT NOT NULL REFERENCES splits(id), record TEXT NOT NULL REFERENCES records(id), PRIMARY KEY (split, record));
CREATE TABLE sortings (
  split TEXT NOT NULL REFERENCES splits(id), fact TEXT NOT NULL REFERENCES facts(id), kept_on TEXT NOT NULL REFERENCES entities(id),
  new_fact TEXT REFERENCES facts(id), sorted_by TEXT NOT NULL, why TEXT NOT NULL, PRIMARY KEY (split, fact));

INSERT INTO merges (id, junior, senior, kind, valid_from, name_rule, decided_by, decided_at, withdrawn_at, withdrawn_by)
SELECT 'm-' || id, entity, synonym_of, 'found the same', NULL, 'not kept before migration', opened_by, from_at, to_at, closed_by
FROM names WHERE synonym_of IS NOT NULL;

INSERT INTO merge_evidence SELECT 'm-' || id, evidence FROM names WHERE synonym_of IS NOT NULL AND evidence IS NOT NULL;

UPDATE names SET merge = 'm-' || id WHERE synonym_of IS NOT NULL;

INSERT INTO splits SELECT 's-' || id, 'm-' || id, closed_by, to_at, 'not kept before migration'
FROM names WHERE synonym_of IS NOT NULL AND to_at IS NOT NULL;

-- The split's evidence: the record cited by the junior's name opened at the moment the synonym closed.
INSERT INTO split_evidence
SELECT 's-' || s.id, a.evidence FROM names s
JOIN names a ON a.entity = s.entity AND a.status = 'accepted' AND a.from_at = s.to_at
WHERE s.synonym_of IS NOT NULL AND s.to_at IS NOT NULL AND a.evidence IS NOT NULL;

-- Sortings are inferred: a fact on the senior closed at the split, with the same property
-- and value opened on the junior at that moment. Marked as inferred.
INSERT INTO sortings
SELECT 's-' || s.id, old.id, new.entity, new.id, new.recorded_by, 'inferred at migration'
FROM names s
JOIN facts old ON old.entity = s.synonym_of AND old.superseded_at = s.to_at AND old.recorded_at >= s.from_at
JOIN facts new ON new.entity = s.entity AND new.property = old.property AND new.value = old.value AND new.recorded_at = s.to_at
WHERE s.synonym_of IS NOT NULL AND s.to_at IS NOT NULL;
