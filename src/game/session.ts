import type { Dictionary } from './dictionary';
import type { LetterSet, Rng, SetGenerator, SetSize } from './generator';
import type { RoundRecord, WordRecord } from './stats';
import { validateWord, type Rejection } from './validate';

export type Mode = '2' | '3' | '4' | 'combo';
export const MODES: readonly Mode[] = ['2', '3', '4', 'combo'];

export const DURATION_MS = 120_000;
export const SKIP_PENALTY_MS = 2_000;

export function isMode(value: unknown): value is Mode {
  return typeof value === 'string' && (MODES as readonly string[]).includes(value);
}

export function sizeForMode(mode: Mode, rng: Rng = Math.random): SetSize {
  if (mode === 'combo') return (2 + Math.floor(rng() * 3)) as SetSize;
  return Number(mode) as SetSize;
}

export type SubmitResult =
  | { ok: true; record: WordRecord }
  | Rejection
  | { ok: false; reason: 'over' };

export interface SessionDeps {
  dictionary: Dictionary;
  generator: SetGenerator;
  rng?: Rng;
}

/**
 * One 120-second game. Time is always passed in (`now`, in ms) so the
 * session stays pure and testable; the UI supplies `performance.now()`.
 */
export class Session {
  readonly mode: Mode;
  current: LetterSet;
  readonly records: RoundRecord[] = [];

  private readonly deps: SessionDeps;
  private readonly used = new Set<string>();
  private readonly usedKeys = new Set<string>();
  private startedAt: number | null = null;
  private setShownAt = 0;
  private penaltyMs = 0;

  constructor(mode: Mode, deps: SessionDeps) {
    this.mode = mode;
    this.deps = deps;
    this.current = this.draw();
  }

  /** Valid words found so far. */
  get words(): number {
    return this.used.size;
  }

  get started(): boolean {
    return this.startedAt !== null;
  }

  /** Starts the clock (first keystroke). The first set's clock starts here too. */
  start(now: number): void {
    if (this.startedAt !== null) return;
    this.startedAt = now;
    this.setShownAt = now;
  }

  remaining(now: number): number {
    if (this.startedAt === null) return DURATION_MS;
    return Math.max(0, DURATION_MS - (now - this.startedAt) - this.penaltyMs);
  }

  isOver(now: number): boolean {
    return this.started && this.remaining(now) <= 0;
  }

  submit(input: string, now: number): SubmitResult {
    this.start(now);
    if (this.isOver(now)) return { ok: false, reason: 'over' };
    const result = validateWord(input, this.current.letters, this.deps.dictionary, this.used);
    // Rejected attempts leave the set's clock running.
    if (!result.ok) return result;
    const record: WordRecord = {
      kind: 'word',
      word: result.word,
      letters: this.current.letters,
      ms: now - this.setShownAt,
    };
    this.used.add(result.word);
    this.records.push(record);
    this.advance(now);
    return { ok: true, record };
  }

  /** Skips the current set for a 2s penalty. Skipped sets don't count toward timing stats. */
  skip(now: number): boolean {
    this.start(now);
    if (this.isOver(now)) return false;
    this.records.push({ kind: 'skip', letters: this.current.letters, examples: this.current.examples });
    this.penaltyMs += SKIP_PENALTY_MS;
    this.advance(now);
    return true;
  }

  private advance(now: number): void {
    this.current = this.draw();
    this.setShownAt = now;
  }

  private draw(): LetterSet {
    const set = this.deps.generator.next(sizeForMode(this.mode, this.deps.rng), this.usedKeys);
    this.usedKeys.add(set.key);
    return set;
  }
}
