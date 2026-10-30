import './style.css';
import { loadWordLists, type WordLists } from './game/dictionary';
import { createSetGenerator, type SetGenerator } from './game/generator';
import { litLetters } from './game/letters';
import { DURATION_MS, isMode, MODES, Session, type Mode } from './game/session';
import { computeResults, formatLetters, formatSeconds, lengthDistribution, type WordRecord } from './game/stats';
import * as store from './game/storage';
import { describeRejection } from './game/validate';

type Screen = 'home' | 'ready' | 'playing' | 'results';

const $ = <T extends HTMLElement>(id: string) => document.getElementById(id) as T;
const app = $('app');
const brandEl = $('brand');
const timerEl = $('timer');
const countEl = $('count');
const variationsEl = $('variations');
const readyModeEl = $('ready-mode');
const readySecondsEl = $('ready-seconds');
const readyBestEl = $('ready-best');
const startEl = $<HTMLButtonElement>('start');
const modeIconEl = $('mode-icon');
const lettersEl = $('letters');
const entry = $<HTMLInputElement>('entry');
const feedbackEl = $('feedback');
const trailEl = $('trail');
const statsEl = $('stats');
const summaryEl = $('summary');
const lengthsEl = $('lengths');
const lengthBarsEl = $('length-bars');
const lengthTableEl = $('length-table');
const lengthReadoutEl = $('length-readout');
const historyEl = $('history');
const againEl = $('again');
const keysEl = $('keys');
const themeEl = $('theme');
const howtoEl = $<HTMLDialogElement>('howto');
const howtoOpenEl = $('howto-open');
const howtoCloseEl = $('howto-close');
const liveEl = $('live');

const TRAIL_LENGTH = 5;
/** Height of the tallest bar in the word-length chart; the plot leaves room above it for the count. */
const BAR_MAX_REM = 4.5;
/** Ignore play-again keys briefly so a last-second Enter doesn't skip the results. */
const RESULTS_GRACE_MS = 600;

const MODE_LABELS: Record<Mode, string> = {
  '2': '2 letters',
  '3': '3 letters',
  '4': '4 letters',
  combo: 'combo · 2, 3 or 4 letters',
};

/** Single-key shortcuts on the home screen. */
const MODE_KEYS: Record<string, Mode> = { '2': '2', '3': '3', '4': '4', c: 'combo' };

let lists: WordLists | null = null;
let generator: SetGenerator | null = null;
let loadFailed = false;
/** The home page starts on 2; after a game it returns to the variation just played. */
let mode: Mode = '2';
let session: Session | null = null;
let screen: Screen = 'home';
let tick = 0;
let resultsShownAt = 0;

const now = () => performance.now();
const isTouch = () => window.matchMedia('(pointer: coarse)').matches;

// ---------- screens ----------

function setScreen(next: Screen): void {
  screen = next;
  app.dataset.screen = next;
  entry.disabled = next !== 'playing';
  if (next !== 'playing') window.clearInterval(tick);
  renderFooter();
}

function goHome(): void {
  session = null;
  setScreen('home');
  variationButton(mode)?.focus({ preventScroll: true });
  announce('stitchy. choose a variation.');
}

function chooseMode(next: Mode): void {
  mode = next;
  goReady();
}

/** The "how long / press enter" screen. The set isn't shown until the clock starts. */
function goReady(): void {
  session = null;
  setScreen('ready');
  readyModeEl.textContent = MODE_LABELS[mode];
  readySecondsEl.textContent = String(DURATION_MS / 1000);
  const best = store.getBest(mode);
  readyBestEl.textContent = best === null ? '' : `best ${best} ${best === 1 ? 'word' : 'words'}`;
  renderReadyState();
  startEl.focus({ preventScroll: true });
  announce(`${MODE_LABELS[mode]}. ${DURATION_MS / 1000} seconds. ${isTouch() ? 'tap' : 'press enter'} to start.`);
}

function renderReadyState(): void {
  if (screen !== 'ready') return;
  const loaded = lists !== null;
  startEl.disabled = !loaded;
  if (loadFailed) startEl.textContent = "couldn't load the word list. refresh to try again.";
  else if (!loaded) startEl.textContent = 'loading words…';
  else if (isTouch()) startEl.textContent = 'tap to start';
  else startEl.replaceChildren(text('press '), kbd('enter'), text(' to start'));
}

