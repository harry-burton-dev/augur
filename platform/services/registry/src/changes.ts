/**
 * Changelogs as Admin → Updates shows them: each change once, however many parts it moved, with how
 * big it is. They come from Changesets' CHANGELOG.md sections, which the Release workflow attaches to
 * each release (AUGUR's `changelogs`, an app's `notes`).
 */

export type ChangeKind = 'major' | 'minor' | 'patch';

/** One change, and the parts it moved. */
export interface Change {
  /** Changesets' short commit hash, when the line has one: the same change in two parts has the same id. */
  id?: string;
  kind: ChangeKind;
  text: string;
  parts: string[];
}

const HEADING = /^#{2,4}\s+(Major|Minor|Patch) Changes\s*$/i;
const ENTRY = /^- (?:([0-9a-f]{7,40}): )?(.*)$/;

/** The changes in one part's changelog section, without "Updated dependencies" lines. */
export const changesIn = (markdown: string, part: string): Change[] => {
  const out: Change[] = [];
  let kind: ChangeKind = 'patch';
  let current: Change | undefined;
  const close = () => {
    if (current && current.text && !/^Updated dependencies/.test(current.text)) out.push({ ...current, text: current.text.trim() });
    current = undefined;
  };
  for (const line of markdown.split('\n')) {
    const heading = HEADING.exec(line);
    if (heading) {
      close();
      kind = heading[1]!.toLowerCase() as ChangeKind;
      continue;
    }
    if (/^#/.test(line)) {
      close();
      continue;
    }
    const entry = ENTRY.exec(line);
    if (entry) {
      close();
      current = { ...(entry[1] ? { id: entry[1] } : {}), kind, text: entry[2]!, parts: [part] };
    } else if (current && /^\s+\S/.test(line) && !/^\s+- @/.test(line)) {
      current.text += `\n${line.trim()}`;
    } else if (current && line.trim() === '') {
      current.text += '\n';
    }
  }
  close();
  return out.map((c) => ({ ...c, text: c.text.replace(/\n{2,}/g, '\n\n').trim() }));
};

const RANK: Record<ChangeKind, number> = { major: 0, minor: 1, patch: 2 };

/** Every part's changes as one list: a change in several parts once, biggest kind first. */
export const mergeChanges = (lists: Change[][]): Change[] => {
  const byKey = new Map<string, Change>();
  for (const change of lists.flat()) {
    const key = change.id ?? change.text;
    const seen = byKey.get(key);
    if (!seen) byKey.set(key, { ...change, parts: [...change.parts] });
    else {
      for (const p of change.parts) if (!seen.parts.includes(p)) seen.parts.push(p);
      if (RANK[change.kind] < RANK[seen.kind]) seen.kind = change.kind;
    }
  }
  return [...byKey.values()].sort((a, b) => RANK[a.kind] - RANK[b.kind]);
};

/** An AUGUR release file's changes: from each changed part's changelog. */
export const releaseChanges = (changelogs: Record<string, string> | undefined): Change[] | undefined =>
  changelogs ? mergeChanges(Object.entries(changelogs).map(([part, text]) => changesIn(text, part))) : undefined;
