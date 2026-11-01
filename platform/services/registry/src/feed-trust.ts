/**
 * Whether the release feed can be trusted (ADR 0017). The publisher's feed, on GitHub's container
 * registry beside the images, is signed with cosign keyless by the Release feed workflow and expires:
 * the registry refuses one that isn't signed by that workflow, or that has expired, so whoever sits
 * between the publisher and a deployment can't hide a newer release or offer one that was withdrawn.
 * A mirror's feed is written by the organisation that runs the mirror, so it isn't the publisher's to
 * sign; each image it names is still checked by the updater before it runs. GitHub's releases read
 * directly (the older token) aren't signed at all, and the Upgrade Centre says so.
 */
import { execFile } from 'node:child_process';
import { existsSync } from 'node:fs';
import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

/** What the Upgrade Centre says about the feed it read. */
export interface FeedTrust {
  /** verified: signed by the publisher and in date; mirror: a mirror's own feed; unchecked: GitHub's releases, read directly. */
  state: 'verified' | 'mirror' | 'unchecked';
  /** When a verified feed stops being good, unless it is issued again. */
  expires?: string;
  /** Who signed it: the workflow, as cosign checked it. */
  signer?: string;
  /** What to know, when it isn't verified. */
  note?: string;
}

/** Checks `feed` (the exact bytes read) was signed by the publisher, with its cosign bundle. Throws, with why, when it wasn't. */
export type FeedSignatureCheck = (feed: string, bundle: string) => Promise<void>;

/** The feed was refused; the message says why and what to do. */
export class FeedTrustProblem extends Error {}

const GITHUB_ISSUER = 'https://token.actions.githubusercontent.com';
const escape = (text: string) => text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

/**
 * Who signs the feed: the Release feed workflow (.github/workflows/feed.yml) of `repo` on main or a
 * hotfix's release branch, as a pattern for cosign's --certificate-identity-regexp.
 */
export const feedSigner = (repo: string) => `^${escape(`https://github.com/${repo}/.github/workflows/feed.yml`)}@refs/heads/(main|release/[a-z][a-z0-9-]*-[0-9]+\\.[0-9]+)$`;

/** The repository a feed address belongs to, `oci://ghcr.io/<owner>/<repo>/feed:<tag>`, when it is one on GitHub. */
export const repoOfFeed = (target: string) => /^oci:\/\/ghcr\.io\/([^/]+\/[^/]+)\/feed:[^/]+$/i.exec(target)?.[1];

/**
 * Checks a feed with the cosign CLI (`cosign verify-blob --bundle`), offline when the deployment has
 * Sigstore's trust root (the mirror script writes it into releases/; docs/mirror.md).
 */
export const cosignFeedCheck =
  ({ identity, issuer = GITHUB_ISSUER, trustedRoot }: { identity: string; issuer?: string; trustedRoot?: string }): FeedSignatureCheck =>
  async (feed, bundle) => {
    const dir = await mkdtemp(join(tmpdir(), 'augur-feed-'));
    try {
      await writeFile(join(dir, 'feed.json'), feed);
      await writeFile(join(dir, 'feed.json.sigstore.json'), bundle);
      const root = trustedRoot && existsSync(trustedRoot) ? trustedRoot : undefined;
      const args = [
        'verify-blob',
        '--bundle',
        join(dir, 'feed.json.sigstore.json'),
        identity.startsWith('^') ? '--certificate-identity-regexp' : '--certificate-identity',
        identity,
        '--certificate-oidc-issuer',
        issuer,
        ...(root ? ['--offline=true', '--trusted-root', root] : []),
        join(dir, 'feed.json'),
      ];
      await new Promise<void>((resolve, reject) =>
        // cosign keeps Sigstore's trust root under HOME when it fetches it: a folder of its own.
        execFile('cosign', args, { env: { PATH: process.env.PATH ?? '/usr/bin:/bin', HOME: dir }, timeout: 60_000 }, (err, _out, stderr) => {
          if (!err) return resolve();
          if ((err as NodeJS.ErrnoException).code === 'ENOENT') return reject(new Error('cosign isn’t in this registry’s image.'));
          reject(new Error(`${stderr}`.trim().split('\n').filter(Boolean).slice(-1)[0] || 'cosign refused it.'));
        }),
      );
    } finally {
      await rm(dir, { recursive: true, force: true });
    }
  };

/**
 * Checks the publisher's feed: signed by its workflow, and in date. Gives back what the Upgrade Centre
 * says about it. `bundle` is undefined when the feed came with no signature.
 */
export const checkPublisherFeed = async ({ text, bundle, check, signer, now }: { text: string; bundle?: string; check?: FeedSignatureCheck; signer?: string; now: Date }): Promise<FeedTrust> => {
  if (!check) return { state: 'unchecked', note: 'This registry was started without a way to check the feed’s signature.' };
  if (!bundle) throw new FeedTrustProblem('The release feed isn’t signed, so nothing new is offered. If it persists, the publisher’s Release feed workflow needs to run again (docs/upgrade.md, The signed feed).');
  try {
    await check(text, bundle);
  } catch (err) {
    throw new FeedTrustProblem(`The release feed’s signature didn’t check out, so nothing new is offered: ${(err as Error).message} Everything running carries on (docs/upgrade.md, The signed feed).`);
  }
  let expires: unknown;
  try {
    expires = (JSON.parse(text) as { expires?: unknown }).expires;
  } catch {
    throw new FeedTrustProblem('The release feed isn’t JSON. Check RELEASE_FEED_URL.');
  }
  if (typeof expires !== 'string' || Number.isNaN(Date.parse(expires))) throw new FeedTrustProblem('The release feed doesn’t say when it expires, so it can’t be trusted to be current. Nothing new is offered.');
  if (Date.parse(expires) <= now.getTime()) throw new FeedTrustProblem(`The release feed expired on ${expires.slice(0, 10)}, so nothing newer than it can be trusted. The publisher issues it weekly; if a newer one doesn’t arrive, check this server can reach the feed (docs/upgrade.md, The signed feed).`);
  return { state: 'verified', expires, ...(signer ? { signer } : {}) };
};

/** The trust root the mirror script writes beside a mirror's feed, as the registry sees it. */
export const TRUSTED_ROOT_IN_REGISTRY = '/run/augur/releases/trusted_root.json';
