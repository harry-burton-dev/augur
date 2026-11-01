/** Who the updater takes images and apps from: the certificate identities cosign checks signatures against. */

/** The branches releases are made from (docs/release-channels.md): `main` until it became `production`. */
export const RELEASE_BRANCHES = ['main', 'preview', 'production'] as const;
const escape = (text: string) => text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
/** The certificate identity of `workflow` (`owner/repo/.github/workflows/<file>`) on any branch releases are made from. */
/** The workflow that builds AUGUR's dev builds on every merge into dev (docs/release-channels.md, "AUGUR dev builds"). */
export const AUGUR_DEV_WORKFLOW = '.github/workflows/augur-dev.yml';
/** The exact identity AUGUR's dev builds are signed with: that workflow, on dev, in `repository` (owner/repo). */
export const augurDevIdentity = (repository: string) => `https://github.com/${repository}/${AUGUR_DEV_WORKFLOW}@refs/heads/dev`;
/** An AUGUR or app version that's a dev build: <next patch>-dev.<run>. */
export const isDevBuild = (version: string) => /-dev\.\d+$/.test(version);
export const releaseIdentity = (workflow: string) => `^${escape(`https://github.com/${workflow}`)}@refs/heads/(${RELEASE_BRANCHES.join('|')})$`;
