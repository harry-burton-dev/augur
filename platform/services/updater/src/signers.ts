/** Who the updater takes images and apps from: the certificate identities cosign checks signatures against. */

/** The branches releases are made from (docs/release-channels.md): `main` until it became `production`. */
export const RELEASE_BRANCHES = ['main', 'preview', 'production'] as const;
const escape = (text: string) => text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
/** The certificate identity of `workflow` (`owner/repo/.github/workflows/<file>`) on any branch releases are made from. */
export const releaseIdentity = (workflow: string) => `^${escape(`https://github.com/${workflow}`)}@refs/heads/(${RELEASE_BRANCHES.join('|')})$`;
