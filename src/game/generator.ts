import { countLetters, covers, hasHardConsonant, isLettersOnly, setKey } from './letters';

export type SetSize = 2 | 3 | 4;
export type Rng = () => number;

export interface LetterSet {
  /** Letters in display order (already shuffled). */
  letters: string[];
  /** Order-independent identity, used to avoid repeats. */
  key: string;
  /** How many common words solve this set. */
  solutions: number;
  /** A few common words that solve it, shown for skipped sets. */
  examples: string[];
}

/** Minimum number of common words that must solve a set of each size. */
export const MIN_SOLUTIONS: Record<SetSize, number> = { 2: 30, 3: 15, 4: 8 };

/** How often a vowels-and-S-only set (like `E A`) is let through. */
export const EASY_SET_ACCEPT_RATE = 0.15;

const MAX_ATTEMPTS = 3000;
const EXAMPLE_COUNT = 3;

interface Entry {
  word: string;
  counts: Uint8Array;
}

export interface SetGenerator {
  next(size: SetSize, usedKeys: ReadonlySet<string>): LetterSet;
  /** Common words longer than the set that contain all its letters. */
  solutionsFor(letters: readonly string[]): string[];
}

export function createSetGenerator(commonWords: readonly string[], rng: Rng = Math.random): SetGenerator {
  const entries: Entry[] = commonWords
    .filter(isLettersOnly)
    .map((word) => ({ word, counts: countLetters(word) }));
  const pick = <T>(items: readonly T[]): T => items[Math.floor(rng() * items.length)];

  function solutionsFor(letters: readonly string[]): string[] {
    const need = countLetters(letters.join(''));
    const out: string[] = [];
    for (const e of entries) {
      if (e.word.length > letters.length && covers(e.counts, need)) out.push(e.word);
    }
    return out;
  }

  function attempt(size: SetSize, usedKeys: ReadonlySet<string> | null): LetterSet | null {
    const seed = pick(entries).word;
    if (seed.length <= size) return null;
    const letters = shuffle([...seed], rng).slice(0, size);
    const key = setKey(letters);
    if (usedKeys?.has(key)) return null;
    if (!hasHardConsonant(letters) && rng() >= EASY_SET_ACCEPT_RATE) return null;
    const solutions = solutionsFor(letters);
    if (solutions.length < MIN_SOLUTIONS[size]) return null;
    return {
      letters: shuffle(letters, rng),
      key,
      solutions: solutions.length,
      examples: shuffle(solutions, rng).slice(0, EXAMPLE_COUNT),
    };
  }

  function next(size: SetSize, usedKeys: ReadonlySet<string>): LetterSet {
    for (let i = 0; i < MAX_ATTEMPTS; i++) {
      const set = attempt(size, usedKeys);
      if (set) return set;
    }
    // Practically unreachable with a real word list; allow a repeat rather than stall.
    for (let i = 0; i < MAX_ATTEMPTS; i++) {
      const set = attempt(size, null);
      if (set) return set;
    }
    throw new Error(`could not generate a solvable ${size}-letter set`);
  }

  return { next, solutionsFor };
}

export function shuffle<T>(items: readonly T[], rng: Rng = Math.random): T[] {
  const out = [...items];
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

/** Deterministic PRNG (mulberry32), handy for tests. */
export function seededRng(seed: number): Rng {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
