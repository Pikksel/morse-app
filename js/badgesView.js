// Badges popup: every badge in a grid, unlocked ones with their date, locked ones grayed out.
import { getBadges } from './api.js';
import { BADGES } from './badges.js';

const $ = (id) => document.getElementById(id);

// '2026-10-13T…' → '10/13' (month/day, in the player's own time zone)
function shortDate(iso) {
  const d = new Date(iso);
  return `${String(d.getMonth() + 1).padStart(2, '0')}/${String(d.getDate()).padStart(2, '0')}`;
}

function square(id, earnedAt) {
  const { icon, name, desc } = BADGES[id];
  const el = document.createElement('button');
  el.type = 'button';
  el.className = 'badge-square' + (earnedAt ? '' : ' locked');
  el.innerHTML = '<span class="sq-icon"></span><span class="sq-name"></span><span class="sq-state"></span>';
  el.querySelector('.sq-icon').textContent = icon;
  el.querySelector('.sq-name').textContent = name;
  el.querySelector('.sq-state').textContent = earnedAt ? `Unlocked ${shortDate(earnedAt)}` : 'LOCKED';
  el.addEventListener('click', () => {
    $('badge-detail').textContent = `${icon} ${name}: ${desc}`;
  });
  return el;
}

async function load(name) {
  const grid = $('badge-grid');
  grid.innerHTML = '';
  $('badges-count').textContent = 'Loading…';
  $('badge-detail').textContent = 'Tap a badge to see how to earn it.';
  try {
    const earned = new Map((await getBadges(name)).map((b) => [b.badge_id, b.earned_at]));
    const ids = Object.keys(BADGES);
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
