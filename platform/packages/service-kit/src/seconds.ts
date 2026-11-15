/** The most a timer or a Postgres timeout takes: 2^31-1 milliseconds, about 24 days. */
const MOST_SECONDS = 2_147_483;

/** A setting given in seconds, as milliseconds: `fallbackMs` when it is unset, empty, negative, over 24 days or not a number; 0 stays 0. */
export const secondsSetting = (raw: string | undefined, fallbackMs: number): number => {
  const seconds = Number(raw?.trim());
  return raw?.trim() && Number.isFinite(seconds) && seconds >= 0 && seconds <= MOST_SECONDS ? Math.round(seconds * 1000) : fallbackMs;
};

/** 300 → "0.3s", 30000 → "30s". */
export const asSeconds = (ms: number): string => `${ms / 1000}s`;
