-- The case, in across time V3's shape (two clocks). Sample names and floors only.

INSERT INTO floors VALUES
  ('org', 'org', 'The org', NULL),
  ('tree:dept-freight', 'department', 'Freight', 'org'),
  ('tree:team-inbound', 'team', 'Inbound', 'tree:dept-freight'),
  ('tree:team-contracts', 'team', 'Contracts', 'tree:dept-freight');

INSERT INTO records VALUES
  ('r-ch-hf',   'Companies House lists Harbourline Freight Ltd as 04417721', 'registry', 'CH 04417721', 'tree:dept-freight', '2026-01-09T10:00:00Z', 'alex', NULL, NULL),
  ('r-inv-2207','Invoice INV-2207 from Harbour Line Logistics quotes 04417721', 'invoice', 'INV-2207', 'tree:dept-freight', '2026-01-14T11:00:00Z', 'alex', '2026-05-12T16:00:00Z', 'The invoice quoted the parent''s number, not its own'),
  ('r-list-kes','Supplier list row: Kestrel Packaging', 'import', 'suppliers-jan.csv:3', 'tree:dept-freight', '2026-01-05T09:00:00Z', 'alex', NULL, NULL),
  ('r-list-mar','Supplier list row: Marlow Chemicals', 'import', 'suppliers-jan.csv:4', 'tree:dept-freight', '2026-01-05T09:00:00Z', 'alex', NULL, NULL),
  ('r-list-ost','Supplier list row: Ostrava Pallets', 'import', 'suppliers-jan.csv:5', 'tree:dept-freight', '2026-01-05T09:00:00Z', 'alex', NULL, NULL),
  ('r-list-pen','Supplier list row: Pennine Cold Store', 'import', 'suppliers-jan.csv:6', 'tree:dept-freight', '2026-01-05T09:00:00Z', 'alex', NULL, NULL),
  ('r-list-qua','Supplier list row: Quayside Cranes', 'import', 'suppliers-jan.csv:7', 'tree:dept-freight', '2026-01-05T09:00:00Z', 'alex', NULL, NULL),
  ('r-list-red','Supplier list row: Redfern Tyres', 'import', 'suppliers-jan.csv:8', 'tree:dept-freight', '2026-01-05T09:00:00Z', 'alex', NULL, NULL),
  ('r-list-sol','Supplier list row: Solent Marine Fuel', 'import', 'suppliers-jan.csv:9', 'tree:dept-freight', '2026-01-05T09:00:00Z', 'alex', NULL, NULL),
  ('r-list-tid','Supplier list row: Tidewater Seals (a partnership, no company number)', 'import', 'suppliers-jan.csv:10', 'tree:dept-freight', '2026-01-05T09:00:00Z', 'alex', NULL, NULL),
  ('r-dn-118',  'Delivery note DN-118 from Harbour Line Logistics gives Unit 3, Dock Road', 'delivery note', 'DN-118', 'tree:dept-freight', '2026-04-02T08:00:00Z', 'alex', NULL, NULL),
  ('r-mail-0408','Email from "Harbor Line" about a late pallet', 'email', 'mail 2026-04-08 #5521', 'tree:dept-freight', '2026-04-08T07:40:00Z', 'model:triage', NULL, NULL),
  ('r-ch-hll',  'Companies House lists Harbour Line Logistics Ltd as 09812345 with parent 04417721', 'registry', 'CH 09812345', 'tree:dept-freight', '2026-05-12T15:30:00Z', 'morgan', NULL, NULL),
  ('r-sol-note','Solent says the 30 March email came from Solent Marine Services, another firm', 'note', 'call 2026-06-10', 'tree:dept-freight', '2026-06-10T10:00:00Z', 'morgan', NULL, NULL),
  ('r-ch-pen',  'Companies House: Pennine Cold Store changed its name to Pennine Cold Chain', 'registry', 'CH 05550104', 'tree:dept-freight', '2026-08-04T09:00:00Z', 'morgan', NULL, NULL);

