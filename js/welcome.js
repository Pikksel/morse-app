// Welcome box: shown the first time a player enters the game, once per device (Normal and Easy each once).
import { getPlayerCount } from './api.js';
import { getMode } from './mode.js';

const $ = (id) => document.getElementById(id);
const keyFor = (mode) => `morse-web:welcome:${mode}`;

const TEXT = {
  normal: {
    title: '📡 Welcome to Morse Daily!',
    text: 'Every weekday brings a new mysterious code… can you crack it? Race other players for the top spot on the leaderboard!',
  },
  easy: {
    title: '🐣 Welcome to Morse Daily: Easy!',
    text: 'A new word every day, played slower, with a hint if you get stuck. Collect badges and climb the Easy leaderboard!',
  },
};

function seen(mode) {
  try { return localStorage.getItem(keyFor(mode)) === 'seen'; } catch { return false; }
}

function close() {
  try { localStorage.setItem(keyFor(getMode()), 'seen'); } catch {}
  $('welcome').hidden = true;
}

// Call when the game screen opens. Does nothing if this device has already seen it.
export function maybeShowWelcome() {
  const mode = getMode();
  if (seen(mode) || !$('welcome').hidden) return;
  $('welcome-title').textContent = TEXT[mode].title;
  $('welcome-text').textContent = TEXT[mode].text;
  $('welcome-players').textContent = '';
  $('welcome').hidden = false;
  getPlayerCount()
    .then((n) => { $('welcome-players').textContent = `👥 ${n} ${n === 1 ? 'player has' : 'players have'} joined`; })
    .catch(() => {}); // offline: just leave the line out
}

export function hideWelcome() {
  $('welcome').hidden = true;
}

$('welcome-ok').addEventListener('click', close);
$('welcome-close').addEventListener('click', close);
