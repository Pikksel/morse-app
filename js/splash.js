// Title screen: "PLAY" inside a ring that spells PLAY in Morse, as dots and dashes.
import { MORSE, primeAudio } from './morse.js';
import { playSfx, playPitched } from './sfx.js';
import { loadPlayer } from './player.js';
import { nextFact } from './facts.js';

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
  $('splash-ring-shine').setAttribute('stroke-dasharray', dashes.join(' ')); // overlay uses the same dashes
}

// ---------- Water ripples (tap anywhere outside the PLAY ring) ----------

const RIPPLE_RADIUS = 280;   // px a ripple grows to
const RIPPLE_MS = 1500;      // how long it takes (grows at a steady speed, see .ripple in style.css)
const RIPPLE_RINGS = 3;      // rings per tap: thick → thin → faint
const RIPPLE_GAP_MS = 170;   // delay between those rings
const SHIMMER_COOLDOWN_MS = 300; // ring-hit sound: every hit, but rapid taps don't stack
let lastShimmer = 0;

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
    if ($('splash').classList.contains('leaving')) return; // PLAY already tapped
    const play = $('splash-play');
    play.classList.remove('hit');
    void play.offsetWidth; // restart the animation
    play.classList.add('hit');
    shineFrom(x, y);
    const now = performance.now();
    if (now - lastShimmer > SHIMMER_COOLDOWN_MS) {
      lastShimmer = now;
      playPitched('shimmer');
    }
  }, (distance / RIPPLE_RADIUS) * RIPPLE_MS);
}

// Light and shadow sweep through the Morse dashes, entering from the side the ripple came from:
// the ring's calm glow is briefly "disrupted".
function shineFrom(x, y) {
  const svg = document.querySelector('.splash-ring');
  const box = svg.getBoundingClientRect();
  const toRipple = Math.atan2(y - (box.top + box.height / 2), x - (box.left + box.width / 2)) * 180 / Math.PI;
  const m = new DOMMatrix(getComputedStyle(svg).transform); // the ring is slowly spinning
  const spin = Math.atan2(m.b, m.a) * 180 / Math.PI;
  // The gradient's band moves along its own x axis: point that axis away from the ripple.
  const angle = toRipple - spin + 180;
  $('ring-shine').setAttribute('gradientTransform', `rotate(${angle.toFixed(1)} 130 130)`);
  $('ring-shine-sweep').beginElement();
  const shine = $('splash-ring-shine');
  shine.classList.remove('on');
  void shine.getBoundingClientRect(); // restart the fade
  shine.classList.add('on');
}

// ---------- Easter egg: tap like crazy and a shark swims by ----------

const SHARK_TAPS = 15;          // this many taps…
const SHARK_WINDOW_MS = 6000;   // …within this time
const SHARK_COOLDOWN_MS = 60000;
const SHARK_SWIM_MS = 7000;   // = the length of sounds/shark.mp3
const SHARK_PEAK_MS = 5000;   // colors drained the most here, then they come back
const SHARK_GRAY = 'saturate(0.2) brightness(0.85)';
let tapTimes = [];
let lastShark = -Infinity;

// Side view, facing right. The tail is its own group so it can sway around the joint.
const SHARK_SVG = `
<svg viewBox="0 0 200 72" aria-hidden="true">
  <g class="shark-tail">
    <path d="M40 36 L30 37 Q18 29 4 8 Q14 28 21 38 Q14 48 9 62 Q22 47 30 41 L40 42 Z" />
  </g>
  <path class="shark-body" d="M38 37 C55 30 75 26 96 24 Q104 15 106 2 L107 1 Q114 13 126 22
    C150 21 175 25 190 32 Q199 36 196 39 C188 44 175 46 160 46 L146 47 Q140 57 128 67
    Q128 57 124 50 C100 53 70 49 50 44 L38 42 Z" />
</svg>`;

function countTap() {
  const now = performance.now();
  tapTimes = tapTimes.filter((t) => now - t < SHARK_WINDOW_MS);
  tapTimes.push(now);
  if (tapTimes.length >= SHARK_TAPS && now - lastShark > SHARK_COOLDOWN_MS) {
    lastShark = now;
    tapTimes = [];
    shark();
  }
}