function startGame(): void {
  if (screen !== 'ready' || !lists || !generator) return;
  session = new Session(mode, { dictionary: lists.dictionary, generator });
  // Enable and focus the input inside the same gesture so mobile keyboards open.
  setScreen('playing');
  entry.value = '';
  clearFeedback();
  trailEl.replaceChildren();
  session.start(now());
  tick = window.setInterval(onTick, 100);
  renderClock();
  delete modeIconEl.dataset.size;
  renderLetters(true);
  focusEntry();
  announce(`go. letters ${formatLetters(session.current.letters)}.`);
}

function onTick(): void {
  if (!session) return;
  if (session.isOver(now())) finish();
  else renderClock();
}

function finish(): void {
  if (!session) return;
  setScreen('results');
  resultsShownAt = now();
  entry.blur();
  renderResults(session);
  againEl.focus({ preventScroll: true });
}

function playAgain(): void {
  if (now() - resultsShownAt >= RESULTS_GRACE_MS) goReady();
}

// ---------- actions ----------

function submit(): void {
  if (!session || screen !== 'playing') return;
  const t = now();
  if (session.isOver(t)) return finish();
  const result = session.submit(entry.value, t);
  if (result.ok) {
    accept(result.record);
  } else if (result.reason === 'over') {
    finish();
  } else {
    const reason = describeRejection(result);
    reject(reason);
    announce(reason);
  }
}

function accept(record: WordRecord): void {
  if (!session) return;
  entry.value = '';
  clearFeedback();
  countEl.textContent = String(session.words);
  restartAnimation(countEl, 'bump', 400);
  const li = document.createElement('li');
  li.textContent = record.word;
  li.className = 'new';
  trailEl.prepend(li);
  while (trailEl.children.length > TRAIL_LENGTH) trailEl.lastElementChild?.remove();
  renderLetters(true);
  announce(`${record.word}. ${session.words} ${session.words === 1 ? 'word' : 'words'}. next letters ${formatLetters(session.current.letters)}.`);
}

function reject(reason: string): void {
  // Keep the text so the player can fix it.
  showFeedback(reason);
  restartAnimation(entry, 'shake', 200);
}

function skip(): void {
  if (!session || screen !== 'playing') return;
  if (!session.skip(now())) return finish();
  renderClock();
  entry.value = '';
  clearFeedback();
  renderLetters(true);
  announce(`skipped, minus 2 seconds. letters ${formatLetters(session.current.letters)}.`);
}

// ---------- rendering ----------

function variationButtons(): HTMLButtonElement[] {
  return [...variationsEl.querySelectorAll<HTMLButtonElement>('button[data-mode]')];
}

function variationButton(m: Mode): HTMLButtonElement | undefined {
  return variationButtons().find((b) => b.dataset.mode === m);
}

interface Hint {
  key: string;
  label: string;
  run: () => void;
}

function renderFooter(): void {
  const hints: Record<Screen, Hint[]> = {
    home: [],
    ready: [
      { key: 'enter', label: 'start', run: startGame },
      { key: 'esc', label: 'back', run: goHome },
    ],
    playing: [
      { key: 'tab', label: 'skip', run: skip },
      { key: 'esc', label: 'restart', run: goReady },
      { key: 'enter', label: 'submit', run: submit },
    ],
    results: [
      { key: 'enter', label: 'play again', run: goReady },
      { key: 'esc', label: 'home', run: goHome },
    ],
  };
  const nodes: Node[] = [];
  hints[screen].forEach((hint, i) => {
    if (i) nodes.push(span('dot', '·'));
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'key';
    btn.append(kbd(hint.key), text(` ${hint.label}`));
    // Keep focus (and the mobile keyboard) on the input while playing.
    btn.addEventListener('pointerdown', (e) => {
      if (document.activeElement === entry) e.preventDefault();
    });
    btn.addEventListener('click', () => {
      hint.run();
      if (screen === 'playing') focusEntry();
    });
    nodes.push(btn);
  });
  keysEl.replaceChildren(...nodes);
  for (const dot of keysEl.querySelectorAll('.dot')) dot.setAttribute('aria-hidden', 'true');
}

