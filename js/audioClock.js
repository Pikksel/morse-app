// Highlights follow the audio clock, not setTimeout: if the audio is still waking up
// (its clock stands still), the highlight waits too, and a late check can't skip a letter.
// letters: [{ n, at }] = character index + start time on ctx's clock. end: when the sound is over.
export function followAudioClock(ctx, letters, end, id, currentId, onLetter, onDone) {
  let shown = -1;
  const frame = () => { // one check: which letter is sounding right now?
    if (id !== currentId()) return; // stopped or replaced
    const heard = ctx.currentTime - (ctx.outputLatency || ctx.baseLatency || 0);
    if (heard >= end) return onDone?.();
    const now = letters.findLast((l) => l.at <= heard);
    if (now && now.n !== shown) onLetter?.((shown = now.n));
    setTimeout(frame, 15); // not requestAnimationFrame: that pauses on a hidden page, and onDone must still come
  };
  frame();
}
