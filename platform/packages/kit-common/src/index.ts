/**
 * Common: what both of AUGUR's kits stand on. Aerie (`@augur/shell-kit`) is the
 * shell's own kit and Quill (`@augur/app-kit`) is the kit apps build with; both
 * read these tokens, and the controls they share arrive here as they move to
 * React (ADR 0015).
 */
export { tokens, token, type TokenName } from './generated/tokens.js';
