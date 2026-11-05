-- The case in across time V4's shape: one list of events, in the order they were recorded.

INSERT INTO floors VALUES
  ('org', 'org', 'The org', NULL),
  ('tree:dept-freight', 'department', 'Freight', 'org'),
  ('tree:team-inbound', 'team', 'Inbound', 'tree:dept-freight'),
  ('tree:team-contracts', 'team', 'Contracts', 'tree:dept-freight');

INSERT INTO records VALUES
  ('r-ch-hf', 'Companies House lists Harbourline Freight Ltd as 04417721', 'tree:dept-freight', '2026-01-09T10:00:00Z', 'alex'),
  ('r-inv-2207', 'Invoice INV-2207 from Harbour Line Logistics quotes 04417721', 'tree:dept-freight', '2026-01-14T11:00:00Z', 'alex'),
  ('r-list-kes', 'Supplier list row: Kestrel Packaging', 'tree:dept-freight', '2026-01-05T09:00:00Z', 'alex'),
  ('r-list-mar', 'Supplier list row: Marlow Chemicals', 'tree:dept-freight', '2026-01-05T09:00:00Z', 'alex'),
  ('r-list-ost', 'Supplier list row: Ostrava Pallets', 'tree:dept-freight', '2026-01-05T09:00:00Z', 'alex'),
  ('r-list-pen', 'Supplier list row: Pennine Cold Store', 'tree:dept-freight', '2026-01-05T09:00:00Z', 'alex'),
  ('r-list-qua', 'Supplier list row: Quayside Cranes', 'tree:dept-freight', '2026-01-05T09:00:00Z', 'alex'),
  ('r-list-red', 'Supplier list row: Redfern Tyres', 'tree:dept-freight', '2026-01-05T09:00:00Z', 'alex'),
  ('r-list-sol', 'Supplier list row: Solent Marine Fuel', 'tree:dept-freight', '2026-01-05T09:00:00Z', 'alex'),
  ('r-list-tid', 'Supplier list row: Tidewater Seals (a partnership, no company number)', 'tree:dept-freight', '2026-01-05T09:00:00Z', 'alex'),
  ('r-dn-118', 'Delivery note DN-118 from Harbour Line Logistics gives Unit 3, Dock Road', 'tree:dept-freight', '2026-04-02T08:00:00Z', 'alex'),
  ('r-mail-0408', 'Email from "Harbor Line" about a late pallet', 'tree:dept-freight', '2026-04-08T07:40:00Z', 'model:triage'),
  ('r-ch-hll', 'Companies House lists Harbour Line Logistics Ltd as 09812345 with parent 04417721', 'tree:dept-freight', '2026-05-12T15:30:00Z', 'morgan'),
  ('r-sol-note', 'Solent says the 30 March email came from Solent Marine Services, another firm', 'tree:dept-freight', '2026-06-10T10:00:00Z', 'morgan'),
  ('r-ch-pen', 'Companies House: Pennine Cold Store changed its name to Pennine Cold Chain', 'tree:dept-freight', '2026-08-04T09:00:00Z', 'morgan');

