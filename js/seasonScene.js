// 🎃 Title screen scenery during Halloween (js/season.js): stars, a moon, three rows of pines
// and bats flying past now and then. All SVG, built here, so normal days load nothing extra.
// Only on the title screen: the returned stop() runs when PLAY is tapped.

import { playSfx } from './sfx.js';

const $ = (id) => document.getElementById(id);
const WITCH_GIGGLE_MS = 700; // ≈ when the witch's broom reaches the left edge of the screen
const THUNDER_DELAY_MS = 900; // light first, sound a moment later (like a storm a few hundred metres away)
const WOLF_MIN_MS = 15000;    // 🐺 at least this long between howls…
const WOLF_EXTRA_MS = 15000;  // …plus up to this much more, at random

// Same "random" numbers every load, so the forest and stars always look the same.
function seeded(seed) {
  return () => (seed = (seed * 16807) % 2147483647) / 2147483647;
}

// One pine: three stacked tiers, base at y. w = width, h = height.
function pine(x, y, w, h) {
  const p = (dx, f) => `${(x + w * dx).toFixed(1)} ${(y - h * f).toFixed(1)}`;
  return `M${p(-0.5, 0)} L${p(-0.18, 0.34)} L${p(-0.36, 0.34)} L${p(-0.12, 0.64)} L${p(-0.26, 0.64)} L${p(0, 1)}
    L${p(0.26, 0.64)} L${p(0.12, 0.64)} L${p(0.36, 0.34)} L${p(0.18, 0.34)} L${p(0.5, 0)} Z`;
}

// A row of pines across a 1000 × 300 drawing, standing on a strip of ground.
function forestRow(seed, count, minH, maxH) {
  const rnd = seeded(seed);
  let d = 'M-40 300 L-40 286 L1040 286 L1040 300 Z';
  for (let i = 0; i < count; i++) {
    const x = -30 + (i + 0.5 + (rnd() - 0.5) * 0.7) * (1060 / count);
    const h = minH + rnd() * (maxH - minH);
    d += pine(x, 290, h * (0.42 + rnd() * 0.12), h);
  }
  return `<svg viewBox="0 0 1000 300" preserveAspectRatio="xMidYMax slice"><path d="${d}" /></svg>`;
}

function stars(count) {
  const rnd = seeded(7);
  let dots = '';
  for (let i = 0; i < count; i++) {
    const twinkle = i % 5 === 0 ? ' class="twinkle"' : '';
    dots += `<circle${twinkle} cx="${(rnd() * 1000).toFixed(0)}" cy="${(rnd() * 420).toFixed(0)}" r="${(0.8 + rnd() * 1.6).toFixed(1)}" />`;
  }
  return `<svg class="stars" viewBox="0 0 1000 600" preserveAspectRatio="xMidYMin slice">${dots}</svg>`;
}

const MOON = `
<svg class="moon" viewBox="0 0 100 100">
  <defs>
    <radialGradient id="moon-fill" cx="40%" cy="38%" r="65%">
      <stop offset="0" stop-color="#fff6e0" /><stop offset="0.6" stop-color="#ffd59a" /><stop offset="1" stop-color="#f3a75a" />
    </radialGradient>
  </defs>
  <circle cx="50" cy="50" r="46" fill="url(#moon-fill)" />
  <circle cx="34" cy="40" r="8" class="crater" /><circle cx="62" cy="30" r="5" class="crater" />
  <circle cx="58" cy="64" r="10" class="crater" /><circle cx="30" cy="68" r="4" class="crater" />
</svg>`;

// Seen from the front: ears up, wings raised, scalloped edge underneath. The whole bat flaps (scaleX) inside .bat-flap.
const BAT = `
<svg viewBox="0 0 60 26">
  <path d="M27 4 L28.5 8 L31.5 8 L33 4 L34 9 C40 5 50 2 60 2 Q58 8 54 12 Q50 8 46 13 Q42 10 38 15 Q35 14 32 19
           L30 21 L28 19 Q25 14 22 15 Q18 10 14 13 Q10 8 6 12 Q2 8 0 2 C10 2 20 5 26 9 Z" />
</svg>`;

const MAX_BATS = 3;

