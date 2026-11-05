-- The case in the combined shape. Sample names and floors only.
-- The January clash on the company number became a Triage item; Alex's March decision on
-- it is the merge. Morgan's split withdrew it and sorted the one fact said while merged.

INSERT INTO records VALUES
  ('r-ch-hf', 'Companies House lists Harbourline Freight Ltd as 04417721', '{"kind":"registry","ref":"CH 04417721"}', 'tree:dept-freight', '2026-01-09T10:00:00Z', 'alex', NULL, NULL, NULL),
  ('r-inv-2207', 'Invoice INV-2207 from Harbour Line Logistics quotes 04417721', '{"kind":"invoice","ref":"INV-2207"}', 'tree:dept-freight', '2026-01-14T11:00:00Z', 'alex', '2026-05-12T16:00:00Z', 'morgan', 'The invoice quoted the parent''s number, not its own'),
  ('r-list-kes', 'Supplier list row: Kestrel Packaging', '{"kind":"import","ref":"suppliers-jan.csv:3"}', 'tree:dept-freight', '2026-01-05T09:00:00Z', 'alex', NULL, NULL, NULL),
  ('r-list-mar', 'Supplier list row: Marlow Chemicals', '{"kind":"import","ref":"suppliers-jan.csv:4"}', 'tree:dept-freight', '2026-01-05T09:00:00Z', 'alex', NULL, NULL, NULL),
  ('r-list-ost', 'Supplier list row: Ostrava Pallets', '{"kind":"import","ref":"suppliers-jan.csv:5"}', 'tree:dept-freight', '2026-01-05T09:00:00Z', 'alex', NULL, NULL, NULL),
  ('r-list-pen', 'Supplier list row: Pennine Cold Store', '{"kind":"import","ref":"suppliers-jan.csv:6"}', 'tree:dept-freight', '2026-01-05T09:00:00Z', 'alex', NULL, NULL, NULL),
  ('r-list-qua', 'Supplier list row: Quayside Cranes', '{"kind":"import","ref":"suppliers-jan.csv:7"}', 'tree:dept-freight', '2026-01-05T09:00:00Z', 'alex', NULL, NULL, NULL),
  ('r-list-red', 'Supplier list row: Redfern Tyres', '{"kind":"import","ref":"suppliers-jan.csv:8"}', 'tree:dept-freight', '2026-01-05T09:00:00Z', 'alex', NULL, NULL, NULL),
  ('r-list-sol', 'Supplier list row: Solent Marine Fuel', '{"kind":"import","ref":"suppliers-jan.csv:9"}', 'tree:dept-freight', '2026-01-05T09:00:00Z', 'alex', NULL, NULL, NULL),
  ('r-list-tid', 'Supplier list row: Tidewater Seals (a partnership, no company number)', '{"kind":"import","ref":"suppliers-jan.csv:10"}', 'tree:dept-freight', '2026-01-05T09:00:00Z', 'alex', NULL, NULL, NULL),
  ('r-dn-118', 'Delivery note DN-118 from Harbour Line Logistics gives Unit 3, Dock Road', '{"kind":"delivery note","ref":"DN-118"}', 'tree:dept-freight', '2026-04-02T08:00:00Z', 'alex', NULL, NULL, NULL),
  ('r-mail-0408', 'Email from "Harbor Line" about a late pallet', '{"kind":"email","ref":"mail 2026-04-08 #5521"}', 'tree:dept-freight', '2026-04-08T07:40:00Z', 'model:triage', NULL, NULL, NULL),
  ('r-ch-hll', 'Companies House lists Harbour Line Logistics Ltd as 09812345 with parent 04417721', '{"kind":"registry","ref":"CH 09812345"}', 'tree:dept-freight', '2026-05-12T15:30:00Z', 'morgan', NULL, NULL, NULL),
  ('r-sol-note', 'Solent says the 30 March email came from Solent Marine Services, another firm', '{"kind":"note","ref":"call 2026-06-10"}', 'tree:dept-freight', '2026-06-10T10:00:00Z', 'morgan', NULL, NULL, NULL),
  ('r-ch-pen', 'Companies House: Pennine Cold Store changed its name to Pennine Cold Chain', '{"kind":"registry","ref":"CH 05550104"}', 'tree:dept-freight', '2026-08-04T09:00:00Z', 'morgan', NULL, NULL, NULL);

