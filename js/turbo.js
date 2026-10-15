// Turbo mode: one letter plays once, pick it from three (🐣 Easy: two), three lives, faster and faster.
// The database picks the letters, checks the answers and keeps the score (see turbo_* in schema.sql);
// this file only plays, shows and sends taps.
import { turboStart, turboAnswer, getTurboBest, awardBadges } from './api.js';
import { BADGES } from './badges.js';
import { revealSequence } from './badgeReveal.js';
import { play, stop } from './morse.js';
import { playSfx, blip, prepareRandom, playRandom } from './sfx.js';
import { confetti } from './confetti.js';
import { loadPlayer } from './player.js';
import { isEasy } from './mode.js';

const $ = (id) => document.getElementById(id);

// Time to answer, starting when the letter has finished playing. 🐣 Easy: 10 s (the server uses the same).
const answerMs = () => (isEasy() ? 10000 : 5000);
const RIGHT_MS = 650;     // pause after a correct answer before the next letter
const WRONG_MS = 1200;    // a bit longer after a miss: time to see the right letter
const START_HALVES = 6;   // lives in half-hearts: 6 = 3 hearts (the server keeps the real count)
const MAX_HALVES = 10;    // 5 hearts
const FAST_FOR_BONUS = 3; // fast answers in a row for +½ heart
const PATTERNS = ['dots', 'stripes', 'rings', 'grid', 'cross'];

let run = null;           // { id, score, lives }
let current = null;       // { letter, wpm, options }
let answering = false;    // waiting for the server: ignore extra taps
let countdownId = null;
let lowId = null;          // turns the timer bar red near the end
let prevBest = null;      // all-time best before this run (for "New personal best!")
let onLeaderboard = () => {};

// ---------- Look: new colors + pattern for every session ----------

let lastPattern = null;
function newSessionLook() {
  const options = PATTERNS.filter((p) => p !== lastPattern);
  lastPattern = options[Math.floor(Math.random() * options.length)];
  document.body.dataset.pattern = lastPattern;
  document.body.style.setProperty('--t-hue', Math.floor(Math.random() * 360));
  document.body.classList.remove('turbo-mode');
  void document.body.offsetWidth; // restart the fade-in
  document.body.classList.add('turbo-mode');
}

// ---------- Rendering ----------

let justGained = false; // next paint: make the heart that grew sparkle

// Hearts: full, half or empty. At least 3 slots, more when bonus halves go above 3 hearts.
function paintHearts(halves) {
  const box = $('turbo-lives');
  const slots = Math.max(START_HALVES, Math.min(MAX_HALVES, halves + (halves % 2))) / 2;
  box.innerHTML = '';
  for (let i = 0; i < slots; i++) {
    const heart = document.createElement('span');
    heart.className = `heart ${halves >= 2 * i + 2 ? 'full' : halves === 2 * i + 1 ? 'half' : 'empty'}`;
    box.append(heart);
  }
  if (justGained) {
    [...box.querySelectorAll('.full, .half')].at(-1)?.classList.add('gained');
    justGained = false;
  }
  box.setAttribute('aria-label', `${halves / 2} of ${slots} lives`);
}

// ⚡ pips under the hearts: how many fast answers in a row so far
function paintStreak(streak) {
  $('turbo-streak').innerHTML = Array.from({ length: FAST_FOR_BONUS },
    (_, i) => `<i class="${i < streak ? 'lit' : ''}"></i>`).join('');
}

function paintStatus() {
  paintHearts(run?.halves ?? START_HALVES);
  paintStreak(run?.streak ?? 0);
  $('turbo-score').textContent = run?.score ?? 0;
  $('turbo-wpm').textContent = current ? `${current.wpm} WPM` : '';
}

function orb(text, state = '') {
  $('turbo-orb-text').textContent = text;
  $('turbo-orb').className = `turbo-orb ${state}`;
}

function message(text) {
  $('turbo-message').textContent = text;
}

function renderOptions(letters) {
  const box = $('turbo-options');
  box.innerHTML = '';
  letters.forEach((letter, i) => {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'turbo-option';
    btn.dataset.letter = letter;
    btn.textContent = letter;
    btn.setAttribute('aria-label', `Option ${i + 1}: ${letter}`);
    box.append(btn);
  });
  box.hidden = false;
}

