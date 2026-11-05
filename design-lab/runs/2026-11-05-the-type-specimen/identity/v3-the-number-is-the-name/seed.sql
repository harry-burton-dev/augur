-- The case in V3's shape. The March merge is Alex keying the invoice's number.
-- The May split is Morgan correcting it, and re-keying the delivery note said while merged.

INSERT INTO floors VALUES
  ('org', 'org', 'The org', NULL),
  ('tree:dept-freight', 'department', 'Freight', 'org'),
  ('tree:team-inbound', 'team', 'Inbound', 'tree:dept-freight'),
  ('tree:team-contracts', 'team', 'Contracts', 'tree:dept-freight');

INSERT INTO records VALUES
  ('r-ch-hf',    'Companies House lists Harbourline Freight Ltd as 04417721', 'Harbourline Freight Ltd', 'supplier', 1, 'tree:dept-freight', '2026-01-09T10:00:00Z', 'alex'),
  ('r-inv-2207', 'Invoice INV-2207 from Harbour Line Logistics quotes 04417721', 'Harbour Line Logistics', 'supplier', 0, 'tree:dept-freight', '2026-01-14T11:00:00Z', 'alex'),
  ('r-list-kes', 'Supplier list row: Kestrel Packaging', 'Kestrel Packaging', 'supplier', 0, 'tree:dept-freight', '2026-01-05T09:00:00Z', 'alex'),
  ('r-list-mar', 'Supplier list row: Marlow Chemicals', 'Marlow Chemicals', 'supplier', 0, 'tree:dept-freight', '2026-01-05T09:00:00Z', 'alex'),
  ('r-list-ost', 'Supplier list row: Ostrava Pallets', 'Ostrava Pallets', 'supplier', 0, 'tree:dept-freight', '2026-01-05T09:00:00Z', 'alex'),
  ('r-list-pen', 'Supplier list row: Pennine Cold Store', 'Pennine Cold Store', 'supplier', 0, 'tree:dept-freight', '2026-01-05T09:00:00Z', 'alex'),
  ('r-list-qua', 'Supplier list row: Quayside Cranes', 'Quayside Cranes', 'supplier', 0, 'tree:dept-freight', '2026-01-05T09:00:00Z', 'alex'),
  ('r-list-red', 'Supplier list row: Redfern Tyres', 'Redfern Tyres', 'supplier', 0, 'tree:dept-freight', '2026-01-05T09:00:00Z', 'alex'),
  ('r-list-sol', 'Supplier list row: Solent Marine Fuel', 'Solent Marine Fuel', 'supplier', 0, 'tree:dept-freight', '2026-01-05T09:00:00Z', 'alex'),
  ('r-list-tid', 'Supplier list row: Tidewater Seals (a partnership, no company number)', 'Tidewater Seals', 'supplier', 0, 'tree:dept-freight', '2026-01-05T09:00:00Z', 'alex'),
  ('r-dn-118',   'Delivery note DN-118 from Harbour Line Logistics gives Unit 3, Dock Road', NULL, NULL, 0, 'tree:dept-freight', '2026-04-02T08:00:00Z', 'alex'),
  ('r-mail-0408','Email from "Harbor Line" about a late pallet', 'Harbor Line', NULL, 0, 'tree:dept-freight', '2026-04-08T07:40:00Z', 'model:triage'),
  ('r-ch-hll',   'Companies House lists Harbour Line Logistics Ltd as 09812345 with parent 04417721', 'Harbour Line Logistics Ltd', 'supplier', 1, 'tree:dept-freight', '2026-05-12T15:30:00Z', 'morgan'),
  ('r-ch-pen',   'Companies House: Pennine Cold Store changed its name to Pennine Cold Chain', 'Pennine Cold Chain', 'supplier', 1, 'tree:dept-freight', '2026-08-04T09:00:00Z', 'morgan');

INSERT INTO record_keys VALUES
  ('r-ch-hf',    'gb-ch', '04417721', '2026-01-09T10:00:00Z', NULL, 'alex', NULL, 'r-ch-hf'),
  -- This row is the merge.
  ('r-inv-2207', 'gb-ch', '04417721', '2026-03-10T14:00:00Z', '2026-05-12T16:00:00Z', 'alex', 'morgan', 'r-inv-2207'),
  -- This row is the split.
  ('r-inv-2207', 'gb-ch', '09812345', '2026-05-12T16:00:00Z', NULL, 'morgan', NULL, 'r-ch-hll'),
  ('r-ch-hll',   'gb-ch', '09812345', '2026-05-12T15:30:00Z', NULL, 'morgan', NULL, 'r-ch-hll'),
  ('r-dn-118',   'gb-ch', '04417721', '2026-04-02T08:00:00Z', '2026-05-12T16:00:00Z', 'alex', 'morgan', 'r-dn-118'),
  ('r-dn-118',   'gb-ch', '09812345', '2026-05-12T16:00:00Z', NULL, 'morgan', NULL, 'r-ch-hll'),
  ('r-list-kes', 'gb-ch', '05550101', '2026-01-05T09:00:00Z', NULL, 'alex', NULL, 'r-list-kes'),
  ('r-list-mar', 'gb-ch', '05550102', '2026-01-05T09:00:00Z', NULL, 'alex', NULL, 'r-list-mar'),
  ('r-list-ost', 'gb-ch', '05550103', '2026-01-05T09:00:00Z', NULL, 'alex', NULL, 'r-list-ost'),
  ('r-list-pen', 'gb-ch', '05550104', '2026-01-05T09:00:00Z', NULL, 'alex', NULL, 'r-list-pen'),
  ('r-ch-pen',   'gb-ch', '05550104', '2026-08-04T09:00:00Z', NULL, 'morgan', NULL, 'r-ch-pen'),
  ('r-list-qua', 'gb-ch', '05550105', '2026-01-05T09:00:00Z', NULL, 'alex', NULL, 'r-list-qua'),
  ('r-list-red', 'gb-ch', '05550106', '2026-01-05T09:00:00Z', NULL, 'alex', NULL, 'r-list-red'),
  ('r-list-sol', 'gb-ch', '05550107', '2026-01-05T09:00:00Z', NULL, 'alex', NULL, 'r-list-sol');

