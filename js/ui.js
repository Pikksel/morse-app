import { register, login, logout, verifyPlayer, submitScore } from './api.js';
import { loadPlayer, savePlayer, clearPlayer, NAME_PATTERN, PASSWORD_PATTERN } from './player.js';
import { initGame, currentState } from './gameView.js';
import { saveState, score, elapsedMs } from './game.js';
import { openResults, refreshResults, setStatus } from './results.js';
import { beep } from './morse.js';

const $ = (id) => document.getElementById(id);

const screens = ['start', 'saved', 'game'];
function show(screen) {
  for (const s of screens) $(s).hidden = s !== screen;
}

const SYMBOL = { '.': '•', '-': '—' };
const showPassword = (pw) => [...pw].map((c) => SYMBOL[c]).join(' ');

// ---------- Start screen: New player / Log in ----------

let mode = 'new';   // 'new' | 'login'
let password = '';  // 4 symbols of '.' or '-'

function setMode(next) {
  mode = next;
  $('tab-new').setAttribute('aria-selected', mode === 'new');
  $('tab-login').setAttribute('aria-selected', mode === 'login');
  $('auth-submit').textContent = mode === 'new' ? 'Create callsign' : 'Log in';
  $('name-hint').hidden = mode !== 'new';
  $('pw-hint').hidden = mode !== 'new';
  $('auth-error').textContent = '';
}

$('tab-new').addEventListener('click', () => setMode('new'));
$('tab-login').addEventListener('click', () => setMode('login'));

// Callsign style while typing: uppercase, A-Z and 0-9 only.
const nameInput = $('auth-name');
nameInput.addEventListener('input', () => {
  nameInput.value = nameInput.value.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 4);
});

function paintPassword() {
  const slots = $('pw-slots');
  slots.innerHTML = '';
  for (let i = 0; i < 4; i++) {
    const slot = document.createElement('span');
    slot.className = 'pw-slot' + (password[i] ? ' filled' : '') + (i === password.length ? ' next' : '');
    slot.textContent = password[i] ? SYMBOL[password[i]] : '';
    slots.append(slot);
  }
  slots.setAttribute('aria-label', `${password.length} of 4 entered`);
}

function addSymbol(sym) {
  if (sym === 'back') {
    password = password.slice(0, -1);
  } else if (password.length < 4) {
    password += sym;
    beep(sym);
  }
  paintPassword();
}

document.querySelector('.pw-pad').addEventListener('click', (e) => {
  const btn = e.target.closest('[data-sym]');
  if (btn) addSymbol(btn.dataset.sym);
});

// Physical keyboard: '.' and '-' always go to the password.
// Backspace only when the callsign field isn't focused.
document.addEventListener('keydown', (e) => {
  if ($('start').hidden || e.ctrlKey || e.metaKey || e.altKey) return;
  if (e.key === '.' || e.key === '-') {
    e.preventDefault();
    addSymbol(e.key);
  } else if (e.key === 'Backspace' && document.activeElement !== nameInput) {
    e.preventDefault();
    addSymbol('back');
  }
});

const ERRORS = {
  NAME_TAKEN: 'That callsign is taken. If it’s yours, use Log in.',
  INVALID_NAME: 'Use 1–4 letters or digits.',
  INVALID_PASSWORD: 'Enter 4 dits or dahs.',
  BAD_LOGIN: 'Wrong callsign or password.',
};

function setBusy(busy) {
  for (const el of $('auth-form').elements) el.disabled = busy;
}

$('auth-form').addEventListener('submit', async (e) => {
  e.preventDefault();
  const name = nameInput.value;
  const error = $('auth-error');
  error.textContent = '';

  if (!NAME_PATTERN.test(name)) return (error.textContent = ERRORS.INVALID_NAME);
  if (!PASSWORD_PATTERN.test(password)) return (error.textContent = ERRORS.INVALID_PASSWORD);

  setBusy(true);
  try {
    if (mode === 'new') {
      const token = await register(name, password);
      savePlayer(name, token);
      $('saved-name').textContent = name;
      $('saved-pw').textContent = showPassword(password);
      show('saved');
    } else {
      const res = await login(name, password);
      if (res.token) {
        savePlayer(name, res.token);
        startGame({ name, token: res.token });
      } else if (res.error === 'LOCKED') {
        const min = Math.ceil(res.retry_after_s / 60);
        error.textContent = `Too many wrong tries. Try again in ${min} min.`;
      } else {
        error.textContent = ERRORS.BAD_LOGIN;
      }
    }
    password = '';
    paintPassword();
  } catch (err) {
    error.textContent = ERRORS[err.message] || `Something went wrong: ${err.message}`;
  } finally {
    setBusy(false);
  }
});

$('continue').addEventListener('click', () => startGame(loadPlayer()));

// ---------- Game ----------

function startGame(player) {
  $('player-name').textContent = player.name;
  show('game');
  initGame({ owner: player.name, onFinish });
}

const SUBMIT_ERRORS = {
  ALREADY_SUBMITTED: 'You already have a score today (another device?). Your first result counts.',
  WRONG_DAY: 'The day ended before you finished, so this score wasn’t saved.',
};

// Game over: show results, save the score once, then refresh with the rank.
async function onFinish(state, restored) {
  const player = loadPlayer();
  if (!player) return;

  // Let the last flip (and the confetti on a win) play before the popup covers it.
  const delay = restored ? 0 : state.status === 'won' ? 2200 : 1400;
  setTimeout(() => openResults(state, player.name), delay);
  if (state.submitted) return;

  setStatus('Saving your score…');
  try {
    const timeMs = Math.max(1, Math.round(elapsedMs(state)));
    state.rank = await submitScore(player.name, player.token, state.day, score(state), timeMs);
    state.submitted = true;
    setStatus('');
  } catch (err) {
    if (SUBMIT_ERRORS[err.message]) {
      state.submitted = true; // retrying won't help
      setStatus(SUBMIT_ERRORS[err.message]);
    } else if (err.message === 'BAD_TOKEN') {
      setStatus('Your login has expired. Log out and in again to save this score.');
    } else {
      setStatus(`Couldn’t save your score (${err.message}). It will retry next time you open the game.`);
    }
  }
  saveState(state);
  refreshResults(state);
}

$('open-board').addEventListener('click', () => openResults(currentState(), loadPlayer()?.name ?? ''));

$('sign-out').addEventListener('click', () => {
  if (!confirm('Log out? Log back in with your callsign and Morse password.')) return;
  const player = loadPlayer();
  if (player) logout(player.name, player.token).catch(() => {}); // best effort
  clearPlayer();
  setMode('login');
  show('start');
});

// ---------- Boot ----------

paintPassword();
setMode('new');

const player = loadPlayer();
if (player?.name && player?.token) {
  startGame(player);
  // Session removed on the server (e.g. logged out elsewhere)? Back to log in.
  verifyPlayer(player.name, player.token)
    .then((ok) => {
      if (ok) return;
      clearPlayer();
      setMode('login');
      nameInput.value = player.name;
      $('auth-error').textContent = 'Please log in again.';
      show('start');
    })
    .catch(() => {}); // offline: keep playing
} else {
  show('start');
}
