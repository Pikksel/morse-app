// Title screen: "PLAY" inside a ring that spells PLAY in Morse, as dots and dashes.
import { MORSE, primeAudio } from './morse.js';
import { playSfx, playPitched } from './sfx.js';
import { loadPlayer } from './player.js';

const $ = (id) => document.getElementById(id);

const RING_WORD = 'PLAY';
const REPEATS = 3;   // how many times the word goes around the ring
const STROKE = 5;    // ring thickness; must match stroke-width in index.html

// Morse timing in units: dot 1, dash 3, gap inside a letter 1, between letters 3, between words 7.
// Returns [on, off, on, off, ...] for one copy of the word.
function morseUnits(word) {
  const units = [];
  for (const letter of word) {
    for (const symbol of MORSE[letter]) units.push(symbol === '.' ? 1 : 3, 1);
    units[units.length - 1] = 3; // letter gap
  }
  units[units.length - 1] = 7;   // word gap before the next copy
  return units;
}

// Turns the Morse units into an SVG stroke-dasharray that fits the ring exactly.
// Round line caps add half the stroke at each end, so "on" parts get shorter and gaps longer:
// a dot becomes a round dot, a dash a short pill.
function buildRing() {
  const circle = $('splash-ring');
  const circumference = 2 * Math.PI * circle.r.baseVal.value;
  const units = morseUnits(RING_WORD);
  const total = units.reduce((a, b) => a + b, 0) * REPEATS;
  const u = circumference / total;
  const dashes = [];
  let extra = 0; // a dot shorter than the round cap gets rounded up: take that from the next gap
  units.forEach((n, i) => {
    if (i % 2 === 0) {
      const on = n * u - STROKE;
      dashes.push(Math.max(0.01, on));
      extra = Math.max(0, 0.01 - on);
    } else {
      dashes.push(n * u + STROKE - extra);
    }
  });
  circle.setAttribute('stroke-dasharray', dashes.join(' '));
}

// ---------- Water ripples (tap anywhere outside the PLAY ring) ----------

const RIPPLE_RADIUS = 280;   // px a ripple grows to
const RIPPLE_MS = 1500;      // how long it takes (grows at a steady speed, see .ripple in style.css)
const RIPPLE_RINGS = 3;      // rings per tap: thick → thin → faint
const RIPPLE_GAP_MS = 170;   // delay between those rings
const SONAR_CHANCE = 0.35;   // a ring hit plays the sonar ping about 1 in 3 times…
const SONAR_COOLDOWN_MS = 2000; // …and never within 2 s of the previous ping
let lastSonar = 0;

function ripple(x, y) {
  for (let i = 0; i < RIPPLE_RINGS; i++) {
    const ring = document.createElement('span');
    ring.className = `ripple r${i}`;
    ring.style.left = `${x}px`;
    ring.style.top = `${y}px`;
    ring.style.width = ring.style.height = `${RIPPLE_RADIUS * 2}px`;
    ring.style.animationDelay = `${i * RIPPLE_GAP_MS}ms`;
    ring.addEventListener('animationend', () => ring.remove());
    $('ripples').append(ring);
  }
  ringHitLater(x, y);
}

// The first ripple grows at a steady speed, so we know when it reaches the PLAY ring.
function ringHitLater(x, y) {
  const box = $('splash-play').getBoundingClientRect();
  const cx = box.left + box.width / 2;
  const cy = box.top + box.height / 2;
  const circle = $('splash-ring');
  const ringRadius = (box.width / 2) * (circle.r.baseVal.value / 130); // ring r=118 in a 260-wide drawing
  const distance = Math.abs(Math.hypot(x - cx, y - cy) - ringRadius); // to the nearest point of the ring
  if (distance > RIPPLE_RADIUS) return; // fades out before it gets there
  setTimeout(() => {
    const play = $('splash-play');
    play.classList.remove('hit');
    void play.offsetWidth; // restart the animation
    play.classList.add('hit');
    maybeSonar();
  }, (distance / RIPPLE_RADIUS) * RIPPLE_MS);
}

