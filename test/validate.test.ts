import { describe, expect, it } from 'vitest';
import { createDictionary, parseWordList } from '../src/game/dictionary';
import { containsAll, litLetters, missingLetters } from '../src/game/letters';
import { describeRejection, MIN_WORD_LENGTH, validateWord } from '../src/game/validate';
import { realLists } from './helpers';

const dict = createDictionary(['water', 'great', 'arena', 'teeth', 'eat', 'tree', 'see', 'seen', 'rae']);
const none = new Set<string>();

describe('spelling', () => {
  it('rejects misspelled words with no fuzzy matching', () => {
    for (const typo of ['wtaer', 'graet', 'waterr', 'arenaa', 'raeing']) {
      expect(validateWord(typo, ['r', 'a', 'e'], dict, none)).toEqual({ ok: false, reason: 'not-a-word' });
    }
  });

  it('rejects common misspellings against the real dictionary', () => {
    const { dictionary } = realLists();
    for (const typo of ['recieve', 'seperate', 'definately', 'occured', 'wierd', 'teh', 'acheive']) {
      expect(dictionary.has(typo), typo).toBe(false);
    }
    for (const word of ['receive', 'separate', 'definitely', 'occurred', 'weird', 'achieve', 'orchard']) {
      expect(dictionary.has(word), word).toBe(true);
    }
  });

  it('is case-insensitive and trims input', () => {
    expect(validateWord('  WaTeR \n', ['r', 'a', 'e'], dict, none)).toEqual({ ok: true, word: 'water' });
  });

  it('accepts letters only', () => {
    expect(validateWord('wa-ter', ['r', 'a', 'e'], dict, none)).toEqual({ ok: false, reason: 'letters-only' });
    expect(validateWord('', ['r', 'a', 'e'], dict, none)).toEqual({ ok: false, reason: 'empty' });
  });

  it('parses word lists to plain lowercase letters', () => {
    expect(parseWordList('Apple\nbanana\n\ncafé\nit\'s\n  pear \n')).toEqual(['apple', 'banana', 'pear']);
  });
});

describe('letter matching', () => {
  it('matches letters in any position and order', () => {
    for (const word of ['water', 'great', 'arena']) {
      expect(validateWord(word, ['r', 'a', 'e'], dict, none).ok, word).toBe(true);
      expect(validateWord(word, ['e', 'r', 'a'], dict, none).ok, word).toBe(true);
    }
  });

  it('requires a repeated letter to appear at least that many times', () => {
    expect(containsAll('teeth', ['e', 'e'])).toBe(true);
    expect(containsAll('great', ['e', 'e'])).toBe(false);
    expect(missingLetters('great', ['e', 'e'])).toEqual(['e']);
    expect(validateWord('tree', ['e', 'e'], dict, none).ok).toBe(true);
    expect(validateWord('water', ['e', 'e'], dict, none)).toEqual({ ok: false, reason: 'missing', missing: ['e'] });
  });

  it('reports which letters are missing', () => {
    const result = validateWord('teeth', ['r', 'h', 'd'], dict, none);
    expect(result).toEqual({ ok: false, reason: 'missing', missing: ['r', 'd'] });
    if (!result.ok) expect(describeRejection(result)).toBe('missing r d');
  });

  it('requires the word to be longer than the set', () => {
    expect(validateWord('rae', ['r', 'a', 'e'], dict, none)).toEqual({ ok: false, reason: 'too-short' });
    expect(validateWord('eat', ['e', 'a', 't'], dict, none)).toEqual({ ok: false, reason: 'too-short' });
  });

  it('never accepts a word under four letters, even on a two-letter set', () => {
    expect(MIN_WORD_LENGTH).toBe(4);
    const short = createDictionary(['as', 'see', 'seen', 's']);
    for (const word of ['s', 'as', 'see']) {
      expect(validateWord(word, ['s'], short, none).ok, word).toBe(false);
      expect(validateWord(word, [...word], short, none).ok, word).toBe(false);
    }
    expect(validateWord('as', ['a', 's'], short, none)).toEqual({ ok: false, reason: 'too-short' });
    expect(validateWord('see', ['s', 'e'], short, none)).toEqual({ ok: false, reason: 'too-short' });
    expect(validateWord('seen', ['s', 'e'], short, none)).toEqual({ ok: true, word: 'seen' });
  });

  it('rejects words already used this session', () => {
    expect(validateWord('water', ['r', 'a', 'e'], dict, new Set(['water']))).toEqual({
      ok: false,
      reason: 'already-used',
    });
  });

  it('lights up shown letters as they are typed, counting repeats', () => {
    expect(litLetters('', ['r', 'a', 'e'])).toEqual([false, false, false]);
    expect(litLetters('wa', ['r', 'a', 'e'])).toEqual([false, true, false]);
    expect(litLetters('TE', ['e', 'e'])).toEqual([true, false]);
    expect(litLetters('tee', ['e', 'e'])).toEqual([true, true]);
  });
});
