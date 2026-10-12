// Results popup: today's result, leaderboards (today / all-time), countdown to the next word.
import { getDailyLeaderboard, getAlltimeLeaderboard } from './api.js';
import { MAX_TRIES, dailyWord, elapsedMs, formatTime, todayKey } from './game.js';
import { MORSE } from './morse.js';

const $ = (id) => document.getElementById(id);

let me = '';          // logged-in callsign, highlighted in the tables
let tab = 'today';
let countdownId = null;

// ---------- Summary ----------

function paintSummary(state) {
  const finished = state && state.status !== 'playing';
  $('result-summary').hidden = !finished;
  $('board-title').hidden = finished;
  if (!finished) return;

  const answer = dailyWord(state.day);
  $('results-title').textContent = state.status === 'won' ? 'Solved!' : 'Out of tries';
  $('result-word').textContent = answer;
  $('result-morse').textContent = [...answer].map((c) => MORSE[c]).join('   ');
  $('stat-tries').textContent = state.status === 'won' ? `${state.tries}/${MAX_TRIES}` : '✗';
  $('stat-time').textContent = formatTime(elapsedMs(state));
  $('stat-rank').textContent = state.rank ? `#${state.rank}` : '–';
}

export function setStatus(text) {
  $('result-status').textContent = text;
}

// ---------- Leaderboard ----------

const triesText = (n) => (n > MAX_TRIES ? '✗' : String(n));

function row(cells, isMe) {
  const tr = document.createElement('tr');
  if (isMe) tr.className = 'me';
  for (const text of cells) {
    const td = document.createElement('td');
    td.textContent = text;
    tr.append(td);
  }
  return tr;
}

function head(cells) {
  const tr = document.createElement('tr');
  for (const text of cells) {
    const th = document.createElement('th');
    th.textContent = text;
    tr.append(th);
  }
  return tr;
}

async function loadBoard() {
  const body = $('board-body');
  const note = $('board-note');
  $('board-today').setAttribute('aria-selected', tab === 'today');
  $('board-alltime').setAttribute('aria-selected', tab === 'alltime');
  body.innerHTML = '';
  note.textContent = 'Loading…';

  const current = tab;
  try {
    if (tab === 'today') {
      $('board-head').replaceChildren(head(['#', 'Call', 'Tries', 'Time']));
      const rows = await getDailyLeaderboard(todayKey());
      if (current !== tab) return; // switched tabs while loading
      for (const r of rows) {
        body.append(row([r.rank, r.name, triesText(r.guesses), formatTime(r.time_ms)], r.name === me));
      }
      note.textContent = rows.length ? '' : 'No scores yet today. Be the first!';
    } else {
      $('board-head').replaceChildren(head(['#', 'Call', 'Games', 'Avg tries']));
      const rows = await getAlltimeLeaderboard();
      if (current !== tab) return;
      for (const r of rows) {
        body.append(row([r.rank, r.name, r.games, Number(r.avg_guesses).toFixed(1)], r.name === me));
      }
      note.textContent = rows.length
        ? 'Players with 3+ games. A miss counts as 22 tries.'
        : 'Nobody has 3 games yet.';
    }
  } catch (err) {
    if (current === tab) note.textContent = `Couldn't load the leaderboard: ${err.message}`;
  }
}

// ---------- Countdown to 00:00 UTC ----------

function tickCountdown() {
  const now = new Date();
  const next = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() + 1);
  const s = Math.max(0, Math.floor((next - now) / 1000));
  const hh = String(Math.floor(s / 3600)).padStart(2, '0');
  const mm = String(Math.floor((s % 3600) / 60)).padStart(2, '0');
  const ss = String(s % 60).padStart(2, '0');
  $('countdown').textContent = s ? `${hh}:${mm}:${ss}` : 'now. Reload the page!';
}

// ---------- Public ----------

// state: today's game (summary shown only if finished). name: the logged-in callsign.
export function openResults(state, name) {
  me = name;
  paintSummary(state);
  tab = 'today';
  loadBoard();
  tickCountdown();
  clearInterval(countdownId);
  countdownId = setInterval(tickCountdown, 1000);
  if (!$('results').open) $('results').showModal();
}

// Refresh after the score is saved (new rank, new row in the table).
export function refreshResults(state) {
  paintSummary(state);
  loadBoard();
}

$('results-close').addEventListener('click', () => $('results').close());
$('results').addEventListener('close', () => clearInterval(countdownId));
// Click on the dimmed backdrop (outside the box) closes too.
$('results').addEventListener('click', (e) => {
  const r = $('results').getBoundingClientRect();
  const outside = e.clientX < r.left || e.clientX > r.right || e.clientY < r.top || e.clientY > r.bottom;
  if (e.target === $('results') && outside) $('results').close();
});
$('board-today').addEventListener('click', () => { tab = 'today'; loadBoard(); });
$('board-alltime').addEventListener('click', () => { tab = 'alltime'; loadBoard(); });