INSERT INTO entities VALUES
  ('e-hf',  'supplier', 'r-ch-hf',    'tree:dept-freight', '2026-01-09T10:00:00Z', 'alex'),
  ('e-hll', 'supplier', 'r-inv-2207', 'tree:dept-freight', '2026-01-14T11:00:00Z', 'alex'),
  ('e-kes', 'supplier', 'r-list-kes', 'tree:dept-freight', '2026-01-05T09:00:00Z', 'alex'),
  ('e-mar', 'supplier', 'r-list-mar', 'tree:dept-freight', '2026-01-05T09:00:00Z', 'alex'),
  ('e-ost', 'supplier', 'r-list-ost', 'tree:dept-freight', '2026-01-05T09:00:00Z', 'alex'),
  ('e-pen', 'supplier', 'r-list-pen', 'tree:dept-freight', '2026-01-05T09:00:00Z', 'alex'),
  ('e-qua', 'supplier', 'r-list-qua', 'tree:dept-freight', '2026-01-05T09:00:00Z', 'alex'),
  ('e-red', 'supplier', 'r-list-red', 'tree:dept-freight', '2026-01-05T09:00:00Z', 'alex'),
  ('e-sol', 'supplier', 'r-list-sol', 'tree:dept-freight', '2026-01-05T09:00:00Z', 'alex'),
  ('e-tid', 'supplier', 'r-list-tid', 'tree:dept-freight', '2026-01-05T09:00:00Z', 'alex');

INSERT INTO names VALUES
  ('n-hf-1',  'e-hf',  'Harbourline Freight Ltd',    'accepted', NULL,   '2026-01-09T10:00:00Z', NULL, 'alex', NULL, 'r-ch-hf', NULL),
  ('n-hll-1', 'e-hll', 'Harbour Line Logistics',     'accepted', NULL,   '2026-01-14T11:00:00Z', '2026-03-10T14:00:00Z', 'alex', 'alex', 'r-inv-2207', NULL),
  ('n-hll-2', 'e-hll', 'Harbour Line Logistics',     'synonym',  'e-hf', '2026-03-10T14:00:00Z', '2026-05-12T16:00:00Z', 'alex', 'morgan', 'r-inv-2207', 'm1'),
  -- The split: the junior's own name comes back, corrected from the registry.
  ('n-hll-3', 'e-hll', 'Harbour Line Logistics Ltd', 'accepted', NULL,   '2026-05-12T16:00:00Z', NULL, 'morgan', NULL, 'r-ch-hll', NULL),
  ('n-hll-4', 'e-hll', 'Harbour Line Logistics',     'synonym',  NULL,   '2026-05-12T16:00:00Z', NULL, 'morgan', NULL, 'r-ch-hll', NULL),
  ('n-kes-1', 'e-kes', 'Kestrel Packaging',  'accepted', NULL, '2026-01-05T09:00:00Z', NULL, 'alex', NULL, 'r-list-kes', NULL),
  ('n-mar-1', 'e-mar', 'Marlow Chemicals',   'accepted', NULL, '2026-01-05T09:00:00Z', NULL, 'alex', NULL, 'r-list-mar', NULL),
  ('n-ost-1', 'e-ost', 'Ostrava Pallets',    'accepted', NULL, '2026-01-05T09:00:00Z', NULL, 'alex', NULL, 'r-list-ost', NULL),
  ('n-pen-1', 'e-pen', 'Pennine Cold Store', 'accepted', NULL, '2026-01-05T09:00:00Z', '2026-08-04T09:00:00Z', 'alex', 'morgan', 'r-list-pen', NULL),
  ('n-pen-2', 'e-pen', 'Pennine Cold Chain', 'accepted', NULL, '2026-08-04T09:00:00Z', NULL, 'morgan', NULL, 'r-ch-pen', NULL),
  ('n-pen-3', 'e-pen', 'Pennine Cold Store', 'synonym',  NULL, '2026-08-04T09:00:00Z', NULL, 'morgan', NULL, 'r-ch-pen', NULL),
  ('n-qua-1', 'e-qua', 'Quayside Cranes',    'accepted', NULL, '2026-01-05T09:00:00Z', NULL, 'alex', NULL, 'r-list-qua', NULL),
  ('n-red-1', 'e-red', 'Redfern Tyres',      'accepted', NULL, '2026-01-05T09:00:00Z', NULL, 'alex', NULL, 'r-list-red', NULL),
  ('n-sol-1', 'e-sol', 'Solent Marine Fuel', 'accepted', NULL, '2026-01-05T09:00:00Z', NULL, 'alex', NULL, 'r-list-sol', NULL),
  ('n-tid-1', 'e-tid', 'Tidewater Seals',    'accepted', NULL, '2026-01-05T09:00:00Z', NULL, 'alex', NULL, 'r-list-tid', NULL);

