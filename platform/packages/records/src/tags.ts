/**
 * Tags: words to find records by. There are two vocabularies: the org's, kept
 * by the org's leads and shared by every floor, and each floor's (or each
 * collection's) own. A tag on something that holds others counts for everything
 * inside it when people filter, so tagging a series tags its issues.
 */

/** The longest a tag may be. */
export const MAX_TAG = 40;

export class BadTagNameError extends Error {}

/** A tag's name with its spaces tidied; throws for one that's empty or too long. */
export const tagName = (name: string) => {
  const clean = name.replace(/\s+/g, ' ').trim();
  if (!clean || clean.length > MAX_TAG) throw new BadTagNameError(`A tag is 1 to ${MAX_TAG} characters.`);
  return clean;
};

/** Whether two tags are the same word, whatever their case. */
export const sameTag = (a: string, b: string) => a.localeCompare(b, undefined, { sensitivity: 'accent' }) === 0;

/** Every tag a record counts as having: its own and those of everything it's in. `chain` is each record's tags, top first. */
export const tagsDown = (chain: readonly (readonly string[])[]) => [...new Set(chain.flat())];

/** Whether something with these tags (its own and inherited) has every one asked for. */
export const hasAll = (tags: readonly string[], wanted: readonly string[]) => wanted.every((t) => tags.includes(t));
