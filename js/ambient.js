// Calm background movement for when the player isn't actively playing (menus, popups, game over):
// a few slow, dim dits and dahs drifting up, plus a faint drifting glow. Fades out during play.

const MAX_PARTICLES = 12;
const SPAWN_MS = 2200;

const layer = document.createElement('div');
layer.id = 'ambient';
layer.className = 'ambient';
layer.setAttribute('aria-hidden', 'true');
layer.innerHTML = '<div class="amb-glow a"></div><div class="amb-glow b"></div>';
document.body.prepend(layer);

const calm = matchMedia('(prefers-reduced-motion: reduce)').matches;
let spawnId = null;

function spawn() {
  if (layer.querySelectorAll('.amb-particle').length >= MAX_PARTICLES) return;
  const p = document.createElement('span');
  p.className = `amb-particle ${Math.random() < 0.5 ? 'dit' : 'dah'}`;
  p.style.left = `${Math.random() * 100}%`;
  p.style.setProperty('--sway', `${(Math.random() - 0.5) * 60}px`);
  p.style.setProperty('--tilt', `${(Math.random() - 0.5) * 30}deg`);
  p.style.animationDuration = `${20 + Math.random() * 12}s`;
  p.addEventListener('animationend', () => p.remove());
  layer.append(p);
}

// on = not playing right now. Particles already floating finish their trip; no new ones while off.
export function setAmbient(on) {
  if (layer.classList.contains('on') === on) return;
  layer.classList.toggle('on', on);
  clearInterval(spawnId);
  spawnId = null;
  if (on && !calm) {
    spawn();
    spawnId = setInterval(spawn, SPAWN_MS);
  }
}
