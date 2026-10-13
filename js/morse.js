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

// Phones in silent mode mute Web Audio (it counts as "ambient" sound) but still play media
// (<audio>, video, music). So jscwlib's output is sent through a hidden <audio> element:
// the phone then treats the Morse as media, like the win/fail MP3s.
let mediaEl = null;

function routeThroughMediaElement() {
  if (player.mode !== 'audio') return; // jscwlib's <audio> fallback mode has no Web Audio graph
  if (!player.init_done) player.init(); // jscwlib builds its audio graph lazily; we need it now
  try {
    const stream = player.audioCtx.createMediaStreamDestination();
    mediaEl = new Audio();
    mediaEl.srcObject = stream.stream;
    player.analyser.disconnect();       // was: analyser → speakers
    player.analyser.connect(stream);    // now: analyser → stream → <audio> → speakers
    mediaEl.play().catch(useSpeakersDirectly);
  } catch {
    useSpeakersDirectly();
  }
}

// Fallback if the browser can't play the stream: back to jscwlib's normal output.
function useSpeakersDirectly() {
  mediaEl = null;
  try { player.analyser.disconnect(); } catch {}
  player.analyser.connect(player.audioCtx.destination);
}

// Browsers pause audio after a while in the background; wake it on every play (always a tap).
function wakeAudio() {
  if (player.mode !== 'audio') return;
  if (player.audioCtx.state === 'suspended') player.audioCtx.resume();
  if (mediaEl?.paused) mediaEl.play().catch(() => {});
}

function getPlayer(wpm) {
  if (!player) {
    // Safari 17+: ask for media-style playback, which ignores the silent switch.
    if (navigator.audioSession) navigator.audioSession.type = 'playback';
    player = new jscw({ wpm, freq: 650 });
    routeThroughMediaElement();
  }
  wakeAudio();
  return player;
}

// Call from a tap (e.g. the title screen): sets up the Morse audio while the browser allows it.
export function primeAudio() {
  if (typeof jscw !== 'undefined') getPlayer(20);
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

// Short feedback sound, e.g. one letter. No lead-in, so it feels instant.
export function tone(text, wpm = 20) {
  getPlayer(wpm);
  if (player.init_done) player.stop(); // fast taps: cut the previous one (stop() fails before the first play)
  player.startDelay = 0;
  playId++;
  player.setWpm(wpm);
  player.onFinished = null;
  player.onCharacterPlay = () => {};
  player.play(text);
}

// One password symbol: '.' = dit (E), '-' = dah (T).
export const beep = (symbol) => tone(symbol === '.' ? 'E' : 'T');

export function stop() {
  playId++;
  if (player?.init_done) player.stop();
}
