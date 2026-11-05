-- The case in merge and split V4's shape. The merge is a 'same' conclusion citing two
-- records; the split is a 'distinct' conclusion that withdraws it, citing the registry for
-- and the invoice against, and the invoice is marked as wrong. The delivery note's address
-- stays one fact, typed on the parent; an 'about' conclusion says it is the subsidiary's.

INSERT INTO floors VALUES
  ('org', 'org', 'The org', NULL),
  ('tree:dept-freight', 'department', 'Freight', 'org'),
  ('tree:team-inbound', 'team', 'Inbound', 'tree:dept-freight'),
  ('tree:team-contracts', 'team', 'Contracts', 'tree:dept-freight');

INSERT INTO records VALUES
  ('r-ch-hf', 'Companies House lists Harbourline Freight Ltd as 04417721', 'tree:dept-freight', '2026-01-09T10:00:00Z', 'alex', NULL, NULL),
  ('r-inv-2207', 'Invoice INV-2207 from Harbour Line Logistics quotes 04417721', 'tree:dept-freight', '2026-01-14T11:00:00Z', 'alex', '2026-05-12T16:00:00Z', 'The invoice quoted the parent''s number, not its own'),
  ('r-list-kes', 'Supplier list row: Kestrel Packaging', 'tree:dept-freight', '2026-01-05T09:00:00Z', 'alex', NULL, NULL),
  ('r-list-mar', 'Supplier list row: Marlow Chemicals', 'tree:dept-freight', '2026-01-05T09:00:00Z', 'alex', NULL, NULL),
  ('r-list-ost', 'Supplier list row: Ostrava Pallets', 'tree:dept-freight', '2026-01-05T09:00:00Z', 'alex', NULL, NULL),
  ('r-list-pen', 'Supplier list row: Pennine Cold Store', 'tree:dept-freight', '2026-01-05T09:00:00Z', 'alex', NULL, NULL),
  ('r-list-qua', 'Supplier list row: Quayside Cranes', 'tree:dept-freight', '2026-01-05T09:00:00Z', 'alex', NULL, NULL),
  ('r-list-red', 'Supplier list row: Redfern Tyres', 'tree:dept-freight', '2026-01-05T09:00:00Z', 'alex', NULL, NULL),
  ('r-list-sol', 'Supplier list row: Solent Marine Fuel', 'tree:dept-freight', '2026-01-05T09:00:00Z', 'alex', NULL, NULL),
  ('r-list-tid', 'Supplier list row: Tidewater Seals (a partnership, no company number)', 'tree:dept-freight', '2026-01-05T09:00:00Z', 'alex', NULL, NULL),
  ('r-dn-118', 'Delivery note DN-118 from Harbour Line Logistics gives Unit 3, Dock Road', 'tree:dept-freight', '2026-04-02T08:00:00Z', 'alex', NULL, NULL),
  ('r-mail-0408', 'Email from "Harbor Line" about a late pallet', 'tree:dept-freight', '2026-04-08T07:40:00Z', 'model:triage', NULL, NULL),
  ('r-ch-hll', 'Companies House lists Harbour Line Logistics Ltd as 09812345 with parent 04417721', 'tree:dept-freight', '2026-05-12T15:30:00Z', 'morgan', NULL, NULL),
  ('r-sol-note', 'Solent says the 30 March email came from Solent Marine Services, another firm', 'tree:dept-freight', '2026-06-10T10:00:00Z', 'morgan', NULL, NULL),
  ('r-ch-pen', 'Companies House: Pennine Cold Store changed its name to Pennine Cold Chain', 'tree:dept-freight', '2026-08-04T09:00:00Z', 'morgan', NULL, NULL);

