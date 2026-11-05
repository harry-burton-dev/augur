-- From identity V4 (same as) to merge and split V4 (evidence and conclusion).
-- A person's link becomes a 'same' conclusion; a withdrawn one also gets the 'distinct'
-- conclusion that withdrew it. Edit summaries become the reasoning. V4 kept no records,
-- so nothing can be cited: each conclusion says so. A model's link becomes a hypothesis,
-- and the node made for its mention stops being an entity (it was never one).

CREATE TABLE records (id TEXT PRIMARY KEY, says TEXT NOT NULL, floor TEXT NOT NULL REFERENCES floors(id), recorded_at TEXT NOT NULL,
  recorded_by TEXT NOT NULL, discredited_at TEXT, discredited_why TEXT);
CREATE TABLE conclusions (id TEXT PRIMARY KEY, kind TEXT NOT NULL CHECK (kind IN ('same', 'distinct', 'about')), a TEXT NOT NULL REFERENCES entities(id),
  b TEXT REFERENCES entities(id), fact TEXT REFERENCES facts(id), stated_by TEXT NOT NULL, stated_at TEXT NOT NULL, reasoning TEXT NOT NULL,
  withdraws TEXT REFERENCES conclusions(id), CHECK ((kind = 'about') = (fact IS NOT NULL)));
CREATE TABLE cites (conclusion TEXT NOT NULL REFERENCES conclusions(id), record TEXT NOT NULL REFERENCES records(id),
  bearing TEXT NOT NULL CHECK (bearing IN ('supports', 'contradicts')), PRIMARY KEY (conclusion, record));
CREATE TABLE hypotheses (id TEXT PRIMARY KEY, producer_kind TEXT NOT NULL CHECK (producer_kind IN ('model', 'person', 'import')), producer TEXT NOT NULL,
  claim TEXT NOT NULL, mention TEXT, about TEXT REFERENCES entities(id), record TEXT REFERENCES records(id), made_at TEXT NOT NULL,
  state TEXT NOT NULL DEFAULT 'open' CHECK (state IN ('open', 'accepted', 'rejected')), decided_by TEXT, decided_at TEXT, became TEXT);

INSERT INTO conclusions
SELECT 'c-' || id, 'same', a, b, NULL, made_by, asserted_at, summary || ' (no records were kept)', NULL
FROM same_as WHERE made_by_kind = 'person' AND asserted_at IS NOT NULL;

INSERT INTO conclusions
SELECT 'cw-' || id, 'distinct', a, b, NULL, closed_by, closed_at, COALESCE(closed_summary, '') || ' (no records were kept)', 'c-' || id
FROM same_as WHERE made_by_kind = 'person' AND state = 'withdrawn';

-- A model's link: the guess becomes a hypothesis about the entity it pointed at.
INSERT INTO hypotheses
SELECT 'h-' || s.id, 'model', s.made_by, 'same supplier as this one', l.label, s.a, NULL, s.made_at,
  CASE s.state WHEN 'proposed' THEN 'open' WHEN 'rejected' THEN 'rejected' ELSE 'accepted' END, NULL, NULL, NULL
FROM same_as s JOIN labels l ON l.entity = s.b AND l.to_at IS NULL
WHERE s.made_by_kind = 'model';

-- The mention's node was only ever pencil.
DELETE FROM labels WHERE entity IN (SELECT b FROM same_as WHERE made_by_kind = 'model' AND state = 'proposed');
DELETE FROM entities WHERE id IN (SELECT b FROM same_as WHERE made_by_kind = 'model' AND state = 'proposed')
  AND id NOT IN (SELECT entity FROM facts);
DELETE FROM same_as WHERE made_by_kind = 'model' AND state = 'proposed';

ALTER TABLE facts DROP COLUMN from_model;
