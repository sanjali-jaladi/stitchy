import { describe, expect, it } from 'vitest';
import { createSetGenerator, MIN_SOLUTIONS, seededRng, type SetSize } from '../src/game/generator';
import { hasHardConsonant } from '../src/game/letters';
import { validateWord } from '../src/game/validate';
import { realLists } from './helpers';

const { dictionary, common } = realLists();

describe('set generation', () => {
  const sizes: SetSize[] = [2, 3, 4];

  it.each(sizes)('every generated %i-letter set is solvable by enough common words', (size) => {
    const gen = createSetGenerator(common, seededRng(size));
    const used = new Set<string>();
    for (let i = 0; i < 150; i++) {
      const set = gen.next(size, used);
      used.add(set.key);
      expect(set.letters).toHaveLength(size);
      const solutions = gen.solutionsFor(set.letters);
      expect(solutions.length).toBeGreaterThanOrEqual(MIN_SOLUTIONS[size]);
      // The solutions must actually pass the real validator.
      for (const word of solutions.slice(0, 5)) {
        expect(validateWord(word, set.letters, dictionary, new Set()).ok, `${word} for ${set.key}`).toBe(true);
      }
      expect(set.examples.length).toBeGreaterThanOrEqual(2);
      for (const ex of set.examples) expect(validateWord(ex, set.letters, dictionary, new Set()).ok).toBe(true);
    }
  });

  it.each(sizes)('never repeats a %i-letter set within a long session', (size) => {
    // 120s allows at most ~60 skips plus accepted words, so 150 sets is a generous session.
    const gen = createSetGenerator(common, seededRng(7 + size));
    const used = new Set<string>();
    for (let i = 0; i < 150; i++) {
      const set = gen.next(size, used);
      expect(used.has(set.key)).toBe(false);
      used.add(set.key);
    }
  });

  it('mostly includes a consonant other than S', () => {
    const gen = createSetGenerator(common, seededRng(11));
    const used = new Set<string>();
    let easy = 0;
    for (let i = 0; i < 300; i++) {
      const set = gen.next(2, used);
      used.add(set.key);
      if (!hasHardConsonant(set.letters)) easy++;
    }
    expect(easy / 300).toBeLessThan(0.1);
  });

  it('only accepts sets that meet the solution threshold', () => {
    const gen = createSetGenerator(['quiz', 'quizzes', 'water', 'later', 'cater', 'rated'], seededRng(1));
    // Too few words to satisfy any threshold.
    expect(() => gen.next(2, new Set())).toThrow();
  });
});
