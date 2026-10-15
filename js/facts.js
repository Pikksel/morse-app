// Fun Morse facts for the title screen (tap 5 times, then pause).
// Written in our own words. Sources: Encyclopaedia Britannica, "Morse Code"; plus well-known basics.
const FACTS = [
  'Morse code was invented in the 1830s by Samuel F. B. Morse, a painter turned inventor, and refined by his partner Alfred Vail.',
  'The original code had no letters with accents, so in 1851 European countries agreed on a new version: International Morse Code.',
  'International Morse Code has barely changed since 1851. The only real update was a few small tweaks in 1938.',
  'American telegraph companies kept using the original Morse code until teleprinters took over in the 1920s and 30s.',
  'Ships relied on Morse code for safety at sea right up until the early 1990s.',
  'In 1901 Guglielmo Marconi sent Morse code across the Atlantic Ocean by radio, with no wires at all.',
  'Morse code doesn’t have to be sound: it can be sent with flashing lights, too.',
  'Morse code was used in World War II and in the Korean and Vietnam wars.',
  'Until the early 2000s, most countries required a Morse test to get an amateur radio license.',
  'The first long-distance telegraph message, “What hath God wrought”, was sent from Washington to Baltimore in 1844.',
  'SOS (· · · – – – · · ·) was chosen as the distress signal because it’s easy to send and hard to mistake. It became international in 1906.',
  'A dash lasts exactly as long as three dots. The pause between words is seven dots long.',
  'E is just one dot because it’s the most common letter in English: frequent letters got the shortest codes.',
  'Radio operators sign off with “73”, which means “best regards”.',
  'Morse speed is measured with the word PARIS: send it 20 times in one minute and you’re going 20 words per minute.',
];

let queue = [];

// A random fact; no repeats until every fact has been shown once.
export function nextFact() {
  if (!queue.length) queue = [...FACTS].sort(() => Math.random() - 0.5);
  return queue.pop();
}