INSERT INTO facts VALUES
  ('f01', 'e-hf',  'company_number', '04417721', NULL, NULL, 'tree:dept-freight', 'r-ch-hf',    '2026-01-09T10:00:00Z', 'alex', NULL, NULL),
  ('f02', 'e-hll', 'company_number', '04417721', NULL, NULL, 'tree:dept-freight', 'r-inv-2207', '2026-01-14T11:00:00Z', 'alex', '2026-05-12T16:00:00Z', NULL),
  ('f03', 'e-hf',  'contact', '2026-02-02', NULL, '2026-02-02', 'tree:dept-freight', NULL, '2026-02-02T12:00:00Z', 'alex', NULL, NULL),
  ('f04', 'e-hll', 'contact', '2026-02-20', NULL, '2026-02-20', 'tree:dept-freight', NULL, '2026-02-20T12:00:00Z', 'alex', NULL, NULL),
  ('f05', 'e-kes', 'contact', '2026-01-20', NULL, '2026-01-20', 'tree:dept-freight', NULL, '2026-01-20T12:00:00Z', 'alex', NULL, NULL),
  ('f06', 'e-kes', 'contact', '2026-06-18', NULL, '2026-06-18', 'tree:dept-freight', NULL, '2026-06-18T12:00:00Z', 'morgan', NULL, NULL),
  ('f07', 'e-mar', 'contact', '2026-01-28', NULL, '2026-01-28', 'tree:dept-freight', NULL, '2026-01-28T12:00:00Z', 'alex', NULL, NULL),
  ('f08', 'e-ost', 'contact', '2026-01-12', NULL, '2026-01-12', 'tree:dept-freight', NULL, '2026-01-12T12:00:00Z', 'alex', NULL, NULL),
  ('f09', 'e-pen', 'contact', '2026-02-10', NULL, '2026-02-10', 'tree:dept-freight', NULL, '2026-02-10T12:00:00Z', 'alex', NULL, NULL),
  ('f10', 'e-qua', 'contact', '2026-01-05', NULL, '2026-01-05', 'tree:dept-freight', NULL, '2026-01-05T12:00:00Z', 'alex', NULL, NULL),
  ('f11', 'e-red', 'contact', '2026-03-22', NULL, '2026-03-22', 'tree:dept-freight', NULL, '2026-03-22T12:00:00Z', 'alex', NULL, NULL),
  ('f12', 'e-sol', 'contact', '2026-03-30', NULL, '2026-03-30', 'tree:dept-freight', NULL, '2026-03-30T12:00:00Z', 'alex', '2026-06-10T10:00:00Z', NULL),
  ('f13', 'e-tid', 'contact', '2026-01-30', NULL, '2026-01-30', 'tree:dept-freight', NULL, '2026-01-30T12:00:00Z', 'alex', NULL, NULL),
  ('f14', 'e-hf',  'phone', '+44 1632 960118', NULL, NULL, 'tree:dept-freight', NULL, '2026-02-05T09:00:00Z', 'alex', NULL, NULL),
  ('f20', 'e-hll', 'company_number', '09812345', NULL, NULL, 'tree:dept-freight', 'r-ch-hll', '2026-05-12T16:00:00Z', 'morgan', NULL, NULL),
  ('f21', 'e-hll', 'parent', NULL, 'e-hf', NULL, 'tree:dept-freight', 'r-ch-hll', '2026-05-12T16:00:00Z', 'morgan', NULL, NULL),
  ('f22', 'e-hll', 'delivery_site', 'Berth 7', NULL, NULL, 'tree:team-inbound', NULL, '2026-05-20T10:00:00Z', 'sam', NULL, NULL),
  ('f23', 'e-hll', 'contract', 'Dock 4 haulage', NULL, '2026-05-20', 'tree:team-contracts', NULL, '2026-05-20T11:00:00Z', 'jo', NULL, NULL),
  -- Said while merged, so said of the senior; sorted to the subsidiary at the split.
  ('f24', 'e-hf',  'site_address', 'Unit 3, Dock Road', NULL, NULL, 'tree:dept-freight', 'r-dn-118', '2026-04-02T08:00:00Z', 'alex', '2026-05-12T16:00:00Z', NULL),
  ('f25', 'e-hll', 'site_address', 'Unit 3, Dock Road', NULL, NULL, 'tree:dept-freight', 'r-dn-118', '2026-05-12T16:00:00Z', 'morgan', NULL, NULL),
  ('f26', 'e-mar', 'contact', '2026-07-09', NULL, '2026-07-09', 'tree:team-contracts', NULL, '2026-07-09T12:00:00Z', 'jo', NULL, NULL);

