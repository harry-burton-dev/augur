// The SHACL shapes the store is checked against (draft 4's shapes.ttl): served at GET /ontology/shapes and
// used by shacl.test.ts. A shape added here must hold for the store as SQL too (see that test).
export const SHAPES = String.raw`@prefix sh:   <http://www.w3.org/ns/shacl#> .
@prefix kg:   <urn:augur:kg:> .
@prefix rdfs: <http://www.w3.org/2000/01/rdf-schema#> .
@prefix xsd:  <http://www.w3.org/2001/XMLSchema#> .
@prefix prov: <http://www.w3.org/ns/prov#> .

# Draft 4 shapes: what the service checks on every action and on demand (the SHACL is the check, OWL is an export).
# The namespace is a placeholder; the service takes IRIs from the shipped base profile.

kg:ObservationShape a sh:NodeShape ; sh:targetClass kg:Observation ;
  sh:property [ sh:path kg:subject ; sh:minCount 1 ; sh:maxCount 1 ; sh:class kg:Entity ; sh:message "an observation has one subject entity" ] ;
  sh:property [ sh:path kg:predicate ; sh:minCount 1 ; sh:maxCount 1 ; sh:class kg:Predicate ; sh:message "the predicate is a declared one" ] ;
  sh:property [ sh:path kg:modality ; sh:minCount 1 ; sh:maxCount 1 ; sh:in ( "reported" "expected" "planned" "possible" "denied" ) ; sh:message "modality is one of reported, expected, planned, possible, denied" ] ;
  sh:property [ sh:path kg:validFrom ; sh:maxCount 1 ; sh:datatype xsd:dateTime ; sh:message "validFrom is a dateTime or absent, never an empty string" ] ;
  sh:property [ sh:path kg:validTo ; sh:maxCount 1 ; sh:datatype xsd:dateTime ] ;
  sh:property [ sh:path kg:validPrecision ; sh:minCount 1 ; sh:in ( "minute" "day" "month" "year" "unknown" ) ] ;
  sh:property [ sh:path kg:recordedAt ; sh:minCount 1 ; sh:datatype xsd:dateTime ] ;
  sh:property [ sh:path kg:floor ; sh:minCount 1 ; sh:maxCount 1 ] ;
  sh:property [ sh:path kg:extractor ; sh:minCount 1 ] ;
  sh:property [ sh:path kg:ontologyVersion ; sh:minCount 1 ; sh:datatype xsd:integer ] ;
  sh:property [ sh:path prov:wasDerivedFrom ; sh:minCount 1 ; sh:class kg:Source ; sh:message "an observation names its source" ] ;
  sh:property [ sh:path kg:quote ; sh:minCount 1 ; sh:datatype xsd:string ] ;
  sh:xone ( [ sh:property [ sh:path kg:object ; sh:minCount 1 ; sh:class kg:Entity ] ] [ sh:property [ sh:path kg:value ; sh:minCount 1 ] ] ) .

# A quantity keeps its unit apart from its number.
kg:QuantityObservationShape a sh:NodeShape ; sh:targetClass kg:Observation ;
  sh:sparql [ sh:message "a quantity has a numeric value and its unit in a separate field" ;
    sh:select """SELECT $this WHERE { $this kg:predicate ?p . ?p kg:datatype "quantity" . $this kg:value ?v . FILTER (datatype(?v) NOT IN (xsd:integer, xsd:decimal, xsd:double)) }""" ] .

# Domain and range of every declared predicate, checked from the predicate's own declaration.
kg:DomainShape a sh:NodeShape ; sh:targetClass kg:Observation ;
  sh:sparql [ sh:message "subject is outside the predicate's declared domain" ;
    sh:select """SELECT $this WHERE { $this kg:subject ?s ; kg:predicate ?p . ?p kg:domain ?d . ?s kg:class ?c . FILTER NOT EXISTS { ?c rdfs:subClassOf* ?d } }""" ] .
kg:RangeShape a sh:NodeShape ; sh:targetClass kg:Observation ;
  sh:sparql [ sh:message "object is outside the predicate's declared range" ;
    sh:select """SELECT $this WHERE { $this kg:object ?o ; kg:predicate ?p . ?p kg:range ?r . ?o kg:class ?c . FILTER NOT EXISTS { ?c rdfs:subClassOf* ?r } }""" ] .

# Entities: typed only by a base or accepted class; disjointness from the base.
kg:EntityShape a sh:NodeShape ; sh:targetClass kg:Entity ;
  sh:property [ sh:path kg:class ; sh:minCount 1 ; sh:maxCount 1 ] ;
  sh:sparql [ sh:message "entity typed with a class that is not base or accepted" ;
    sh:select """SELECT $this WHERE { $this a ?c . ?c kg:status ?st . FILTER (?st NOT IN ("base", "accepted")) }""" ] .
kg:PersonShape a sh:NodeShape ; sh:targetClass kg:Person ; sh:not [ sh:class kg:Organization ] ; sh:not [ sh:class kg:Artifact ] .
kg:OrganizationShape a sh:NodeShape ; sh:targetClass kg:Organization ; sh:not [ sh:class kg:Vehicle ] ; sh:not [ sh:class kg:Person ] .

# Beliefs: two clocks, modality, evidence, reach.
kg:BeliefShape a sh:NodeShape ; sh:targetClass kg:Belief ;
  sh:property [ sh:path kg:subject ; sh:minCount 1 ; sh:class kg:Entity ] ;
  sh:property [ sh:path kg:predicate ; sh:minCount 1 ; sh:class kg:Predicate ] ;
  sh:property [ sh:path kg:modality ; sh:minCount 1 ; sh:in ( "reported" "expected" "planned" "possible" "denied" ) ] ;
  sh:property [ sh:path kg:recordedAt ; sh:minCount 1 ; sh:datatype xsd:dateTime ] ;
  sh:property [ sh:path kg:validFrom ; sh:maxCount 1 ; sh:datatype xsd:dateTime ] ;
  sh:property [ sh:path kg:heldOn ; sh:minCount 1 ; sh:message "a belief is held on at least one floor (its home floor is in its reach)" ] ;
  sh:property [ sh:path kg:evidence ; sh:minCount 1 ; sh:class kg:Observation ; sh:message "a belief has evidence" ] .
# A single-valued predicate: a belief about an occurrent's time is single-valued per event.
kg:EventShape a sh:NodeShape ; sh:targetClass kg:Event ;
  sh:sparql [ sh:message "an event has at most one current reported time" ;
    sh:select """SELECT $this WHERE { ?b1 a kg:Belief ; kg:subject $this ; kg:predicate kg:occursOn ; kg:modality "reported" ; kg:current true . ?b2 a kg:Belief ; kg:subject $this ; kg:predicate kg:occursOn ; kg:modality "reported" ; kg:current true . FILTER (?b1 != ?b2) }""" ] .
`;
