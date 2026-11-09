// Welcome box: shown the first time a player enters the game, once per device (Normal and Easy each once).
import { getPlayerCount } from './api.js';
import { getMode } from './mode.js';

const $ = (id) => document.getElementById(id);
const keyFor = (mode) => `morse-web:welcome:${mode}`;

// Bump this when you add a dev update: everyone sees the welcome box once more.
const UPDATES_VERSION = '2026-11-09';

const TEXT = {
  normal: {
    title: '📡 Welcome to Morse Daily!',
    text: 'Every weekday brings a new mysterious code… can you crack it?',
  },
  easy: {
    title: '🐣 Welcome to Morse Daily: Easy!',
    text: 'A new word every day, played slower, with a hint if you get stuck. Collect badges and climb the Easy leaderboard!',
  },
};

function seen(mode) {
  try { return localStorage.getItem(keyFor(mode)) === UPDATES_VERSION; } catch { return false; }
}

function close() {
  try { localStorage.setItem(keyFor(getMode()), UPDATES_VERSION); } catch {}
  $('welcome').hidden = true;
  document.body.classList.remove('welcome-open');
}

// Call when the game screen opens. Does nothing if this device has already seen it.
export function maybeShowWelcome() {
  const mode = getMode();
  if (seen(mode) || !$('welcome').hidden) return;
  $('welcome-title').textContent = TEXT[mode].title;
  $('welcome-text').textContent = TEXT[mode].text;
  $('welcome-players').textContent = '';
  $('welcome').hidden = false;
  document.body.classList.add('welcome-open'); // overlay: the game waits behind it until "Got it!"
  getPlayerCount()
    .then((n) => { $('welcome-players').textContent = `👥 ${n} ${n === 1 ? 'player has' : 'players have'} joined`; })
    .catch(() => {}); // offline: just leave the line out
}

export function hideWelcome() {
  $('welcome').hidden = true;
  document.body.classList.remove('welcome-open');
}

$('welcome-ok').addEventListener('click', close);
$('welcome-close').addEventListener('click', close);

// While the welcome box is open, keys don't reach the game (no letters typed behind it). Enter / Escape close it.
document.addEventListener('keydown', (e) => {
  if ($('welcome').hidden) return;
  if (e.key === 'Escape' || (e.key === 'Enter' && e.target === document.body)) close();
  if (e.key !== 'Tab' && e.key !== 'Enter') e.stopImmediatePropagation();
}, true);
