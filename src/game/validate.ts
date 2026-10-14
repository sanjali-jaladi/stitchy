import type { Dictionary } from './dictionary';
import { isLettersOnly, missingLetters, normalize } from './letters';

export type Rejection =
  | { ok: false; reason: 'empty' }
  | { ok: false; reason: 'letters-only' }
  | { ok: false; reason: 'missing'; missing: string[] }
  | { ok: false; reason: 'too-short' }
  | { ok: false; reason: 'not-a-word' }
  | { ok: false; reason: 'already-used' };

export type Validation = { ok: true; word: string } | Rejection;

/**
 * A word is accepted only when it is spelled exactly as in the dictionary,
 * contains every shown letter (repeats included), is longer than the set,
 * and hasn't been used yet this session.
 */
export function validateWord(
  input: string,
  letters: readonly string[],
  dictionary: Dictionary,
  used: ReadonlySet<string>,
): Validation {
  const word = normalize(input);
  if (!word) return { ok: false, reason: 'empty' };
  if (!isLettersOnly(word)) return { ok: false, reason: 'letters-only' };
  const missing = missingLetters(word, letters);
  if (missing.length) return { ok: false, reason: 'missing', missing };
  if (word.length <= letters.length) return { ok: false, reason: 'too-short' };
  if (!dictionary.has(word)) return { ok: false, reason: 'not-a-word' };
  if (used.has(word)) return { ok: false, reason: 'already-used' };
  return { ok: true, word };
}

export function describeRejection(rejection: Rejection): string {
  switch (rejection.reason) {
    case 'empty':
      return 'type a word';
    case 'letters-only':
      return 'letters only';
    case 'missing':
      return `missing ${rejection.missing.join(' ')}`;
    case 'too-short':
      return 'too short';
    case 'not-a-word':
      return 'not a word';
    case 'already-used':
      return 'already used';
  }
}
