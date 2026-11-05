-- The case, as today's Data Atlas would hold it after a keeper did the merge and split by hand.
-- January: the invoice's company number can't be kept as a key: Harbourline Freight Ltd holds it.
-- March "merge": retire Harbour Line Logistics, add its name as an alias of Harbourline Freight Ltd.
-- May "split": a retired entity can't come back, so a new one is made and its facts typed again.

INSERT INTO entities VALUES
  ('e-hf',   'supplier', 'Harbourline Freight Ltd', '', 'tree:dept-freight', 'active', 'alex', '2026-01-09T10:00:00Z', 'morgan', '2026-05-12T16:00:00Z'),
  ('e-hll',  'supplier', 'Harbour Line Logistics', 'Invoice INV-2207 quotes 04417721', 'tree:dept-freight', 'retired', 'alex', '2026-01-14T11:00:00Z', 'alex', '2026-03-10T14:00:00Z'),
  ('e-hll2', 'supplier', 'Harbour Line Logistics Ltd', 'Split from Harbourline Freight Ltd', 'tree:dept-freight', 'active', 'morgan', '2026-05-12T16:00:00Z', 'morgan', '2026-05-12T16:00:00Z'),
  ('e-kes', 'supplier', 'Kestrel Packaging',  '', 'tree:dept-freight', 'active', 'alex', '2026-01-05T09:00:00Z', 'alex', '2026-01-05T09:00:00Z'),
  ('e-mar', 'supplier', 'Marlow Chemicals',   '', 'tree:dept-freight', 'active', 'alex', '2026-01-05T09:00:00Z', 'alex', '2026-01-05T09:00:00Z'),
  ('e-ost', 'supplier', 'Ostrava Pallets',    '', 'tree:dept-freight', 'active', 'alex', '2026-01-05T09:00:00Z', 'alex', '2026-01-05T09:00:00Z'),
  ('e-pen', 'supplier', 'Pennine Cold Chain', '', 'tree:dept-freight', 'active', 'alex', '2026-01-05T09:00:00Z', 'morgan', '2026-08-04T09:00:00Z'),
  ('e-qua', 'supplier', 'Quayside Cranes',    '', 'tree:dept-freight', 'active', 'alex', '2026-01-05T09:00:00Z', 'alex', '2026-01-05T09:00:00Z'),
  ('e-red', 'supplier', 'Redfern Tyres',      '', 'tree:dept-freight', 'active', 'alex', '2026-01-05T09:00:00Z', 'alex', '2026-01-05T09:00:00Z'),
  ('e-sol', 'supplier', 'Solent Marine Fuel', '', 'tree:dept-freight', 'active', 'alex', '2026-01-05T09:00:00Z', 'alex', '2026-01-05T09:00:00Z'),
  ('e-tid', 'supplier', 'Tidewater Seals',    '', 'tree:dept-freight', 'active', 'alex', '2026-01-05T09:00:00Z', 'alex', '2026-01-05T09:00:00Z');

-- The alias added at the merge was taken off at the split. Pennine's old name is kept.
INSERT INTO entity_aliases VALUES ('e-pen', 'Pennine Cold Store'), ('e-hll2', 'Harbour Line Logistics');

INSERT INTO entity_keys VALUES
  ('e-hf', 'supplier', 'company_number', '04417721'),
  ('e-hll2', 'supplier', 'company_number', '09812345');

INSERT INTO observations VALUES
  ('o-dn-118', 'e-hf', 'site_address', 'Unit 3, Dock Road', 'tree:dept-freight', '{"kind":"document","ref":"DN-118"}', 'alex', '2026-04-02T08:00:00Z', NULL, NULL),
  ('o-sol-0330', 'e-sol', 'contact', '2026-03-30', 'tree:dept-freight', '{"kind":"email"}', 'alex', '2026-03-30T12:00:00Z', '2026-06-10T10:00:00Z', 'The email came from Solent Marine Services, another firm');

INSERT INTO facts VALUES
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
  ('f24', 'e-hf',  'site_address', 'Unit 3, Dock Road', NULL, NULL, NULL, 'tree:dept-freight', '["o-dn-118"]', 'alex', '2026-04-02T08:00:00Z', '2026-05-12T16:00:00Z', NULL),
  -- Typed again on the new entity at the split.
  ('f04b', 'e-hll2', 'contact', '2026-02-20', NULL, '2026-02-20', NULL, 'tree:dept-freight', '[]', 'morgan', '2026-05-12T16:00:00Z', NULL, NULL),
  ('f20', 'e-hll2', 'company_number', '09812345', NULL, NULL, NULL, 'tree:dept-freight', '[]', 'morgan', '2026-05-12T16:00:00Z', NULL, NULL),
  ('f21', 'e-hll2', 'parent', NULL, 'e-hf', NULL, NULL, 'tree:dept-freight', '[]', 'morgan', '2026-05-12T16:00:00Z', NULL, NULL),
  ('f25', 'e-hll2', 'site_address', 'Unit 3, Dock Road', NULL, NULL, NULL, 'tree:dept-freight', '["o-dn-118"]', 'morgan', '2026-05-12T16:00:00Z', NULL, NULL),
  ('f22', 'e-hll2', 'delivery_site', 'Berth 7', NULL, NULL, NULL, 'tree:team-inbound', '[]', 'sam', '2026-05-20T10:00:00Z', NULL, NULL),
  ('f23', 'e-hll2', 'contract', 'Dock 4 haulage', NULL, '2026-05-20', NULL, 'tree:team-contracts', '[]', 'jo', '2026-05-20T11:00:00Z', NULL, NULL),
  ('f26', 'e-mar', 'contact', '2026-07-09', NULL, '2026-07-09', NULL, 'tree:team-contracts', '[]', 'jo', '2026-07-09T12:00:00Z', NULL, NULL);

INSERT INTO proposals VALUES
  ('p1', 'tree:dept-freight', '{"kind":"document","ref":"CH 04417721"}', '{"kind":"model","id":"model:triage"}', 'finished', 'model:triage', '2026-02-04T16:00:00Z'),
  ('p2', 'tree:dept-freight', '{"kind":"email","ref":"mail 2026-04-08 #5521"}', '{"kind":"model","id":"model:triage"}', 'open', 'model:triage', '2026-04-08T07:41:00Z');

INSERT INTO proposal_items VALUES
  ('p1', 'i1', 'observation', '{"entity":"e-hf","property":"phone","value":"+44 1632 960118"}', '[]', '{"as":"accepted","fact":"f14"}', 'alex', '2026-02-05T09:00:00Z'),
  ('p2', 'i1', 'mention', '{"text":"Harbor Line","type":"supplier"}', '[{"entity":"e-hf","why":"similar"}]', NULL, NULL, NULL);
