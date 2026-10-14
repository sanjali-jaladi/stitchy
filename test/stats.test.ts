import { describe, expect, it } from 'vitest';
import {
  computeResults,
  formatLetters,
  formatSeconds,
  lengthDistribution,
  type RoundRecord,
  type WordRecord,
} from '../src/game/stats';

const word = (w: string, ms: number, letters = ['a', 'e']): WordRecord => ({
  kind: 'word',
  word: w,
  letters,
  ms,
});
const skip: RoundRecord = { kind: 'skip', letters: ['x', 'q'], examples: [] };

describe('results stats', () => {
  it('counts words and finds fastest, slowest, longest and shortest', () => {
    const records = [word('water', 3_400), skip, word('orchard', 11_200), word('tea', 900), word('ate', 5_000)];
    const r = computeResults(records);
    expect(r.words).toBe(4);
    expect(r.fastest?.word).toBe('tea');
    expect(r.slowest?.word).toBe('orchard');
    expect(r.longest?.word).toBe('orchard');
    expect(r.shortest?.word).toBe('tea');
  });

  it('breaks ties with the first one achieved', () => {
    const r = computeResults([word('great', 2_000), word('water', 2_000), word('tea', 1_000), word('eat', 1_000)]);
    expect(r.slowest?.word).toBe('great');
    expect(r.fastest?.word).toBe('tea');
    expect(r.longest?.word).toBe('great');
    expect(r.shortest?.word).toBe('tea');
  });

  it('counts how many other words tied each stat', () => {
    const r = computeResults([word('great', 2_000), word('water', 2_000), word('tea', 1_000), word('orchard', 500), word('reading', 3_000)]);
    expect(r.longest?.word).toBe('orchard');
    expect(r.ties).toEqual({ longest: 1, shortest: 0, fastest: 0, slowest: 0 });
    const tied = computeResults([word('great', 2_000), word('water', 2_000), word('arena', 2_000)]);
    expect(tied.ties).toEqual({ longest: 2, shortest: 2, fastest: 2, slowest: 2 });
  });

  const none = { words: 0, fastest: null, slowest: null, longest: null, shortest: null, ties: { fastest: 0, slowest: 0, longest: 0, shortest: 0 } };

  it('ignores skips entirely', () => {
    expect(computeResults([skip, skip])).toEqual(none);
  });

  it('handles zero words', () => {
    expect(computeResults([])).toEqual(none);
  });

  it('formats times as seconds with one decimal', () => {
    expect(formatSeconds(3_412)).toBe('3.4s');
    expect(formatSeconds(11_250)).toBe('11.3s');
    expect(formatSeconds(0)).toBe('0.0s');
    expect(formatSeconds(999)).toBe('1.0s');
  });

  it('shows letters in lowercase', () => {
    expect(formatLetters(['r', 'h', 'd'])).toBe('r h d');
  });
});

describe('word length distribution', () => {
  it('counts words per length, filling gaps with zero and ignoring skips', () => {
    const records = [word('water', 1), skip, word('great', 1), word('orchard', 1), word('tea', 1)];
    expect(lengthDistribution(records)).toEqual([
      { length: 3, count: 1 },
      { length: 4, count: 0 },
      { length: 5, count: 2 },
      { length: 6, count: 0 },
      { length: 7, count: 1 },
    ]);
  });

  it('is empty with no words', () => {
    expect(lengthDistribution([skip])).toEqual([]);
  });
});