INSERT INTO events VALUES
  (1, '2026-01-05T09:00:00Z', 'alex', 'person', 'entity made', 'e-kes', NULL, NULL, NULL, 'supplier', NULL, 'tree:dept-freight', NULL, NULL, ''),
  (2, '2026-01-05T09:00:00Z', 'alex', 'person', 'entity made', 'e-mar', NULL, NULL, NULL, 'supplier', NULL, 'tree:dept-freight', NULL, NULL, ''),
  (3, '2026-01-05T09:00:00Z', 'alex', 'person', 'entity made', 'e-ost', NULL, NULL, NULL, 'supplier', NULL, 'tree:dept-freight', NULL, NULL, ''),
  (4, '2026-01-05T09:00:00Z', 'alex', 'person', 'entity made', 'e-pen', NULL, NULL, NULL, 'supplier', NULL, 'tree:dept-freight', NULL, NULL, ''),
  (5, '2026-01-05T09:00:00Z', 'alex', 'person', 'entity made', 'e-qua', NULL, NULL, NULL, 'supplier', NULL, 'tree:dept-freight', NULL, NULL, ''),
  (6, '2026-01-05T09:00:00Z', 'alex', 'person', 'entity made', 'e-red', NULL, NULL, NULL, 'supplier', NULL, 'tree:dept-freight', NULL, NULL, ''),
  (7, '2026-01-05T09:00:00Z', 'alex', 'person', 'entity made', 'e-sol', NULL, NULL, NULL, 'supplier', NULL, 'tree:dept-freight', NULL, NULL, ''),
  (8, '2026-01-05T09:00:00Z', 'alex', 'person', 'entity made', 'e-tid', NULL, NULL, NULL, 'supplier', NULL, 'tree:dept-freight', NULL, NULL, ''),
  (9, '2026-01-05T09:00:00Z', 'alex', 'person', 'named', 'e-kes', NULL, NULL, NULL, 'Kestrel Packaging', NULL, NULL, NULL, NULL, ''),
  (10, '2026-01-05T09:00:00Z', 'alex', 'person', 'named', 'e-mar', NULL, NULL, NULL, 'Marlow Chemicals', NULL, NULL, NULL, NULL, ''),
  (11, '2026-01-05T09:00:00Z', 'alex', 'person', 'named', 'e-ost', NULL, NULL, NULL, 'Ostrava Pallets', NULL, NULL, NULL, NULL, ''),
  (12, '2026-01-05T09:00:00Z', 'alex', 'person', 'named', 'e-pen', NULL, NULL, NULL, 'Pennine Cold Store', NULL, NULL, NULL, NULL, ''),
  (13, '2026-01-05T09:00:00Z', 'alex', 'person', 'named', 'e-qua', NULL, NULL, NULL, 'Quayside Cranes', NULL, NULL, NULL, NULL, ''),
  (14, '2026-01-05T09:00:00Z', 'alex', 'person', 'named', 'e-red', NULL, NULL, NULL, 'Redfern Tyres', NULL, NULL, NULL, NULL, ''),
  (15, '2026-01-05T09:00:00Z', 'alex', 'person', 'named', 'e-sol', NULL, NULL, NULL, 'Solent Marine Fuel', NULL, NULL, NULL, NULL, ''),
  (16, '2026-01-05T09:00:00Z', 'alex', 'person', 'named', 'e-tid', NULL, NULL, NULL, 'Tidewater Seals', NULL, NULL, NULL, NULL, ''),
  (17, '2026-01-05T12:00:00Z', 'alex', 'person', 'fact said', 'e-qua', NULL, 'f10', 'contact', '2026-01-05', '2026-01-05', 'tree:dept-freight', NULL, NULL, ''),
  (18, '2026-01-09T10:00:00Z', 'alex', 'person', 'entity made', 'e-hf', NULL, NULL, NULL, 'supplier', NULL, 'tree:dept-freight', NULL, NULL, ''),
  (19, '2026-01-09T10:00:00Z', 'alex', 'person', 'named', 'e-hf', NULL, NULL, NULL, 'Harbourline Freight Ltd', NULL, NULL, NULL, NULL, ''),
  (20, '2026-01-09T10:00:00Z', 'alex', 'person', 'fact said', 'e-hf', NULL, 'f01', 'company_number', '04417721', NULL, 'tree:dept-freight', NULL, NULL, ''),
  (21, '2026-01-12T12:00:00Z', 'alex', 'person', 'fact said', 'e-ost', NULL, 'f08', 'contact', '2026-01-12', '2026-01-12', 'tree:dept-freight', NULL, NULL, ''),
  (22, '2026-01-14T11:00:00Z', 'alex', 'person', 'entity made', 'e-hll', NULL, NULL, NULL, 'supplier', NULL, 'tree:dept-freight', NULL, NULL, ''),
  (23, '2026-01-14T11:00:00Z', 'alex', 'person', 'named', 'e-hll', NULL, NULL, NULL, 'Harbour Line Logistics', NULL, NULL, NULL, NULL, ''),
  (24, '2026-01-14T11:00:00Z', 'alex', 'person', 'fact said', 'e-hll', NULL, 'f02', 'company_number', '04417721', NULL, 'tree:dept-freight', NULL, NULL, ''),
  (25, '2026-01-20T12:00:00Z', 'alex', 'person', 'fact said', 'e-kes', NULL, 'f05', 'contact', '2026-01-20', '2026-01-20', 'tree:dept-freight', NULL, NULL, ''),
  (26, '2026-01-28T12:00:00Z', 'alex', 'person', 'fact said', 'e-mar', NULL, 'f07', 'contact', '2026-01-28', '2026-01-28', 'tree:dept-freight', NULL, NULL, ''),
  (27, '2026-01-30T12:00:00Z', 'alex', 'person', 'fact said', 'e-tid', NULL, 'f13', 'contact', '2026-01-30', '2026-01-30', 'tree:dept-freight', NULL, NULL, ''),
  (28, '2026-02-02T12:00:00Z', 'alex', 'person', 'fact said', 'e-hf', NULL, 'f03', 'contact', '2026-02-02', '2026-02-02', 'tree:dept-freight', NULL, NULL, ''),
  (29, '2026-02-04T16:00:00Z', 'model:triage', 'model', 'guess made', 'e-hf', NULL, NULL, 'phone', '+44 1632 960118', NULL, NULL, NULL, NULL, 'phone for this supplier'),
  (30, '2026-02-05T09:00:00Z', 'alex', 'person', 'guess accepted', 'e-hf', NULL, 'f14', NULL, NULL, NULL, NULL, NULL, 29, ''),
  (31, '2026-02-05T09:00:00Z', 'alex', 'person', 'fact said', 'e-hf', NULL, 'f14', 'phone', '+44 1632 960118', NULL, 'tree:dept-freight', NULL, 29, ''),
  (32, '2026-02-10T12:00:00Z', 'alex', 'person', 'fact said', 'e-pen', NULL, 'f09', 'contact', '2026-02-10', '2026-02-10', 'tree:dept-freight', NULL, NULL, ''),
  (33, '2026-02-20T12:00:00Z', 'alex', 'person', 'fact said', 'e-hll', NULL, 'f04', 'contact', '2026-02-20', '2026-02-20', 'tree:dept-freight', NULL, NULL, ''),
  (34, '2026-03-10T14:00:00Z', 'alex', 'person', 'merged', 'e-hll', 'e-hf', NULL, NULL, NULL, NULL, NULL, NULL, NULL, 'Found the same: same company number. Name by priority'),
  (35, '2026-03-22T12:00:00Z', 'alex', 'person', 'fact said', 'e-red', NULL, 'f11', 'contact', '2026-03-22', '2026-03-22', 'tree:dept-freight', NULL, NULL, ''),
  (36, '2026-03-30T12:00:00Z', 'alex', 'person', 'fact said', 'e-sol', NULL, 'f12', 'contact', '2026-03-30', '2026-03-30', 'tree:dept-freight', NULL, NULL, ''),
  (37, '2026-04-02T08:00:00Z', 'alex', 'person', 'fact said', 'e-hf', NULL, 'f24', 'site_address', 'Unit 3, Dock Road', NULL, 'tree:dept-freight', NULL, NULL, ''),
  (38, '2026-04-08T07:41:00Z', 'model:triage', 'model', 'guess made', 'e-hf', NULL, NULL, NULL, NULL, NULL, NULL, 'Harbor Line', NULL, 'same supplier as this one'),
  (39, '2026-05-12T16:00:00Z', 'morgan', 'person', 'split', 'e-hll', 'e-hf', NULL, NULL, NULL, NULL, NULL, NULL, 34, 'A subsidiary with its own number and contracts'),
  (40, '2026-05-12T16:00:00Z', 'morgan', 'person', 'named', 'e-hll', NULL, NULL, NULL, 'Harbour Line Logistics Ltd', NULL, NULL, NULL, NULL, ''),
  (41, '2026-05-12T16:00:00Z', 'morgan', 'person', 'other name', 'e-hll', NULL, NULL, NULL, 'Harbour Line Logistics', NULL, NULL, NULL, NULL, ''),
  (42, '2026-05-12T16:00:00Z', 'morgan', 'person', 'fact withdrawn', 'e-hll', NULL, 'f02', NULL, NULL, NULL, NULL, NULL, NULL, 'The invoice quoted the parents number'),
  (43, '2026-05-12T16:00:00Z', 'morgan', 'person', 'fact said', 'e-hll', NULL, 'f20', 'company_number', '09812345', NULL, 'tree:dept-freight', NULL, NULL, ''),
  (44, '2026-05-12T16:00:00Z', 'morgan', 'person', 'fact said', 'e-hll', 'e-hf', 'f21', 'parent', NULL, NULL, 'tree:dept-freight', NULL, NULL, ''),
  (45, '2026-05-12T16:00:00Z', 'morgan', 'person', 'fact sorted', 'e-hll', NULL, 'f24', NULL, NULL, NULL, NULL, NULL, NULL, 'Said of the parent while merged; the delivery note is the subsidiarys'),
  (46, '2026-05-20T10:00:00Z', 'sam', 'person', 'fact said', 'e-hll', NULL, 'f22', 'delivery_site', 'Berth 7', NULL, 'tree:team-inbound', NULL, NULL, ''),
  (47, '2026-05-20T11:00:00Z', 'jo', 'person', 'fact said', 'e-hll', NULL, 'f23', 'contract', 'Dock 4 haulage', '2026-05-20', 'tree:team-contracts', NULL, NULL, ''),
  (48, '2026-06-10T10:00:00Z', 'morgan', 'person', 'fact withdrawn', 'e-sol', NULL, 'f12', NULL, NULL, NULL, NULL, NULL, NULL, 'Another firms email'),
  (49, '2026-06-18T12:00:00Z', 'morgan', 'person', 'fact said', 'e-kes', NULL, 'f06', 'contact', '2026-06-18', '2026-06-18', 'tree:dept-freight', NULL, NULL, ''),
  (50, '2026-07-09T12:00:00Z', 'jo', 'person', 'fact said', 'e-mar', NULL, 'f26', 'contact', '2026-07-09', '2026-07-09', 'tree:team-contracts', NULL, NULL, ''),
  (51, '2026-08-04T09:00:00Z', 'morgan', 'person', 'named', 'e-pen', NULL, NULL, NULL, 'Pennine Cold Chain', NULL, NULL, NULL, NULL, ''),
  (52, '2026-08-04T09:00:00Z', 'morgan', 'person', 'other name', 'e-pen', NULL, NULL, NULL, 'Pennine Cold Store', NULL, NULL, NULL, NULL, '');

