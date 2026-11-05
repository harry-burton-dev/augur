import { createHash } from 'node:crypto';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative, sep } from 'node:path';
import { gunzipSync, gzipSync } from 'node:zlib';
import { serviceHeaders, ServiceCallError, type ServiceCredentials } from './service.js';
import { withDeadline } from './deadline.js';

/** A whole frontend goes up in one call, so it gets longer than a service call's few seconds. */
const PUBLISH_TIMEOUT_MS = 120_000;

/** One file of an app's built frontend, by its path inside `dist/` ("entry.js", "assets/x.js"). */
export interface FrontendFile {
  path: string;
  data: Buffer;
}

/** What the registry takes in one frontend: enough for any app, small enough to hold in memory. */
export const FRONTEND_LIMITS = { files: 2000, bytes: 50 * 1024 * 1024 } as const;

export class FrontendProblem extends Error {}

const BLOCK = 512;

/** A file's path is kept as it is served: forward slashes, no `.` or `..` parts, nothing hidden but `.well-known`. */
export const frontendPathProblem = (path: string): string | undefined => {
  if (!path || path.length > 400) return `"${path.slice(0, 60)}" is not a usable file path.`;
  if (path.startsWith('/') || path.includes('\\')) return `"${path}" must be relative, with forward slashes.`;
  const parts = path.split('/');
  if (parts.some((p) => !p || p === '.' || p === '..')) return `"${path}" has an empty, "." or ".." part.`;
  if (!/^[A-Za-z0-9._@~+-]+(\/[A-Za-z0-9._@~+-]+)*$/.test(path)) return `"${path}" has characters a web address can’t carry plainly.`;
  return undefined;
};

/** Every file under `dir`, sorted, so the same build always packs to the same bytes. */
export const readFrontend = (dir: string): FrontendFile[] => {
  const files: FrontendFile[] = [];
  const walk = (at: string) => {
    for (const name of readdirSync(at).sort()) {
      const full = join(at, name);
      const stat = statSync(full);
      if (stat.isDirectory()) walk(full);
      else if (stat.isFile()) files.push({ path: relative(dir, full).split(sep).join('/'), data: readFileSync(full) });
    }
  };
  walk(dir);
  return files;
};

const octal = (n: number, width: number) => n.toString(8).padStart(width - 1, '0') + '\0';

/** One ustar header. A path longer than 100 bytes is split at a slash into the 155-byte prefix. */
const header = (path: string, size: number): Buffer => {
  const h = Buffer.alloc(BLOCK);
  let name = path;
  let prefix = '';
  if (Buffer.byteLength(path) > 100) {
    const cut = path.lastIndexOf('/', path.length - 1);
    prefix = path.slice(0, cut);
    name = path.slice(cut + 1);
    if (cut < 0 || Buffer.byteLength(name) > 100 || Buffer.byteLength(prefix) > 155) throw new FrontendProblem(`"${path}" is too long to pack.`);
  }
  h.write(name, 0, 100, 'utf8');
  h.write(octal(0o644, 8), 100, 'ascii');
  h.write(octal(0, 8), 108, 'ascii');
  h.write(octal(0, 8), 116, 'ascii');
  h.write(octal(size, 12), 124, 'ascii');
  // A fixed time: packing the same files twice gives the same bytes, so the same digest.
  h.write(octal(0, 12), 136, 'ascii');
  h.write('        ', 148, 'ascii');
  h.write('0', 156, 'ascii');
  h.write('ustar\0', 257, 'ascii');
  h.write('00', 263, 'ascii');
  h.write(prefix, 345, 155, 'utf8');
  let sum = 0;
  for (const byte of h) sum += byte;
  h.write(octal(sum, 7) + ' ', 148, 'ascii');
  return h;
};

/** The files as one gzipped tarball, the form a frontend travels in to the registry and in an app's bundle. */
export const packFrontend = (files: FrontendFile[]): Buffer => {
  const parts: Buffer[] = [];
  for (const file of [...files].sort((a, b) => (a.path < b.path ? -1 : 1))) {
    const problem = frontendPathProblem(file.path);
    if (problem) throw new FrontendProblem(problem);
    parts.push(header(file.path, file.data.length), file.data, Buffer.alloc((BLOCK - (file.data.length % BLOCK)) % BLOCK));
  }
  parts.push(Buffer.alloc(BLOCK * 2));
  return gzipSync(Buffer.concat(parts), { level: 9 });
};

const field = (block: Buffer, start: number, length: number) => {
  const raw = block.subarray(start, start + length);
  const end = raw.indexOf(0);
  return raw.subarray(0, end < 0 ? length : end).toString('utf8');
};

/** A pax header's `path`, when it has one. */
const paxPath = (data: Buffer) => {
  for (const line of data.toString('utf8').split('\n')) {
    const match = /^\d+ path=(.*)$/.exec(line);
    if (match) return match[1];
  }
  return undefined;
};

/**
 * The files in a gzipped tarball, checked: regular files and directories only, every path
 * one a browser can ask for, within FRONTEND_LIMITS. Throws FrontendProblem saying what's wrong.
 */
