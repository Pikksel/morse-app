// 🎀 Cute Morse: dits and dahs played from two MP3 files instead of a beep tone.
// Both files are decoded once into Web Audio buffers, and every symbol is scheduled on the
// audio clock, so the timing stays exact even at high speed. A new symbol cuts off the previous one.
import { followAudioClock } from './audioClock.js';

const FILES = { '.': 'sounds/cute-ding.mp3', '-': 'sounds/cute-dash.mp3' };
const VOLUME = 0.8;
const CUT_S = 0.012; // quick fade when the next symbol cuts a sound off (no click)

let ctx = null;
let out = null;       // master gain
let mediaEl = null;   // hidden <audio>: plays even with the phone on silent (see morse.js)
let buffers = null;
let loading = null;
let playId = 0;
let sources = [];     // scheduled sounds of the current play

function setup() {
  if (ctx) return;
  ctx = new (window.AudioContext || window.webkitAudioContext)();
  out = ctx.createGain();
  out.gain.value = VOLUME;
  try {
    const stream = ctx.createMediaStreamDestination();
    out.connect(stream);
    mediaEl = new Audio();
    mediaEl.srcObject = stream.stream;
    mediaEl.play().catch(useSpeakersDirectly);
  } catch {
    useSpeakersDirectly();
  }
}

function useSpeakersDirectly() {
  mediaEl = null;
  try { out.disconnect(); } catch {}
  out.connect(ctx.destination);
}

function wake() {
  if (ctx.state === 'suspended') ctx.resume();
  if (mediaEl?.paused) mediaEl.play().catch(() => {});
}

function load() {
  loading ??= Promise.all(Object.entries(FILES).map(async ([symbol, file]) => {
    const data = await (await fetch(file)).arrayBuffer();
    return [symbol, await ctx.decodeAudioData(data)];
  }))
    .then((pairs) => { buffers = Object.fromEntries(pairs); })
    .catch(() => { loading = null; }); // try again next time
  return loading;
}

// Call from a tap: unlocks the audio and starts loading the sounds.
export function primeCute() {
  setup();
  wake();
  load();
}

export function stopCute() {
  playId++;
  for (const s of sources) try { s.stop(); } catch {}
  sources = [];
}

// codes: one Morse code per character ('.-'), or null for a space.
// lead: seconds of silence first. onLetter(i) as character i starts, onDone at the end.
export async function playCute(codes, wpm, lead, onDone, onLetter) {
  stopCute();
  const id = playId;
  setup();
  wake();
  await load();
  if (id !== playId) return;             // stopped or replaced while loading
  if (!buffers) return onDone?.();       // files missing: skip silently

  const unit = 1.2 / wpm;                 // seconds per Morse unit (PARIS standard)
  let t = ctx.currentTime + lead;
  let prev = null;
  const letters = []; // { n, at }: when each character starts, on the audio clock

  codes.forEach((code, i) => {
    if (code === null) { t += 4 * unit; return; } // word gap: 7 units (3 already added)
    letters.push({ n: i, at: t });
    for (const symbol of code) {
      if (prev) cut(prev, t);
      prev = sound(symbol, t);
      t += (symbol === '.' ? 1 : 3) * unit + unit;
    }
    t += 2 * unit; // letter gap: 3 units in total
  });

  const end = t - 3 * unit;
  followAudioClock(ctx, letters, end, id, () => playId, onLetter, onDone);
}

function sound(symbol, t) {
  const src = ctx.createBufferSource();
  const gain = ctx.createGain();
  src.buffer = buffers[symbol];
  src.connect(gain).connect(out);
  src.start(t);
  sources.push(src);
  return { src, gain };
}

// The next symbol starts at t: fade this one out right then.
function cut({ src, gain }, t) {
  gain.gain.setValueAtTime(1, t);
  gain.gain.linearRampToValueAtTime(0, t + CUT_S);
  try { src.stop(t + CUT_S); } catch {}
}
