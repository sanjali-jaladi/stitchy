import { isLettersOnly } from './letters';

export interface Dictionary {
  has(word: string): boolean;
  readonly size: number;
}

export interface WordLists {
  /** Large permissive list, used only to check spelling. */
  dictionary: Dictionary;
  /** Smaller list of common words, used to generate letter sets. */
  common: string[];
}

/** One word per line; anything that isn't plain lowercase letters is dropped. */
export function parseWordList(text: string): string[] {
  const words: string[] = [];
  for (const line of text.split('\n')) {
    const word = line.trim().toLowerCase();
    if (word && isLettersOnly(word)) words.push(word);
  }
  return words;
}

/** Exact lookup only: no stemming, fuzzy matching or case folding beyond lowercase. */
export function createDictionary(words: Iterable<string>): Dictionary {
  return new Set(words);
}

export async function loadWordLists(
  baseUrl: string,
  fetchImpl: typeof fetch = fetch,
): Promise<WordLists> {
  const get = async (name: string) => {
    const res = await fetchImpl(`${baseUrl}${name}`);
    if (!res.ok) throw new Error(`failed to load ${name}: ${res.status}`);
    return parseWordList(await res.text());
  };
  const [dictionaryWords, common] = await Promise.all([get('dictionary.txt'), get('common.txt')]);
  const dictionary = createDictionary(dictionaryWords);
  // Every generated set must be solvable with words the validator accepts.
  return { dictionary, common: common.filter((w) => dictionary.has(w)) };
}
