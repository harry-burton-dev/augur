-- The case in V4's shape. The merge is a sameAs link; the split withdraws it.
-- Withdrawing a link has no step for sorting what was said while merged, so the
-- delivery note's address stays on Harbourline Freight Ltd, where it was typed.

INSERT INTO floors VALUES
  ('org', 'org', 'The org', NULL),
  ('tree:dept-freight', 'department', 'Freight', 'org'),
  ('tree:team-inbound', 'team', 'Inbound', 'tree:dept-freight'),
  ('tree:team-contracts', 'team', 'Contracts', 'tree:dept-freight');

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
  ('e-tid', 'supplier', 'tree:dept-freight', '2026-01-05T09:00:00Z', 'alex'),
  -- The email's mention is a node of its own, waiting on a proposed link.
  ('e-mail-hl', 'supplier', 'tree:dept-freight', '2026-04-08T07:41:00Z', 'model:triage');

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
  ('e-tid', 'Tidewater Seals',    '2026-01-05T09:00:00Z', NULL, 'alex'),
  ('e-mail-hl', 'Harbor Line',    '2026-04-08T07:41:00Z', NULL, 'model:triage');

INSERT INTO same_as VALUES
  ('s1', 'e-hf', 'e-hll', 'withdrawn', 'alex', 'person', '2026-03-10T14:00:00Z', '2026-03-10T14:00:00Z', 'morgan', '2026-05-12T16:00:00Z',
   'Same company number 04417721', 'A subsidiary with its own contracts and number'),
  ('s2', 'e-hf', 'e-mail-hl', 'proposed', 'model:triage', 'model', '2026-04-08T07:41:00Z', NULL, NULL, NULL, 'Spelling close to Harbourline', NULL);

INSERT INTO facts VALUES
  ('f01', 'e-hf',  'company_number', '04417721', NULL, NULL, 'tree:dept-freight', '2026-01-09T10:00:00Z', 'alex', NULL, 0),
  ('f02', 'e-hll', 'company_number', '04417721', NULL, NULL, 'tree:dept-freight', '2026-01-14T11:00:00Z', 'alex', '2026-05-12T16:00:00Z', 0),
  ('f03', 'e-hf',  'contact', '2026-02-02', NULL, '2026-02-02', 'tree:dept-freight', '2026-02-02T12:00:00Z', 'alex', NULL, 0),
  ('f04', 'e-hll', 'contact', '2026-02-20', NULL, '2026-02-20', 'tree:dept-freight', '2026-02-20T12:00:00Z', 'alex', NULL, 0),
  ('f05', 'e-kes', 'contact', '2026-01-20', NULL, '2026-01-20', 'tree:dept-freight', '2026-01-20T12:00:00Z', 'alex', NULL, 0),
  ('f06', 'e-kes', 'contact', '2026-06-18', NULL, '2026-06-18', 'tree:dept-freight', '2026-06-18T12:00:00Z', 'morgan', NULL, 0),
  ('f07', 'e-mar', 'contact', '2026-01-28', NULL, '2026-01-28', 'tree:dept-freight', '2026-01-28T12:00:00Z', 'alex', NULL, 0),
  ('f08', 'e-ost', 'contact', '2026-01-12', NULL, '2026-01-12', 'tree:dept-freight', '2026-01-12T12:00:00Z', 'alex', NULL, 0),
  ('f09', 'e-pen', 'contact', '2026-02-10', NULL, '2026-02-10', 'tree:dept-freight', '2026-02-10T12:00:00Z', 'alex', NULL, 0),
  ('f10', 'e-qua', 'contact', '2026-01-05', NULL, '2026-01-05', 'tree:dept-freight', '2026-01-05T12:00:00Z', 'alex', NULL, 0),
  ('f11', 'e-red', 'contact', '2026-03-22', NULL, '2026-03-22', 'tree:dept-freight', '2026-03-22T12:00:00Z', 'alex', NULL, 0),
  ('f12', 'e-sol', 'contact', '2026-03-30', NULL, '2026-03-30', 'tree:dept-freight', '2026-03-30T12:00:00Z', 'alex', '2026-06-10T10:00:00Z', 0),
  ('f13', 'e-tid', 'contact', '2026-01-30', NULL, '2026-01-30', 'tree:dept-freight', '2026-01-30T12:00:00Z', 'alex', NULL, 0),
  ('f14', 'e-hf',  'phone', '+44 1632 960118', NULL, NULL, 'tree:dept-freight', '2026-02-05T09:00:00Z', 'alex', NULL, 1),
  ('f20', 'e-hll', 'company_number', '09812345', NULL, NULL, 'tree:dept-freight', '2026-05-12T16:00:00Z', 'morgan', NULL, 0),
  ('f21', 'e-hll', 'parent', NULL, 'e-hf', NULL, 'tree:dept-freight', '2026-05-12T16:00:00Z', 'morgan', NULL, 0),
  ('f22', 'e-hll', 'delivery_site', 'Berth 7', NULL, NULL, 'tree:team-inbound', '2026-05-20T10:00:00Z', 'sam', NULL, 0),
  ('f23', 'e-hll', 'contract', 'Dock 4 haulage', NULL, '2026-05-20', 'tree:team-contracts', '2026-05-20T11:00:00Z', 'jo', NULL, 0),
  ('f24', 'e-hf',  'site_address', 'Unit 3, Dock Road', NULL, NULL, 'tree:dept-freight', '2026-04-02T08:00:00Z', 'alex', NULL, 0),
  ('f26', 'e-mar', 'contact', '2026-07-09', NULL, '2026-07-09', 'tree:team-contracts', '2026-07-09T12:00:00Z', 'jo', NULL, 0);

INSERT INTO questions VALUES ('sq1', 'Which suppliers have we not heard from since spring?', 'supplier', 'contact', '2026-03-01', 'priya');
INSERT INTO runs VALUES
  ('r1', 'sq1', 'priya', '2026-04-20', '2026-04-20T09:30:00Z', 7),
  ('r2', 'sq1', 'sam',   '2026-11-05', '2026-11-05T10:00:00Z', 8);
INSERT INTO run_floors VALUES
  ('r1', 'org'), ('r1', 'tree:dept-freight'),
  ('r2', 'org'), ('r2', 'tree:dept-freight'), ('r2', 'tree:team-inbound');
