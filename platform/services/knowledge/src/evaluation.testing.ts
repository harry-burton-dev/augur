// Extraction, measured (plan PR 5): a corpus of reports is retained one by one through the service, as a person
// would send them, with the model reading each text; then what the store kept is scored against labels written
// before any prompt saw the reports. The same run is recorded once against a real model and replayed in CI, so CI
// never calls a model and still proves the whole path, from reply to observation, on real text.
import { createHash } from 'node:crypto';
import pg from 'pg';
import { client, own, people } from './http.testing.ts';
import type { KnowledgeOptions } from './app.ts';
import { PROMPT_VERSION } from './extract.ts';

/** The corpora extraction is measured on, as fixtures: reports and their labels. */
export const CORPORA = [
  { name: 'draft4', reports: 'reports.json', gold: 'gold-draft4.json' },
  { name: 'heldout', reports: 'heldout/reports.json', gold: 'heldout/gold.json' },
] as const;
/** Where a corpus's recorded replies for the current prompt are kept. */
export const recordingPath = (name: string) => new URL(`./fixtures/recordings/${name}-${PROMPT_VERSION}.json`, import.meta.url);

export interface Report {
  id: string;
  title: string;
  floor: 'team' | 'personal';
  author: string;
  date: string;
  text: string;
}

/** One reply the model gave, kept so the run can be replayed: the fence it was asked with, and what it said. */
export interface Recorded {
  report: string;
  fence: string;
  content: string;
}
export interface Recording {
  promptVersion: string;
  model?: string;
  recordedAt: string;
  replies: Recorded[];
}

type Extract = NonNullable<KnowledgeOptions['extract']>;
type Messages = Parameters<Extract>[0];

const TEAM = 'team-a';
const fenceOf = (messages: Messages) => /with "fence" set to (\S+):/.exec(messages[0]!.content)?.[1] ?? '';
const reportOf = (messages: Messages) => /^Source title: (.*)$/m.exec(messages[1]!.content)?.[1] ?? '';

/** A model that answers from a recording: the reply given for that report, with the fence of this call. */
export const replaying = (recording: Recording, reports: Report[]): Extract => {
  const byTitle = new Map(reports.map((r) => [r.title, r.id]));
  const replies = new Map(recording.replies.map((r) => [r.report, r]));
  return async (messages) => {
    const id = byTitle.get(reportOf(messages));
    const r = id ? replies.get(id) : undefined;
    if (!r) throw new Error(`The recording has no reply for "${reportOf(messages)}".`);
    return r.content.split(r.fence).join(fenceOf(messages));
  };
};

/** Wraps a real model so every reply is kept, for a recording. */
export const recording = (extract: Extract, reports: Report[]) => {
  const byTitle = new Map(reports.map((r) => [r.title, r.id]));
  const replies: Recorded[] = [];
  const wrapped: Extract = async (messages, floor) => {
    const content = await extract(messages, floor);
    replies.push({ report: byTitle.get(reportOf(messages)) ?? reportOf(messages), fence: fenceOf(messages), content });
    return content;
  };
  return { extract: wrapped, replies };
};

export interface RunOutcome {
  report: string;
  status: number;
  reason?: string;
  flagged?: number;
  dropped?: number;
}

/**
 * Retains every report, in date order, as one person: team reports on a team floor, personal ones on their own.
 * The store must be empty first; `app` is the service's own login.
 */
export const runCorpus = async ({ app, reports, extract }: { app: pg.Pool; reports: Report[]; extract: Extract }): Promise<RunOutcome[]> => {
  const { standing } = people();
  const svc = await client({ store: app, standing, extract });
  const out: RunOutcome[] = [];
  for (const r of [...reports].sort((a, b) => a.date.localeCompare(b.date) || a.id.localeCompare(b.id))) {
    const res = await svc.act('alice', r.floor === 'personal' ? own.alice : TEAM, 'retain', {
      source: { app: 'evaluation', ref: r.id, version: '1', contentSha256: createHash('sha256').update(r.text).digest('hex'), title: r.title, writtenAt: `${r.date}T09:00:00Z` },
      text: r.text,
    });
    const body = res.json();
    out.push({ report: r.id, status: res.statusCode, ...(body.reason ? { reason: body.reason } : {}), ...(body.extraction ? { flagged: body.extraction.flagged, dropped: body.extraction.dropped.length } : {}) });
  }
  await svc.app.close();
  return out;
};

// ---------------------------------------------------------------------------------------------------------------
// The labels: the notation of draft 4's gold set (gold_build.py), so one set of rules scores both corpora.

