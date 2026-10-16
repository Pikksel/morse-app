// Badges popup: every badge in a grid, unlocked ones with their date, locked ones grayed out.
import { getBadges, getBadgeCounts } from './api.js';
import { BADGES, badgeIdsFor } from './badges.js';
import { getMode, isEasy } from './mode.js';
import { todayKey } from './game.js';
import { playSfx } from './sfx.js';

const $ = (id) => document.getElementById(id);

// '2026-10-13T…' → 'today' / 'yesterday' / '3 days ago' (calendar days, same clock as the Daily)
function daysAgo(iso) {
  const days = Math.round((Date.parse(todayKey()) - Date.parse(todayKey(new Date(iso)))) / 86400000);
  if (days <= 0) return 'today';
  if (days === 1) return 'yesterday';
  return `${days} days ago`;
}

let counts = new Map(); // badge id → number of players who have it

const ownersText = (n) => (n === 0 ? 'Nobody has this yet' : n === 1 ? '1 player has this' : `${n} players have this`);

function square(id, earnedAt) {
  const { icon, name, desc } = BADGES[id];
  const el = document.createElement('button');
  el.type = 'button';
  el.className = 'badge-square' + (earnedAt ? '' : ' locked');
  el.innerHTML = '<span class="sq-icon"></span><span class="sq-name"></span><span class="sq-state"></span>';
  el.querySelector('.sq-icon').textContent = icon;
  el.querySelector('.sq-name').textContent = name;
  el.querySelector('.sq-state').textContent = earnedAt ? `Unlocked ${daysAgo(earnedAt)}` : 'LOCKED';
  el.addEventListener('click', () => {
    playSfx(earnedAt ? 'badgeTap' : 'badgeTapNo');
    // Only one badge is selected at a time: the highlight moves to the tapped one.
    $('badge-grid').querySelector('.selected')?.classList.remove('selected');
    el.classList.add('selected');
    // The square already shows icon + name: here how to earn it, and how many players have it.
    const owners = document.createElement('em');
    owners.textContent = ownersText(counts.get(id) ?? 0);
    $('badge-detail').replaceChildren(desc, owners);
  });
  return el;
}

async function load(name) {
  const grid = $('badge-grid');
  grid.innerHTML = '';
  $('badges-title').textContent = isEasy() ? '🐣 Easy badges' : 'Badges';
  $('badges-count').textContent = 'Loading…';
  $('badge-detail').textContent = 'Tap a badge to see how to earn it.';
  try {
    const [mine, all] = await Promise.all([getBadges(name), getBadgeCounts().catch(() => [])]);
    const earned = new Map(mine.map((b) => [b.badge_id, b.earned_at]));
    counts = new Map(all.map((c) => [c.badge_id, Number(c.players)]));
    const ids = badgeIdsFor(getMode());
    for (const id of ids) grid.append(square(id, earned.get(id)));
    const count = ids.filter((id) => earned.has(id)).length;
    $('badges-count').textContent = `${count} of ${ids.length} unlocked`;
  } catch (err) {
    $('badges-count').textContent = `Couldn't load badges: ${err.message}`;
  }
}

export function openBadges(name) {
  load(name);
  if (!$('badges').open) $('badges').showModal();
}

$('badges-close').addEventListener('click', () => $('badges').close());
// Click on the dimmed backdrop (outside the box) closes too.
$('badges').addEventListener('click', (e) => {
  const r = $('badges').getBoundingClientRect();
  const outside = e.clientX < r.left || e.clientX > r.right || e.clientY < r.top || e.clientY > r.bottom;
  if (e.target === $('badges') && outside) $('badges').close();
});
