// Pure game logic: daily word, tries, guess evaluation, saved state. No DOM here.
//
// Rules (inspired by morsle.fun):
// - 21 tries. Each Play costs one try and grants one guess.
// - Speed starts at 40 WPM and drops 5 WPM every 3 tries (40, 35, ... 10).
// - Blanks are allowed. Correct letters turn green; no other hints.
import { ANSWERS } from './words.js';

export const WORD_LENGTH = 5;
export const MAX_TRIES = 21;
export const BLANK = ' ';

const EPOCH = Date.UTC(2026, 0, 1);
const DAY_MS = 24 * 60 * 60 * 1000;

// 'YYYY-MM-DD' in UTC: same for every player, changes at 00:00 UTC.
export function todayKey(now = new Date()) {
  return now.toISOString().slice(0, 10);
}

export function dailyWord(dayKey = todayKey()) {
  const dayNumber = Math.floor((Date.parse(dayKey) - EPOCH) / DAY_MS);
  const i = ((dayNumber % ANSWERS.length) + ANSWERS.length) % ANSWERS.length;
  return ANSWERS[i];
}

// Try 1–3 → 40 WPM, 4–6 → 35 ... 19–21 → 10.
export function wpmForTry(tryNumber) {
  return 40 - 5 * Math.floor((tryNumber - 1) / 3);
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

// Each callsign has its own game, so several players can share a device.
const keyFor = (owner) => `morse-web:game:${owner}`;

function newState(day, owner) {
  return {
    day,
    owner,             // callsign this game belongs to
    tries: 0,          // plays used
    canGuess: false,   // one guess per play
    guesses: [],       // { word, tryNumber }; word uses BLANK for empty squares
    status: 'playing', // 'playing' | 'won' | 'lost'
    startedAt: null,
    finishedAt: null,
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

export function elapsedMs(state) {
  if (!state.startedAt) return 0;
  return (state.finishedAt ?? Date.now()) - state.startedAt;
}

export function formatTime(ms) {
  const s = Math.floor(ms / 1000);
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
}