/**
 * The spinning shape from the home page that matches the current set size
 * (in combo it changes with each set). Kept as-is when the size doesn't change,
 * so the rotation doesn't restart on every word.
 */
function renderSetIcon(): void {
  if (!session) return;
  const size = String(session.current.letters.length);
  if (modeIconEl.dataset.size === size) return;
  const icon = isMode(size) ? variationButton(size)?.querySelector('.icon') : null;
  modeIconEl.replaceChildren(...(icon ? [icon.cloneNode(true)] : []));
  modeIconEl.dataset.size = size;
}

function renderClock(): void {
  if (!session) return;
  timerEl.textContent = String(Math.ceil(session.remaining(now()) / 1000));
  countEl.textContent = String(session.words);
}

function renderLetters(fresh: boolean): void {
  if (!session) return;
  const letters = session.current.letters;
  const lit = litLetters(entry.value, letters);
  if (fresh || lettersEl.children.length !== letters.length) {
    lettersEl.replaceChildren(...letters.map((l) => span('', l)));
    // 2 sit in a line, 3 form a triangle, 4 a square (see .letters in style.css).
    lettersEl.dataset.count = String(letters.length);
    renderSetIcon();
    lettersEl.setAttribute('aria-label', `letters ${formatLetters(letters)}`);
    restartAnimation(lettersEl, 'enter', 200);
  }
  [...lettersEl.children].forEach((el, i) => el.classList.toggle('lit', lit[i]));
}

function renderResults(s: Session): void {
  const r = computeResults(s.records);
  const timed = (rec: WordRecord | null, ties: number) =>
    rec ? statBlockArgs(formatSeconds(rec.ms), rec, ties) : statBlockArgs('–');
  const sized = (rec: WordRecord | null, ties: number) =>
    rec ? statBlockArgs(String(rec.word.length), rec, ties) : statBlockArgs('–');

  statsEl.replaceChildren(
    statBlock('words', statBlockArgs(String(r.words))),
    statBlock('longest word', sized(r.longest, r.ties.longest)),
    statBlock('shortest word', sized(r.shortest, r.ties.shortest)),
    statBlock('fastest', timed(r.fastest, r.ties.fastest)),
    statBlock('slowest', timed(r.slowest, r.ties.slowest)),
  );

  const { previous, isNewBest } = store.recordWords(s.mode, r.words);
  renderLengths(s);

  summaryEl.replaceChildren(
    text('mode '),
    bold(s.mode === 'combo' ? 'combo' : `${s.mode} letters`),
    text(' · best '),
    bold(String(isNewBest ? r.words : (previous ?? 0))),
    text(' words'),
  );
  if (isNewBest) summaryEl.append(span('new-best', ' · new best'));

  historyEl.replaceChildren(
    ...s.records.map((rec) => {
      const li = document.createElement('li');
      const set = span('set', formatLetters(rec.letters));
      if (rec.kind === 'word') {
        li.append(set, span('word', rec.word), span('time', formatSeconds(rec.ms)));
      } else {
        li.className = 'skipped';
        const examples = rec.examples.length ? ` · e.g. ${rec.examples.join(', ')}` : '';
        li.append(set, span('word', `skipped${examples}`));
      }
      return li;
    }),
  );

  const best = isNewBest ? ' new personal best.' : '';
  announce(`time. ${r.words} words.${best} press enter to play again.`);
}