export function addSeasonScene({ calm }) {
  const scene = document.createElement('div');
  scene.className = 'season-scene';
  scene.setAttribute('aria-hidden', 'true');
  scene.innerHTML = `
    <div class="sky-layer">${stars(60)}${MOON}</div>
    <div class="lightning"></div>
    <div id="bolt-layer" class="bolt-layer"></div>
    <div id="witch-layer" class="witch-layer"></div>
    <div id="bats" class="bats"></div>
    <div class="forest far">${forestRow(11, 22, 90, 170)}</div>
    <div class="forest mid">${forestRow(23, 15, 110, 210)}</div>
    <div class="forest near">${forestRow(37, 9, 120, 250)}</div>`;
  document.querySelector('.splash-deep').prepend(scene); // behind the embers and ripples

  if (calm) return () => {}; // reduced motion: the scene stays, no bats (and no witch, see summonWitch)

  let timer = null;
  const nextBat = () => {
    timer = setTimeout(() => {
      if ($('bats').children.length < MAX_BATS) bat();
      nextBat();
    }, 4000 + Math.random() * 5000);
  };
  timer = setTimeout(() => { bat(); nextBat(); }, 1500);

  // ⚡ Lightning every 20–40 s: a bolt + the sky flashes, then thunder and a short rumble of the scene.
  let flashTimer = null;
  const nextFlash = () => {
    flashTimer = setTimeout(() => {
      strike(scene);
      nextFlash();
    }, 20000 + Math.random() * 20000);
  };
  nextFlash();

  // 🐺 A wolf howls somewhere in the forest now and then (at least 15 s apart).
  let wolfTimer = null;
  const nextHowl = () => {
    wolfTimer = setTimeout(() => {
      if (!$('splash').classList.contains('leaving')) playSfx('wolf');
      nextHowl();
    }, WOLF_MIN_MS + Math.random() * WOLF_EXTRA_MS);
  };
  nextHowl();

  return () => { clearTimeout(timer); clearTimeout(flashTimer); clearTimeout(wolfTimer); };
}

// Restarts a one-shot CSS animation class on an element.
function replay(el, cls) {
  el.classList.remove(cls);
  void el.offsetWidth;
  el.classList.add(cls);
}

function strike(scene) {
  replay(scene.querySelector('.lightning'), 'flash');
  bolt();
  setTimeout(() => {
    if ($('splash').classList.contains('leaving')) return; // PLAY tapped meanwhile: no thunder
    playSfx('thunder');
    replay(scene, 'rumble');
  }, THUNDER_DELAY_MS);
}

// A jagged bolt from the top of the sky down toward the trees, with one side branch. New shape every time.
// Drawn in a 60 × 100 box that is stretched to the layer (non-scaling stroke keeps the line thin).
function boltPath() {
  const pts = [[0, 0]];
  let x = 0, y = 0;
  while (y < 100) {
    y = Math.min(100, y + 6 + Math.random() * 10);
    x = Math.max(-26, Math.min(26, x + (Math.random() - 0.5) * 16));
    pts.push([x, y]);
  }
  const line = (p) => p.map(([px, py]) => `${px.toFixed(1)} ${py.toFixed(1)}`).join(' L');
  let [bx, by] = pts[Math.floor(pts.length * (0.3 + Math.random() * 0.3))];
  const dir = Math.random() < 0.5 ? -1 : 1;
  const branch = [[bx, by]];
  for (let i = 0; i < 3; i++) { bx += dir * (4 + Math.random() * 7); by += 5 + Math.random() * 8; branch.push([bx, by]); }
  return `M${line(pts)} M${line(branch)}`;
}

function bolt() {
  const el = document.createElement('div');
  el.className = 'bolt';
  el.style.left = `${10 + Math.random() * 80}%`;
  el.innerHTML = `<svg viewBox="-30 0 60 100" preserveAspectRatio="none">
    <path d="${boltPath()}" vector-effect="non-scaling-stroke" /></svg>`;
  el.addEventListener('animationend', (e) => { if (e.target === el) el.remove(); });
  $('bolt-layer').append(el);
}

// 🧙 The witch flies when the player taps the title screen (splash.js calls this), one at a time.
// Crosses left → right at moon height (graphics/witch.svg faces right).
export function summonWitch() {
  const layer = $('witch-layer');
  if (!layer || layer.children.length) return; // no Halloween scene, or she's already flying
  if (matchMedia('(prefers-reduced-motion: reduce)').matches) return;
  const el = document.createElement('div');
  el.className = 'witch';
  el.innerHTML = '<img src="graphics/witch.svg" alt="">';
  el.addEventListener('animationend', (e) => { if (e.target === el) el.remove(); });
  layer.append(el);
  // She starts just off the left edge: giggle as she comes into view.
  setTimeout(() => { if (el.isConnected && !$('splash').classList.contains('leaving')) playSfx('witchGiggle'); }, WITCH_GIGGLE_MS);
}

function bat() {
  const el = document.createElement('div');
  el.className = `bat${Math.random() < 0.5 ? ' rtl' : ''}`;
  el.style.top = `${6 + Math.random() * 34}%`;
  el.style.width = `${28 + Math.random() * 26}px`;
  el.style.animationDuration = `${6 + Math.random() * 4}s`;
  el.innerHTML = `<div class="bat-bob"><div class="bat-flap">${BAT}</div></div>`;
  el.addEventListener('animationend', (e) => { if (e.target === el) el.remove(); });
  $('bats').append(el);
}
