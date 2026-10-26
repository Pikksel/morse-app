// 🕷️ Halloween Turbo "spider's lair" (js/season.js): cobwebs in the top corners and fog (static, also during a run),
// plus a spider that drops down on its thread, swings and climbs back up (also during a run), then hides for 7 s.
import { getSeason } from './season.js';

let lair = null;

// A corner web at (0, 0): spokes over 90° and rings that sag toward the corner between the spokes.
function cobweb() {
  const R = 160, SPOKES = 9, RINGS = 6;
  const pt = (a, r) => [(r * Math.cos(a)).toFixed(1), (r * Math.sin(a)).toFixed(1)];
  const angles = Array.from({ length: SPOKES }, (_, i) => (i / (SPOKES - 1)) * Math.PI / 2);
  let d = angles.map((a) => `M0 0 L${pt(a, R).join(' ')}`).join(' ');
  for (let k = 1; k <= RINGS; k++) {
    const r = (R * k) / (RINGS + 0.6);
    angles.forEach((a, i) => {
      if (i === 0) { d += ` M${pt(a, r).join(' ')}`; return; }
      d += ` Q${pt((a + angles[i - 1]) / 2, r * 0.82).join(' ')} ${pt(a, r).join(' ')}`;
    });
  }
  return `<svg viewBox="0 0 170 170"><path d="${d}" /></svg>`;
}

// Hanging head-down: abdomen on top (the thread is fixed there), head and red eyes below.
const SPIDER = `
<svg viewBox="0 0 40 44">
  <g class="legs">
    <path d="M17 17 Q8 11 4 3 M16 20 Q7 18 2 13 M16 23 Q7 26 3 32 M17 26 Q10 32 8 40" />
    <path d="M23 17 Q32 11 36 3 M24 20 Q33 18 38 13 M24 23 Q33 26 37 32 M23 26 Q30 32 32 40" />
  </g>
  <ellipse class="body" cx="20" cy="16" rx="6" ry="7.5" />
  <circle class="body" cx="20" cy="27" r="4.2" />
  <circle class="eye" cx="18.4" cy="28.4" r="0.9" /><circle class="eye" cx="21.6" cy="28.4" r="0.9" />
</svg>`;

// Turbo screen opened: build the lair (only during Halloween).
export function enterLair() {
  if (getSeason() !== 'halloween' || lair) return;
  lair = document.createElement('div');
  lair.className = 'turbo-lair';
  lair.setAttribute('aria-hidden', 'true');
  lair.innerHTML = `<div class="cobweb left">${cobweb()}</div><div class="cobweb right">${cobweb()}</div>
    <div class="lair-fog"></div>
    <div class="spider-hang"><div class="spider-thread"></div><div class="spider">${SPIDER}</div></div>`;
  const hang = lair.querySelector('.spider-hang');
  const newSpot = () => { // along the sides, so it never hides behind the orb in the middle
    hang.style.left = `${Math.random() < 0.5 ? 4 + Math.random() * 14 : 78 + Math.random() * 12}%`;
    hang.style.setProperty('--drop', `${18 + Math.random() * 16}vh`);
  };
  newSpot();
  hang.addEventListener('animationiteration', newSpot); // back up out of sight: next drop somewhere else
  document.body.append(lair);
}

// on = the spider may dangle (off = fades out and freezes). Turned on when the Turbo screen opens.
export function setSpider(on) {
  lair?.classList.toggle('spider-on', on && !matchMedia('(prefers-reduced-motion: reduce)').matches);
}

// Turbo screen closed.
export function leaveLair() {
  lair?.remove();
  lair = null;
}
