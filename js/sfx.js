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
