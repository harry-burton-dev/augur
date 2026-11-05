/** Who the updater takes images and apps from: the certificate identities cosign checks signatures against. */

/**
 * The branches releases are made from (docs/release-channels.md): `main`, and a hotfix's
 * `release/<unit>-<major>.<minor>`. `preview` and `production` made the releases up to 0.13.0, which a
 * deployment may still roll back to.
 */
export const RELEASE_BRANCHES = ['main', 'preview', 'production'] as const;
/** A hotfix branch, as a pattern: release/<unit>-<major>.<minor>. */
export const HOTFIX_BRANCH = 'release/[a-z][a-z0-9-]*-[0-9]+\\.[0-9]+';
/** The branches dev builds are made from: `main`, and `dev` before it was renamed `main`. */
export const DEV_BRANCHES = ['main', 'dev'] as const;
const escape = (text: string) => text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
/**
 * The repositories AUGUR is released from: its name now, then the name it had before. A release made
 * before the rename is signed with the old name, and a server may still run it or go back to it. Its
 * images and feed stay at ghcr.io/harry-burton-dev/im-platform, where servers pull them (docs/upgrade.md).
 */
export const AUGUR_REPOSITORIES = ['harry-burton-dev/augur', 'harry-burton-dev/im-platform'] as const;
/** One workflow, or any of several (the same file in each of AUGUR_REPOSITORIES), as the start of a pattern. */
const anyOf = (workflow: string | readonly string[]) => {
  const urls = (typeof workflow === 'string' ? [workflow] : [...workflow]).map((w) => escape(`https://github.com/${w}`));
  return urls.length === 1 ? urls[0] : `(?:${urls.join('|')})`;
};
/** The certificate identity of `workflow` (`owner/repo/.github/workflows/<file>`) on any branch releases are made from. */
/** The workflow that builds AUGUR's dev builds on every merge into main (docs/release-channels.md, "AUGUR dev builds"). */
export const AUGUR_DEV_WORKFLOW = '.github/workflows/augur-dev.yml';
/** Who signs a dev build: `workflow` (`owner/repo/.github/workflows/<file>`) on a branch dev builds are made from, as a pattern. */
export const devBuildIdentity = (workflow: string | readonly string[]) => `^${anyOf(workflow)}@refs/heads/(${DEV_BRANCHES.join('|')})$`;
/** The identity AUGUR's dev builds are signed with: that workflow, on main, in `repository` (owner/repo) or any of several. */
export const augurDevIdentity = (repository: string | readonly string[]) =>
  devBuildIdentity((typeof repository === 'string' ? [repository] : [...repository]).map((r) => `${r}/${AUGUR_DEV_WORKFLOW}`));
/**
 * The repository (owner/repo) a certificate identity names, such as
 * `https://github.com/acme/augur/.github/workflows/release.yml@refs/heads/main` or that as a pattern
 * (`^https://github\\.com/acme/augur/...`). Undefined for a pattern of several, or one that names none.
 */
export const repositoryOfIdentity = (identity: string): string | undefined =>
  /^\^?https:\/\/github\.com\/([\w.-]+\/[\w.-]+)\//.exec(identity.replace(/\\(?=[./-])/g, ''))?.[1];
/** An AUGUR or app version that's a dev build: <next patch>-dev.<run>. */
export const isDevBuild = (version: string) => /-dev\.\d+$/.test(version);
export const releaseIdentity = (workflow: string | readonly string[]) => `^${anyOf(workflow)}@refs/heads/(${[...RELEASE_BRANCHES, HOTFIX_BRANCH].join('|')})$`;
