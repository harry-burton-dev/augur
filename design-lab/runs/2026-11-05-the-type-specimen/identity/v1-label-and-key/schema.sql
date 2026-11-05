-- Identity V1: label and key. Data Atlas's shape today (store.ts migrations 001-008),
-- made portable: text[] aliases become a child table, jsonb becomes TEXT holding JSON.
-- An entity is a row with one label. Other names are undated aliases. Identity keys are
-- unique across entities. Retiring frees the keys. There is no merge and no split.

CREATE TABLE entities (
  id TEXT PRIMARY KEY,
  type TEXT NOT NULL,
  label TEXT NOT NULL,
  description TEXT NOT NULL DEFAULT '',
  floor TEXT NOT NULL,
  state TEXT NOT NULL DEFAULT 'active' CHECK (state IN ('active', 'retired')),
  created_by TEXT NOT NULL,
  created_at TEXT NOT NULL,
  updated_by TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

-- Today: aliases text[] on the entity. No dates, no who, no why.
CREATE TABLE entity_aliases (
  entity TEXT NOT NULL REFERENCES entities(id),
  alias TEXT NOT NULL,
  PRIMARY KEY (entity, alias)
);

-- One row per identity key, so no two entities share one.
CREATE TABLE entity_keys (
  entity TEXT NOT NULL REFERENCES entities(id),
  type TEXT NOT NULL,
  key TEXT NOT NULL,
  value TEXT NOT NULL,
  PRIMARY KEY (entity, key),
  UNIQUE (type, key, value)
);

-- What people saw or read, as they said it. Only ever added.
CREATE TABLE observations (
  id TEXT PRIMARY KEY,
  entity TEXT NOT NULL REFERENCES entities(id),
  property TEXT NOT NULL,
  value TEXT,
  floor TEXT NOT NULL,
  source TEXT NOT NULL,
  created_by TEXT NOT NULL,
  created_at TEXT NOT NULL,
  retracted_at TEXT,
  retracted_why TEXT
);

-- What a floor accepts as so, on two clocks.
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
