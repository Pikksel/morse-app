// 💡 Suggestion box: opened from the results popup, saved in the database (submit_suggestion).
// Only admins can read them, on …/sugg/.
import { submitSuggestion } from './api.js';
import { loadPlayer } from './player.js';

const $ = (id) => document.getElementById(id);
const MAX = 500;
const ERRORS = {
  TOO_MANY: 'That’s 3 today, thank you! Send more tomorrow.',
  BAD_TOKEN: 'Your login has expired. Log out and in again.',
  BAD_LENGTH: 'Write something first (max 500 characters).',
};

const paintCount = () => { $('suggest-count').textContent = `${$('suggest-text').value.length}/${MAX}`; };
const status = (text) => { $('suggest-status').textContent = text; };

$('open-suggest').addEventListener('click', () => {
  status('');
  paintCount();
  $('suggest').showModal();
  $('suggest-text').focus();
});
$('suggest-close').addEventListener('click', () => $('suggest').close());
$('suggest-text').addEventListener('input', paintCount);

$('suggest-form').addEventListener('submit', async (e) => {
  e.preventDefault();
  const text = $('suggest-text').value.trim();
  const player = loadPlayer();
  if (!text) return status(ERRORS.BAD_LENGTH);
  if (!player) return status(ERRORS.BAD_TOKEN);
  $('suggest-send').disabled = true;
  status('Sending…');
  try {
    await submitSuggestion(player.name, player.token, text);
    $('suggest-text').value = '';
    paintCount();
    status('Thanks! 🙏 Every idea gets read.');
  } catch (err) {
    status(ERRORS[err.message] || `Couldn’t send (${err.message}). Try again later.`);
  } finally {
    $('suggest-send').disabled = false;
  }
});