INSERT INTO entities VALUES
  ('e-hf',  'supplier', 'Harbourline Freight Ltd',    '', 'tree:dept-freight', 'active', 'r-ch-hf',    'alex', '2026-01-09T10:00:00Z', 'alex', '2026-01-09T10:00:00Z'),
  ('e-hll', 'supplier', 'Harbour Line Logistics Ltd', '', 'tree:dept-freight', 'active', 'r-inv-2207', 'alex', '2026-01-14T11:00:00Z', 'morgan', '2026-05-12T16:00:00Z'),
  ('e-kes', 'supplier', 'Kestrel Packaging',  '', 'tree:dept-freight', 'active', 'r-list-kes', 'alex', '2026-01-05T09:00:00Z', 'alex', '2026-01-05T09:00:00Z'),
  ('e-mar', 'supplier', 'Marlow Chemicals',   '', 'tree:dept-freight', 'active', 'r-list-mar', 'alex', '2026-01-05T09:00:00Z', 'alex', '2026-01-05T09:00:00Z'),
  ('e-ost', 'supplier', 'Ostrava Pallets',    '', 'tree:dept-freight', 'active', 'r-list-ost', 'alex', '2026-01-05T09:00:00Z', 'alex', '2026-01-05T09:00:00Z'),
  ('e-pen', 'supplier', 'Pennine Cold Chain', '', 'tree:dept-freight', 'active', 'r-list-pen', 'alex', '2026-01-05T09:00:00Z', 'morgan', '2026-08-04T09:00:00Z'),
  ('e-qua', 'supplier', 'Quayside Cranes',    '', 'tree:dept-freight', 'active', 'r-list-qua', 'alex', '2026-01-05T09:00:00Z', 'alex', '2026-01-05T09:00:00Z'),
  ('e-red', 'supplier', 'Redfern Tyres',      '', 'tree:dept-freight', 'active', 'r-list-red', 'alex', '2026-01-05T09:00:00Z', 'alex', '2026-01-05T09:00:00Z'),
  ('e-sol', 'supplier', 'Solent Marine Fuel', '', 'tree:dept-freight', 'active', 'r-list-sol', 'alex', '2026-01-05T09:00:00Z', 'alex', '2026-01-05T09:00:00Z'),
  ('e-tid', 'supplier', 'Tidewater Seals',    '', 'tree:dept-freight', 'active', 'r-list-tid', 'alex', '2026-01-05T09:00:00Z', 'alex', '2026-01-05T09:00:00Z');

