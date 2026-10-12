// Wrapper around jscwlib (global `jscw`, loaded in index.html).

export const MORSE = {
  A: '.-', B: '-...', C: '-.-.', D: '-..', E: '.', F: '..-.', G: '--.', H: '....', I: '..',
  J: '.---', K: '-.-', L: '.-..', M: '--', N: '-.', O: '---', P: '.--.', Q: '--.-', R: '.-.',
  S: '...', T: '-', U: '..-', V: '...-', W: '.--', X: '-..-', Y: '-.--', Z: '--..',
};

let player = null; // Created on first play: jscwlib opens its AudioContext in the constructor.
let playId = 0;     // ignores a late onFinished from a sound that was cut off

// jscwlib starts the tone 10 ms after play(). Audio devices that are waking up
// (Bluetooth/USB headsets) swallow that, cutting off the first letter.
const LEAD_IN_S = 0.4;

function getPlayer(wpm) {
  if (!player) player = new jscw({ wpm, freq: 650 });
  return player;
}

// Plays text at the given speed. onLetter(index) fires as each letter starts;
// onDone runs when playback finishes.
export function play(text, wpm, onDone, onLetter = () => {}) {
  getPlayer(wpm).startDelay = LEAD_IN_S;
  const id = ++playId;
  player.setWpm(wpm);
  player.onFinished = () => { if (id === playId) onDone(); };
  player.onCharacterPlay = ({ n }) => { if (id === playId) onLetter(n); };
  player.play(text);
}

// Short feedback beep for one symbol: '.' = dit, '-' = dah. No lead-in, so it feels instant.
export function beep(symbol) {
  getPlayer(20);
  if (player.init_done) player.stop(); // fast taps: cut the previous beep (stop() fails before the first play)
  player.startDelay = 0;
  playId++;
  player.setWpm(20);
  player.onFinished = null;
  player.onCharacterPlay = () => {};
  player.play(symbol === '.' ? 'E' : 'T');
}

export function stop() {
  playId++;
  if (player?.init_done) player.stop();
}
