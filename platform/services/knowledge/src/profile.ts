// The base profile's classes (migration 2), named once for the contract, so the client can type them. A
// deployment may adopt more classes, so a class at the seam is any IRI; these are the ones every one has.
// objects.test.ts checks this list is the ontology's base classes.
export const BASE_CLASSES = [
  'kg:Entity', 'kg:Agent', 'kg:Person', 'kg:Organization', 'kg:Artifact', 'kg:Vehicle', 'kg:Ship', 'kg:Equipment', 'kg:Facility', 'kg:Port', 'kg:Place',
  'kg:City', 'kg:InformationContentEntity', 'kg:Document', 'kg:Intent', 'kg:Event', 'kg:Act', 'kg:Meeting', 'kg:Arrival', 'kg:Departure', 'kg:Incident',
  'kg:Commissioning',
] as const;
