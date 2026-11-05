-- The case, in merge and split V3's shape (the register). Sample names and floors only.

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

INSERT INTO register VALUES
  ('e-hf',  1, '2026-01-09T10:00:00Z', 'alex', 'name', 'Harbourline Freight Ltd', NULL, NULL, NULL, ''),
  ('e-hll', 1, '2026-01-14T11:00:00Z', 'alex', 'name', 'Harbour Line Logistics', NULL, NULL, NULL, ''),
  ('e-hll', 2, '2026-03-10T14:00:00Z', 'alex', 'placed under', NULL, 'e-hf', NULL, NULL, 'Same company number. Found the same; name by priority'),
  ('e-hll', 3, '2026-05-12T16:00:00Z', 'morgan', 'released', NULL, 'e-hf', NULL, 2, 'A subsidiary with its own number and contracts'),
  ('e-hll', 4, '2026-05-12T16:00:00Z', 'morgan', 'name', 'Harbour Line Logistics Ltd', NULL, NULL, 1, 'Registered name'),
  ('e-hll', 5, '2026-05-12T16:00:00Z', 'morgan', 'other name', 'Harbour Line Logistics', NULL, NULL, NULL, ''),
  ('e-hll', 6, '2026-05-12T16:00:00Z', 'morgan', 'fact sorted', NULL, 'e-hf', 'f25', NULL, 'f24 was said of the parent while merged'),
  ('e-kes', 1, '2026-01-05T09:00:00Z', 'alex', 'name', 'Kestrel Packaging', NULL, NULL, NULL, ''),
  ('e-mar', 1, '2026-01-05T09:00:00Z', 'alex', 'name', 'Marlow Chemicals', NULL, NULL, NULL, ''),
  ('e-ost', 1, '2026-01-05T09:00:00Z', 'alex', 'name', 'Ostrava Pallets', NULL, NULL, NULL, ''),
  ('e-pen', 1, '2026-01-05T09:00:00Z', 'alex', 'name', 'Pennine Cold Store', NULL, NULL, NULL, ''),
  ('e-pen', 2, '2026-08-04T09:00:00Z', 'morgan', 'name', 'Pennine Cold Chain', NULL, NULL, 1, 'Changed its name'),
  ('e-pen', 3, '2026-08-04T09:00:00Z', 'morgan', 'other name', 'Pennine Cold Store', NULL, NULL, NULL, ''),
  ('e-qua', 1, '2026-01-05T09:00:00Z', 'alex', 'name', 'Quayside Cranes', NULL, NULL, NULL, ''),
  ('e-red', 1, '2026-01-05T09:00:00Z', 'alex', 'name', 'Redfern Tyres', NULL, NULL, NULL, ''),
  ('e-sol', 1, '2026-01-05T09:00:00Z', 'alex', 'name', 'Solent Marine Fuel', NULL, NULL, NULL, ''),
  ('e-tid', 1, '2026-01-05T09:00:00Z', 'alex', 'name', 'Tidewater Seals', NULL, NULL, NULL, '');

INSERT INTO entry_evidence VALUES
  ('e-hf', 1, 'r-ch-hf'),
  ('e-hll', 1, 'r-inv-2207'),
  ('e-hll', 2, 'r-ch-hf'), ('e-hll', 2, 'r-inv-2207'),
  ('e-hll', 3, 'r-ch-hll'),
  ('e-hll', 4, 'r-ch-hll'),
  ('e-hll', 6, 'r-dn-118'),
  ('e-pen', 2, 'r-ch-pen');

