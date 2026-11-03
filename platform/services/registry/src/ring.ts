/**
 * What kind of server this is (docs/release-channels.md): a dev server is the workbench, which runs what's
 * on dev (AUGUR's own dev builds as well as apps'); a preview server runs what's on its way to production,
 * and may follow preview releases and pull requests' builds; a production server takes only releases
 * promoted to production. It's set in .env (SERVER_RING), never from Admin, so an admin's session can't
 * turn a production server into one that runs unreleased code.
 */
export type Ring = 'dev' | 'preview' | 'production';

export const RINGS: readonly Ring[] = ['dev', 'preview', 'production'];

/** SERVER_RING: dev, preview or production, and production when unset. */
export const ringFrom = (value?: string): Ring => {
  if (!value) return 'production';
  if ((RINGS as readonly string[]).includes(value)) return value as Ring;
  throw new Error(`SERVER_RING is dev, preview or production, not "${value}".`);
};

/** Whether a server on `ring` may follow preview releases (beta in the release files), apps' dev builds and pull requests' builds. */
export const takesPreview = (ring: Ring) => ring !== 'production';

/** Whether a server on `ring` may run AUGUR's own dev builds: the workbench only. */
export const takesAugurDevBuilds = (ring: Ring) => ring === 'dev';

/** Why a production server won't follow preview releases, as Admin shows it. */
export const PRODUCTION_ONLY = 'This is a production server (SERVER_RING=production in .env), so it takes only releases promoted to production.';

/**
 * Whether a server on `ring` may install a release its publisher halted, when a deployment admin asks
 * for it by name, to prove AUGUR goes back by itself from a broken release (ADR 0051): dev and preview only.
 */
export const takesHaltedOnRequest = (ring: Ring) => ring !== 'production';

/** Why a production server won't install a halted release, as the Upgrade Centre shows it. */
export const HALTED_PRODUCTION_ONLY =
  'This is a production server (SERVER_RING=production in .env), so it never installs a release its publisher halted. Only a dev or preview server does, to test going back.';
