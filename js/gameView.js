// Game screen: 5 squares, tries meter, Play button, guess history, keyboard.
import {
  WORD_LENGTH, MAX_TRIES, BLANK, dailyWord, wpmForTry, evaluate, knownLetters,
  loadState, saveState, useTry, addGuess, elapsedMs, formatTime,
} from './game.js';
import { MORSE, play, stop, tone } from './morse.js';
import { playSfx } from './sfx.js';
import { confetti } from './confetti.js';

const $ = (id) => document.getElementById(id);

const KEY_ROWS = ['QWERTYUIOP', 'ASDFGHJKL', 'ZXCVBNM-']; // - = Backspace (Guess has its own button)

let state;
let slots = [];      // letters in the 5 squares (BLANK = empty)
let locked = [];     // true where the letter is already known (green)
let stale = [];      // true for a wrong letter carried over from the last guess
let cursor = -1;     // square the next typed letter goes into
let inPlace = false; // Backspace clears the cursor square itself (after a tap / at the end)
let lastResult = null; // evaluation shown after a guess, until the next Play
let playing = false;
let sounding = -1;   // index of the square whose letter is playing right now
let timerId = null;
let onGameOver = () => {};

// ---------- Rendering ----------

function buildSquares() {
  const word = $('word');
  word.innerHTML = '';
  for (let i = 0; i < WORD_LENGTH; i++) {
    const sq = document.createElement('div');
    sq.className = 'square';
    word.append(sq);
  }
}

// One dot per try, with a gap wherever the speed drops.
function buildMeter() {
  const meter = $('meter');
  meter.innerHTML = '';
  for (let t = 1; t <= MAX_TRIES; t++) {
    const dot = document.createElement('span');
    dot.className = 'dot';
    if (t < MAX_TRIES && wpmForTry(t + 1) !== wpmForTry(t)) dot.classList.add('speed-end');
    dot.title = `Try ${t}: ${wpmForTry(t)} WPM`;
    meter.append(dot);
  }
}

function buildKeyboard() {
  const kb = $('keyboard');
  kb.innerHTML = '';
  for (const keys of KEY_ROWS) {
    const row = document.createElement('div');
    row.className = 'kb-row';
    for (const k of keys) {
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'key';
      if (k === '-') {
        btn.dataset.key = 'Backspace';
        btn.textContent = '⌫';
        btn.setAttribute('aria-label', 'Backspace');
        btn.classList.add('wide');
      } else {
        btn.dataset.key = k;
        btn.innerHTML = `<span>${k}</span><small>${MORSE[k]}</small>`;
      }
      row.append(btn);
    }
    kb.append(row);
  }
}

function paintSquares(animate = false) {
  const squares = $('word').children;
  for (let i = 0; i < WORD_LENGTH; i++) {
    const sq = squares[i];
    const letter = slots[i];
    sq.textContent = letter === BLANK ? '' : letter;

    let cls = 'square';
    if (lastResult) cls += lastResult[i] ? ' correct' : (letter === BLANK ? '' : ' wrong');
    else if (locked[i]) cls += ' correct';
    else if (stale[i]) cls += ' wrong';
    else if (letter !== BLANK) cls += ' filled';
    if (i === cursor && canType()) cls += ' cursor';
    if (i === sounding) cls += ' sounding';
    sq.className = cls;

    if (animate) {
      sq.classList.add('flip');
      sq.style.animationDelay = `${i * 100}ms`;
    }
  }
}

function paintStatus() {
  const t = state.tries;
  $('try-count').textContent = `Try ${t}/${MAX_TRIES}`;
  $('try-wpm').textContent = t ? `${wpmForTry(t)} WPM` : '';
  [...$('meter').children].forEach((dot, i) => {
    dot.classList.toggle('used', i < t);
    dot.classList.toggle('current', i === t - 1 && state.status === 'playing');
  });
}

