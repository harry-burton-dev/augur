/**
 * A Map that holds at most `max` entries, dropping the one used longest ago when it is full. The kit's
 * lookups (floors, people, grants) remember answers per floor, person or app for a short while; without a
 * bound, a long-running service would keep one for everyone it was ever asked about (PER-213).
 */
export class BoundedMap<K, V> {
  private readonly entries = new Map<K, V>();

  constructor(readonly max = DEFAULT_CACHE_ENTRIES) {}

  get(key: K): V | undefined {
    const value = this.entries.get(key);
    if (value !== undefined) {
      // Used now, so it moves to the newest end and is dropped last.
      this.entries.delete(key);
      this.entries.set(key, value);
    }
    return value;
  }

  set(key: K, value: V): this {
    this.entries.delete(key);
    this.entries.set(key, value);
    while (this.entries.size > this.max) this.entries.delete(this.entries.keys().next().value as K);
    return this;
  }

  delete(key: K): boolean {
    return this.entries.delete(key);
  }

  get size(): number {
    return this.entries.size;
  }
}

/** Enough for every floor, person or app a deployment has many times over, at a few hundred bytes each. */
export const DEFAULT_CACHE_ENTRIES = 5_000;
