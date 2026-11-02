import { PutObjectCommand, S3Client } from '@aws-sdk/client-s3';
import { bucketKeyIdFor, type FrontendFile } from '@augur/service-kit';
import type { AppEntry } from './manifest.ts';
import type { StoredFrontend } from './store.ts';

/** Where apps' frontends are written: the frontends bucket, which the front door serves at /apps/<app>/<version>/. */
export interface FrontendFiles {
  /** Writes every file of one build of a version's frontend under apps/<app>/<folder>/. */
  put(app: string, folder: string, files: FrontendFile[]): Promise<void>;
}

/**
 * The folder one build of a version's frontend is kept in: the version and the start of the build's
 * digest, such as 0.5.0_3f2a9c1b7d4e. A new build of the same version (a dev build, or a pillar app
 * rebuilt with a newer kit) gets a folder of its own, so a browser that kept the old one for good
 * can't go on running it. Frontends kept before this have the version alone (`folder` unset).
 */
export const frontendFolder = (version: string, digest: string) => `${version}_${digest.replace(/^sha256:/, '').slice(0, 12)}`;

/** The folder a kept frontend is in. */
export const folderOf = (frontend: Pick<StoredFrontend, 'version' | 'folder'>) => frontend.folder ?? frontend.version;

/** The bucket's key prefix and the address the front door serves it at are the same: apps/<app>/<folder>/. */
export const frontendBase = (app: string, folder: string) => `/apps/${app}/${folder}/`;

const TYPES: Record<string, string> = {
  js: 'text/javascript; charset=utf-8',
  mjs: 'text/javascript; charset=utf-8',
  css: 'text/css; charset=utf-8',
  json: 'application/json',
  map: 'application/json',
  html: 'text/html; charset=utf-8',
  svg: 'image/svg+xml',
  png: 'image/png',
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  gif: 'image/gif',
  webp: 'image/webp',
  avif: 'image/avif',
  ico: 'image/x-icon',
  woff: 'font/woff',
  woff2: 'font/woff2',
  ttf: 'font/ttf',
  txt: 'text/plain; charset=utf-8',
  wasm: 'application/wasm',
};

/** What a browser is told a file is; modules must say JavaScript or the browser won't run them. */
export const contentTypeOf = (path: string) => TYPES[path.slice(path.lastIndexOf('.') + 1).toLowerCase()] ?? 'application/octet-stream';

/** The frontends bucket in Garage, through S3's API, with the registry's own key. */
export const s3FrontendFiles = ({ endpoint, bucket, accessKeyId, secretAccessKey }: { endpoint: string; bucket: string; accessKeyId: string; secretAccessKey: string }): FrontendFiles => {
  const s3 = new S3Client({ endpoint, region: 'garage', forcePathStyle: true, credentials: { accessKeyId, secretAccessKey } });
  return {
    async put(app, folder, files) {
      const base = frontendBase(app, folder).slice(1);
      // A few at a time: a frontend is a handful of files, and Garage is one small node.
      for (let i = 0; i < files.length; i += 8) {
        await Promise.all(
          files.slice(i, i + 8).map((f) =>
            s3.send(
              new PutObjectCommand({
                Bucket: bucket,
                Key: `${base}${f.path}`,
                Body: f.data,
                ContentType: contentTypeOf(f.path),
                // A folder's files never change (a new build gets a new folder), so browsers keep them for good.
                CacheControl: 'public, max-age=31536000, immutable',
              }),
            ),
          ),
        );
      }
    },
  };
};

/** For tests: remembers what it was given. */
export class MemoryFrontendFiles implements FrontendFiles {
  readonly objects = new Map<string, Buffer>();
  async put(app: string, folder: string, files: FrontendFile[]) {
    for (const f of files) this.objects.set(`${frontendBase(app, folder).slice(1)}${f.path}`, f.data);
  }
}

/**
 * The manifest as the shell should get it: when this version's frontend is kept, its `entry` points
 * at that version's own copy (/apps/<id>/<folder>/entry.js), so serving an older version serves
 * its older code too. Otherwise, or for an entry elsewhere, the manifest as the app registered it.
 */
export const servedEntry = <T extends AppEntry>(entry: T, kept: StoredFrontend[]): T => {
  const base = `/apps/${entry.id}/`;
  if (!entry.entry.startsWith(base)) return entry;
  const file = entry.entry.slice(base.length);
  const frontend = kept.find((f) => f.app === entry.id && f.version === entry.version);
  if (!frontend?.files.includes(file)) return entry;
  return { ...entry, entry: `${frontendBase(entry.id, folderOf(frontend))}${file}` };
};

/** FRONTENDS_BUCKET_SECRET and where Garage is: the frontends bucket, or nothing when this deployment doesn't keep frontends. */
export const frontendFilesFromEnv = (env: Record<string, string | undefined> = process.env): FrontendFiles | undefined => {
  const secret = env.FRONTENDS_BUCKET_SECRET;
  if (!secret) return undefined;
  return s3FrontendFiles({ endpoint: env.FRONTENDS_S3_URL ?? 'http://garage:3900', bucket: env.FRONTENDS_BUCKET ?? 'augur-frontends', accessKeyId: bucketKeyIdFor(secret), secretAccessKey: secret });
};