export const unpackFrontend = (tarball: Buffer, limits: { files: number; bytes: number } = FRONTEND_LIMITS): FrontendFile[] => {
  let tar: Buffer;
  try {
    tar = gunzipSync(tarball, { maxOutputLength: limits.bytes + 1024 * 1024 });
  } catch (err) {
    throw new FrontendProblem(`The frontend isn’t a gzipped tarball within ${limits.bytes / 1024 / 1024} MB (${(err as Error).message}).`);
  }
  const files: FrontendFile[] = [];
  const seen = new Set<string>();
  let total = 0;
  let longName: string | undefined;
  for (let at = 0; at + BLOCK <= tar.length; ) {
    const block = tar.subarray(at, at + BLOCK);
    if (block.every((b) => b === 0)) break;
    const size = parseInt(field(block, 124, 12).trim() || '0', 8);
    if (size < 0) throw new FrontendProblem('The frontend’s tarball is damaged: an entry has a negative size.');
    const type = String.fromCharCode(block[156] || 48);
    const data = tar.subarray(at + BLOCK, at + BLOCK + size);
    if (Number.isNaN(size) || data.length < size) throw new FrontendProblem('The frontend’s tarball is cut short.');
    at += BLOCK + Math.ceil(size / BLOCK) * BLOCK;
    const prefix = field(block, 345, 155);
    const path = (longName ?? (prefix ? `${prefix}/${field(block, 0, 100)}` : field(block, 0, 100))).replace(/^\.\//, '');
    longName = undefined;
    if (type === 'x' || type === 'L') {
      longName = type === 'L' ? field(data, 0, data.length) : paxPath(data);
      continue;
    }
    if (type === 'g' || type === '5') continue;
    if (type !== '0') throw new FrontendProblem(`"${path}" isn’t a plain file; a frontend holds only files and folders.`);
    const problem = frontendPathProblem(path);
    if (problem) throw new FrontendProblem(problem);
    if (seen.has(path)) throw new FrontendProblem(`"${path}" is in the tarball twice.`);
    seen.add(path);
    total += size;
    if (files.length >= limits.files) throw new FrontendProblem(`A frontend holds at most ${limits.files} files.`);
    if (total > limits.bytes) throw new FrontendProblem(`A frontend holds at most ${limits.bytes / 1024 / 1024} MB.`);
    files.push({ path, data: Buffer.from(data) });
  }
  if (!files.length) throw new FrontendProblem('The frontend has no files.');
  return files;
};

/** The digest a frontend is known by: sha256 of its tarball, as `sha256:<hex>`. */
export const frontendDigest = (tarball: Buffer) => `sha256:${createHash('sha256').update(tarball).digest('hex')}`;

export interface PublishFrontendOptions {
  /** The registry's internal address, e.g. http://registry:8082. */
  registryUrl: string;
  credentials: ServiceCredentials;
  app: string;
  /** The release the frontend belongs to: the manifest's `version`. */
  version: string;
  /** The built frontend, usually the frontend package's `dist/`. */
  dir: string;
  attempts?: number;
  retryMs?: number;
  fetchImpl?: typeof fetch;
}

/**
 * Gives the registry this version's frontend, to keep and serve at /apps/<app>/<version>/.
 * Call it before registerApp, so the shell is never given a version whose code isn't there.
 * A version's frontend never changes: the same files again is fine, different ones are refused
 * (release a new version). Answers false when this deployment doesn't keep frontends by version,
 * and the app is then served from wherever its manifest's `entry` says.
 */
export async function publishFrontend({ registryUrl, credentials, app, version, dir, attempts = 6, retryMs = 500, fetchImpl = fetch }: PublishFrontendOptions): Promise<boolean> {
  const what = `give the registry ${app} ${version}'s frontend`;
  const tarball = packFrontend(readFrontend(dir));
  const url = `${registryUrl.replace(/\/$/, '')}/v1/apps/${encodeURIComponent(app)}/versions/${encodeURIComponent(version)}/frontend`;
  let lastError = '';
  for (let attempt = 1; attempt <= attempts; attempt++) {
    try {
      const res = await withDeadline(fetchImpl, PUBLISH_TIMEOUT_MS)(url, { method: 'PUT', headers: { 'content-type': 'application/gzip', ...(await serviceHeaders(credentials)) }, body: new Uint8Array(tarball) });
      const reply = (await res.json().catch(() => ({}))) as { message?: string; error?: string };
      if (res.ok) return true;
      if (res.status === 501) return false;
      lastError = `it answered ${res.status}${reply.message ? `: ${reply.message.replace(/\.$/, '')}` : ''}`;
      if (res.status < 500) break;
    } catch (err) {
      lastError = `it could not be reached (${(err as Error).message})`;
    }
    if (attempt < attempts) await new Promise((r) => setTimeout(r, retryMs * 2 ** (attempt - 1)));
  }
  throw new ServiceCallError(`Could not ${what}: ${lastError}.`);
}