/** Bar chart of how many words had each length. Hidden when no words were found. */
function renderLengths(s: Session): void {
  const buckets = lengthDistribution(s.records);
  lengthsEl.hidden = buckets.length === 0;
  const max = Math.max(1, ...buckets.map((b) => b.count));
  const plural = (n: number, one: string) => `${n} ${one}${n === 1 ? '' : 's'}`;

  lengthReadoutEl.textContent = '';
  lengthBarsEl.replaceChildren(
    ...buckets.map(({ length, count }) => {
      const col = document.createElement('div');
      col.className = count ? 'col' : 'col empty';
      // Hover (or tap) shows the exact count next to the caption.
      const tip = `· ${plural(count, 'word')} with ${length} letters`;
      col.addEventListener('pointerenter', () => (lengthReadoutEl.textContent = tip));
      col.addEventListener('pointerleave', () => (lengthReadoutEl.textContent = ''));
      const bar = document.createElement('div');
      bar.className = 'bar';
      bar.style.height = `${(count / max) * BAR_MAX_REM}rem`;
      const plot = document.createElement('div');
      plot.className = 'plot';
      plot.append(span('n', count ? String(count) : ''), bar);
      col.append(plot, span('len', String(length)));
      return col;
    }),
  );

  // Screen readers get the same numbers as a table.
  const row = (cells: string[], tag: 'th' | 'td') => {
    const tr = document.createElement('tr');
    for (const c of cells) {
      const cell = document.createElement(tag);
      cell.textContent = c;
      tr.append(cell);
    }
    return tr;
  };
  lengthTableEl.replaceChildren(
    row(['letters', 'words'], 'th'),
    ...buckets.map((b) => row([String(b.length), String(b.count)], 'td')),
  );
}

/** The value, the first word that achieved it, and "+N more" when other words tied. */
function statBlockArgs(value: string, rec?: WordRecord, ties = 0): [string, Node[]] {
  if (!rec) return [value, []];
  const detail: Node[] = [bold(`"${rec.word}"`)];
  if (ties) detail.push(text(` +${ties} more`));
  return [value, detail];
}

function statBlock(label: string, [value, detail]: [string, Node[]]): HTMLElement {
  const div = document.createElement('div');
  div.className = 'stat';
  const dt = document.createElement('dt');
  dt.textContent = label;
  const dd = document.createElement('dd');
  dd.className = 'value';
  dd.textContent = value;
  div.append(dt, dd);
  if (detail.length) {
    const d = document.createElement('dd');
    d.className = 'detail';
    d.append(...detail);
    div.append(d);
  }
  return div;
}

const text = (s: string) => document.createTextNode(s);
const bold = (s: string) => {
  const b = document.createElement('b');
  b.textContent = s;
  return b;
};
const kbd = (s: string) => {
  const k = document.createElement('kbd');
  k.textContent = s;
  return k;
};
const span = (cls: string, s: string) => {
  const el = document.createElement('span');
  if (cls) el.className = cls;
  el.textContent = s;
  return el;
};

function showFeedback(message: string): void {
  feedbackEl.textContent = message;
}

function clearFeedback(): void {
  feedbackEl.textContent = '';
}

/** Re-triggers a CSS animation class and removes it after `ms`. */
function restartAnimation(el: HTMLElement, cls: string, ms: number): void {
  el.classList.remove(cls);
  void el.offsetWidth;
  el.classList.add(cls);
  window.setTimeout(() => el.classList.remove(cls), ms);
}

let announceFrame = 0;
function announce(message: string): void {
  // Clear first so repeated messages ("not a word" twice) are re-announced.
  cancelAnimationFrame(announceFrame);
  liveEl.textContent = '';
  announceFrame = requestAnimationFrame(() => (liveEl.textContent = message));
}

function focusEntry(): void {
  if (!entry.disabled) entry.focus({ preventScroll: true });
}

// ---------- home selection ----------

function selectedMode(): Mode {
  const focused = document.activeElement as HTMLElement | null;
  const m = focused?.closest<HTMLButtonElement>('#variations button')?.dataset.mode;
  return isMode(m) ? m : mode;
}

function moveSelection(step: number): void {
  const i = MODES.indexOf(selectedMode());
  variationButton(MODES[(i + step + MODES.length) % MODES.length])?.focus();
}

// ---------- theme ----------

function applyTheme(pref: store.ThemePref): void {
  if (pref === 'dark') document.documentElement.dataset.theme = 'dark';
  else delete document.documentElement.dataset.theme;
  // The button names the theme it switches to.
  const other = pref === 'dark' ? 'light' : 'dark';
  themeEl.textContent = `${other} theme`;
  themeEl.setAttribute('aria-label', `switch to ${other} theme`);
}

themeEl.addEventListener('click', () => {
  const next: store.ThemePref = store.getTheme() === 'dark' ? 'light' : 'dark';
  store.setTheme(next);
  applyTheme(next);
  focusEntry();
});

