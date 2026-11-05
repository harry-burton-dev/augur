-- Identity V3: the number is the name.
-- No entity table. Records carry keys (a registry scheme and number) on recorded time.
-- An entity is every record that holds the same key now: 'gb-ch:04417721'. A record with
-- no key is an entity on its own: 'local:<record id>'. Its name comes from its newest
-- registry record, else its earliest record. Merges and splits happen when a key is
-- entered or corrected; nobody decides them as such.

CREATE TABLE floors (
  id TEXT PRIMARY KEY,
  kind TEXT NOT NULL CHECK (kind IN ('you', 'team', 'department', 'org')),
  name TEXT NOT NULL,
  parent TEXT REFERENCES floors(id)
);

CREATE TABLE records (
  id TEXT PRIMARY KEY,
  says TEXT NOT NULL,
  name TEXT,
  stands_for TEXT,            -- the kind this record stands for ('supplier'), or NULL for a mention
  registry INTEGER NOT NULL DEFAULT 0 CHECK (registry IN (0, 1)),
  floor TEXT NOT NULL REFERENCES floors(id),
  recorded_at TEXT NOT NULL,
  recorded_by TEXT NOT NULL
);

-- The key a record holds, from when to when (recorded time). Only one open at a time.
CREATE TABLE record_keys (
  record TEXT NOT NULL REFERENCES records(id),
  scheme TEXT NOT NULL,
  number TEXT NOT NULL,
  from_at TEXT NOT NULL,
  to_at TEXT,
  entered_by TEXT NOT NULL,
  closed_by TEXT,
  evidence TEXT NOT NULL REFERENCES records(id),
  PRIMARY KEY (record, from_at)
);

-- Facts hang on records, so they follow whatever key the record holds.
CREATE TABLE facts (
  id TEXT PRIMARY KEY,
  record TEXT NOT NULL REFERENCES records(id),
  property TEXT NOT NULL,
  value TEXT,
  target TEXT,                -- an identity, 'gb-ch:...' or 'local:...'
  valid_from TEXT,
  floor TEXT NOT NULL REFERENCES floors(id),
  recorded_at TEXT NOT NULL,
  recorded_by TEXT NOT NULL,
  superseded_at TEXT,
  CHECK ((value IS NULL) <> (target IS NULL))
);

-- Pencil. A model's "same supplier" is a key it proposes for a record.
CREATE TABLE proposals (
  id TEXT PRIMARY KEY,
  producer_kind TEXT NOT NULL CHECK (producer_kind IN ('model', 'person', 'import')),
  producer TEXT NOT NULL,
  claim TEXT NOT NULL,
  record TEXT NOT NULL REFERENCES records(id),
  scheme TEXT,
  number TEXT,
  made_at TEXT NOT NULL,
  state TEXT NOT NULL DEFAULT 'open' CHECK (state IN ('open', 'accepted', 'rejected')),
  decided_by TEXT,
  decided_at TEXT
);

CREATE TABLE questions (id TEXT PRIMARY KEY, words TEXT NOT NULL, kind TEXT NOT NULL, property TEXT NOT NULL, since TEXT NOT NULL, asked_by TEXT NOT NULL);
CREATE TABLE runs (id TEXT PRIMARY KEY, question TEXT NOT NULL REFERENCES questions(id), run_by TEXT NOT NULL, valid_at TEXT NOT NULL, known_at TEXT NOT NULL, answered INTEGER NOT NULL);
CREATE TABLE run_floors (run TEXT NOT NULL REFERENCES runs(id), floor TEXT NOT NULL REFERENCES floors(id), PRIMARY KEY (run, floor));
