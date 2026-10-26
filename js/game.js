// Pure game logic: daily word, tries, guess evaluation, saved state. No DOM here.
//
// Rules (inspired by morsle.fun):
// - 25 tries. Each Play costs one try and grants one guess (a blind Guess costs a try too).
// - Speed starts at 35 WPM and drops 5 WPM every 4 tries, down to 10 (35 ×4, 30 ×4 ... 15 ×4, 10 ×5).
// - Blanks are allowed. Correct letters turn green; no other hints.
// - Normal: 5 random letters (not a word) since RANDOM_FROM. 🐣 Easy: a real word,
//   slower speeds (20 → 5 WPM) and the word's Morse as a hint after 5 tries.
import { ANSWERS } from './words.js';
import { getMode } from './mode.js';

export const WORD_LENGTH = 5;
export const MAX_TRIES = 25;
export const BLANK = ' ';

const EPOCH = Date.UTC(2026, 0, 1);
const DAY_MS = 24 * 60 * 60 * 1000;

// The day follows Swedish time: a new Daily at 00:00 in Sweden, for every player wherever they are
// (the database uses the same clock, see _today() in schema.sql).
const TIME_ZONE = 'Europe/Stockholm';
const swedishDate = new Intl.DateTimeFormat('en-CA', { timeZone: TIME_ZONE, year: 'numeric', month: '2-digit', day: '2-digit' });
const swedishClock = new Intl.DateTimeFormat('en-US', {
  timeZone: TIME_ZONE, hourCycle: 'h23', year: 'numeric', month: 'numeric', day: 'numeric',
  hour: 'numeric', minute: 'numeric', second: 'numeric',
});

// 'YYYY-MM-DD' in Sweden.
export function todayKey(now = new Date()) {
  return swedishDate.format(now); // en-CA formats as 2026-10-16
}

// Swedish time minus UTC at that moment, in ms (+1 h in winter, +2 h in summer).
function swedishOffset(ms) {
  const p = Object.fromEntries(swedishClock.formatToParts(ms).map(({ type, value }) => [type, Number(value)]));
  return Date.UTC(p.year, p.month - 1, p.day, p.hour, p.minute, p.second) - Math.floor(ms / 1000) * 1000;
}

// The moment it is 00:00 in Sweden on that day.
function swedishMidnight(dayKey) {
  const utcMidnight = Date.parse(dayKey);
  return utcMidnight - swedishOffset(utcMidnight);
}

// Normal switched from words to random letters on this day (earlier days keep their word).
const RANDOM_FROM = '2026-10-17';

