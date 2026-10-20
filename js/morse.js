// Wrapper around jscwlib (global `jscw`, loaded in index.html).
// With 🎀 Cute Morse on, the same calls play the cute MP3 dits/dahs instead (cuteMorse.js).
import { primeCute, playCute, stopCute } from './cuteMorse.js';
import { followAudioClock } from './audioClock.js';

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

// ---------- 🎀 Cute Morse toggle (remembered per device, off by default) ----------

const CUTE_KEY = 'morse-web:cute';
let cute = false;
try { cute = localStorage.getItem(CUTE_KEY) === 'on'; } catch {}

export const isCute = () => cute;

// Call from a tap (the toggle), so the cute sounds are allowed to play.
export function setCute(on) {
  stop();
  cute = on;
  try { localStorage.setItem(CUTE_KEY, on ? 'on' : 'off'); } catch {}
  if (on) primeCute();
}

const codesFor = (text) => [...text.toUpperCase()].map((c) => MORSE[c] ?? null);

// Call from a tap (e.g. the title screen): sets up the Morse audio while the browser allows it.
export function primeAudio() {
  if (typeof jscw !== 'undefined') getPlayer(20);
  if (cute) primeCute();
}

// A word/letter (play) is sounding: the app listens to 'morse:sound' (e.g. to lock the 🎵 toggle).
// Short tones don't count.
let sounding = false;
function setSounding(on) {
  if (on === sounding) return;
  sounding = on;
  document.dispatchEvent(new CustomEvent('morse:sound', { detail: on }));
}

// Plays text at the given speed. onLetter(index) fires as each letter starts;
// onDone runs when playback finishes.
export function play(text, wpm, onDone, onLetter = () => {}) {
  const done = () => { setSounding(false); onDone?.(); };
  if (cute) {
    stop();
    setSounding(true);
    return playCute(codesFor(text), wpm, LEAD_IN_S, done, onLetter);
  }
  setSounding(true);
  getPlayer(wpm).startDelay = LEAD_IN_S;
  const id = ++playId;
  player.setWpm(wpm);
  if (player.mode !== 'audio') { // jscwlib's <audio> fallback: its own timers are all we have
    player.onFinished = () => { if (id === playId) done(); };
    player.onCharacterPlay = ({ n }) => { if (id === playId) onLetter(n); };
    return player.play(text);
  }
  player.onFinished = null;
  player.onCharacterPlay = () => {};
  player.play(text);
  // Letter start times on the audio clock (jscwlib marks each letter's first event with `c`).
  const letters = player.playTiming.filter((e) => e.c).map((e) => ({ n: e.c.n, at: player.playStart + e.t }));
  followAudioClock(player.audioCtx, letters, player.playEnd, id, () => playId, onLetter, done);
}

// Short feedback sound, e.g. one letter. No lead-in, so it feels instant.
export function tone(text, wpm = 20) {
  if (cute) {
    stop();
    return playCute(codesFor(text), wpm, 0);
  }
  setSounding(false); // cuts off a word too
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
  setSounding(false);
  stopCute();
  playId++;
  if (player?.init_done) player.stop();
}