function setOptionsEnabled(on) {
  for (const btn of $('turbo-options').children) btn.disabled = !on;
}

// ---------- Timer bar ----------

// The bar only shows while a letter is being asked.
function showTimer(on) {
  $('turbo-timer').style.visibility = on ? 'visible' : 'hidden';
}

function resetTimer() {
  clearTimeout(countdownId);
  clearTimeout(lowId);
  const bar = $('turbo-timer-bar');
  bar.style.transition = 'none';
  bar.style.width = '100%';
  bar.classList.remove('low');
}

function startTimer() {
  const bar = $('turbo-timer-bar');
  const ms = answerMs();
  void bar.offsetWidth;
  bar.style.transition = `width ${ms}ms linear`;
  bar.style.width = '0%';
  lowId = setTimeout(() => bar.classList.add('low'), ms * 0.6);
  countdownId = setTimeout(() => answer(null), ms);
}

function freezeTimer() {
  clearTimeout(countdownId);
  clearTimeout(lowId);
  const bar = $('turbo-timer-bar');
  bar.style.width = getComputedStyle(bar).width; // stop where it is
  bar.style.transition = 'none';
}

// ---------- Game loop ----------

function ask(next) {
  current = next;
  answering = false;
  paintStatus();
  renderOptions(next.options);
  setOptionsEnabled(true);
  resetTimer();
  showTimer(true);
  orb('♪', 'listening');
  message('');
  play(next.letter, next.wpm, () => {
    if (current !== next || answering) return; // already answered while it played
    orb('?', 'waiting');
    startTimer();
  });
}

async function answer(choice) {
  if (!run || answering) return;
  answering = true;
  freezeTimer();
  stop();
  setOptionsEnabled(false);
  const tapped = [...$('turbo-options').children].find((b) => b.dataset.letter === choice);

  const player = loadPlayer();
  const thisRun = run;
  let res;
  try {
    res = await turboAnswer(player.name, player.token, run.id, choice);
  } catch (err) {
    if (run !== thisRun) return;
    message(`Connection problem (${err.message}). Your score so far is saved.`);
    return gameOver(run.score);
  }
  if (run !== thisRun) return; // left Turbo while waiting for the server

  // Feedback: right letter green, a wrong tap red.
  for (const btn of $('turbo-options').children) {
    if (btn.dataset.letter === res.answer) btn.classList.add('right');
  }
  if (res.correct) {
    blip('correct');
    orb(res.answer, 'right');
    if (res.bonus) {
      message(res.capped ? '⚡ Fast streak! (max hearts)' : '⚡ Fast streak! +½ ❤️');
      justGained = !res.capped;
    }
  } else {
    blip('wrong');
    tapped?.classList.add('wrong');
    orb(res.answer, 'wrong');
    message(choice === null || res.late ? `Too slow: it was ${res.answer}` : `It was ${res.answer}`);
    $('turbo-lives').classList.remove('hit');
    void $('turbo-lives').offsetWidth;
    $('turbo-lives').classList.add('hit');
  }
  run.score = res.score;
  run.halves = res.halves;
  run.streak = res.streak;
  paintStatus();

  setTimeout(() => {
    if (run !== thisRun) return; // left Turbo during the feedback pause
    if (res.over) gameOver(res.score);
    else ask(res.next);
  }, res.correct ? RIGHT_MS : WRONG_MS);
}

async function startRun() {
  const player = loadPlayer();
  if (!player) return;
  cancelReveal(); // badges from the last game over still waiting
  newSessionLook();
  prepareRandom('turboFail'); // load this run's game-over sound now, so it plays instantly
  $('turbo-intro').hidden = true;
  $('turbo-over').hidden = true;
  message('');
  orb('…', 'waiting');
  try {
    prevBest = (await getTurboBest(player.name))?.alltime ?? 0;
    const start = await turboStart(player.name, player.token);
    run = { id: start.run_id, score: start.score, halves: start.halves ?? START_HALVES, streak: 0 };
    notifyState();
    ask(start.next);
  } catch (err) {
    message(err.message === 'BAD_TOKEN' ? 'Your login has expired. Log out and in again.' : `Couldn't start: ${err.message}`);
    $('turbo-intro').hidden = false;
    orb('TURBO');
  }
}

