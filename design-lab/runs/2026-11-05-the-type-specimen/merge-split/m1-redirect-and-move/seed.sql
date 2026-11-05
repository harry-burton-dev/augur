-- The case in merge and split V1's shape. The merge moved the subsidiary's contact onto the
-- parent; the undo moved it back. The delivery note's address, said of the merged entity,
-- was moved to the subsidiary afterwards by an ordinary edit, which leaves no trace here.

INSERT INTO entities VALUES
  ('e-hf',  'supplier', 'Harbourline Freight Ltd', '', 'tree:dept-freight', 'active', 'alex', '2026-01-09T10:00:00Z', 'morgan', '2026-05-12T16:00:00Z', NULL),
  ('e-hll', 'supplier', 'Harbour Line Logistics Ltd', '', 'tree:dept-freight', 'active', 'alex', '2026-01-14T11:00:00Z', 'morgan', '2026-05-12T16:00:00Z', NULL),
  ('e-kes', 'supplier', 'Kestrel Packaging',  '', 'tree:dept-freight', 'active', 'alex', '2026-01-05T09:00:00Z', 'alex', '2026-01-05T09:00:00Z', NULL),
  ('e-mar', 'supplier', 'Marlow Chemicals',   '', 'tree:dept-freight', 'active', 'alex', '2026-01-05T09:00:00Z', 'alex', '2026-01-05T09:00:00Z', NULL),
  ('e-ost', 'supplier', 'Ostrava Pallets',    '', 'tree:dept-freight', 'active', 'alex', '2026-01-05T09:00:00Z', 'alex', '2026-01-05T09:00:00Z', NULL),
  ('e-pen', 'supplier', 'Pennine Cold Chain', '', 'tree:dept-freight', 'active', 'alex', '2026-01-05T09:00:00Z', 'morgan', '2026-08-04T09:00:00Z', NULL),
  ('e-qua', 'supplier', 'Quayside Cranes',    '', 'tree:dept-freight', 'active', 'alex', '2026-01-05T09:00:00Z', 'alex', '2026-01-05T09:00:00Z', NULL),
  ('e-red', 'supplier', 'Redfern Tyres',      '', 'tree:dept-freight', 'active', 'alex', '2026-01-05T09:00:00Z', 'alex', '2026-01-05T09:00:00Z', NULL),
  ('e-sol', 'supplier', 'Solent Marine Fuel', '', 'tree:dept-freight', 'active', 'alex', '2026-01-05T09:00:00Z', 'alex', '2026-01-05T09:00:00Z', NULL),
  ('e-tid', 'supplier', 'Tidewater Seals',    '', 'tree:dept-freight', 'active', 'alex', '2026-01-05T09:00:00Z', 'alex', '2026-01-05T09:00:00Z', NULL);

INSERT INTO entity_aliases VALUES ('e-pen', 'Pennine Cold Store'), ('e-hll', 'Harbour Line Logistics');
INSERT INTO entity_keys VALUES ('e-hf', 'supplier', 'company_number', '04417721'), ('e-hll', 'supplier', 'company_number', '09812345');

INSERT INTO revisions VALUES
  ('e-hf',  '2026-01-09T10:00:00Z', 'alex', 'Harbourline Freight Ltd', NULL, 'Created'),
  ('e-hll', '2026-01-14T11:00:00Z', 'alex', 'Harbour Line Logistics', NULL, 'Created'),
  ('e-hll', '2026-03-10T14:00:00Z', 'alex', NULL, 'e-hf', 'Merged into Harbourline Freight Ltd'),
  ('e-hll', '2026-05-12T16:00:00Z', 'morgan', 'Harbour Line Logistics Ltd', NULL, 'Undo merge; name from Companies House'),
  ('e-pen', '2026-01-05T09:00:00Z', 'alex', 'Pennine Cold Store', NULL, 'Created'),
  ('e-pen', '2026-08-04T09:00:00Z', 'morgan', 'Pennine Cold Chain', NULL, 'Changed its name');

INSERT INTO merges VALUES
  ('m1', 'e-hll', 'e-hf', 'alex', '2026-03-10T14:00:00Z', 'Same company number 04417721', 'morgan', '2026-05-12T16:00:00Z', 'A subsidiary with its own number and contracts');
INSERT INTO moved VALUES ('m1', 'f04', 'e-hll'), ('m1', 'f02', 'e-hll');

INSERT INTO observations VALUES
  ('o-dn-118', 'e-hll', 'site_address', 'Unit 3, Dock Road', 'tree:dept-freight', '{"kind":"document","ref":"DN-118"}', 'alex', '2026-04-02T08:00:00Z', NULL, NULL),
  ('o-sol-0330', 'e-sol', 'contact', '2026-03-30', 'tree:dept-freight', '{"kind":"email"}', 'alex', '2026-03-30T12:00:00Z', '2026-06-10T10:00:00Z', 'The email came from Solent Marine Services, another firm');

