// Pure game logic: daily word, tries, guess evaluation, saved state. No DOM here.
//
// Rules (inspired by morsle.fun):
// - 25 tries. Each Play costs one try and grants one guess (a blind Guess costs a try too).
// - Speed starts at 35 WPM and drops 5 WPM every 4 tries, down to 10 (35 ×4, 30 ×4 ... 15 ×4, 10 ×5).
// - Blanks are allowed. Correct letters turn green; no other hints.
// 🐣 Easy: its own daily word, slower speeds (20 → 5 WPM) and the word's Morse as a hint after 5 tries.
import { ANSWERS } from './words.js';
import { getMode } from './mode.js';

export const WORD_LENGTH = 5;
export const MAX_TRIES = 25;
export const BLANK = ' ';

const EPOCH = Date.UTC(2026, 0, 1);
const DAY_MS = 24 * 60 * 60 * 1000;

// 'YYYY-MM-DD' in UTC: same for every player, changes at 00:00 UTC.
export function todayKey(now = new Date()) {
  return now.toISOString().slice(0, 10);
}

// Easy uses the same list, half a list further on: a different word than Normal every day.
export function dailyWord(dayKey = todayKey(), mode = getMode()) {
  const dayNumber = Math.floor((Date.parse(dayKey) - EPOCH) / DAY_MS)
    + (mode === 'easy' ? Math.floor(ANSWERS.length / 2) : 0);
  const i = ((dayNumber % ANSWERS.length) + ANSWERS.length) % ANSWERS.length;
  return ANSWERS[i];
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
