// …/sugg/: every suggestion, newest first. The database only answers for admins (DAW1).
import { getSuggestions } from './api.js';
import { loadPlayer } from './player.js';

const $ = (id) => document.getElementById(id);
const player = loadPlayer();

async function show() {
  if (!player) return ($('sugg-status').textContent = 'Nothing to see here 🙂');
  let rows;
  try {
    rows = await getSuggestions(player.name, player.token);
  } catch (err) {
    $('sugg-status').textContent = err.message === 'NOT_ALLOWED' ? 'Nothing to see here 🙂' : `Couldn’t load (${err.message}).`;
    return;
  }
  $('sugg-status').textContent = `${rows.length} suggestion${rows.length === 1 ? '' : 's'}`;
  for (const r of rows) {
    const li = document.createElement('li');
    const meta = document.createElement('p');
    meta.className = 'hint';
    meta.textContent = `${r.name} · ${r.mode === 'easy' ? '🐣 Easy' : 'Normal'} · ${new Date(r.created_at).toLocaleString('sv-SE')}`;
    const body = document.createElement('p');
    body.className = 'sugg-body';
    body.textContent = r.body; // textContent, never innerHTML: player text can't run code
    li.append(meta, body);
    $('sugg-list').append(li);
  }
}
show();
