import { readFileSync } from 'node:fs';
import { createDictionary, parseWordList } from '../src/game/dictionary';

const read = (name: string) => readFileSync(new URL(`../public/${name}`, import.meta.url), 'utf8');

/** The real word lists shipped in public/. */
export function realLists() {
  const dictionary = createDictionary(parseWordList(read('dictionary.txt')));
  const common = parseWordList(read('common.txt')).filter((w) => dictionary.has(w));
  return { dictionary, common };
}
