/**
 * What kind of server this is (docs/release-channels.md): a preview server runs what's on its way to
 * production, and may follow preview releases and pull requests' builds; a production server takes
 * only releases promoted to production. It's set in .env (SERVER_RING), never from Admin, so an
 * admin's session can't turn a production server into one that runs unreleased code.
 */
export type Ring = 'preview' | 'production';

/** SERVER_RING: preview or production, and production when unset. */
export const ringFrom = (value?: string): Ring => {
  if (!value) return 'production';
  if (value === 'preview' || value === 'production') return value;
  throw new Error(`SERVER_RING is preview or production, not "${value}".`);
};

/** Whether a server on `ring` may follow preview releases (beta in the release files). */
export const takesPreview = (ring: Ring) => ring === 'preview';

/** Why a production server won't follow preview releases, as Admin shows it. */
export const PRODUCTION_ONLY = 'This is a production server (SERVER_RING=production in .env), so it takes only releases promoted to production.';