async function gameOver(score) {
  notifyState();
  stop();
  resetTimer();
  showTimer(false);
  run = null;
  current = null;
  notifyState();
  $('turbo-options').hidden = true;
  $('turbo-final-score').textContent = score;

  const newBest = score > 0 && score > prevBest;
  $('turbo-over-title').textContent = newBest ? 'New personal best!' : 'Game over';
  orb(String(score), newBest ? 'right' : '');
  if (newBest) {
    playSfx('win');
    const r = $('turbo-orb').getBoundingClientRect();
    confetti({ origin: { x: r.left + r.width / 2, y: r.top + r.height / 2 } });
  } else {
    playRandom('turboFail'); // one of several Turbo fail sounds
  }
  $('turbo-over').hidden = false;

  showNewBadges();
  $('turbo-best').textContent = 'Loading your best…';
  try {
    const best = await getTurboBest(loadPlayer().name);
    $('turbo-best').textContent =
      `Best today: ${best.today ?? 0} (#${best.today_rank ?? '–'}) · All-time: ${best.alltime ?? 0} (#${best.alltime_rank ?? '–'})`;
  } catch {
    $('turbo-best').textContent = '';
  }
}

// Badges can also be earned in Turbo (e.g. Turbocharged): shown one at a time in the game-over card.
let cancelReveal = () => {};
async function showNewBadges() {
  cancelReveal();
  const box = $('turbo-badges');
  box.hidden = true;
  box.innerHTML = '';
  const player = loadPlayer();
  let ids = [];
  try { ids = (await awardBadges(player.name, player.token)).filter((id) => BADGES[id]); } catch { return; }
  if (!ids.length || run) return; // nothing new, or a new run already started
  box.hidden = false;
  setTimeout(() => {
    cancelReveal = revealSequence(box, ids, {
      prefix: 'New badge: ',
      stillShowing: () => !$('turbo').hidden && !$('turbo-over').hidden && !run, // still on this game over
    });
  }, 600);
}

// ---------- Public ----------

// Lets the app know a run started or ended (e.g. for the calm background).
const notifyState = () => document.dispatchEvent(new Event('morse:state'));
export const isTurboRunning = () => !!run;

const INTRO = {
  normal: 'One letter plays once. Pick it from three. Three lives, and it gets faster. 5 seconds per letter.<br>⚡ Answer within 2 s three times in a row: +½ ❤️ (up to 5).',
  easy: '🐣 One letter plays once. Pick it from two. Three lives, and it gets a little faster every 5 points. 10 seconds per letter.<br>⚡ Answer within 4 s three times in a row: +½ ❤️ (up to 5).',
};

// Turbo screen became visible: fresh look, ready to start.
export function enterTurbo({ onOpenLeaderboard } = {}) {
  if (onOpenLeaderboard) onLeaderboard = onOpenLeaderboard;
  $('turbo-intro-text').innerHTML = INTRO[isEasy() ? 'easy' : 'normal'];
  newSessionLook();
  paintStatus();
  showTimer(false);
  orb('TURBO');
  message('');
  $('turbo-options').hidden = true;
  $('turbo-over').hidden = true;
  $('turbo-intro').hidden = false;
}

// Leaving the Turbo screen: stop the sound, back to the normal background.
// A run in progress ends here (its score so far is already saved on the server).
export function leaveTurbo() {
  stop();
  resetTimer();
  run = null;
  current = null;
  answering = false;
  cancelReveal();
  notifyState();
  document.body.classList.remove('turbo-mode');
}

$('turbo-start').addEventListener('click', startRun);
$('turbo-again').addEventListener('click', startRun);
$('turbo-board').addEventListener('click', () => onLeaderboard());
$('turbo-options').addEventListener('click', (e) => {
  const btn = e.target.closest('.turbo-option');
  if (btn && !btn.disabled) answer(btn.dataset.letter);
});

// Keyboard: 1 / 2 / 3 (Easy: 1 / 2), or the letter itself.
document.addEventListener('keydown', (e) => {
  if ($('turbo').hidden || !run || answering || e.ctrlKey || e.metaKey || e.altKey) return;
  const buttons = [...$('turbo-options').children];
  const byNumber = buttons[Number(e.key) - 1];
  const byLetter = buttons.find((b) => b.dataset.letter === e.key.toUpperCase());
  const btn = byNumber ?? byLetter;
  if (btn) {
    e.preventDefault();
    answer(btn.dataset.letter);
  }
});
