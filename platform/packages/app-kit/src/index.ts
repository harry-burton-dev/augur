/**
 * Quill: the kit apps build with (ADR 0015). The shell serves it, with React
 * and Common, through the import map, so an app's bundle carries none of them.
 * Its parts arrive as the Lit kit's move to React, group by group; until SDK 2
 * apps keep using `@augur/ui-kit`.
 */
export { tokens, token, type TokenName } from '@augur/kit-common';