INSERT INTO proposals VALUES
  ('p1', 'model', 'model:triage', 'phone +44 1632 960118 for this supplier', NULL, 'e-hf', 'r-ch-hf', 'tree:dept-freight', '2026-02-04T16:00:00Z', 'accepted', 'alex', '2026-02-05T09:00:00Z', 'f14'),
  ('p2', 'model', 'model:triage', 'same supplier as this one', 'Harbor Line', 'e-hf', 'r-mail-0408', 'tree:dept-freight', '2026-04-08T07:41:00Z', 'open', NULL, NULL, NULL);

INSERT INTO questions VALUES
  ('sq1', 'Which suppliers have we not heard from since spring?', 'supplier', 'contact', '2026-03-01', 'priya');

INSERT INTO runs VALUES
  ('r1', 'sq1', 'priya', '2026-04-20', '2026-04-20T09:30:00Z', 7),
  ('r2', 'sq1', 'sam',   '2026-11-05', '2026-11-05T10:00:00Z', 8);

INSERT INTO run_floors VALUES
  ('r1', 'org'), ('r1', 'tree:dept-freight'),
  ('r2', 'org'), ('r2', 'tree:dept-freight'), ('r2', 'tree:team-inbound');

INSERT INTO quotes VALUES
  ('qt1', 'r1', 'Briefing: supplier review, April', '7 suppliers silent since spring', '2026-04-22T08:00:00Z');

INSERT INTO merges VALUES
  ('m1', 'e-hll', 'e-hf', 'found the same', NULL, 'priority: earliest recorded name wins', 'alex', '2026-03-10T14:00:00Z', '2026-05-12T16:00:00Z', 'morgan');
INSERT INTO merge_evidence VALUES ('m1', 'r-ch-hf'), ('m1', 'r-inv-2207');
INSERT INTO splits VALUES
  ('s1', 'm1', 'morgan', '2026-05-12T16:00:00Z', 'A subsidiary with its own number and contracts');
INSERT INTO split_evidence VALUES ('s1', 'r-ch-hll');
INSERT INTO sortings VALUES
  ('s1', 'f24', 'e-hll', 'f25', 'morgan', 'The delivery note is from the subsidiary');
