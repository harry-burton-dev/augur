-- Combined: the type specimen, placed under, cited and sorted, on two clocks.
-- Data Atlas's tables today stay (entities, entity_keys, observations, facts, proposals,
-- proposal_items), with one column added to entities. New: records, names, merges and
-- splits with their citations, sortings, and saved questions with their runs.
-- Portable: TEXT times in ISO 8601, TEXT holding JSON where Postgres has jsonb.

-- What a source said, as it arrived: a registry entry, an invoice, a delivery note, an email.
-- Never changed. A record found wrong is marked, with why, and stays.
CREATE TABLE records (
  id TEXT PRIMARY KEY,
  says TEXT NOT NULL,
  source TEXT NOT NULL,                 -- JSON, as observations.source today
  floor TEXT NOT NULL,
  recorded_at TEXT NOT NULL,
  recorded_by TEXT NOT NULL,
  discredited_at TEXT,
  discredited_by TEXT,
  discredited_why TEXT,
  CHECK ((discredited_at IS NULL) = (discredited_why IS NULL))
);

-- Today's entities, plus the specimen: the record the entity hangs on, set once.
-- NULL only for entities made before specimens were kept.
CREATE TABLE entities (
  id TEXT PRIMARY KEY,
  type TEXT NOT NULL,
  label TEXT NOT NULL,                  -- a copy of the accepted name, kept for today's readers
  description TEXT NOT NULL DEFAULT '',
  floor TEXT NOT NULL,
  state TEXT NOT NULL DEFAULT 'active' CHECK (state IN ('active', 'retired')),
  specimen TEXT UNIQUE REFERENCES records(id),
  created_by TEXT NOT NULL,
  created_at TEXT NOT NULL,
  updated_by TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

-- Every name an entity has had, on recorded time. Replaces label history and aliases.
CREATE TABLE names (
  id TEXT PRIMARY KEY,
  entity TEXT NOT NULL REFERENCES entities(id),
  name TEXT NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('accepted', 'synonym')),
  from_at TEXT NOT NULL,
  to_at TEXT,
  since_known INTEGER NOT NULL DEFAULT 1 CHECK (since_known IN (0, 1)),
  opened_by TEXT NOT NULL,
  closed_by TEXT,
  record TEXT REFERENCES records(id)
);

-- Today's identity keys: one entity per key. A second record with the same key is a
-- reason to ask a person (a proposal), never a merge.
CREATE TABLE entity_keys (
  entity TEXT NOT NULL REFERENCES entities(id),
  type TEXT NOT NULL,
  key TEXT NOT NULL,
  value TEXT NOT NULL,
  PRIMARY KEY (entity, key),
  UNIQUE (type, key, value)
);

-- The merge as an act: the junior placed under the senior. Nothing moves.
CREATE TABLE merges (
  id TEXT PRIMARY KEY,
  junior TEXT NOT NULL REFERENCES entities(id),
  senior TEXT NOT NULL REFERENCES entities(id),
  kind TEXT NOT NULL CHECK (kind IN ('found the same', 'became one')),
  valid_from TEXT,
  name_rule TEXT NOT NULL,
  floor TEXT NOT NULL,
  decided_by TEXT NOT NULL,
  decided_at TEXT NOT NULL,
  proposal TEXT,                        -- the Triage item it came from, if any
  withdrawn_at TEXT,
  CHECK ((kind = 'became one') = (valid_from IS NOT NULL)),
  CHECK (junior <> senior)
);

CREATE TABLE merge_cites (
  merge TEXT NOT NULL REFERENCES merges(id),
  record TEXT NOT NULL REFERENCES records(id),
  bearing TEXT NOT NULL CHECK (bearing IN ('supports', 'contradicts')),
  PRIMARY KEY (merge, record)
);

-- A split withdraws one merge, and says why. The old entity comes back with its own id.
CREATE TABLE splits (
  id TEXT PRIMARY KEY,
  merge TEXT NOT NULL UNIQUE REFERENCES merges(id),
  decided_by TEXT NOT NULL,
  decided_at TEXT NOT NULL,
  why TEXT NOT NULL
);