INSERT INTO entities VALUES
  ('e-hf',  'supplier', 'tree:dept-freight', '2026-01-09T10:00:00Z', 'alex'),
  ('e-hll', 'supplier', 'tree:dept-freight', '2026-01-14T11:00:00Z', 'alex'),
  ('e-kes', 'supplier', 'tree:dept-freight', '2026-01-05T09:00:00Z', 'alex'),
  ('e-mar', 'supplier', 'tree:dept-freight', '2026-01-05T09:00:00Z', 'alex'),
  ('e-ost', 'supplier', 'tree:dept-freight', '2026-01-05T09:00:00Z', 'alex'),
  ('e-pen', 'supplier', 'tree:dept-freight', '2026-01-05T09:00:00Z', 'alex'),
  ('e-qua', 'supplier', 'tree:dept-freight', '2026-01-05T09:00:00Z', 'alex'),
  ('e-red', 'supplier', 'tree:dept-freight', '2026-01-05T09:00:00Z', 'alex'),
  ('e-sol', 'supplier', 'tree:dept-freight', '2026-01-05T09:00:00Z', 'alex'),
  ('e-tid', 'supplier', 'tree:dept-freight', '2026-01-05T09:00:00Z', 'alex');

INSERT INTO labels VALUES
  ('e-hf',  'Harbourline Freight Ltd', '2026-01-09T10:00:00Z', NULL, 'alex'),
  ('e-hll', 'Harbour Line Logistics', '2026-01-14T11:00:00Z', '2026-05-12T16:00:00Z', 'alex'),
  ('e-hll', 'Harbour Line Logistics Ltd', '2026-05-12T16:00:00Z', NULL, 'morgan'),
  ('e-kes', 'Kestrel Packaging',  '2026-01-05T09:00:00Z', NULL, 'alex'),
  ('e-mar', 'Marlow Chemicals',   '2026-01-05T09:00:00Z', NULL, 'alex'),
  ('e-ost', 'Ostrava Pallets',    '2026-01-05T09:00:00Z', NULL, 'alex'),
  ('e-pen', 'Pennine Cold Store', '2026-01-05T09:00:00Z', '2026-08-04T09:00:00Z', 'alex'),
  ('e-pen', 'Pennine Cold Chain', '2026-08-04T09:00:00Z', NULL, 'morgan'),
  ('e-qua', 'Quayside Cranes',    '2026-01-05T09:00:00Z', NULL, 'alex'),
  ('e-red', 'Redfern Tyres',      '2026-01-05T09:00:00Z', NULL, 'alex'),
  ('e-sol', 'Solent Marine Fuel', '2026-01-05T09:00:00Z', NULL, 'alex'),
  ('e-tid', 'Tidewater Seals',    '2026-01-05T09:00:00Z', NULL, 'alex');

