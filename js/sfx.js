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
