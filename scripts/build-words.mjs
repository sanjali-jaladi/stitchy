// Generates the two word lists the game loads at runtime from SCOWL
// (via the `wordlist-english` package). Run with `npm run words`.
import { createRequire } from 'node:module';
import { writeFileSync } from 'node:fs';

const require = createRequire(import.meta.url);
const LETTERS_ONLY = /^[a-z]+$/; // drops proper nouns, abbreviations, accents, apostrophes

function load(variants, levels) {
  const out = new Set();
  for (const v of variants) {
    for (const l of levels) {
      for (const w of require(`wordlist-english/${v}-words-${l}.json`)) {
        if (LETTERS_ONLY.test(w)) out.add(w);
      }
    }
  }
  return out;
}

const ALL_LEVELS = [10, 20, 35, 40, 50, 55, 60, 70];
// Spelling validation: everything up to SCOWL size 70, all spelling variants.
const dictionary = load(['english', 'american', 'british', 'canadian', 'australian'], ALL_LEVELS);
// Set generation / example words: common words, up to SCOWL size 25. SCOWL has no
// tier between 20 and 35, so that is sizes 10 and 20. Widening this to 35 pulls in
// words like `ambidextrous`, which letter sets then get carved out of.
const COMMON_LEVELS = [10, 20];
const common = new Set(
  [...load(['english', 'american'], COMMON_LEVELS)].filter(
    (w) => w.length >= 3 && dictionary.has(w),
  ),
);

const write = (name, set) =>
  writeFileSync(new URL(`../public/${name}`, import.meta.url), [...set].sort().join('\n') + '\n');
write('dictionary.txt', dictionary);
write('common.txt', common);
console.log(`dictionary.txt: ${dictionary.size} words, common.txt: ${common.size} words`);