// Sometimes the ring answers with a sonar ping: random, and never stacked on top of the last one.
function maybeSonar() {
  if ($('splash').classList.contains('leaving')) return; // PLAY already tapped
  const now = performance.now();
  if (now - lastSonar < SONAR_COOLDOWN_MS || Math.random() > SONAR_CHANCE) return;
  lastSonar = now;
  playPitched('sonar');
}

// ---------- Floating dits and dahs ----------

const AMBIENT = 8;          // always drifting
const MAX_PARTICLES = 40;   // taps add more, up to this
const PER_TAP = 2;

function spawnParticle() {
  if (document.querySelectorAll('.particle').length >= MAX_PARTICLES) return;
  const deep = Math.random() < 0.4; // 40% in the deep layer: bigger, darker, slower
  const p = document.createElement('span');
  p.className = `particle ${Math.random() < 0.5 ? 'dit' : 'dah'}`;
  p.style.left = `${Math.random() * 100}%`;
  p.style.setProperty('--sway', `${(Math.random() - 0.5) * 80}px`);
  p.style.setProperty('--tilt', `${(Math.random() - 0.5) * 40}deg`);
  p.style.animationDuration = `${(deep ? 16 : 10) + Math.random() * 8}s`;
  p.addEventListener('animationend', () => p.remove()); // gone at the top: no endless pile-up
  $(deep ? 'particles-back' : 'particles-front').append(p);
}

// Keeps a few ambient particles going; taps add extra ones on top.
function keepAmbient() {
  const ambient = document.querySelectorAll('.particle').length;
  if (ambient < AMBIENT) spawnParticle();
}

// ---------- Parallax: layers shift with the mouse or phone tilt ----------

function setParallax(x, y) { // -1 … 1
  $('splash').style.setProperty('--px', Math.max(-1, Math.min(1, x)).toFixed(3));
  $('splash').style.setProperty('--py', Math.max(-1, Math.min(1, y)).toFixed(3));
}
const onPointerMove = (e) => setParallax(e.clientX / innerWidth * 2 - 1, e.clientY / innerHeight * 2 - 1);
// Android sends tilt freely; iPhone needs a permission prompt, so there it simply stays still.
const onTilt = (e) => { if (e.gamma != null) setParallax(e.gamma / 30, (e.beta - 45) / 30); };

// ---------- Start ----------

// Shows the title screen; resolves once the player has tapped PLAY and the exit animation is done.
export function runSplash() {
  buildRing();
  const calm = matchMedia('(prefers-reduced-motion: reduce)').matches;

  const onTap = (e) => {
    if (e.target.closest('#splash-play')) return; // the PLAY ring itself starts the game
    playPitched('tap'); // one sound per tap (not per ripple ring), random pitch each time
    ripple(e.clientX, e.clientY);
    if (!calm) for (let i = 0; i < PER_TAP; i++) spawnParticle();
  };
  $('splash').addEventListener('pointerdown', onTap);

  let ambientId = null;
  if (!calm) {
    for (let i = 0; i < 4; i++) spawnParticle(); // a few right away
    ambientId = setInterval(keepAmbient, 1200);
    addEventListener('pointermove', onPointerMove);
    addEventListener('deviceorientation', onTilt);
  }

  return new Promise((resolve) => {
    $('splash-play').addEventListener('click', () => {
      playSfx('enter', loadPlayer()?.name); // VIP players get their own sound (see sfx.js)
      primeAudio(); // the tap counts as permission to play sound: unlock the Morse audio now
      $('splash').classList.add('leaving');
      // Title screen is done: stop everything it runs in the background.
      clearInterval(ambientId);
      $('splash').removeEventListener('pointerdown', onTap);
      removeEventListener('pointermove', onPointerMove);
      removeEventListener('deviceorientation', onTilt);
      setTimeout(resolve, 650); // matches the .leaving animations in style.css
    }, { once: true });
  });
}
