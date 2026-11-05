-- From Data Atlas today (identity V1: store.ts migrations 001-008, made portable) to the
-- combined shape. In Postgres this is one more migration, 009_identity, under atlas.
-- Nothing is deleted. History from before the migration can't be found again, so what
-- isn't known says so: names get since_known = 0, entities made before have no specimen.
-- Postgres notes: entity_aliases is unnest(aliases) there; JSON reads use ->>; times are
-- timestamptz; group_concat in the questions is string_agg.

CREATE TABLE records (
  id TEXT PRIMARY KEY, says TEXT NOT NULL, source TEXT NOT NULL, floor TEXT NOT NULL,
  recorded_at TEXT NOT NULL, recorded_by TEXT NOT NULL,
  discredited_at TEXT, discredited_by TEXT, discredited_why TEXT,
  CHECK ((discredited_at IS NULL) = (discredited_why IS NULL)));

ALTER TABLE entities ADD COLUMN specimen TEXT REFERENCES records(id);
CREATE UNIQUE INDEX entities_specimen ON entities (specimen);

CREATE TABLE names (
  id TEXT PRIMARY KEY, entity TEXT NOT NULL REFERENCES entities(id), name TEXT NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('accepted', 'synonym')), from_at TEXT NOT NULL, to_at TEXT,
  since_known INTEGER NOT NULL DEFAULT 1 CHECK (since_known IN (0, 1)),
  opened_by TEXT NOT NULL, closed_by TEXT, record TEXT REFERENCES records(id));

CREATE TABLE merges (
  id TEXT PRIMARY KEY, junior TEXT NOT NULL REFERENCES entities(id), senior TEXT NOT NULL REFERENCES entities(id),
  kind TEXT NOT NULL CHECK (kind IN ('found the same', 'became one')), valid_from TEXT, name_rule TEXT NOT NULL,
  floor TEXT NOT NULL, decided_by TEXT NOT NULL, decided_at TEXT NOT NULL, proposal TEXT, withdrawn_at TEXT,
  CHECK ((kind = 'became one') = (valid_from IS NOT NULL)), CHECK (junior <> senior));
CREATE TABLE merge_cites (merge TEXT NOT NULL REFERENCES merges(id), record TEXT NOT NULL REFERENCES records(id),
  bearing TEXT NOT NULL CHECK (bearing IN ('supports', 'contradicts')), PRIMARY KEY (merge, record));
CREATE TABLE splits (id TEXT PRIMARY KEY, merge TEXT NOT NULL UNIQUE REFERENCES merges(id), decided_by TEXT NOT NULL,
  decided_at TEXT NOT NULL, why TEXT NOT NULL);
CREATE TABLE split_cites (split TEXT NOT NULL REFERENCES splits(id), record TEXT NOT NULL REFERENCES records(id),
  bearing TEXT NOT NULL CHECK (bearing IN ('supports', 'contradicts')), PRIMARY KEY (split, record));
CREATE TABLE sortings (split TEXT NOT NULL REFERENCES splits(id), fact TEXT NOT NULL, about TEXT NOT NULL REFERENCES entities(id),
  sorted_by TEXT NOT NULL, sorted_at TEXT NOT NULL, why TEXT NOT NULL, record TEXT REFERENCES records(id), PRIMARY KEY (split, fact));

ALTER TABLE observations ADD COLUMN record TEXT REFERENCES records(id);

CREATE TABLE questions (id TEXT PRIMARY KEY, words TEXT NOT NULL, kind TEXT NOT NULL, property TEXT NOT NULL, since TEXT NOT NULL,
  choices TEXT NOT NULL DEFAULT '{}', asked_by TEXT NOT NULL, floor TEXT NOT NULL);
CREATE TABLE runs (id TEXT PRIMARY KEY, question TEXT NOT NULL REFERENCES questions(id), run_by TEXT NOT NULL,
  valid_at TEXT NOT NULL, known_at TEXT NOT NULL, answered INTEGER NOT NULL);
CREATE TABLE run_floors (run TEXT NOT NULL REFERENCES runs(id), floor TEXT NOT NULL, PRIMARY KEY (run, floor));
CREATE TABLE quotes (id TEXT PRIMARY KEY, run TEXT NOT NULL REFERENCES runs(id), quoted_in TEXT NOT NULL, says TEXT NOT NULL, quoted_at TEXT NOT NULL);

-- Each entity's label becomes its accepted name. When it began isn't known.
INSERT INTO names (id, entity, name, status, from_at, to_at, since_known, opened_by, closed_by, record)
SELECT 'n-' || id || '-label', id, label, 'accepted', created_at, NULL, 0, created_by, NULL, NULL FROM entities;

-- Each alias becomes a synonym. When and why aren't known.
INSERT INTO names (id, entity, name, status, from_at, to_at, since_known, opened_by, closed_by, record)
SELECT 'n-' || a.entity || '-' || ROW_NUMBER() OVER (PARTITION BY a.entity ORDER BY a.alias), a.entity, a.alias, 'synonym',
  e.created_at, NULL, 0, e.created_by, NULL, NULL
FROM entity_aliases a JOIN entities e ON e.id = a.entity;

-- Each observation's source becomes a record it came from, one per distinct source.
INSERT INTO records (id, says, source, floor, recorded_at, recorded_by)
SELECT 'r-' || o.id, o.property || ': ' || COALESCE(o.value, ''), o.source, o.floor, o.created_at, o.created_by FROM observations o;
UPDATE observations SET record = 'r-' || id;
-- A withdrawn source is a discredited record.
UPDATE records SET discredited_at = (SELECT retracted_at FROM observations o WHERE 'r-' || o.id = records.id),
                   discredited_why = (SELECT retracted_why FROM observations o WHERE 'r-' || o.id = records.id)
WHERE id IN (SELECT 'r-' || id FROM observations WHERE retracted_at IS NOT NULL);