// While this try's sound plays (and its guess is unused) the button waits.
// After guessing, Play always starts the next try.
function paintPlayButton() {
  const btn = $('play');
  const done = state.status !== 'playing' || state.tries >= MAX_TRIES;
  const busy = playing && state.canGuess;
  btn.disabled = done || busy;
  if (busy) btn.innerHTML = '♪ Playing…';
  else if (state.status === 'won') btn.innerHTML = 'Solved!';
  else if (done) btn.innerHTML = 'No tries left';
  else btn.innerHTML = `▶ Play <small>${wpmForTry(state.tries + 1)} WPM</small>`;
}

function paintHistory() {
  const list = $('history');
  list.innerHTML = '';
  const answer = dailyWord(state.day);
  for (const { word, tryNumber } of [...state.guesses].reverse()) {
    const li = document.createElement('li');
    const result = evaluate(word, answer);
    li.innerHTML = `<span class="h-try">#${tryNumber}</span>` +
      [...word].map((c, i) => `<span class="mini ${result[i] ? 'correct' : ''}">${c === BLANK ? '' : c}</span>`).join('') +
      `<span class="h-wpm">${wpmForTry(tryNumber)}</span>`;
    list.append(li);
  }
}

function paintKeyboard() {
  $('keyboard').classList.toggle('disabled', !canType());
  $('guess').disabled = !canType();
}

function message(text) {
  $('message').textContent = text;
}

function shake() {
  const word = $('word');
  word.classList.remove('shake');
  void word.offsetWidth; // restart the animation
  word.classList.add('shake');
}

function paintAll() {
  paintSquares();
  paintStatus();
  paintPlayButton();
  paintHistory();
  paintKeyboard();
}

// ---------- Timer ----------

function tick() {
  $('timer').textContent = formatTime(elapsedMs(state));
}

function startTimer() {
  clearInterval(timerId);
  tick();
  if (state.status === 'playing' && state.startedAt) timerId = setInterval(tick, 250);
}

// ---------- Play ----------

// Input for a new try: green letters locked, the rest of the last guess carried over.
function resetInput() {
  const known = knownLetters(state);
  const last = state.guesses.at(-1)?.word ?? '';
  locked = known.map((c) => c !== BLANK);
  slots = known.map((c, i) => (locked[i] ? c : last[i] ?? BLANK));
  stale = slots.map((c, i) => !locked[i] && c !== BLANK);
  lastResult = null;

  const firstEmpty = slots.findIndex((c, i) => !locked[i] && c === BLANK);
  cursor = firstEmpty !== -1 ? firstEmpty : locked.indexOf(false);
  inPlace = firstEmpty === -1; // all filled: Backspace clears the selected square
}

function onPlayClick() {
  if (playing && state.canGuess) return;
  const wpm = useTry(state);
  if (wpm === null) return;
  stop(); // cut off the previous try's sound
  sounding = -1;

  // Letters already typed for this try are kept.
  startTimer();
  playing = true;
  paintAll();
  message('Type your guess, then press Guess.');
  play(dailyWord(state.day), wpm, () => {
    playing = false;
    setSounding(-1);
    paintPlayButton();
  }, setSounding);
}

// Highlights the square whose letter is being played.
function setSounding(i) {
  sounding = i;
  [...$('word').children].forEach((sq, j) => sq.classList.toggle('sounding', j === i));
}

// ---------- Input ----------

// Typing is open from the first Play until the game ends.
// A Guess without a fresh Play costs a try (see submit).
function canType() {
  return state.status === 'playing' && state.tries > 0;
}

// Next / previous square that isn't locked, or -1.
function step(from, dir) {
  for (let i = from + dir; i >= 0 && i < WORD_LENGTH; i += dir) {
    if (!locked[i]) return i;
  }
  return -1;
}

function setSlot(i, letter) {
  slots[i] = letter;
  stale[i] = false;
}

function handleKey(key) {
  if (!canType()) return;
  if (key === 'Enter') return submit();
  if (cursor === -1) return; // every square is green

  if (/^[A-Z]$/.test(key)) {
    setSlot(cursor, key);
    if (!playing) tone(key); // hear the letter you typed (never over the word itself)
    const next = step(cursor, 1);
    if (next !== -1) { cursor = next; inPlace = false; }
    else inPlace = true; // last free square: stay, Backspace clears it
  } else if (key === 'Backspace') {
    if (inPlace && slots[cursor] !== BLANK) {
      setSlot(cursor, BLANK);
    } else {
      const prev = step(cursor, -1);
      if (prev !== -1) cursor = prev;
      setSlot(cursor, BLANK);
    }
    inPlace = false;
  } else if (key === 'ArrowLeft' || key === 'ArrowRight') {
    const next = step(cursor, key === 'ArrowLeft' ? -1 : 1);
    if (next !== -1) cursor = next;
    inPlace = true;
  }
  paintSquares();
}

