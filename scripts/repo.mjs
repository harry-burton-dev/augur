// Which GitHub repository AUGUR's scripts work on. One place, one override, instead of a slug in each script.
//   AUGUR_REPO (owner/name) wins; in a workflow, GitHub's own GITHUB_REPOSITORY; else AUGUR's home.
// The images and the feed keep their old path (ghcr.io/harry-burton-dev/im-platform): that is IMAGE_REPO,
// not this (AGENTS.md, "Old ids kept on purpose").

/** AUGUR's own repository, where its docs link to. */
export const AUGUR_HOME = 'harry-burton-dev/augur';

/** The AUGUR handbook's decisions folder on Google Drive, which holds the Decision register (ADRs and PDRs live there, not here). */
export const DECISIONS_URL = 'https://drive.google.com/drive/folders/16wXmUMRNP2_vXAlf4kBMF9hCDNUXg7yO';

/** The repository a script releases, promotes or halts in. */
export const repoFrom = (env = process.env) => env.AUGUR_REPO || env.GITHUB_REPOSITORY || AUGUR_HOME;

export const REPO = repoFrom();
