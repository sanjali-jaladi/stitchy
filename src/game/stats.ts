export interface WordRecord {
  kind: 'word';
  word: string;
  letters: string[];
  /** Time from the set appearing to this word being accepted, rejected attempts included. */
  ms: number;
}

export interface SkipRecord {
  kind: 'skip';
  letters: string[];
  examples: string[];
}

export type RoundRecord = WordRecord | SkipRecord;

export interface Results {
  words: number;
  fastest: WordRecord | null;
  slowest: WordRecord | null;
  longest: WordRecord | null;
  shortest: WordRecord | null;
  /** How many other words tied each stat (e.g. another word just as long as the longest). */
  ties: Record<'fastest' | 'slowest' | 'longest' | 'shortest', number>;
}

/** Skips are excluded. On ties the first word achieved wins. */
export function computeResults(records: readonly RoundRecord[]): Results {
  const words = records.filter((r): r is WordRecord => r.kind === 'word');
  const best = (better: (a: WordRecord, b: WordRecord) => boolean) =>
    words.reduce<WordRecord | null>((acc, r) => (acc === null || better(r, acc) ? r : acc), null);
  const fastest = best((a, b) => a.ms < b.ms);
  const slowest = best((a, b) => a.ms > b.ms);
  const longest = best((a, b) => a.word.length > b.word.length);
  const shortest = best((a, b) => a.word.length < b.word.length);
  const others = (winner: WordRecord | null, same: (r: WordRecord) => boolean) =>
    winner ? words.filter((r) => r !== winner && same(r)).length : 0;
  return {
    words: words.length,
    fastest,
    slowest,
    longest,
    shortest,
    ties: {
      fastest: others(fastest, (r) => r.ms === fastest?.ms),
      slowest: others(slowest, (r) => r.ms === slowest?.ms),
      longest: others(longest, (r) => r.word.length === longest?.word.length),
      shortest: others(shortest, (r) => r.word.length === shortest?.word.length),
    },
  };
}

export interface LengthBucket {
  length: number;
  count: number;
}

/**
 * How many valid words had each length, from the shortest to the longest found.
 * Lengths in between with no words are included as 0 so gaps stay visible.
 */
export function lengthDistribution(records: readonly RoundRecord[]): LengthBucket[] {
  const lengths = records.flatMap((r) => (r.kind === 'word' ? [r.word.length] : []));
  if (!lengths.length) return [];
  const min = Math.min(...lengths);
  const max = Math.max(...lengths);
  const buckets: LengthBucket[] = [];
  for (let length = min; length <= max; length++) {
    buckets.push({ length, count: lengths.filter((l) => l === length).length });
  }
  return buckets;
}

/** `3412` → `"3.4s"`. */
export function formatSeconds(ms: number): string {
  return `${(Math.round(ms / 100) / 10).toFixed(1)}s`;
}

export function formatLetters(letters: readonly string[]): string {
  return letters.join(' ');
}
