/**
 * Modules the shell serves once, through an import map, for the shell and
 * every app to share. An app's build leaves these imports as they are, so its
 * bundle carries none of React or the kit, and every app gets the same copy of
 * each.
 *
 * Within an SDK major the shell keeps serving each of these: React on 19.x and
 * the kits, Common and Quill (ADR 0015), on their same major. They come from
 * the kit bundle, at the deployment's kit URL (ADR 0048). Aerie, the shell's
 * own kit, is never shared. SDK 2 dropped Lit and the Lit kit
 * (`@augur/ui-kit`): an app that still imports them doesn't load.
 */
export const sharedModules: readonly string[] = [
  'react',
  'react/jsx-runtime',
  'react/jsx-dev-runtime',
  'react-dom',
  'react-dom/client',
  '@augur/kit-common',
  '@augur/app-kit',
];

/** Whether the shell provides this import, so an app's build should leave it external. */
export const isSharedModule = (id: string): boolean => sharedModules.includes(id);
