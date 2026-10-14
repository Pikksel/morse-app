// Reveals new badges one at a time (Daily results popup and Turbo game over use the same thing).
import { BADGES } from './badges.js';
import { playSfx } from './sfx.js';

const GAP_MS = 2000; // time between two badges

// Adds a card per badge to `list`, 2 s apart, each with its pop-in animation and sound.
// prefix: text before the name (e.g. "New badge: "). onEach(i): called as card i appears.
// stillShowing(): checked before each badge; false (popup closed, new game…) stops the rest.
// Returns a function that cancels the badges still waiting.
export function revealSequence(list, ids, { prefix = '', onEach, stillShowing = () => true } = {}) {
  list.innerHTML = '';
  const known = ids.filter((id) => BADGES[id]);
  const timers = known.map((id, i) => setTimeout(() => {
    if (!stillShowing()) return cancel();
    const { icon, name, desc, sound } = BADGES[id];
    const card = document.createElement('div');
    card.className = 'badge-card';
    card.innerHTML = '<span class="badge-icon"></span><div><b class="badge-name"></b><span class="badge-desc"></span></div>';
    card.querySelector('.badge-icon').textContent = icon;
    card.querySelector('.badge-name').textContent = prefix + name;
    card.querySelector('.badge-desc').textContent = desc;
    list.append(card);
    playSfx(sound ?? 'newBadge'); // a badge with its own sound (First Contact) keeps it
    onEach?.(i, card);
  }, i * GAP_MS));
  const cancel = () => timers.forEach(clearTimeout);
  return cancel;
}
