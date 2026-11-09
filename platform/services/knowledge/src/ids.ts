import { isValid, ulidToUUID, uuidToULID } from 'ulid';

/**
 * Entity ids on the seam (N2): `ent_` and a ULID. The store keys an entity by a uuid; the ULID is the same
 * 128 bits written in Crockford base32, so neither side keeps a second id. Ids of other objects stay the
 * store's uuids for now.
 */
export const ENTITY_PREFIX = 'ent_';
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** The seam's id for an entity the store keys by `uuid`. */
export const entityId = (uuid: string): string => ENTITY_PREFIX + uuidToULID(uuid);

/** The store's uuid for a seam id, or undefined when `id` isn't one. */
export const entityUuid = (id: string): string | undefined => {
  if (!id.startsWith(ENTITY_PREFIX)) return undefined;
  const ulid = id.slice(ENTITY_PREFIX.length).toUpperCase();
  return isValid(ulid) ? ulidToUUID(ulid).toLowerCase() : undefined;
};

/** Whether `id` is one of the store's uuids, the ids of sources, observations and beliefs. */
export const isUuid = (id: string) => UUID.test(id);