INSERT INTO facts VALUES
  ('f01', 'e-hf',  'company_number', '04417721', NULL, NULL, 'tree:dept-freight', '2026-01-09T10:00:00Z', 'alex', NULL),
  ('f02', 'e-hll', 'company_number', '04417721', NULL, NULL, 'tree:dept-freight', '2026-01-14T11:00:00Z', 'alex', '2026-05-12T16:00:00Z'),
  ('f03', 'e-hf',  'contact', '2026-02-02', NULL, '2026-02-02', 'tree:dept-freight', '2026-02-02T12:00:00Z', 'alex', NULL),
  ('f04', 'e-hll', 'contact', '2026-02-20', NULL, '2026-02-20', 'tree:dept-freight', '2026-02-20T12:00:00Z', 'alex', NULL),
  ('f05', 'e-kes', 'contact', '2026-01-20', NULL, '2026-01-20', 'tree:dept-freight', '2026-01-20T12:00:00Z', 'alex', NULL),
  ('f06', 'e-kes', 'contact', '2026-06-18', NULL, '2026-06-18', 'tree:dept-freight', '2026-06-18T12:00:00Z', 'morgan', NULL),
  ('f07', 'e-mar', 'contact', '2026-01-28', NULL, '2026-01-28', 'tree:dept-freight', '2026-01-28T12:00:00Z', 'alex', NULL),
  ('f08', 'e-ost', 'contact', '2026-01-12', NULL, '2026-01-12', 'tree:dept-freight', '2026-01-12T12:00:00Z', 'alex', NULL),
  ('f09', 'e-pen', 'contact', '2026-02-10', NULL, '2026-02-10', 'tree:dept-freight', '2026-02-10T12:00:00Z', 'alex', NULL),
  ('f10', 'e-qua', 'contact', '2026-01-05', NULL, '2026-01-05', 'tree:dept-freight', '2026-01-05T12:00:00Z', 'alex', NULL),
  ('f11', 'e-red', 'contact', '2026-03-22', NULL, '2026-03-22', 'tree:dept-freight', '2026-03-22T12:00:00Z', 'alex', NULL),
  ('f12', 'e-sol', 'contact', '2026-03-30', NULL, '2026-03-30', 'tree:dept-freight', '2026-03-30T12:00:00Z', 'alex', '2026-06-10T10:00:00Z'),
  ('f13', 'e-tid', 'contact', '2026-01-30', NULL, '2026-01-30', 'tree:dept-freight', '2026-01-30T12:00:00Z', 'alex', NULL),
  ('f14', 'e-hf',  'phone', '+44 1632 960118', NULL, NULL, 'tree:dept-freight', '2026-02-05T09:00:00Z', 'alex', NULL),
  ('f20', 'e-hll', 'company_number', '09812345', NULL, NULL, 'tree:dept-freight', '2026-05-12T16:00:00Z', 'morgan', NULL),
  ('f21', 'e-hll', 'parent', NULL, 'e-hf', NULL, 'tree:dept-freight', '2026-05-12T16:00:00Z', 'morgan', NULL),
  ('f22', 'e-hll', 'delivery_site', 'Berth 7', NULL, NULL, 'tree:team-inbound', '2026-05-20T10:00:00Z', 'sam', NULL),
  ('f23', 'e-hll', 'contract', 'Dock 4 haulage', NULL, '2026-05-20', 'tree:team-contracts', '2026-05-20T11:00:00Z', 'jo', NULL),
  ('f24', 'e-hf',  'site_address', 'Unit 3, Dock Road', NULL, NULL, 'tree:dept-freight', '2026-04-02T08:00:00Z', 'alex', NULL),
  ('f26', 'e-mar', 'contact', '2026-07-09', NULL, '2026-07-09', 'tree:team-contracts', '2026-07-09T12:00:00Z', 'jo', NULL);

INSERT INTO conclusions VALUES
  ('c1', 'same', 'e-hf', 'e-hll', NULL, 'alex', '2026-03-10T14:00:00Z', 'Same company number on both records; name by priority', NULL),
  ('c2', 'distinct', 'e-hf', 'e-hll', NULL, 'morgan', '2026-05-12T16:00:00Z', 'A subsidiary with its own number and contracts; the invoice quoted the parent''s number', 'c1'),
  ('c3', 'about', 'e-hll', NULL, 'f24', 'morgan', '2026-05-12T16:00:00Z', 'The delivery note is from the subsidiary', NULL);

INSERT INTO cites VALUES
  ('c1', 'r-ch-hf', 'supports'), ('c1', 'r-inv-2207', 'supports'),
  ('c2', 'r-ch-hll', 'supports'), ('c2', 'r-inv-2207', 'contradicts'),
  ('c3', 'r-dn-118', 'supports');

INSERT INTO hypotheses VALUES
  ('h1', 'model', 'model:triage', 'phone +44 1632 960118 for this supplier', NULL, 'e-hf', 'r-ch-hf', '2026-02-04T16:00:00Z', 'accepted', 'alex', '2026-02-05T09:00:00Z', 'f14'),
  ('h2', 'model', 'model:triage', 'same supplier as this one', 'Harbor Line', 'e-hf', 'r-mail-0408', '2026-04-08T07:41:00Z', 'open', NULL, NULL, NULL);

INSERT INTO questions VALUES ('sq1', 'Which suppliers have we not heard from since spring?', 'supplier', 'contact', '2026-03-01', 'priya');
INSERT INTO runs VALUES
  ('r1', 'sq1', 'priya', '2026-04-20', '2026-04-20T09:30:00Z', 7),
  ('r2', 'sq1', 'sam',   '2026-11-05', '2026-11-05T10:00:00Z', 8);
INSERT INTO run_floors VALUES
  ('r1', 'org'), ('r1', 'tree:dept-freight'),
  ('r2', 'org'), ('r2', 'tree:dept-freight'), ('r2', 'tree:team-inbound');