export interface GoldEntity {
  id: string;
  classes: string[];
  aliases: string[];
  reports: string[];
  optional: boolean;
  sensitive: boolean;
}
export interface GoldClaim {
  id: string;
  report: string;
  kind: 'property' | 'link';
  subject: string[];
  pred: string[];
  value?: string;
  object?: string[];
  validAt: string[];
  modality: 'rep' | 'exp' | 'den' | 'rum';
  optional: boolean;
  sensitive: boolean;
}
export interface Gold {
  entities: GoldEntity[];
  claims: GoldClaim[];
  forbidden: { private_reports?: string[]; private_tokens?: string[]; injection_entities?: string[] };
}

interface Kept {
  id: string;
  report: string;
  floor: string;
  subject: string;
  predicate: string;
  value: { v: unknown; unit?: string; asked?: string } | null;
  object: string | null;
  modality: string;
  valid_from: string | null;
  valid_to: string | null;
  flagged: boolean;
  quote: string;
}

/** The modality labels' meaning in the store's words. */
const MODALITY: Record<GoldClaim['modality'], string[]> = { rep: ['reported'], exp: ['expected', 'planned'], den: ['denied'], rum: ['possible'] };
const norm = (s: string) => s.toLowerCase().replace(/^(the|mv|ms|fv|mt)\s+/g, '').replace(/[^a-z0-9]+/g, ' ').trim();

export interface Score {
  /** Core claims found: right entity and right core value, any predicate. */
  found: [number, number];
  /** Of the numbers found, those kept with their unit. */
  unit: [number, number];
  /** Of the claims found, those with the right modality. */
  modality: [number, number];
  /** Of the claims found that the labels date, those with the right valid time. */
  time: [number, number];
  /** Core entities the store resolved to one entity of their own. */
  entities: [number, number];
  /** Observations kept that match no claim (core or optional). Not an error by itself: the labels are not exhaustive. */
  unmatched: number;
  /** What must never happen: a private report's words on a team floor, an instruction believed. */
  leaks: string[];
  missed: string[];
}

const fraction = ([n, d]: [number, number]) => (d ? n / d : 1);
export const summary = (s: Score) => ({
  found: fraction(s.found),
  unit: fraction(s.unit),
  modality: fraction(s.modality),
  time: fraction(s.time),
  entities: fraction(s.entities),
});

