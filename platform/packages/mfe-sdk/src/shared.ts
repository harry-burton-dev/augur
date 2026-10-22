/**
 * Modules the shell serves once, through an import map, for the shell and
 * every app to share. An app's build leaves these imports as they are, so its
 * bundle carries none of the kit or Lit, and every app gets the same copy of
 * each component the shell registered.
 *
 * Within an SDK major the shell keeps serving each of these: the kit on its
 * same major, Lit on 3.x.
 */
const litDirectives = [
  'async-append', 'async-replace', 'cache', 'choose', 'class-map', 'guard', 'if-defined', 'join', 'keyed', 'live',
  'map', 'range', 'ref', 'repeat', 'style-map', 'template-content', 'unsafe-html', 'unsafe-mathml', 'unsafe-svg',
  'until', 'when',
];

export const sharedModules: readonly string[] = [
  'lit',
  'lit/async-directive.js',
  'lit/decorators.js',
  'lit/directive-helpers.js',
  'lit/directive.js',
  'lit/html.js',
  'lit/static-html.js',
  ...litDirectives.map((d) => `lit/directives/${d}.js`),
  '@platform/ui-kit',
];

/** Whether the shell provides this import, so an app's build should leave it external. */
export const isSharedModule = (id: string): boolean => sharedModules.includes(id);
