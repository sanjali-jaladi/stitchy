import { describe, expect, it } from 'vitest';
import { createDictionary } from '../src/game/dictionary';
import type { LetterSet, SetGenerator } from '../src/game/generator';
import { DURATION_MS, Session, SKIP_PENALTY_MS } from '../src/game/session';
import { computeResults } from '../src/game/stats';

/** Hands out a fixed sequence of sets so tests know what's shown. */
function scripted(...sets: string[][]): SetGenerator {
  let i = 0;
  return {
    next: (): LetterSet => {
      const letters = sets[i++ % sets.length];
      return { letters, key: `${i}`, solutions: 99, examples: ['ex1', 'ex2', 'ex3'] };
    },
    solutionsFor: () => [],
    easySolutionsFor: () => [],
  };
}

const dictionary = createDictionary(['water', 'great', 'orchard', 'third', 'arena', 'tree']);

describe('per-word timing', () => {
  it('runs from the set appearing to the valid word, including failed attempts', () => {
    const s = new Session('3', { dictionary, generator: scripted(['r', 'a', 'e'], ['r', 'h', 'd']) });
    s.start(1_000);
    expect(s.submit('watr', 2_000).ok).toBe(false);
    expect(s.submit('tree', 3_000).ok).toBe(false);
    const ok = s.submit('water', 4_400);
    expect(ok.ok && ok.record.ms).toBe(3_400);
    // The next set's clock starts when it appears.
    const next = s.submit('orchard', 15_600);
    expect(next.ok && next.record.ms).toBe(11_200);
  });

  it('excludes skipped sets and restarts the clock on the next set', () => {
    const s = new Session('3', { dictionary, generator: scripted(['r', 'h', 'd'], ['r', 'a', 'e']) });
    s.start(0);
    s.submit('nope', 5_000);
    expect(s.skip(9_000)).toBe(true);
    const ok = s.submit('great', 10_500);
    expect(ok.ok && ok.record.ms).toBe(1_500);
    const results = computeResults(s.records);
    expect(results.words).toBe(1);
    expect(results.slowest?.ms).toBe(1_500);
    expect(s.records[0]).toEqual({ kind: 'skip', letters: ['r', 'h', 'd'], examples: ['ex1', 'ex2', 'ex3'] });
  });

  it('first set clock starts on the first keystroke, not when shown', () => {
    const s = new Session('3', { dictionary, generator: scripted(['r', 'a', 'e']) });
    s.start(50_000);
    const ok = s.submit('arena', 52_000);
    expect(ok.ok && ok.record.ms).toBe(2_000);
  });
});

describe('game clock', () => {
  it('lasts 120s from the first keystroke, minus 2s per skip', () => {
    const s = new Session('2', { dictionary, generator: scripted(['a', 'e']) });
    expect(s.remaining(999_999)).toBe(DURATION_MS);
    s.start(1_000);
    expect(s.remaining(11_000)).toBe(110_000);
    s.skip(11_000);
    expect(s.remaining(11_000)).toBe(110_000 - SKIP_PENALTY_MS);
    expect(s.isOver(1_000 + DURATION_MS - SKIP_PENALTY_MS)).toBe(true);
    expect(s.submit('water', 200_000)).toEqual({ ok: false, reason: 'over' });
  });

  it('counts valid words only', () => {
    const s = new Session('3', { dictionary, generator: scripted(['r', 'a', 'e']) });
    s.start(0);
    s.submit('water', 1);
    s.submit('graet', 2);
    s.skip(3);
    s.submit('great', 4);
    expect(s.words).toBe(2);
    expect(computeResults(s.records).words).toBe(2);
  });

  it('rejects a word already used this session', () => {
    const s = new Session('3', { dictionary, generator: scripted(['r', 'a', 'e']) });
    s.start(0);
    s.submit('water', 1);
    expect(s.submit('WATER', 2)).toEqual({ ok: false, reason: 'already-used' });
  });
});