/** Scores what the store kept against the labels. `admin` reads past row security. */
export const scoreStore = async (admin: pg.Pool, gold: Gold): Promise<Score> => {
  const { rows: names } = await admin.query<{ entity: string; name: string }>('select entity, name from kg.entity_names');
  const { rows: kept } = await admin.query<Kept>(
    `select o.id, s.ref as report, o.floor, o.subject, o.predicate, o.value, o.object, o.modality, o.flagged, o.quote,
            to_char(lower(o.valid) at time zone 'UTC', 'YYYY-MM-DD"T"HH24:MI') as valid_from,
            to_char(upper(o.valid) at time zone 'UTC', 'YYYY-MM-DD"T"HH24:MI') as valid_to
       from kg.observations o join kg.sources s on s.id = o.source where o.retracted_at is null`,
  );

  // Each store entity is the gold entity most of its names are aliases of.
  const aliasOf = new Map<string, string>();
  for (const e of gold.entities) for (const a of [...e.aliases, e.id.replace(/-/g, ' ')]) if (!aliasOf.has(norm(a))) aliasOf.set(norm(a), e.id);
  const votes = new Map<string, Map<string, number>>();
  for (const n of names) {
    const g = aliasOf.get(norm(n.name));
    if (!g) continue;
    const v = votes.get(n.entity) ?? new Map<string, number>();
    v.set(g, (v.get(g) ?? 0) + 1);
    votes.set(n.entity, v);
  }
  const goldOf = new Map([...votes].map(([entity, v]) => [entity, [...v].sort((a, b) => b[1] - a[1])[0]![0]]));
  const is = (entity: string | null, ids: string[] | undefined) => !!entity && !!ids?.includes(goldOf.get(entity) ?? '');

  const valueText = (o: Kept) => `${o.value ? String(o.value.v) : ''} ${o.value?.unit ?? ''} ${o.value?.asked ?? ''} ${o.predicate}`.toLowerCase();
  const coreValue = (g: GoldClaim, o: Kept) => {
    if (g.kind === 'link') return is(o.object, g.object) || (is(o.subject, g.object) && is(o.object, g.subject));
    const [k, ...rest] = g.value!.split(';')[0]!.split(':');
    const spec = rest.join(':');
    if (k === 'n') {
      const want = Number(spec.split(':')[0]!.replace(/,/g, ''));
      const got = typeof o.value?.v === 'number' ? o.value.v : Number(String(o.value?.v ?? '').replace(/,/g, '').match(/-?\d+(\.\d+)?/)?.[0]);
      return got === want;
    }
    if (k === 'd') return spec.split('|').some((d) => valueText(o).includes(d) || o.valid_from?.startsWith(d) || o.valid_to?.startsWith(d));
    return spec.split('|').some((t) => valueText(o).includes(t.toLowerCase()));
  };
  const unitKept = (g: GoldClaim, o: Kept) => {
    const unit = g.value!.split(';')[0]!.split(':')[2];
    if (!unit) return true;
    return unit.split('|').some((u) => `${o.value?.unit ?? ''} ${typeof o.value?.v === 'string' ? o.value.v : ''} ${o.predicate}`.toLowerCase().includes(u.toLowerCase()));
  };
  const timeRight = (g: GoldClaim, o: Kept) => g.validAt.some((d) => o.valid_from?.startsWith(d) || o.valid_to?.startsWith(d) || (o.value && String(o.value.v).startsWith(d)));

  const used = new Set<string>();
  const score: Score = { found: [0, 0], unit: [0, 0], modality: [0, 0], time: [0, 0], entities: [0, 0], unmatched: 0, leaks: [], missed: [] };
  // Core claims first, so an optional one never takes an observation a core one needs.
  for (const g of [...gold.claims].sort((a, b) => Number(a.optional) - Number(b.optional))) {
    const candidates = kept.filter((o) => !used.has(o.id) && o.report === g.report && !o.flagged && (is(o.subject, g.subject) || (g.kind === 'link' && is(o.object, g.subject))) && coreValue(g, o));
    const pred = (o: Kept) => g.pred.some((p) => valueText(o).includes(p.toLowerCase()));
    const o = candidates.find(pred) ?? candidates[0];
    if (!g.optional) score.found[1]++;
    if (!o) {
      if (!g.optional) score.missed.push(`${g.id} ${g.report} ${g.subject[0]} ${g.value ?? g.object?.join('|')}`);
      continue;
    }
    used.add(o.id);
    if (g.optional) continue;
    score.found[0]++;
    if (g.kind === 'property' && g.value!.startsWith('n:')) {
      score.unit[1]++;
      if (unitKept(g, o)) score.unit[0]++;
    }
    score.modality[1]++;
    if (MODALITY[g.modality].includes(o.modality)) score.modality[0]++;
    if (g.validAt.length) {
      score.time[1]++;
      if (timeRight(g, o)) score.time[0]++;
    }
  }
  score.unmatched = kept.filter((o) => !used.has(o.id) && !o.flagged && o.predicate !== 'kg:containsInstruction').length;

  // A core entity is resolved when, in the reports that name it, its observations sit on one store entity.
  for (const e of gold.entities.filter((x) => !x.optional)) {
    const ids = new Set([...goldOf].filter(([, g]) => g === e.id).map(([entity]) => entity));
    const onIt = kept.filter((o) => ids.has(o.subject) || (o.object && ids.has(o.object)));
    score.entities[1]++;
    const team = new Set(onIt.filter((o) => o.floor === TEAM).flatMap((o) => [o.subject, o.object].filter((x) => x && ids.has(x))));
    if (onIt.length && team.size <= 1) score.entities[0]++;
  }

  // What may never reach a team floor, and no instruction may be believed.
  const priv = new Set(gold.forbidden.private_reports ?? []);
  for (const o of kept.filter((x) => x.floor === TEAM)) {
    if (priv.has(o.report)) score.leaks.push(`observation from private ${o.report} on the team floor`);
    const text = `${o.quote} ${valueText(o)}`.toLowerCase();
    for (const t of gold.forbidden.private_tokens ?? []) if (!priv.has(o.report) && t.length > 3 && text.includes(t.toLowerCase()) && reportHasNoToken(gold, o.report, t)) score.leaks.push(`"${t}" on the team floor (${o.report})`);
  }
  const { rows: believed } = await admin.query<{ n: number }>(
    `select count(*)::int as n from kg.belief_evidence be join kg.observations o on o.id = be.observation where o.flagged and o.kept_at is null`,
  );
  if (believed[0]!.n) score.leaks.push(`${believed[0]!.n} flagged observations are evidence for a belief`);
  for (const bad of gold.forbidden.injection_entities ?? []) {
    const hit = names.find((n) => norm(n.name).includes(norm(bad)));
    if (hit && kept.some((o) => !o.flagged && (o.subject === hit.entity || o.object === hit.entity))) score.leaks.push(`"${bad}", which only an instruction names, has an unflagged observation`);
  }
  return score;
};

/** A token from a private report can also appear, innocently, in a team report's own text: only count it when it doesn't. */
const corpusText = new Map<string, string>();
export const useCorpusText = (reports: Report[]) => {
  corpusText.clear();
  for (const r of reports) corpusText.set(r.id, r.text.toLowerCase());
};
const reportHasNoToken = (_gold: Gold, report: string, token: string) => !(corpusText.get(report) ?? '').includes(token.toLowerCase());
