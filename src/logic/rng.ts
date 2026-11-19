import { hashSeed } from './geometry.ts';

export type SeedInput = string | number | null | undefined;
export type RNG = () => number;

export interface ShuffleBag<T> {
  next: () => T;
}

/**
 * Creates a pseudo-random number generator returning values in [0, 1).
 * If a seed is provided, uses deterministic Mulberry32; otherwise uses Math.random.
 */
export function createRNG(seed: SeedInput = null): RNG {
  if (seed === null || seed === undefined) {
    return () => Math.random();
  }
  let state = hashSeed(seed) || 1;
  return function mulberry32() {
    state |= 0;
    state = (state + 0x6D2B79F5) | 0;
    let t = Math.imul(state ^ (state >>> 15), 1 | state);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/**
 * Unbiased Fisher-Yates shuffle returning a new array.
 */
export function shuffle<T>(array: readonly T[], rng: RNG = Math.random): T[] {
  const result = [...array];
  for (let i = result.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    const tmp = result[i];
    result[i] = result[j];
    result[j] = tmp;
  }
  return result;
}

/**
 * Creates a shuffle-bag (deck) generator so every item in `items`
 * is dealt once in random order before reshuffling. Prevents RNG droughts.
 */
export function createShuffleBag<T>(items: readonly T[], rng: RNG = Math.random): ShuffleBag<T> {
  let bag: T[] = [];
  return {
    next() {
      if (bag.length === 0) {
        bag = shuffle(items, rng);
      }
      return bag.pop() as T;
    }
  };
}
