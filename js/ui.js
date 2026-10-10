import { claimName, verifyPlayer } from './api.js';
import { loadPlayer, savePlayer, clearPlayer, NAME_PATTERN } from './player.js';

const $ = (id) => document.getElementById(id);

const screens = ['start', 'saved', 'game'];
function show(screen) {
  for (const s of screens) $(s).hidden = s !== screen;
}

// Force callsign style while typing: uppercase, A-Z and 0-9 only.
function callsignInput(input) {
  input.addEventListener('input', () => {
    input.value = input.value.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 4);
  });
}

const ERRORS = {
  NAME_TAKEN: 'That callsign is taken. Try another.',
  INVALID_NAME: 'Use 1–4 letters or digits.',
};

function setBusy(form, busy) {
  for (const el of form.elements) el.disabled = busy;
}

// ---------- Claim ----------

callsignInput($('claim-name'));

$('claim-form').addEventListener('submit', async (e) => {
  e.preventDefault();
  const name = $('claim-name').value;
  const error = $('claim-error');
  error.textContent = '';

  if (!NAME_PATTERN.test(name)) {
    error.textContent = ERRORS.INVALID_NAME;
    return;
  }

  setBusy(e.target, true);
  try {
    const token = await claimName(name);
    savePlayer(name, token);
    $('saved-name').textContent = name;
    $('saved-code').textContent = token;
    show('saved');
  } catch (err) {
    error.textContent = ERRORS[err.message] || `Something went wrong: ${err.message}`;
  } finally {
    setBusy(e.target, false);
  }
});

// ---------- Recovery code ----------

$('copy-code').addEventListener('click', async () => {
  try {
    await navigator.clipboard.writeText($('saved-code').textContent);
    $('copy-code').textContent = 'Copied!';
  } catch {
    $('copy-code').textContent = 'Select and copy it manually';
  }
});

$('continue').addEventListener('click', () => startGame(loadPlayer()));

// ---------- Restore ----------

callsignInput($('restore-name'));

$('restore-form').addEventListener('submit', async (e) => {
  e.preventDefault();
  const name = $('restore-name').value;
  const token = $('restore-code').value.trim().toLowerCase();
  const error = $('restore-error');
  error.textContent = '';

  setBusy(e.target, true);
  try {
    if (await verifyPlayer(name, token)) {
      savePlayer(name, token);
      startGame({ name, token });
    } else {
      error.textContent = 'Callsign and code do not match.';
    }
  } catch (err) {
    error.textContent = `Something went wrong: ${err.message}`;
  } finally {
    setBusy(e.target, false);
  }
});

// ---------- Game (step 3) ----------

function startGame(player) {
  $('player-name').textContent = player.name;
  show('game');
}

$('sign-out').addEventListener('click', () => {
  if (confirm('Leave this callsign? You can only get it back with your recovery code.')) {
    clearPlayer();
    show('start');
  }
});

// ---------- Boot ----------

const player = loadPlayer();
if (player?.name && player?.token) startGame(player);
else show('start');
