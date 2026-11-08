/** The types of `validate.mjs`, for the registry and other TypeScript callers. */

export const MANIFEST_3_SCHEMA_ID: 'urn:augur:app-manifest:3';
export const SCORE_PART_SCHEMA_ID: 'urn:augur:score-part:1';
export const APP_RELEASE_2_SCHEMA_ID: 'urn:augur:app-release:2';
export const CONTRACT_MAJOR: 3;

/** A JSON Schema document as published. */
export type JsonSchema = Record<string, unknown>;
export const schemas: Record<string, JsonSchema>;
export const scoreSchema: JsonSchema;

/** One reason a document was refused: `<instance path> <what the schema wanted>`. */
export type Problem = string;
/** Returns the problems with a document; none for a valid one. */
export type Check = (doc: unknown) => Problem[];

export interface ContractValidators {
  manifest: Check;
  /** AUGUR's part rules alone. */
  part: Check;
  /** Score's own workload schema alone. */
  scorePart: Check;
  release: Check;
}
export function contractValidators(): ContractValidators;

/** A contract-3 manifest, as far as the tools read it. Everything else is the schema's. */
export interface AppManifest3 {
  id: string;
  name: string;
  version: string;
  contract: number;
  floors?: ('personal' | 'team' | 'org')[];
  frontend?: { entry: string };
  api?: { openapi: string };
  scopes?: string[];
  maxUpload?: number;
  contributes?: {
    settings?: { id: string; label: string; type: 'string' | 'number' | 'boolean' | 'enum' | 'secret'; [key: string]: unknown }[];
    canvas?: boolean;
    [key: string]: unknown;
  };
  [key: string]: unknown;
}

/** A part's Score workload (score.dev/v1b1), as far as the tools read it. */
export interface ScorePart {
  apiVersion: string;
  metadata: { name: string; annotations?: Record<string, string> };
  service?: { ports?: Record<string, { port: number; targetPort?: number }> };
  containers: Record<string, ScoreContainer>;
  resources?: Record<string, { type: string; params?: Record<string, unknown> }>;
  [key: string]: unknown;
}
export interface ScoreContainer {
  image: string;
  command?: string[];
  args?: string[];
  variables?: Record<string, string>;
  files?: Record<string, unknown>;
  volumes?: Record<string, { source: string; [key: string]: unknown }>;
  resources: { limits: { memory: string; cpu: string }; requests?: { memory?: string; cpu?: string } };
  [key: string]: unknown;
}

export function parseWorkload(text: string): ScorePart;
export function partProblems(workload: unknown): Problem[];

export interface AppFiles {
  manifest: AppManifest3;
  /** By file, `score/<part>.score.yaml`. */
  parts: Record<string, ScorePart>;
}
export function validateApp(files: { manifest: unknown; parts: Record<string, unknown> }): { ok: boolean; problems: Problem[] };
export function readApp(
  root: string,
  fs: { readdirSync(dir: string): string[]; existsSync(path: string): boolean; join(...parts: string[]): string },
): AppFiles;
