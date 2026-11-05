-- Across time V4: replay the log. Built on merge and split V2's ideas, stored as events.
-- One append-only list of what happened to the identity model, in order: an entity made,
-- named, merged, split; a fact said, withdrawn, sorted; a guess made, accepted. Every
-- state at any recorded time is the events up to then, replayed. Nothing else is stored.
-- (Event sourcing; the land register's entries in order; the facts' valid time is a column.)

CREATE TABLE floors (
  id TEXT PRIMARY KEY,
  kind TEXT NOT NULL CHECK (kind IN ('you', 'team', 'department', 'org')),
  name TEXT NOT NULL,
  parent TEXT REFERENCES floors(id)
);

CREATE TABLE records (
  id TEXT PRIMARY KEY,
  says TEXT NOT NULL,
  floor TEXT NOT NULL REFERENCES floors(id),
  recorded_at TEXT NOT NULL,
  recorded_by TEXT NOT NULL
);

CREATE TABLE events (
  seq INTEGER PRIMARY KEY,
  at TEXT NOT NULL,
  by TEXT NOT NULL,
  by_kind TEXT NOT NULL CHECK (by_kind IN ('person', 'model', 'import')),
  type TEXT NOT NULL CHECK (type IN ('entity made', 'named', 'other name', 'merged', 'split',
    'fact said', 'fact withdrawn', 'fact sorted', 'guess made', 'guess accepted', 'guess rejected')),
  entity TEXT,
  other TEXT,
  fact TEXT,
  property TEXT,
  value TEXT,
  valid TEXT,
  floor TEXT REFERENCES floors(id),
  mention TEXT,
  ref INTEGER REFERENCES events(seq),
  note TEXT NOT NULL DEFAULT ''
);

CREATE TABLE event_evidence (
  seq INTEGER NOT NULL REFERENCES events(seq),
  record TEXT NOT NULL REFERENCES records(id),
  PRIMARY KEY (seq, record)
);

CREATE TABLE questions (id TEXT PRIMARY KEY, words TEXT NOT NULL, kind TEXT NOT NULL, property TEXT NOT NULL, since TEXT NOT NULL, asked_by TEXT NOT NULL);
CREATE TABLE runs (id TEXT PRIMARY KEY, question TEXT NOT NULL REFERENCES questions(id), run_by TEXT NOT NULL, valid_at TEXT NOT NULL, known_at TEXT NOT NULL, answered INTEGER NOT NULL);
CREATE TABLE run_floors (run TEXT NOT NULL REFERENCES runs(id), floor TEXT NOT NULL REFERENCES floors(id), PRIMARY KEY (run, floor));
