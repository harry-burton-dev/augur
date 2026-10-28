/**
 * The ontology: which kinds of thing Data Atlas keeps, and which details of
 * them say for certain which real thing an entity is.
 *
 * It starts from a profile of the Common Core Ontologies (CCO, BSD-3,
 * github.com/CommonCoreOntology/CommonCoreOntologies), a mid-level ontology on
 * the Basic Formal Ontology used across defence and intelligence. Each type
 * names the CCO class it stands for (`packTerm`), so loading the pack itself
 * later (AT7) maps onto these without renaming anything. Some carry a plainer
 * name on screen: CCO's Watercraft is shown as Vessel.
 */

/** What a detail holds. More kinds (quantities, places, links) come with facts. */
export type DetailKind = 'text' | 'number' | 'date';

export interface DetailDef {
  key: string;
  label: string;
  kind: DetailKind;
  /** Says which real thing it is: no two entities may share a value, whatever their floor. */
  identity: boolean;
  /** What a value must look like, as a regular expression over the whole value. */
  pattern?: string;
  /** How a person would recognise one, shown under the field. */
  hint?: string;
}

export interface TypeDef {
  key: string;
  label: string;
  plural: string;
  /** The kind it is a kind of. */
  parent?: string;
  /** Only a heading for the kinds below it: no entity is made of it directly. */
  abstract: boolean;
  /** A ui-kit icon name. */
  icon: string;
  /** The ontology pack it comes from, and the pack's own name for it. */
  pack: string;
  packTerm: string;
  details: DetailDef[];
}

export interface Ontology {
  version: number;
  types: TypeDef[];
}

const text = (key: string, label: string, more: Partial<DetailDef> = {}): DetailDef => ({ key, label, kind: 'text', identity: false, ...more });

/**
 * The starter profile, as migration 002 writes it. It's part of that
 * migration: change the ontology with a new migration, never by editing this.
 */
export const STARTER_TYPES: readonly TypeDef[] = [
  { key: 'agent', label: 'Agent', plural: 'Agents', abstract: true, icon: 'people', pack: 'cco', packTerm: 'Agent', details: [] },
  { key: 'person', label: 'Person', plural: 'People', parent: 'agent', abstract: false, icon: 'account', pack: 'cco', packTerm: 'Person', details: [] },
  {
    key: 'organization',
    label: 'Organisation',
    plural: 'Organisations',
    parent: 'agent',
    abstract: false,
    icon: 'org',
    pack: 'cco',
    packTerm: 'Organization',
    details: [text('registration', 'Registration number', { identity: true, hint: 'As the register that holds it writes it' })],
  },
  { key: 'artifact', label: 'Artifact', plural: 'Artifacts', abstract: true, icon: 'apps', pack: 'cco', packTerm: 'Artifact', details: [] },
  { key: 'vehicle', label: 'Vehicle', plural: 'Vehicles', parent: 'artifact', abstract: true, icon: 'vehicle', pack: 'cco', packTerm: 'Vehicle', details: [] },
  {
    key: 'vessel',
    label: 'Vessel',
    plural: 'Vessels',
    parent: 'vehicle',
    abstract: false,
    icon: 'vessel',
    pack: 'cco',
    packTerm: 'Watercraft',
    details: [
      text('imo', 'IMO number', { identity: true, pattern: '\\d{7}', hint: 'Seven digits, such as 9400117' }),
      text('mmsi', 'MMSI', { identity: true, pattern: '\\d{9}', hint: 'Nine digits' }),
      text('call-sign', 'Call sign', { pattern: '[A-Z0-9]{3,8}' }),
    ],
  },
  {
    key: 'aircraft',
    label: 'Aircraft',
    plural: 'Aircraft',
    parent: 'vehicle',
    abstract: false,
    icon: 'aircraft',
    pack: 'cco',
    packTerm: 'Aircraft',
    details: [
      text('registration', 'Registration', { identity: true, pattern: '[A-Z0-9-]{3,10}', hint: 'Its tail marks, such as G-ABCD' }),
      text('icao24', 'ICAO 24-bit address', { identity: true, pattern: '[0-9A-F]{6}', hint: 'Six hex digits' }),
    ],
  },
  {
    key: 'ground-vehicle',
    label: 'Ground vehicle',
    plural: 'Ground vehicles',
    parent: 'vehicle',
    abstract: false,
    icon: 'vehicle',
    pack: 'cco',
    packTerm: 'Ground Vehicle',
    details: [text('registration', 'Registration', { identity: true })],
  },
  { key: 'facility', label: 'Facility', plural: 'Facilities', abstract: false, icon: 'facility', pack: 'cco', packTerm: 'Facility', details: [] },
  {
    key: 'port',
    label: 'Port',
    plural: 'Ports',
    parent: 'facility',
    abstract: false,
    icon: 'port',
    pack: 'cco',
    packTerm: 'Port',
    details: [text('unlocode', 'UN/LOCODE', { identity: true, pattern: '[A-Z]{2}[A-Z2-9]{3}', hint: 'Five letters, such as GBSOU' })],
  },
  { key: 'place', label: 'Place', plural: 'Places', abstract: false, icon: 'place', pack: 'cco', packTerm: 'Geospatial Region', details: [] },
  { key: 'event', label: 'Event', plural: 'Events', abstract: false, icon: 'event', pack: 'cco', packTerm: 'Act', details: [] },
];