INSERT INTO names VALUES
  ('n-hf-1',  'e-hf',  'Harbourline Freight Ltd',    'accepted', '2026-01-09T10:00:00Z', NULL, 1, 'alex', NULL, 'r-ch-hf'),
  ('n-hll-1', 'e-hll', 'Harbour Line Logistics',     'accepted', '2026-01-14T11:00:00Z', '2026-05-12T16:00:00Z', 1, 'alex', 'morgan', 'r-inv-2207'),
  ('n-hll-2', 'e-hll', 'Harbour Line Logistics Ltd', 'accepted', '2026-05-12T16:00:00Z', NULL, 1, 'morgan', NULL, 'r-ch-hll'),
  ('n-hll-3', 'e-hll', 'Harbour Line Logistics',     'synonym',  '2026-05-12T16:00:00Z', NULL, 1, 'morgan', NULL, 'r-inv-2207'),
  ('n-kes-1', 'e-kes', 'Kestrel Packaging',  'accepted', '2026-01-05T09:00:00Z', NULL, 1, 'alex', NULL, 'r-list-kes'),
  ('n-mar-1', 'e-mar', 'Marlow Chemicals',   'accepted', '2026-01-05T09:00:00Z', NULL, 1, 'alex', NULL, 'r-list-mar'),
  ('n-ost-1', 'e-ost', 'Ostrava Pallets',    'accepted', '2026-01-05T09:00:00Z', NULL, 1, 'alex', NULL, 'r-list-ost'),
  ('n-pen-1', 'e-pen', 'Pennine Cold Store', 'accepted', '2026-01-05T09:00:00Z', '2026-08-04T09:00:00Z', 1, 'alex', 'morgan', 'r-list-pen'),
  ('n-pen-2', 'e-pen', 'Pennine Cold Chain', 'accepted', '2026-08-04T09:00:00Z', NULL, 1, 'morgan', NULL, 'r-ch-pen'),
  ('n-pen-3', 'e-pen', 'Pennine Cold Store', 'synonym',  '2026-08-04T09:00:00Z', NULL, 1, 'morgan', NULL, 'r-ch-pen'),
  ('n-qua-1', 'e-qua', 'Quayside Cranes',    'accepted', '2026-01-05T09:00:00Z', NULL, 1, 'alex', NULL, 'r-list-qua'),
  ('n-red-1', 'e-red', 'Redfern Tyres',      'accepted', '2026-01-05T09:00:00Z', NULL, 1, 'alex', NULL, 'r-list-red'),
  ('n-sol-1', 'e-sol', 'Solent Marine Fuel', 'accepted', '2026-01-05T09:00:00Z', NULL, 1, 'alex', NULL, 'r-list-sol'),
  ('n-tid-1', 'e-tid', 'Tidewater Seals',    'accepted', '2026-01-05T09:00:00Z', NULL, 1, 'alex', NULL, 'r-list-tid');

INSERT INTO entity_keys VALUES
  ('e-hf', 'supplier', 'company_number', '04417721'),
  ('e-hll', 'supplier', 'company_number', '09812345');

INSERT INTO merges VALUES
  ('m1', 'e-hll', 'e-hf', 'found the same', NULL, 'priority: earliest recorded name', 'tree:dept-freight', 'alex', '2026-03-10T14:00:00Z', 'p0', '2026-05-12T16:00:00Z');
INSERT INTO merge_cites VALUES ('m1', 'r-ch-hf', 'supports'), ('m1', 'r-inv-2207', 'supports');
INSERT INTO splits VALUES ('s1', 'm1', 'morgan', '2026-05-12T16:00:00Z', 'A subsidiary with its own number and contracts');
INSERT INTO split_cites VALUES ('s1', 'r-ch-hll', 'supports'), ('s1', 'r-inv-2207', 'contradicts');
INSERT INTO sortings VALUES ('s1', 'f24', 'e-hll', 'morgan', '2026-05-12T16:00:00Z', 'The delivery note is from the subsidiary', 'r-dn-118');

INSERT INTO observations VALUES
  ('o-dn-118', 'e-hf', 'site_address', 'Unit 3, Dock Road', 'tree:dept-freight', '{"kind":"document","ref":"DN-118"}', 'r-dn-118', 'alex', '2026-04-02T08:00:00Z', NULL, NULL),
  ('o-sol-0330', 'e-sol', 'contact', '2026-03-30', 'tree:dept-freight', '{"kind":"email"}', NULL, 'alex', '2026-03-30T12:00:00Z', '2026-06-10T10:00:00Z', 'The email came from Solent Marine Services, another firm');