// The whole scene loses its color as the shark passes: slowly down to the peak, then back.
// (A CSS transition on `filter`, so it doesn't clash with the splash's own animations.)
function drainColors() {
  const splash = $('splash');
  splash.style.transition = `filter ${SHARK_PEAK_MS}ms ease-in`;
  splash.style.filter = SHARK_GRAY;
  setTimeout(() => {
    splash.style.transition = `filter ${SHARK_SWIM_MS - SHARK_PEAK_MS}ms ease-out`;
    splash.style.filter = '';
  }, SHARK_PEAK_MS);
}

function shark() {
  const fromRight = Math.random() < 0.5;
  const el = document.createElement('div');
  el.className = `shark${fromRight ? ' rtl' : ''}`;
  el.style.top = `${25 + Math.random() * 40}%`;
  el.style.animationDuration = `${SHARK_SWIM_MS}ms`;
  el.innerHTML = `<div class="shark-bob">${SHARK_SVG}</div>`;
  el.addEventListener('animationend', (e) => { if (e.target === el) el.remove(); });
  $('particles-back').append(el); // deep layer: behind the ring, same slow parallax
  playSfx('shark');
  drainColors();

  // Dits and dahs near the shark get pushed out of its way.
  const scatterId = setInterval(() => {
    if (!el.isConnected) return clearInterval(scatterId);
    const s = el.getBoundingClientRect();
    const sx = s.left + s.width / 2;
    const sy = s.top + s.height / 2;
    for (const p of document.querySelectorAll('.particle:not(.scattered)')) {
      const r = p.getBoundingClientRect();
      const dx = r.left - sx;
      const dy = r.top - sy;
      if (Math.abs(dx) < s.width * 0.55 && Math.abs(dy) < s.height * 1.2) {
        p.classList.add('scattered');
        const away = dy < 0 ? -1 : 1;
        p.style.translate = `${(fromRight ? -1 : 1) * (30 + Math.random() * 50)}px ${away * (60 + Math.random() * 80)}px`;
      }
    }
  }, 120);
}

// ---------- Fun Morse fact: tap exactly 5 times, then pause ----------

const FACT_TAPS = 5;
const FACT_PAUSE_MS = 1500;   // quiet time after the 5th tap (more taps = no fact, maybe a shark)
const FACT_SHOW_MS = 10000;
const POOF_MS = 1400;         // the "cloud" at the end
let burst = 0;
let burstTimer = null;
let factShowing = false;

function countBurst() {
  burst++;
  clearTimeout(burstTimer);
  burstTimer = setTimeout(() => {
    if (burst === FACT_TAPS && !factShowing && !$('splash').classList.contains('leaving')) showFact();
    burst = 0;
    tapTimes = []; // a pause also resets the shark: it needs one continuous tapping frenzy
  }, FACT_PAUSE_MS);
}

function showFact() {
  factShowing = true;
  const card = document.createElement('div');
  card.className = 'fact';
  card.setAttribute('role', 'status');
  card.innerHTML = '<span class="fact-label">Fun Morse fact</span><p></p>';
  card.querySelector('p').textContent = nextFact();
  $('splash').append(card);

  setTimeout(() => poof(card), FACT_SHOW_MS);
}

// The card blurs, swells and fades while soft puffs of smoke drift out of it.
function poof(card) {
  card.classList.add('poof');
  for (let i = 0; i < 14; i++) {
    const puff = document.createElement('span');
    puff.className = 'puff';
    puff.style.left = `${10 + Math.random() * 80}%`;
    puff.style.top = `${20 + Math.random() * 60}%`;
    puff.style.setProperty('--dx', `${(Math.random() - 0.5) * 120}px`);
    puff.style.setProperty('--dy', `${-20 - Math.random() * 60}px`);
    puff.style.animationDelay = `${Math.random() * 250}ms`;
    card.append(puff);
  }
  setTimeout(() => { card.remove(); factShowing = false; }, POOF_MS);
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
    if (!calm) countTap(); // easter egg
    countBurst();          // 5 taps + pause = a fun Morse fact
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