INSERT INTO event_evidence VALUES
  (1, 'r-list-kes'),
  (2, 'r-list-mar'),
  (3, 'r-list-ost'),
  (4, 'r-list-pen'),
  (5, 'r-list-qua'),
  (6, 'r-list-red'),
  (7, 'r-list-sol'),
  (8, 'r-list-tid'),
  (18, 'r-ch-hf'),
  (19, 'r-ch-hf'),
  (20, 'r-ch-hf'),
  (22, 'r-inv-2207'),
  (23, 'r-inv-2207'),
  (24, 'r-inv-2207'),
  (29, 'r-ch-hf'),
  (34, 'r-ch-hf'),
  (34, 'r-inv-2207'),
  (37, 'r-dn-118'),
  (38, 'r-mail-0408'),
  (39, 'r-ch-hll'),
  (40, 'r-ch-hll'),
  (42, 'r-ch-hll'),
  (43, 'r-ch-hll'),
  (44, 'r-ch-hll'),
  (45, 'r-dn-118'),
  (48, 'r-sol-note'),
  (51, 'r-ch-pen');

INSERT INTO questions VALUES
  ('sq1', 'Which suppliers have we not heard from since spring?', 'supplier', 'contact', '2026-03-01', 'priya');

INSERT INTO runs VALUES
  ('r1', 'sq1', 'priya', '2026-04-20', '2026-04-20T09:30:00Z', 7),
  ('r2', 'sq1', 'sam',   '2026-11-05', '2026-11-05T10:00:00Z', 8);

INSERT INTO run_floors VALUES
  ('r1', 'org'), ('r1', 'tree:dept-freight'),
  ('r2', 'org'), ('r2', 'tree:dept-freight'), ('r2', 'tree:team-inbound');