INSERT INTO facts VALUES
  ('f01', 'e-hf',  'company_number', '04417721', NULL, NULL, NULL, 'tree:dept-freight', '["r-ch-hf"]', 'alex', '2026-01-09T10:00:00Z', NULL, NULL),
  ('f02', 'e-hll', 'company_number', '04417721', NULL, NULL, NULL, 'tree:dept-freight', '["r-inv-2207"]', 'alex', '2026-01-14T11:00:00Z', '2026-05-12T16:00:00Z', 'f20'),
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
  ('f20', 'e-hll', 'company_number', '09812345', NULL, NULL, NULL, 'tree:dept-freight', '["r-ch-hll"]', 'morgan', '2026-05-12T16:00:00Z', NULL, NULL),
  ('f21', 'e-hll', 'parent', NULL, 'e-hf', NULL, NULL, 'tree:dept-freight', '["r-ch-hll"]', 'morgan', '2026-05-12T16:00:00Z', NULL, NULL),
  ('f22', 'e-hll', 'delivery_site', 'Berth 7', NULL, NULL, NULL, 'tree:team-inbound', '[]', 'sam', '2026-05-20T10:00:00Z', NULL, NULL),
  ('f23', 'e-hll', 'contract', 'Dock 4 haulage', NULL, '2026-05-20', NULL, 'tree:team-contracts', '[]', 'jo', '2026-05-20T11:00:00Z', NULL, NULL),
  -- Said of the merged entity in April. One row; the sorting says it is the subsidiary's.
  ('f24', 'e-hf',  'site_address', 'Unit 3, Dock Road', NULL, NULL, NULL, 'tree:dept-freight', '["o-dn-118"]', 'alex', '2026-04-02T08:00:00Z', NULL, NULL),
  ('f26', 'e-mar', 'contact', '2026-07-09', NULL, '2026-07-09', NULL, 'tree:team-contracts', '[]', 'jo', '2026-07-09T12:00:00Z', NULL, NULL);

INSERT INTO proposals VALUES
  ('p0', 'tree:dept-freight', '{"kind":"document","ref":"INV-2207"}', '{"kind":"import","id":"key-clash"}', 'finished', 'alex', '2026-01-14T11:00:00Z'),
  ('p1', 'tree:dept-freight', '{"kind":"document","ref":"CH 04417721"}', '{"kind":"model","id":"model:triage"}', 'finished', 'model:triage', '2026-02-04T16:00:00Z'),
  ('p2', 'tree:dept-freight', '{"kind":"email","ref":"mail 2026-04-08 #5521"}', '{"kind":"model","id":"model:triage"}', 'open', 'model:triage', '2026-04-08T07:41:00Z');
INSERT INTO proposal_items VALUES
  ('p0', 'i1', 'mention', '{"text":"Harbour Line Logistics","type":"supplier","keys":{"company_number":"04417721"}}', '[{"entity":"e-hf","why":"key"}]', '{"as":"same","entity":"e-hf","merge":"m1"}', 'alex', '2026-03-10T14:00:00Z'),
  ('p1', 'i1', 'observation', '{"entity":"e-hf","property":"phone","value":"+44 1632 960118"}', '[]', '{"as":"accepted","fact":"f14"}', 'alex', '2026-02-05T09:00:00Z'),
  ('p2', 'i1', 'mention', '{"text":"Harbor Line","type":"supplier"}', '[{"entity":"e-hf","why":"similar"}]', NULL, NULL, NULL);

INSERT INTO questions VALUES
  ('sq1', 'Which suppliers have we not heard from since spring?', 'supplier', 'contact', '2026-03-01',
   '{"spring":{"means":"from 1 March","by":"priya"},"heard from":{"means":"a contact fact","by":"priya"}}', 'priya', 'tree:dept-freight');
INSERT INTO runs VALUES
  ('r1', 'sq1', 'priya', '2026-04-20', '2026-04-20T09:30:00Z', 7),
  ('r2', 'sq1', 'sam',   '2026-11-05', '2026-11-05T10:00:00Z', 8);
INSERT INTO run_floors VALUES
  ('r1', 'org'), ('r1', 'tree:dept-freight'),
  ('r2', 'org'), ('r2', 'tree:dept-freight'), ('r2', 'tree:team-inbound');
INSERT INTO quotes VALUES
  ('qt1', 'r1', '{"app":"artifacts","item":"briefing: supplier review, April"}', '7 suppliers silent since spring', '2026-04-22T08:00:00Z');