const literal = (value: string | undefined) => (value === undefined ? 'null' : `'${value.replaceAll("'", "''")}'`);

/** The starter profile as SQL, for migration 002. */
export const starterSql = () =>
  [
    "insert into atlas.ontology_versions (version, note) values (1, 'Starter profile of the Common Core Ontologies');",
    ...STARTER_TYPES.map(
      (t, sort) =>
        `insert into atlas.ontology_types (key, parent, label, plural, abstract, icon, pack, pack_term, sort) values (${literal(t.key)}, ${literal(t.parent)}, ${literal(t.label)}, ${literal(t.plural)}, ${t.abstract}, ${literal(t.icon)}, ${literal(t.pack)}, ${literal(t.packTerm)}, ${sort});`,
    ),
    ...STARTER_TYPES.flatMap((t) =>
      t.details.map(
        (d, sort) =>
          `insert into atlas.ontology_details (type, key, label, kind, identity, pattern, hint, sort) values (${literal(t.key)}, ${literal(d.key)}, ${literal(d.label)}, ${literal(d.kind)}, ${d.identity}, ${literal(d.pattern)}, ${literal(d.hint)}, ${sort});`,
      ),
    ),
  ].join('\n');

/** A type's details, its own after those of the kinds above it. */
export const detailsOf = (ontology: Ontology, type: string): DetailDef[] => {
  const byKey = new Map(ontology.types.map((t) => [t.key, t]));
  const chain: TypeDef[] = [];
  for (let t = byKey.get(type); t; t = t.parent ? byKey.get(t.parent) : undefined) chain.unshift(t);
  return chain.flatMap((t) => t.details);
};

/** Why a detail's value won't do, in words a person can act on; undefined when it will. */
export const checkDetail = (detail: DetailDef, value: string): string | undefined => {
  if (!value.trim()) return `${detail.label} can’t be blank.`;
  if (value.length > 200) return `${detail.label} is too long.`;
  if (detail.kind === 'number' && !Number.isFinite(Number(value))) return `${detail.label} must be a number.`;
  if (detail.kind === 'date' && Number.isNaN(Date.parse(value))) return `${detail.label} must be a date.`;
  if (detail.pattern && !new RegExp(`^(?:${detail.pattern})$`).test(value)) return detail.hint ? `${detail.label} doesn’t look right: ${detail.hint.toLowerCase()}.` : `${detail.label} doesn’t look right.`;
  return undefined;
};

/**
 * A value in the one form it's kept in, so "gbsou" and "GBSOU" are the same
 * port and "9 400 117" the same IMO number: a code (a detail with a pattern)
 * loses its spaces and, if it's lettered, goes to capitals.
 */
export const normaliseDetail = (detail: DetailDef, value: string) => {
  if (!detail.pattern) return value.trim().replace(/\s+/g, ' ');
  const bare = value.replace(/\s+/g, '');
  return /[A-Z]/.test(detail.pattern) ? bare.toUpperCase() : bare;
};