// ---------- how to play ----------

howtoOpenEl.addEventListener('click', () => howtoEl.showModal());
howtoCloseEl.addEventListener('click', () => howtoEl.close());

// Clicking the backdrop closes it. A click on the dialog's own padding also targets
// the dialog, so compare against its box rather than trusting the target alone.
howtoEl.addEventListener('click', (e) => {
  if (e.target !== howtoEl) return;
  const box = howtoEl.getBoundingClientRect();
  const outside =
    e.clientX < box.left || e.clientX > box.right || e.clientY < box.top || e.clientY > box.bottom;
  if (outside) howtoEl.close();
});

// Focus returns to the trigger, which is where the reader left off.
howtoEl.addEventListener('close', () => howtoOpenEl.focus());

// ---------- input ----------

entry.addEventListener('input', () => {
  clearFeedback();
  entry.classList.remove('shake');
  if (session?.isOver(now())) return finish();
  renderLetters(false);
});

document.addEventListener('keydown', (e) => {
  if (e.isComposing || e.metaKey || e.ctrlKey || e.altKey) return;
  // The dialog owns the keyboard while it's open, so `c` doesn't start a game
  // behind it. Escape closes it natively.
  if (howtoEl.open) return;
  const onButton = e.target instanceof HTMLButtonElement;

  switch (screen) {
    case 'home': {
      if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
        e.preventDefault();
        moveSelection(e.key === 'ArrowDown' ? 1 : -1);
      } else if (e.key === 'Enter' && !onButton) {
        e.preventDefault();
        chooseMode(selectedMode());
      } else if (MODE_KEYS[e.key.toLowerCase()]) {
        e.preventDefault();
        chooseMode(MODE_KEYS[e.key.toLowerCase()]);
      }
      return;
    }
    case 'ready': {
      if (e.key === 'Enter') {
        e.preventDefault();
        startGame();
      } else if (e.key === 'Escape') {
        e.preventDefault();
        goHome();
      }
      return;
    }
    case 'playing': {
      const inEntry = e.target === entry;
      if (e.key === 'Escape') {
        e.preventDefault();
        goReady();
      } else if (e.key === 'Tab' && !e.shiftKey && inEntry) {
        e.preventDefault();
        skip();
      } else if (e.key === 'Enter' && inEntry) {
        e.preventDefault();
        submit();
      } else if (!inEntry && e.key.length === 1 && /[a-z]/i.test(e.key)) {
        // Typing a letter anywhere goes to the input.
        focusEntry();
      }
      return;
    }
    case 'results': {
      if ((e.key === 'Enter' || e.key === 'Tab') && !e.shiftKey) {
        e.preventDefault();
        playAgain();
      } else if (e.key === 'Escape') {
        e.preventDefault();
        goHome();
      }
      return;
    }
  }
});

variationsEl.addEventListener('click', (e) => {
  const btn = (e.target as HTMLElement).closest<HTMLButtonElement>('button[data-mode]');
  if (btn && isMode(btn.dataset.mode)) chooseMode(btn.dataset.mode);
});

brandEl.addEventListener('click', goHome);
startEl.addEventListener('click', startGame);
againEl.addEventListener('click', goReady);

// Tapping empty space while playing refocuses the input (brings the keyboard back on mobile).
document.addEventListener('pointerup', (e) => {
  if (screen !== 'playing') return;
  if ((e.target as HTMLElement).closest('button, a, input')) return;
  focusEntry();
});

// ---------- boot ----------

/** SVG <animate> ignores prefers-reduced-motion, so freeze the combo morph on the triangle. */
function respectReducedMotion(): void {
  if (!window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
  for (const svg of document.querySelectorAll<SVGSVGElement>('svg.icon-combo')) {
    svg.pauseAnimations();
    svg.setCurrentTime(3.2);
  }
}

async function boot(): Promise<void> {
  applyTheme(store.getTheme());
  respectReducedMotion();
  goHome();
  try {
    lists = await loadWordLists(import.meta.env.BASE_URL);
    generator = createSetGenerator(lists.common);
  } catch (err) {
    console.error(err);
    loadFailed = true;
  }
  renderReadyState();
}

void boot();