INSERT INTO facts VALUES
  ('f01', 'e-hf',  'company_number', '04417721', NULL, NULL, 'tree:dept-freight', 'r-ch-hf',    '2026-01-09T10:00:00Z', 'alex', NULL),
  ('f02', 'e-hll', 'company_number', '04417721', NULL, NULL, 'tree:dept-freight', 'r-inv-2207', '2026-01-14T11:00:00Z', 'alex', '2026-05-12T16:00:00Z'),
  ('f03', 'e-hf',  'contact', '2026-02-02', NULL, '2026-02-02', 'tree:dept-freight', NULL, '2026-02-02T12:00:00Z', 'alex', NULL),
  ('f04', 'e-hll', 'contact', '2026-02-20', NULL, '2026-02-20', 'tree:dept-freight', NULL, '2026-02-20T12:00:00Z', 'alex', NULL),
  ('f05', 'e-kes', 'contact', '2026-01-20', NULL, '2026-01-20', 'tree:dept-freight', NULL, '2026-01-20T12:00:00Z', 'alex', NULL),
  ('f06', 'e-kes', 'contact', '2026-06-18', NULL, '2026-06-18', 'tree:dept-freight', NULL, '2026-06-18T12:00:00Z', 'morgan', NULL),
  ('f07', 'e-mar', 'contact', '2026-01-28', NULL, '2026-01-28', 'tree:dept-freight', NULL, '2026-01-28T12:00:00Z', 'alex', NULL),
  ('f08', 'e-ost', 'contact', '2026-01-12', NULL, '2026-01-12', 'tree:dept-freight', NULL, '2026-01-12T12:00:00Z', 'alex', NULL),
  ('f09', 'e-pen', 'contact', '2026-02-10', NULL, '2026-02-10', 'tree:dept-freight', NULL, '2026-02-10T12:00:00Z', 'alex', NULL),
  ('f10', 'e-qua', 'contact', '2026-01-05', NULL, '2026-01-05', 'tree:dept-freight', NULL, '2026-01-05T12:00:00Z', 'alex', NULL),
  ('f11', 'e-red', 'contact', '2026-03-22', NULL, '2026-03-22', 'tree:dept-freight', NULL, '2026-03-22T12:00:00Z', 'alex', NULL),
  ('f12', 'e-sol', 'contact', '2026-03-30', NULL, '2026-03-30', 'tree:dept-freight', NULL, '2026-03-30T12:00:00Z', 'alex', '2026-06-10T10:00:00Z'),
  ('f13', 'e-tid', 'contact', '2026-01-30', NULL, '2026-01-30', 'tree:dept-freight', NULL, '2026-01-30T12:00:00Z', 'alex', NULL),
  ('f14', 'e-hf',  'phone', '+44 1632 960118', NULL, NULL, 'tree:dept-freight', NULL, '2026-02-05T09:00:00Z', 'alex', NULL),
  ('f20', 'e-hll', 'company_number', '09812345', NULL, NULL, 'tree:dept-freight', 'r-ch-hll', '2026-05-12T16:00:00Z', 'morgan', NULL),
  ('f21', 'e-hll', 'parent', NULL, 'e-hf', NULL, 'tree:dept-freight', 'r-ch-hll', '2026-05-12T16:00:00Z', 'morgan', NULL),
  ('f22', 'e-hll', 'delivery_site', 'Berth 7', NULL, NULL, 'tree:team-inbound', NULL, '2026-05-20T10:00:00Z', 'sam', NULL),
  ('f23', 'e-hll', 'contract', 'Dock 4 haulage', NULL, '2026-05-20', 'tree:team-contracts', NULL, '2026-05-20T11:00:00Z', 'jo', NULL),
  -- Said while merged, so said of the senior; sorted to the subsidiary at the split.
  ('f24', 'e-hf',  'site_address', 'Unit 3, Dock Road', NULL, NULL, 'tree:dept-freight', 'r-dn-118', '2026-04-02T08:00:00Z', 'alex', '2026-05-12T16:00:00Z'),
  ('f25', 'e-hll', 'site_address', 'Unit 3, Dock Road', NULL, NULL, 'tree:dept-freight', 'r-dn-118', '2026-05-12T16:00:00Z', 'morgan', NULL),
  ('f26', 'e-mar', 'contact', '2026-07-09', NULL, '2026-07-09', 'tree:team-contracts', NULL, '2026-07-09T12:00:00Z', 'jo', NULL);

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