// 5 letters A–Z from a random generator seeded with the day: the same for everyone, new every day.
function randomLetters(dayNumber) {
  let seed = (dayNumber * 2654435761) >>> 0; // mulberry32
  const next = () => {
    seed = (seed + 0x6d2b79f5) >>> 0;
    let t = seed;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  return Array.from({ length: WORD_LENGTH }, () => String.fromCharCode(65 + Math.floor(next() * 26))).join('');
}

// 🎃 Special Daily words on these days, per mode: Normal instead of random letters, Easy instead of its list.
const SPECIAL_WORDS = {
  normal: {
    '2026-10-27': 'GHOST',
    '2026-10-28': 'WITCH',
    '2026-10-29': 'SKULL',
    '2026-10-30': 'CRYPT',
  },
  easy: { // "trick or treat" week, weekend included (Easy is open every day)
    '2026-10-27': 'CANDY',
    '2026-10-28': 'BROOM',
    '2026-10-29': 'MAGIC',
    '2026-10-30': 'SPELL',
    '2026-10-31': 'TRICK',
    '2026-11-01': 'TREAT',
  },
};

export function dailyWord(dayKey = todayKey(), mode = getMode()) {
  const days = Math.floor((Date.parse(dayKey) - EPOCH) / DAY_MS);
  const special = SPECIAL_WORDS[mode === 'easy' ? 'easy' : 'normal'][dayKey];
  if (special) return special;
  if (mode !== 'easy' && dayKey >= RANDOM_FROM) return randomLetters(days);
  // Words: Easy uses the same list half a list further on, so it never matches an old Normal day.
  const dayNumber = days + (mode === 'easy' ? Math.floor(ANSWERS.length / 2) : 0);
  const i = ((dayNumber % ANSWERS.length) + ANSWERS.length) % ANSWERS.length;
  return ANSWERS[i];
}

// ---------- Weekends: Normal Daily is Monday–Friday (Swedish time). Easy and Turbo are open every day. ----------

const isWeekendDay = (dayKey) => [0, 6].includes(new Date(dayKey).getUTCDay());
const addDays = (dayKey, n) => new Date(Date.parse(dayKey) + n * DAY_MS).toISOString().slice(0, 10);

// true on Saturday/Sunday in Normal: no Daily today.
export const isWeekendBreak = (dayKey = todayKey()) => getMode() === 'normal' && isWeekendDay(dayKey);

// The most recent day with a Daily (today, or Friday during the weekend break).
export function lastDailyDay(dayKey = todayKey()) {
  while (isWeekendBreak(dayKey)) dayKey = addDays(dayKey, -1);
  return dayKey;
}

// When the next Daily starts (00:00 Swedish time; Normal skips the weekend).
export function nextDailyAt(now = new Date()) {
  let day = addDays(todayKey(now), 1);
  while (isWeekendBreak(day)) day = addDays(day, 1);
  return swedishMidnight(day);
}

// ms → '05:12:09', or '2d 05:12:09' when it's more than a day away.
export function formatCountdown(ms) {
  const s = Math.max(0, Math.floor(ms / 1000));
  const d = Math.floor(s / 86400);
  const hms = [Math.floor(s / 3600) % 24, Math.floor(s / 60) % 60, s % 60].map((n) => String(n).padStart(2, '0')).join(':');
  return d ? `${d}d ${hms}` : hms;
}

export const TRIES_PER_SPEED = 4;
const SPEEDS = {
  normal: { start: 35, step: 5, min: 10 }, // 35, 30, 25, 20, 15, 10
  easy:   { start: 20, step: 3, min: 5 },  // 20, 17, 14, 11, 8, 5
};

// Try 1–4 → first speed, 5–8 → next … the last speed covers tries 21–25.
export function wpmForTry(tryNumber) {
  const { start, step, min } = SPEEDS[getMode()];
  return Math.max(min, start - step * Math.floor((tryNumber - 1) / TRIES_PER_SPEED));
}

// 🐣 Easy: the word's Morse appears once 5 tries are used up.
export const HINT_AFTER = 5;
export function showsHint(state) {
  return getMode() === 'easy' && state.status === 'playing'
    && (state.tries > HINT_AFTER || (state.tries === HINT_AFTER && !state.canGuess));
}

// true per position where the letter is right.
export function evaluate(guess, answer) {
  return [...answer].map((letter, i) => guess[i] === letter);
}

// Letters found so far: answer letter where any guess was right, else BLANK.
export function knownLetters(state) {
  const answer = dailyWord(state.day);
  return [...answer].map((letter, i) =>
    state.guesses.some((g) => g.word[i] === letter) ? letter : BLANK);
}

// ---------- Saved state (one game per day, per callsign) ----------

// Each callsign has its own game, so several players can share a device. Easy is saved separately.
const keyFor = (owner) => `morse-web:game:${owner}${getMode() === 'easy' ? ':easy' : ''}`;

function newState(day, owner) {
  return {
    day,
    owner,             // callsign this game belongs to
    mode: getMode(),   // 'normal' | 'easy'
    tries: 0,          // plays used
    canGuess: false,   // one guess per play
    guesses: [],       // { word, tryNumber }; word uses BLANK for empty squares
    status: 'playing', // 'playing' | 'won' | 'lost'
    startedAt: null,
    finishedAt: null,
    pausedMs: 0,       // time spent away from the page (doesn't count)
    pausedAt: null,    // set while the page is hidden
    submitted: false,  // score saved on the server (or can't be: other device / day over)
    rank: null,        // rank today, from submit_score
  };
}

export function loadState(owner) {
  const day = todayKey();
  try {
    localStorage.removeItem('morse-web:game'); // old shared key from before per-callsign saves
    const saved = JSON.parse(localStorage.getItem(keyFor(owner)));
    if (saved?.day === day && typeof saved.tries === 'number') return saved;
  } catch {}
  return newState(day, owner);
}

export function saveState(state) {
  try {
    localStorage.setItem(keyFor(state.owner), JSON.stringify(state));
  } catch {}
}

// Uses a try. Returns the WPM to play at, or null if no tries are left.
export function useTry(state) {
  if (state.status !== 'playing' || state.tries >= MAX_TRIES) return null;
  state.tries++;
  state.canGuess = true;
  if (!state.startedAt) state.startedAt = Date.now();
  saveState(state);
  return wpmForTry(state.tries);
}

// Records the one guess for the current try. Returns the evaluation.
export function addGuess(state, word) {
  const answer = dailyWord(state.day);
  state.guesses.push({ word, tryNumber: state.tries });
  state.canGuess = false;

  if (word === answer) state.status = 'won';
  else if (state.tries >= MAX_TRIES) state.status = 'lost';

  if (state.status !== 'playing') state.finishedAt = Date.now();
  saveState(state);
  return evaluate(word, answer);
}

// Score for the leaderboard: tries used, or MAX_TRIES + 1 for a loss.
export function score(state) {
  return state.status === 'won' ? state.tries : MAX_TRIES + 1;
}

// Active playing time: wall-clock time minus time spent away from the page.
export function elapsedMs(state) {
  if (!state.startedAt) return 0;
  const end = state.finishedAt ?? Date.now();
  const away = (state.pausedMs ?? 0) + (state.pausedAt ? end - state.pausedAt : 0);
  return end - state.startedAt - away;
}

// Page hidden (phone locked, other tab, app switched): stop the clock.
export function pauseTimer(state) {
  if (state.status !== 'playing' || !state.startedAt || state.pausedAt) return;
  state.pausedAt = Date.now();
  saveState(state);
}

// Page visible again (also after the browser closed the page while away): add the away-time.
export function resumeTimer(state) {
  if (!state.pausedAt) return;
  state.pausedMs = (state.pausedMs ?? 0) + (Date.now() - state.pausedAt);
  state.pausedAt = null;
  saveState(state);
}

export function formatTime(ms) {
  const s = Math.floor(ms / 1000);
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
}
