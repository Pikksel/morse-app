// Title screen: "PLAY" inside a ring that spells PLAY in Morse, as dots and dashes.
import { MORSE, primeAudio } from './morse.js';
import { playSfx } from './sfx.js';
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

// Shows the title screen; resolves once the player has tapped PLAY and the exit animation is done.
export function runSplash() {
  buildRing();
  return new Promise((resolve) => {
    $('splash-play').addEventListener('click', () => {
      playSfx('enter', loadPlayer()?.name); // VIP players get their own sound (see sfx.js)
      primeAudio(); // the tap counts as permission to play sound: unlock the Morse audio now
      $('splash').classList.add('leaving');
      setTimeout(resolve, 650); // matches the .leaving animations in style.css
    }, { once: true });
  });
}
