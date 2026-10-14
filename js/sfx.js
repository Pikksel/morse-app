// UI sound effects (files in /sounds). Preloaded so they start without delay.
const sounds = {
  win: new Audio('sounds/win.mp3'),
  fail: new Audio('sounds/fail.mp3'),
  badge: new Audio('sounds/badge.mp3'),
  firstContact: new Audio('sounds/first-time.mp3'), // First Contact badge
  enter: new Audio('sounds/enter.mp3'), // title screen PLAY
};
for (const audio of Object.values(sounds)) {
  audio.preload = 'auto';
  audio.volume = 0.7;
}

// VIP players: their own version of a sound, by callsign. Anything not listed uses the normal sound.
// Note: the repo is public, so this list (and the files) can be seen by anyone.
const PLAYER_SOUNDS = {
  USSR: { enter: 'sounds/USSR.mp3' },
  RM1: { enter: 'sounds/RM1.mp3' },
};

// Loaded only when that player actually plays it, so nobody else downloads VIP files.
const playerAudio = {};
function audioFor(name, callsign) {
  const file = PLAYER_SOUNDS[callsign]?.[name];
  if (!file) return sounds[name];
  if (!playerAudio[file]) {
    playerAudio[file] = new Audio(file);
    playerAudio[file].volume = 0.7;
  }
  return playerAudio[file];
}

// callsign (optional): the logged-in player, for VIP sounds.
export function playSfx(name, callsign) {
  const audio = audioFor(name, callsign);
  if (!audio) return;
  audio.currentTime = 0;
  audio.play().catch(() => {}); // blocked autoplay or missing file: stay silent
}

// Short generated feedback sounds (no files needed): 'correct' = rising blip, 'wrong' = low buzz.
let blipCtx = null;
export function blip(kind) {
  try {
    blipCtx ??= new (window.AudioContext || window.webkitAudioContext)();
    if (blipCtx.state === 'suspended') blipCtx.resume();
    const notes = kind === 'correct'
      ? [{ f: 660, t: 0, d: 0.07 }, { f: 990, t: 0.07, d: 0.1 }]
      : [{ f: 150, t: 0, d: 0.28, type: 'sawtooth' }];
    for (const n of notes) {
      const osc = blipCtx.createOscillator();
      const gain = blipCtx.createGain();
      const start = blipCtx.currentTime + n.t;
      osc.type = n.type ?? 'sine';
      osc.frequency.value = n.f;
      gain.gain.setValueAtTime(0.18, start);
      gain.gain.exponentialRampToValueAtTime(0.001, start + n.d); // quick fade: no click
      osc.connect(gain).connect(blipCtx.destination);
      osc.start(start);
      osc.stop(start + n.d);
    }
  } catch {} // no Web Audio: stay silent
}

// Sounds with several versions: a random one each time (never the same twice in a row).
// Static hosting can't list a folder, so the files are named here.
const RANDOM_SOUNDS = {
  turboFail: [
    'sounds/turbo-fail.mp3', 'sounds/turbo-fail2.mp3', 'sounds/turbo-fail3.mp3', 'sounds/turbo-fail4.mp3',
    'sounds/turbo-fail5.mp3', 'sounds/turbo-fail6.mp3', 'sounds/turbo-fail7.mp3', 'sounds/turbo-fail8.mp3',
  ],
};
const lastPick = {};
const prepared = {};

// Picks the next random version and starts loading it, so it plays instantly later.
export function prepareRandom(name) {
  const files = RANDOM_SOUNDS[name];
  if (!files) return;
  const options = files.length > 1 ? files.filter((f) => f !== lastPick[name]) : files;
  const file = options[Math.floor(Math.random() * options.length)];
  lastPick[name] = file;
  prepared[name] = new Audio(file);
  prepared[name].preload = 'auto';
  prepared[name].volume = 0.7;
}

export function playRandom(name) {
  if (!prepared[name]) prepareRandom(name);
  const audio = prepared[name];
  prepared[name] = null; // next time: a new pick
  audio?.play().catch(() => {});
}

// Sounds played at a random pitch each time, so repeated taps never sound identical.
// range: max pitch change (0.12 = ±12%), minStep: always at least this far from the previous pitch.
const PITCHED_SOUNDS = {
  tap: { file: 'sounds/enter-tap.mp3', range: 0.12, minStep: 0.05, volume: 0.5 },
  shimmer: { file: 'sounds/play-shimmer.mp3', range: 0.08, minStep: 0.03, volume: 0.35 }, // ring hit
};
const pitchedPool = {};   // a few players per sound, so quick taps can overlap
const lastRate = {};

export function playPitched(name) {
  const cfg = PITCHED_SOUNDS[name];
  if (!cfg) return;
  pitchedPool[name] ??= { next: 0, players: Array.from({ length: 4 }, () => {
    const a = new Audio(cfg.file);
    a.preload = 'auto';
    a.volume = cfg.volume;
    a.preservesPitch = a.mozPreservesPitch = a.webkitPreservesPitch = false; // speed change = pitch change
    return a;
  }) };

  let rate;
  do {
    rate = 1 + (Math.random() * 2 - 1) * cfg.range;
  } while (lastRate[name] && Math.abs(rate - lastRate[name]) < cfg.minStep);
  lastRate[name] = rate;

  const pool = pitchedPool[name];
  const audio = pool.players[pool.next];
  pool.next = (pool.next + 1) % pool.players.length; // round-robin: doesn't cut off the previous tap
  audio.playbackRate = rate;
  audio.currentTime = 0;
  audio.play().catch(() => {});
}
