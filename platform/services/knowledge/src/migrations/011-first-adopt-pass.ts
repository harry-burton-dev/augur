// Migration 11: the first adopt pass (plan PR 8; draft 4, section 5). Proved on the 26-report corpus, 32.7% of
// claims fell to kg:note because the base profile had no predicate for them. This adopts the frequent ones
// before the service meets real reports: statuses, reasons, defects, expected impacts and availability, with
// risks and descriptions, each with the names the corpus's extraction asked for it by. It is taken through
// adopt, as the knowledge service, so each is in the audit and the ontology's versions like any admin's.
// The names are only those the corpus asked by and that mean the predicate: the rest stay candidates, for a
// deployment's own admin to decide (ontology.test.ts measures what is left).
export const sql = String.raw`
select set_config('kg.person', 'the knowledge service', true), set_config('kg.ontology_admin', 'true', true);

-- Each predicate, with its label; then the names extraction asked for it by. Text, on any entity, many-valued.
select kg.act_adopt(t.term, 'predicate', t.iri, t.label, p_datatype => 'text')
from (values
  ('status', 'kg:status', 'status'),
  ('reason', 'kg:reason', 'reason'),
  ('defect', 'kg:defect', 'defect'),
  ('expectedImpact', 'kg:expectedImpact', 'expected impact'),
  ('availability', 'kg:availability', 'availability'),
  ('risk', 'kg:risk', 'risk'),
  ('description', 'kg:description', 'description')
) as t(term, iri, label);

select kg.act_adopt(t.term, 'predicate', t.iri, t.iri)
from (values
  ('orderStatus', 'kg:status'), ('inspectionStatus', 'kg:status'), ('arrivalStatus', 'kg:status'), ('cargoStatus', 'kg:status'),
  ('gatePassStatus', 'kg:status'), ('deliveryStatus', 'kg:status'), ('scheduleStatus', 'kg:status'), ('loadTestResult', 'kg:status'),
  ('dryDockReason', 'kg:reason'), ('delayCause', 'kg:reason'), ('holdReason', 'kg:reason'), ('performanceGapCause', 'kg:reason'), ('overrunCause', 'kg:reason'),
  ('fault', 'kg:defect'), ('breakdown', 'kg:defect'),
  ('closureRisk', 'kg:risk'),
  ('scope', 'kg:description')
) as t(term, iri);
`;
