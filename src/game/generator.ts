import {
  allDistinct,
  countLetters,
  countVowels,
  covers,
  hasHardConsonant,
  isLettersOnly,
  setKey,
} from './letters';
import { isLongEnough, MIN_WORD_LENGTH } from './validate';

export type SetSize = 2 | 3 | 4;
export type Rng = () => number;

export interface LetterSet {
  /** Letters in display order (already shuffled). */
  letters: string[];
  /** Order-independent identity, used to avoid repeats. */
  key: string;
  /** How many common words solve this set. */
  solutions: number;
  /** A few everyday words that solve it, shown for skipped sets. */
  examples: string[];
}

/** Minimum number of common words that must solve a set of each size. */
export const MIN_SOLUTIONS: Record<SetSize, number> = { 2: 30, 3: 15, 4: 8 };

/**
 * Minimum number of *everyday* words that must solve a set. Counting every common
 * word isn't enough on its own: a four-letter set can clear `MIN_SOLUTIONS` on
 * obscurities alone, like `C J D E` solved only by "adjacent" and "adjective".
 */
export const MIN_EASY_SOLUTIONS: Record<SetSize, number> = { 2: 12, 3: 8, 4: 5 };

/**
 * Vowels a set of each size must contain. Vowel-less four-letter sets (`R S C T`)
 * are the hardest of all; at two letters they're fine, and requiring one there
 * would throw away most of the available pairs.
 */
export const MIN_VOWELS: Record<SetSize, number> = { 2: 0, 3: 1, 4: 1 };

/**
 * Sets are sliced out of everyday words this long, and the same pool measures how
 * findable a set is. The cap keeps sets from being carved out of long rarities.
 */
export const EASY_MIN_LENGTH = MIN_WORD_LENGTH;
export const EASY_MAX_LENGTH = 8;

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
  /** Common words the validator accepts for the set: long enough and containing all its letters. */
  solutionsFor(letters: readonly string[]): string[];
  /** The short, everyday subset of those: roughly what a player finds under the clock. */
  easySolutionsFor(letters: readonly string[]): string[];
}

export function createSetGenerator(commonWords: readonly string[], rng: Rng = Math.random): SetGenerator {
  const entries: Entry[] = commonWords
    .filter(isLettersOnly)
    .map((word) => ({ word, counts: countLetters(word) }));
  // Short everyday words: the seed pool, and the yardstick for how findable a set is.
  const easyWords = entries.filter(
    (e) => e.word.length >= EASY_MIN_LENGTH && e.word.length <= EASY_MAX_LENGTH,
  );
  const pick = <T>(items: readonly T[]): T => items[Math.floor(rng() * items.length)];

  function matches(pool: readonly Entry[], letters: readonly string[]): string[] {
    const need = countLetters(letters.join(''));
    const out: string[] = [];
    for (const e of pool) {
      if (isLongEnough(e.word, letters) && covers(e.counts, need)) out.push(e.word);
    }
    return out;
  }

  const solutionsFor = (letters: readonly string[]) => matches(entries, letters);
  const easySolutionsFor = (letters: readonly string[]) => matches(easyWords, letters);

  function attempt(size: SetSize, usedKeys: ReadonlySet<string> | null): LetterSet | null {
    if (!easyWords.length) return null;
    // Slicing from an everyday word means the seed itself always solves the set.
    const seed = pick(easyWords).word;
    if (seed.length <= size) return null;
    const letters = shuffle([...seed], rng).slice(0, size);
    // A repeated letter is a hidden trap: players don't spot the double, type
    // `rare` for `R A E R`, and get "missing r".
    if (!allDistinct(letters)) return null;
    if (countVowels(letters) < MIN_VOWELS[size]) return null;
    const key = setKey(letters);
    if (usedKeys?.has(key)) return null;
    if (!hasHardConsonant(letters) && rng() >= EASY_SET_ACCEPT_RATE) return null;
    const solutions = solutionsFor(letters);
    if (solutions.length < MIN_SOLUTIONS[size]) return null;
    const easySolutions = easySolutionsFor(letters);
    if (easySolutions.length < MIN_EASY_SOLUTIONS[size]) return null;
    return {
      letters: shuffle(letters, rng),
      key,
      solutions: solutions.length,
      // Skipped sets show words the player will recognise, not the longest match.
      examples: shuffle(easySolutions, rng).slice(0, EXAMPLE_COUNT),
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

  return { next, solutionsFor, easySolutionsFor };
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
