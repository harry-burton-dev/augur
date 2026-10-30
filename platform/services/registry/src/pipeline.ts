import { feedReader, FeedProblem, type ReadKey } from './updates.ts';

/**
 * The pipeline feed (scripts/pipeline.mjs, docs/release-channels.md "The pipeline feed"): where each unit
 * is between dev, preview and production. The Upgrade Centre shows this server's place on that line from
 * it. It only describes: what to install still comes from the release feed and the app feed.
 */
export interface Pipeline {
  schema: 'augur.pipeline/v1';
  generatedAt: string;
  repository: string;
  branches: { name: Branch; sha?: string; committedAt?: string }[];
  units: PipelineUnit[];
  changesets: { id: string; summary: string; units: string[] }[];
  steps: { from: Branch; to: Branch; merged: number; pulls: { number: number; title: string; mergedAt?: string }[] }[];
  pulls: {
    versionPackages?: PipelinePull;
    promoteToPreview?: PipelinePull;
    promoteToProduction: (PipelinePull & { unit: string; version: string })[];
  };
}

export type Branch = 'dev' | 'preview' | 'production';
export interface PipelinePull {
  number: number;
  title: string;
  url: string;
}
export interface PipelineUnit {
  id: string;
  name: string;
  versions: Record<Branch, string | null>;
  devBuild?: { version: string; released?: string };
  waiting: string[];
  previews: { pr: number; version: string }[];
}

/** The line as the Upgrade Centre shows it: the pipeline, with what this server runs of each unit. */
export interface LineView {
  feed: 'on' | 'off';
  checkedAt?: string;
  problem?: string;
  generatedAt?: string;
  repository?: string;
  units: (PipelineUnit & { running?: string })[];
  steps: Pipeline['steps'];
  pulls?: Pipeline['pulls'];
}

/** How long one read of the pipeline is used before it's read again. */
const FRESH_MS = 60_000;
/** How many merged pull requests each step shows. */
const PULLS_SHOWN = 10;

/**
 * Where the pipeline is, from the release feed's address: beside `feed:latest` on GitHub's container
 * registry, as `feed:pipeline`. A mirror or a file has none, so it's off; PIPELINE_FEED_URL says otherwise.
 */
export const pipelineUrlFor = (releaseFeedUrl: string) => {
  const m = /^(oci:\/\/.+\/feed):latest$/.exec(releaseFeedUrl);
  return m ? `${m[1]}:pipeline` : 'off';
};

const isPipeline = (x: unknown): x is Pipeline => typeof x === 'object' && x !== null && (x as Pipeline).schema === 'augur.pipeline/v1' && Array.isArray((x as Pipeline).units);

/** Reads the pipeline at most once a minute, and keeps the last one it read when a read fails. */
export class PipelineReader {
  private last?: { pipeline?: Pipeline; checkedAt: string; problem?: string; at: number };
  private inFlight?: Promise<void>;
  private readonly read?: (target: string, accept: string) => Promise<unknown>;
  private readonly now: () => number;

  constructor(
    private readonly url: string,
    { token, key, fetchImpl, now = () => Date.now() }: { token?: string; key?: ReadKey; fetchImpl?: typeof fetch; now?: () => number } = {},
  ) {
    this.now = now;
    if (url !== 'off') this.read = feedReader({ token, key, fetchImpl });
  }

  get on() {
    return this.read !== undefined;
  }

  /** The pipeline as last read, reading it again first when it's more than a minute old. */
  async current() {
    if (!this.read) return undefined;
    if (!this.last || this.now() - this.last.at > FRESH_MS) {
      this.inFlight ??= (async () => {
        const checkedAt = new Date(this.now()).toISOString();
        try {
          const body = await this.read!(this.url, 'application/json');
          if (!isPipeline(body)) throw new FeedProblem('The pipeline feed isn’t one this registry understands.');
          this.last = { pipeline: body, checkedAt, at: this.now() };
        } catch (err) {
          const problem = err instanceof FeedProblem ? err.message.replace('release feed', 'pipeline feed') : 'The pipeline feed couldn’t be read.';
          this.last = { pipeline: this.last?.pipeline, checkedAt, problem, at: this.now() };
        }
      })().finally(() => (this.inFlight = undefined));
      await this.inFlight;
    }
    return this.last;
  }
}

/** The line for this server: each unit of the pipeline, with the version this server runs of it. */
export const lineView = (read: Awaited<ReturnType<PipelineReader['current']>>, running: Record<string, string>): LineView => {
  if (!read) return { feed: 'off', units: [], steps: [] };
  const p = read.pipeline;
  return {
    feed: 'on',
    checkedAt: read.checkedAt,
    ...(read.problem ? { problem: read.problem } : {}),
    ...(p
      ? {
          generatedAt: p.generatedAt,
          repository: p.repository,
          units: p.units.map((u) => ({ ...u, ...(running[u.id] ? { running: running[u.id] } : {}) })),
          steps: p.steps.map((s) => ({ ...s, pulls: s.pulls.slice(0, PULLS_SHOWN) })),
          pulls: p.pulls,
        }
      : { units: [], steps: [] }),
  };
};
