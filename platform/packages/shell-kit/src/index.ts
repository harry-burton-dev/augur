/**
 * Aerie: the shell's own kit (ADR 0015): the water, the band, Orbit and the
 * title cards. Only the shell imports it (`pnpm check:boundaries`), so it can
 * change with the shell and is not part of the SDK promise. Its parts arrive
 * as the shell's Lit parts move to React.
 */
export { tokens, token, type TokenName } from '@augur/kit-common';