INSERT INTO facts VALUES
  ('f03', 'r-ch-hf',    'contact', '2026-02-02', NULL, '2026-02-02', 'tree:dept-freight', '2026-02-02T12:00:00Z', 'alex', NULL),
  ('f04', 'r-inv-2207', 'contact', '2026-02-20', NULL, '2026-02-20', 'tree:dept-freight', '2026-02-20T12:00:00Z', 'alex', NULL),
  ('f05', 'r-list-kes', 'contact', '2026-01-20', NULL, '2026-01-20', 'tree:dept-freight', '2026-01-20T12:00:00Z', 'alex', NULL),
  ('f06', 'r-list-kes', 'contact', '2026-06-18', NULL, '2026-06-18', 'tree:dept-freight', '2026-06-18T12:00:00Z', 'morgan', NULL),
  ('f07', 'r-list-mar', 'contact', '2026-01-28', NULL, '2026-01-28', 'tree:dept-freight', '2026-01-28T12:00:00Z', 'alex', NULL),
  ('f08', 'r-list-ost', 'contact', '2026-01-12', NULL, '2026-01-12', 'tree:dept-freight', '2026-01-12T12:00:00Z', 'alex', NULL),
  ('f09', 'r-list-pen', 'contact', '2026-02-10', NULL, '2026-02-10', 'tree:dept-freight', '2026-02-10T12:00:00Z', 'alex', NULL),
  ('f10', 'r-list-qua', 'contact', '2026-01-05', NULL, '2026-01-05', 'tree:dept-freight', '2026-01-05T12:00:00Z', 'alex', NULL),
  ('f11', 'r-list-red', 'contact', '2026-03-22', NULL, '2026-03-22', 'tree:dept-freight', '2026-03-22T12:00:00Z', 'alex', NULL),
  ('f12', 'r-list-sol', 'contact', '2026-03-30', NULL, '2026-03-30', 'tree:dept-freight', '2026-03-30T12:00:00Z', 'alex', '2026-06-10T10:00:00Z'),
  ('f13', 'r-list-tid', 'contact', '2026-01-30', NULL, '2026-01-30', 'tree:dept-freight', '2026-01-30T12:00:00Z', 'alex', NULL),
  ('f14', 'r-ch-hf',    'phone', '+44 1632 960118', NULL, NULL, 'tree:dept-freight', '2026-02-05T09:00:00Z', 'alex', NULL),
  ('f21', 'r-ch-hll',   'parent', NULL, 'gb-ch:04417721', NULL, 'tree:dept-freight', '2026-05-12T16:00:00Z', 'morgan', NULL),
  ('f22', 'r-ch-hll',   'delivery_site', 'Berth 7', NULL, NULL, 'tree:team-inbound', '2026-05-20T10:00:00Z', 'sam', NULL),
  ('f23', 'r-ch-hll',   'contract', 'Dock 4 haulage', NULL, '2026-05-20', 'tree:team-contracts', '2026-05-20T11:00:00Z', 'jo', NULL),
  ('f24', 'r-dn-118',   'site_address', 'Unit 3, Dock Road', NULL, NULL, 'tree:dept-freight', '2026-04-02T08:00:00Z', 'alex', NULL),
  ('f26', 'r-list-mar', 'contact', '2026-07-09', NULL, '2026-07-09', 'tree:team-contracts', '2026-07-09T12:00:00Z', 'jo', NULL);

INSERT INTO proposals VALUES
  ('p1', 'model', 'model:triage', 'phone +44 1632 960118 for this supplier', 'r-ch-hf', NULL, NULL, '2026-02-04T16:00:00Z', 'accepted', 'alex', '2026-02-05T09:00:00Z'),
  ('p2', 'model', 'model:triage', 'same supplier: give this email the key gb-ch 04417721', 'r-mail-0408', 'gb-ch', '04417721', '2026-04-08T07:41:00Z', 'open', NULL, NULL);

INSERT INTO questions VALUES ('sq1', 'Which suppliers have we not heard from since spring?', 'supplier', 'contact', '2026-03-01', 'priya');
INSERT INTO runs VALUES
  ('r1', 'sq1', 'priya', '2026-04-20', '2026-04-20T09:30:00Z', 7),
  ('r2', 'sq1', 'sam',   '2026-11-05', '2026-11-05T10:00:00Z', 8);
INSERT INTO run_floors VALUES
  ('r1', 'org'), ('r1', 'tree:dept-freight'),
  ('r2', 'org'), ('r2', 'tree:dept-freight'), ('r2', 'tree:team-inbound');
