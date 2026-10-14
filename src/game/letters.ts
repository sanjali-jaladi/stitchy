// Letter-multiset helpers shared by validation and set generation.

const A = 'a'.charCodeAt(0);
const LETTERS_ONLY = /^[a-z]+$/;

export function normalize(input: string): string {
  return input.trim().toLowerCase();
}

export function isLettersOnly(text: string): boolean {
  return LETTERS_ONLY.test(text);
}

/** Counts of each letter a–z. Assumes `word` is lowercase letters only. */
export function countLetters(word: string): Uint8Array {
  const counts = new Uint8Array(26);
  for (let i = 0; i < word.length; i++) counts[word.charCodeAt(i) - A]++;
  return counts;
}

/** True when `have` contains at least as many of every letter as `need`. */
export function covers(have: Uint8Array, need: Uint8Array): boolean {
  for (let i = 0; i < 26; i++) if (have[i] < need[i]) return false;
  return true;
}

/**
 * The shown letters the word doesn't cover, respecting repeats:
 * `missingLetters("eat", ["e", "e"])` is `["e"]`.
 */
export function missingLetters(word: string, letters: readonly string[]): string[] {
  const have = countLetters(word);
  const missing: string[] = [];
  for (const letter of letters) {
    const i = letter.charCodeAt(0) - A;
    if (have[i] > 0) have[i]--;
    else missing.push(letter);
  }
  return missing;
}

export function containsAll(word: string, letters: readonly string[]): boolean {
  return missingLetters(word, letters).length === 0;
}

/**
 * Which shown letters the typed text already contains, in display order.
 * A repeated letter lights up once per occurrence typed.
 */
export function litLetters(typed: string, letters: readonly string[]): boolean[] {
  const have = countLetters(normalize(typed).replace(/[^a-z]/g, ''));
  return letters.map((letter) => {
    const i = letter.charCodeAt(0) - A;
    if (have[i] > 0) {
      have[i]--;
      return true;
    }
    return false;
  });
}

/** Order-independent identity of a letter set, e.g. `["r","a","e"]` → `"aer"`. */
export function setKey(letters: readonly string[]): string {
  return [...letters].sort().join('');
}

const VOWELS = new Set(['a', 'e', 'i', 'o', 'u']);

/** Sets made only of vowels and S are the trivially easy ones. */
export function hasHardConsonant(letters: readonly string[]): boolean {
  return letters.some((l) => !VOWELS.has(l) && l !== 's');
}
