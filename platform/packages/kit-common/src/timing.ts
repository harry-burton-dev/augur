import { tokens, type TokenName } from './generated/tokens.js';

/** A duration token in milliseconds, for timers (the CSS reads the variable itself). */
export const ms = (name: TokenName): number => {
  const value = String(tokens[name]);
  const n = Number.parseFloat(value);
  return value.endsWith('ms') ? n : value.endsWith('s') ? n * 1000 : n;
};
