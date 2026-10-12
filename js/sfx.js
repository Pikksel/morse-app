// UI sound effects (files in /sounds). Preloaded so they start without delay.
const sounds = {
  win: new Audio('sounds/win.mp3'),
  fail: new Audio('sounds/fail.mp3'),
};
for (const audio of Object.values(sounds)) {
  audio.preload = 'auto';
  audio.volume = 0.7;
}

export function playSfx(name) {
  const audio = sounds[name];
  if (!audio) return;
  audio.currentTime = 0;
  audio.play().catch(() => {}); // blocked autoplay or missing file: stay silent
}