// Tap a square to choose where the next letter goes. Green squares can't be selected.
function onSquareClick(e) {
  const sq = e.target.closest('.square');
  if (!sq || !canType()) return;
  const i = [...$('word').children].indexOf(sq);
  if (locked[i]) return;
  cursor = i;
  inPlace = true;
  paintSquares();
}

function submit() {
  if (slots.every((c, i) => locked[i] || c === BLANK)) {
    message('Type at least one letter.');
    shake();
    return;
  }

  // This try's guess is used up: guessing again blind costs the next try.
  if (!state.canGuess) {
    if (useTry(state) === null) return;
    stop();
    playing = false;
    sounding = -1;
  }

  const result = addGuess(state, slots.join(''));
  if (state.status !== 'playing') return finish();

  // Keep editing from here: greens lock, wrong letters stay gray until changed.
  resetInput();
  paintAll();
  paintSquares(true);

  const correct = result.filter(Boolean).length;
  message(`${correct}/${WORD_LENGTH} correct. Play to listen, or edit and Guess (try ${state.tries + 1}).`);
}

// restored = true when reopening an already finished game (don't re-submit).
function finish(restored = false) {
  clearInterval(timerId);
  tick();
  stop();
  playing = false;
  sounding = -1;
  const answer = dailyWord(state.day);
  slots = [...answer];
  lastResult = evaluate(answer, answer).map(() => state.status === 'won');
  locked = [];
  stale = [];
  cursor = -1;
  paintAll();
  message(state.status === 'won'
    ? `Solved on try ${state.tries}/${MAX_TRIES} in ${formatTime(elapsedMs(state))}`
    : `Out of tries. The word was ${answer}.`);

  // Celebrate only the moment it happens, not when reopening a finished game.
  if (!restored) {
    if (state.status === 'won') {
      playSfx('win');
      const r = $('word').getBoundingClientRect();
      confetti({ origin: { x: r.left + r.width / 2, y: r.top + r.height / 2 } });
    } else {
      playSfx('fail');
    }
  }
  onGameOver(state, restored);
}

// ---------- Public ----------

let wired = false;

function wireEvents() {
  if (wired) return;
  wired = true;

  $('play').addEventListener('click', onPlayClick);
  $('guess').addEventListener('click', () => handleKey('Enter'));
  $('word').addEventListener('click', onSquareClick);

  $('keyboard').addEventListener('click', (e) => {
    const btn = e.target.closest('.key');
    if (btn) handleKey(btn.dataset.key);
  });

  document.addEventListener('keydown', (e) => {
    if ($('game').hidden || e.ctrlKey || e.metaKey || e.altKey) return;
    if (e.target.matches?.('input, textarea')) return;
    const key = e.key.length === 1 ? e.key.toUpperCase() : e.key;
    if (['Enter', 'Backspace', 'ArrowLeft', 'ArrowRight'].includes(key) || /^[A-Z]$/.test(key)) {
      e.preventDefault();
      handleKey(key);
    }
  });
}

export const currentState = () => state;

// owner: the logged-in callsign (each callsign has its own saved game).
export function initGame({ owner, onFinish } = {}) {
  if (onFinish) onGameOver = onFinish;
  stop(); // switching player mid-sound
  state = loadState(owner);
  playing = false;

  buildSquares();
  buildMeter();
  buildKeyboard();
  wireEvents();

  resetInput();

  startTimer();
  if (state.status !== 'playing') return finish(true);

  paintAll();
  if (state.tries === 0) message('Press Play to hear today’s word.');
  else if (state.canGuess) message('Type your guess, then press Guess.');
  else message(`Play to listen, or edit and Guess (try ${state.tries + 1}).`);
}
