import type { Mode } from './session';

// localStorage can be missing or throw (private mode, blocked storage), so
// every access is guarded and the game works without it.

const KEYS = {
  // Most words in one game, per mode. (The old score-based bests lived under 'stitchy:bests'.)
  bests: 'stitchy:best-words',
  theme: 'stitchy:theme',
} as const;

export type ThemePref = 'dark' | 'light';

function storage(): Storage | null {
  try {
    return globalThis.localStorage ?? null;
  } catch {
    return null;
  }
}

function read(key: string): string | null {
  try {
    return storage()?.getItem(key) ?? null;
  } catch {
    return null;
  }
}

function write(key: string, value: string): void {
  try {
    storage()?.setItem(key, value);
  } catch {
    // ignore: storage is a convenience only
  }
}

function readBests(): Partial<Record<Mode, number>> {
  try {
    const parsed: unknown = JSON.parse(read(KEYS.bests) ?? '{}');
    return parsed && typeof parsed === 'object' ? (parsed as Partial<Record<Mode, number>>) : {};
  } catch {
    return {};
  }
}

export function getBest(mode: Mode): number | null {
  const value = readBests()[mode];
  return typeof value === 'number' && Number.isFinite(value) ? value : null;
}

/** Saves `words` if it beats the stored best. Returns the previous best and whether it was beaten. */
export function recordWords(mode: Mode, words: number): { previous: number | null; isNewBest: boolean } {
  const previous = getBest(mode);
  const isNewBest = words > 0 && (previous === null || words > previous);
  if (isNewBest) write(KEYS.bests, JSON.stringify({ ...readBests(), [mode]: words }));
  return { previous, isNewBest };
}

export function getTheme(): ThemePref {
  const value = read(KEYS.theme);
  return value === 'dark' ? 'dark' : 'light';
}

export function setTheme(theme: ThemePref): void {
  write(KEYS.theme, theme);
}
