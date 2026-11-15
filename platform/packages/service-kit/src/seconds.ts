/** A setting given in seconds, as milliseconds: `fallbackMs` when it is unset, empty, negative or not a number; 0 stays 0. */
export const secondsSetting = (raw: string | undefined, fallbackMs: number): number => {
  const seconds = Number(raw?.trim());
  return raw?.trim() && Number.isFinite(seconds) && seconds >= 0 ? Math.round(seconds * 1000) : fallbackMs;
};

/** 300 → "0.3s", 30000 → "30s". */
export const asSeconds = (ms: number): string => `${ms / 1000}s`;