CREATE TABLE split_cites (
  split TEXT NOT NULL REFERENCES splits(id),
  record TEXT NOT NULL REFERENCES records(id),
  bearing TEXT NOT NULL CHECK (bearing IN ('supports', 'contradicts')),
  PRIMARY KEY (split, record)
);

-- A fact said of the merged entity, and which part the split decided it is about.
-- The fact stays one row; its subject is this, not facts.entity.
CREATE TABLE sortings (
  split TEXT NOT NULL REFERENCES splits(id),
  fact TEXT NOT NULL,
  about TEXT NOT NULL REFERENCES entities(id),
  sorted_by TEXT NOT NULL,
  sorted_at TEXT NOT NULL,
  why TEXT NOT NULL,
  record TEXT REFERENCES records(id),
  PRIMARY KEY (split, fact)
);

-- Today's observations, with the record each came from.
CREATE TABLE observations (
  id TEXT PRIMARY KEY,
  entity TEXT NOT NULL REFERENCES entities(id),
  property TEXT NOT NULL,
  value TEXT,
  floor TEXT NOT NULL,
  source TEXT NOT NULL,
  record TEXT REFERENCES records(id),
  created_by TEXT NOT NULL,
  created_at TEXT NOT NULL,
  retracted_at TEXT,
  retracted_why TEXT
);

-- Today's facts: two clocks already.
CREATE TABLE facts (
  id TEXT PRIMARY KEY,
  entity TEXT NOT NULL REFERENCES entities(id),
  property TEXT NOT NULL,
  value TEXT,
  target TEXT REFERENCES entities(id),
  valid_from TEXT,
  valid_to TEXT,
  floor TEXT NOT NULL,
  backed_by TEXT NOT NULL DEFAULT '[]',
  created_by TEXT NOT NULL,
  recorded_at TEXT NOT NULL,
  superseded_at TEXT,
  superseded_by TEXT,
  CHECK ((value IS NULL) <> (target IS NULL))
);

-- Today's Triage: pencil until a person decides.
CREATE TABLE proposals (
  id TEXT PRIMARY KEY,
  floor TEXT NOT NULL,
  source TEXT NOT NULL,
  producer TEXT NOT NULL,
  state TEXT NOT NULL DEFAULT 'open' CHECK (state IN ('open', 'finished', 'withdrawn')),
  created_by TEXT NOT NULL,
  created_at TEXT NOT NULL
);

CREATE TABLE proposal_items (
  proposal TEXT NOT NULL REFERENCES proposals(id),
  key TEXT NOT NULL,
  kind TEXT NOT NULL CHECK (kind IN ('mention', 'observation', 'term')),
  body TEXT NOT NULL,
  matches TEXT NOT NULL DEFAULT '[]',
  decision TEXT,
  decided_by TEXT,
  decided_at TEXT,
  PRIMARY KEY (proposal, key)
);

-- The question is the record: its words and choices, never its rows.
CREATE TABLE questions (
  id TEXT PRIMARY KEY,
  words TEXT NOT NULL,
  kind TEXT NOT NULL,
  property TEXT NOT NULL,
  since TEXT NOT NULL,
  choices TEXT NOT NULL DEFAULT '{}',    -- JSON: each sharpening choice and who made it
  asked_by TEXT NOT NULL,
  floor TEXT NOT NULL
);

-- Each run: as of when (both clocks), by whom, the count it gave. Never the rows.
CREATE TABLE runs (
  id TEXT PRIMARY KEY,
  question TEXT NOT NULL REFERENCES questions(id),
  run_by TEXT NOT NULL,
  valid_at TEXT NOT NULL,
  known_at TEXT NOT NULL,
  answered INTEGER NOT NULL
);

-- Whose access each run used.
CREATE TABLE run_floors (
  run TEXT NOT NULL REFERENCES runs(id),
  floor TEXT NOT NULL,
  PRIMARY KEY (run, floor)
);

-- Copies know their source: where a run's count was quoted, so a change can reach it.
CREATE TABLE quotes (
  id TEXT PRIMARY KEY,
  run TEXT NOT NULL REFERENCES runs(id),
  quoted_in TEXT NOT NULL,              -- JSON: the app and item, e.g. a briefing in Artifacts
  says TEXT NOT NULL,
  quoted_at TEXT NOT NULL
);
