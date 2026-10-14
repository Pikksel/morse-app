// Results popup: today's result, leaderboards (today / all-time), countdown to the next word.
import { getDailyLeaderboard, getAlltimeLeaderboard, getRank, getTurboLeaderboard } from './api.js';
import { MAX_TRIES, dailyWord, elapsedMs, formatTime, todayKey } from './game.js';
import { MORSE } from './morse.js';
import { BADGES } from './badges.js';
import { playSfx } from './sfx.js';

const $ = (id) => document.getElementById(id);

let me = '';          // logged-in callsign, highlighted in the tables
let tab = 'today';      // 'today' | 'alltime' | 'turbo'
let turboScope = 'today'; // Turbo tab: 'today' | 'alltime'
let loadId = 0;         // ignores slow answers after switching tabs
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

// The rank saved at submit time goes stale when others finish later: ask for the current one.
async function loadRank(state) {
  if (!state || state.status === 'playing' || !state.submitted || !me) return;
  try {
    const rank = await getRank(me, state.day);
    if (rank) {
      state.rank = rank;
      $('stat-rank').textContent = `#${rank}`;
    }
  } catch {} // offline: keep showing the saved rank
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

// Long lists scroll inside their own box: bring your row into view (without scrolling the popup).
function scrollToMe() {
  const box = $('board-scroll');
  const mine = $('board-body').querySelector('tr.me');
  box.scrollTop = mine ? mine.offsetTop - box.clientHeight / 2 + mine.offsetHeight : 0;
}

async function loadBoard() {
  const body = $('board-body');
  const note = $('board-note');
  $('board-today').setAttribute('aria-selected', tab === 'today');
  $('board-alltime').setAttribute('aria-selected', tab === 'alltime');
  $('board-turbo').setAttribute('aria-selected', tab === 'turbo');
  $('turbo-scope').hidden = tab !== 'turbo';
  $('turbo-scope-today').setAttribute('aria-pressed', turboScope === 'today');
  $('turbo-scope-alltime').setAttribute('aria-pressed', turboScope === 'alltime');
  body.innerHTML = '';
  note.textContent = 'Loading…';

  const id = ++loadId;
  const stale = () => id !== loadId; // switched tabs while loading
  try {
    if (tab === 'turbo') {
      $('board-head').replaceChildren(head(['#', 'Call', 'Best']));
      const rows = await getTurboLeaderboard(turboScope);
      if (stale()) return;
      for (const r of rows) body.append(row([r.rank, r.name, r.score], r.name === me));
      note.textContent = rows.length ? 'Best Turbo score per player.'
        : turboScope === 'today' ? 'No Turbo runs today yet. Be the first!' : 'No Turbo runs yet.';
      scrollToMe();
    } else if (tab === 'today') {
      $('board-head').replaceChildren(head(['#', 'Call', 'Tries', 'Time']));
      const rows = await getDailyLeaderboard(todayKey());
      if (stale()) return;
      for (const r of rows) {
        body.append(row([r.rank, r.name, triesText(r.guesses), formatTime(r.time_ms)], r.name === me));
      }
      note.textContent = rows.length ? '' : 'No scores yet today. Be the first!';
      scrollToMe();
    } else {
      $('board-head').replaceChildren(head(['#', 'Call', 'Games', 'Avg tries']));
      const rows = await getAlltimeLeaderboard();
      if (stale()) return;
      for (const r of rows) {
        body.append(row([r.rank, r.name, r.games, Number(r.avg_guesses).toFixed(1)], r.name === me));
      }
      note.textContent = rows.length
        ? `Players with 3+ games. A miss counts as ${MAX_TRIES + 1} tries.`
        : 'Nobody has 3 games yet.';
    }
  } catch (err) {
    if (!stale()) note.textContent = `Couldn't load the leaderboard: ${err.message}`;
  }
}

// ---------- New badges ----------

let pendingBadges = []; // earned before the popup opened: revealed once it's open

function revealBadges(ids) {
  const list = $('new-badges-list');
  list.innerHTML = '';
  ids.filter((id) => BADGES[id]).forEach((id, i) => {
    const { icon, name, desc } = BADGES[id];
    const card = document.createElement('div');
    card.className = 'badge-card';
    card.style.setProperty('--d', `${i * 350}ms`); // stagger, used by the CSS animations
    card.innerHTML = '<span class="badge-icon"></span><div><b class="badge-name"></b><span class="badge-desc"></span></div>';
    card.querySelector('.badge-icon').textContent = icon;
    card.querySelector('.badge-name').textContent = name;
    card.querySelector('.badge-desc').textContent = desc;
    list.append(card);
  });
  if (!list.children.length) return;

  $('new-badges-title').textContent = list.children.length > 1 ? 'New badges!' : 'New badge!';
  $('new-badges').hidden = false;
  // A badge with its own sound (e.g. First Contact) wins over the default one.
  playSfx(ids.map((id) => BADGES[id]?.sound).find(Boolean) ?? 'badge');
  $('new-badges').scrollIntoView({ behavior: 'smooth', block: 'nearest' });
}

// Shows "New badge!" cards below the leaderboard: right away if the popup is open, else after it opens.
export function showNewBadges(ids) {
  if (!ids.length) return;
  if ($('results').open) setTimeout(() => revealBadges(ids), 600);
  else pendingBadges = ids;
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
// tab: which leaderboard to show first ('today' | 'alltime' | 'turbo').
export function openResults(state, name, { tab: startTab = 'today' } = {}) {
  me = name;
  paintSummary(state);
  loadRank(state);
  tab = startTab;
  loadBoard();
  tickCountdown();
  clearInterval(countdownId);
  countdownId = setInterval(tickCountdown, 1000);
  if (!$('results').open) $('results').showModal();

  // Badges are a one-time reveal: hidden when the popup is reopened later.
  $('new-badges').hidden = true;
  if (pendingBadges.length) {
    const ids = pendingBadges;
    pendingBadges = [];
    setTimeout(() => revealBadges(ids), 1000); // after the word + list have been seen
  }
}

// Refresh after the score is saved (new rank, new row in the table).
export function refreshResults(state) {
  paintSummary(state);
  loadRank(state);
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
$('board-turbo').addEventListener('click', () => { tab = 'turbo'; loadBoard(); });
$('turbo-scope-today').addEventListener('click', () => { turboScope = 'today'; loadBoard(); });
$('turbo-scope-alltime').addEventListener('click', () => { turboScope = 'alltime'; loadBoard(); });
