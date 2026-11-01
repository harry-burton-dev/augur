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
/** The certificate identity of `workflow` (`owner/repo/.github/workflows/<file>`) on any branch releases are made from. */
/** The workflow that builds AUGUR's dev builds on every merge into main (docs/release-channels.md, "AUGUR dev builds"). */
export const AUGUR_DEV_WORKFLOW = '.github/workflows/augur-dev.yml';
/** Who signs a dev build: `workflow` (`owner/repo/.github/workflows/<file>`) on a branch dev builds are made from, as a pattern. */
export const devBuildIdentity = (workflow: string) => `^${escape(`https://github.com/${workflow}`)}@refs/heads/(${DEV_BRANCHES.join('|')})$`;
/** The identity AUGUR's dev builds are signed with: that workflow, on main, in `repository` (owner/repo). */
export const augurDevIdentity = (repository: string) => devBuildIdentity(`${repository}/${AUGUR_DEV_WORKFLOW}`);
/** An AUGUR or app version that's a dev build: <next patch>-dev.<run>. */
export const isDevBuild = (version: string) => /-dev\.\d+$/.test(version);
export const releaseIdentity = (workflow: string) => `^${escape(`https://github.com/${workflow}`)}@refs/heads/(${[...RELEASE_BRANCHES, HOTFIX_BRANCH].join('|')})$`;