INSERT INTO facts VALUES
  ('f01', 'e-hf',  'company_number', '04417721', NULL, NULL, NULL, 'tree:dept-freight', '[]', 'alex', '2026-01-09T10:00:00Z', NULL, NULL),
  ('f02', 'e-hll', 'company_number', '04417721', NULL, NULL, NULL, 'tree:dept-freight', '[]', 'alex', '2026-01-14T11:00:00Z', '2026-05-12T16:00:00Z', 'f20'),
  ('f03', 'e-hf',  'contact', '2026-02-02', NULL, '2026-02-02', NULL, 'tree:dept-freight', '[]', 'alex', '2026-02-02T12:00:00Z', NULL, NULL),
  ('f04', 'e-hll', 'contact', '2026-02-20', NULL, '2026-02-20', NULL, 'tree:dept-freight', '[]', 'alex', '2026-02-20T12:00:00Z', NULL, NULL),
  ('f05', 'e-kes', 'contact', '2026-01-20', NULL, '2026-01-20', NULL, 'tree:dept-freight', '[]', 'alex', '2026-01-20T12:00:00Z', NULL, NULL),
  ('f06', 'e-kes', 'contact', '2026-06-18', NULL, '2026-06-18', NULL, 'tree:dept-freight', '[]', 'morgan', '2026-06-18T12:00:00Z', NULL, NULL),
  ('f07', 'e-mar', 'contact', '2026-01-28', NULL, '2026-01-28', NULL, 'tree:dept-freight', '[]', 'alex', '2026-01-28T12:00:00Z', NULL, NULL),
  ('f08', 'e-ost', 'contact', '2026-01-12', NULL, '2026-01-12', NULL, 'tree:dept-freight', '[]', 'alex', '2026-01-12T12:00:00Z', NULL, NULL),
  ('f09', 'e-pen', 'contact', '2026-02-10', NULL, '2026-02-10', NULL, 'tree:dept-freight', '[]', 'alex', '2026-02-10T12:00:00Z', NULL, NULL),
  ('f10', 'e-qua', 'contact', '2026-01-05', NULL, '2026-01-05', NULL, 'tree:dept-freight', '[]', 'alex', '2026-01-05T12:00:00Z', NULL, NULL),
  ('f11', 'e-red', 'contact', '2026-03-22', NULL, '2026-03-22', NULL, 'tree:dept-freight', '[]', 'alex', '2026-03-22T12:00:00Z', NULL, NULL),
  ('f12', 'e-sol', 'contact', '2026-03-30', NULL, '2026-03-30', NULL, 'tree:dept-freight', '["o-sol-0330"]', 'alex', '2026-03-30T12:00:00Z', '2026-06-10T10:00:00Z', NULL),
  ('f13', 'e-tid', 'contact', '2026-01-30', NULL, '2026-01-30', NULL, 'tree:dept-freight', '[]', 'alex', '2026-01-30T12:00:00Z', NULL, NULL),
  ('f14', 'e-hf',  'phone', '+44 1632 960118', NULL, NULL, NULL, 'tree:dept-freight', '[]', 'alex', '2026-02-05T09:00:00Z', NULL, NULL),
  ('f20', 'e-hll', 'company_number', '09812345', NULL, NULL, NULL, 'tree:dept-freight', '[]', 'morgan', '2026-05-12T16:00:00Z', NULL, NULL),
  ('f21', 'e-hll', 'parent', NULL, 'e-hf', NULL, NULL, 'tree:dept-freight', '[]', 'morgan', '2026-05-12T16:00:00Z', NULL, NULL),
  ('f22', 'e-hll', 'delivery_site', 'Berth 7', NULL, NULL, NULL, 'tree:team-inbound', '[]', 'sam', '2026-05-20T10:00:00Z', NULL, NULL),
  ('f23', 'e-hll', 'contract', 'Dock 4 haulage', NULL, '2026-05-20', NULL, 'tree:team-contracts', '[]', 'jo', '2026-05-20T11:00:00Z', NULL, NULL),
  -- Said of the merged entity in April; edited onto the subsidiary after the undo.
  ('f24', 'e-hll', 'site_address', 'Unit 3, Dock Road', NULL, NULL, NULL, 'tree:dept-freight', '["o-dn-118"]', 'alex', '2026-04-02T08:00:00Z', NULL, NULL),
  ('f26', 'e-mar', 'contact', '2026-07-09', NULL, '2026-07-09', NULL, 'tree:team-contracts', '[]', 'jo', '2026-07-09T12:00:00Z', NULL, NULL);

INSERT INTO proposals VALUES
  ('p1', 'tree:dept-freight', '{"kind":"document","ref":"CH 04417721"}', '{"kind":"model","id":"model:triage"}', 'finished', 'model:triage', '2026-02-04T16:00:00Z'),
  ('p2', 'tree:dept-freight', '{"kind":"email","ref":"mail 2026-04-08 #5521"}', '{"kind":"model","id":"model:triage"}', 'open', 'model:triage', '2026-04-08T07:41:00Z');
INSERT INTO proposal_items VALUES
  ('p1', 'i1', 'observation', '{"entity":"e-hf","property":"phone","value":"+44 1632 960118"}', '[]', '{"as":"accepted","fact":"f14"}', 'alex', '2026-02-05T09:00:00Z'),
  ('p2', 'i1', 'mention', '{"text":"Harbor Line","type":"supplier"}', '[{"entity":"e-hf","why":"similar"}]', NULL, NULL, NULL);

INSERT INTO questions VALUES ('sq1', 'Which suppliers have we not heard from since spring?', 'supplier', 'contact', '2026-03-01', 'priya');
INSERT INTO runs VALUES
  ('r1', 'sq1', 'priya', '2026-04-20', '2026-04-20T09:30:00Z', 7),
  ('r2', 'sq1', 'sam',   '2026-11-05', '2026-11-05T10:00:00Z', 8);
INSERT INTO run_floors VALUES
  ('r1', 'org'), ('r1', 'tree:dept-freight'),
  ('r2', 'org'), ('r2', 'tree:dept-freight'), ('r2', 'tree:team-inbound');
