// Small canvas confetti burst. No library: pieces get a speed, then gravity and drag pull them down.
import { getSeason } from './season.js';

const COLORS = ['#4a9d5b', '#f0a04b', '#e9e6df', '#c9a227', '#5aa9e6', '#e05d5d'];
const SEASON_COLORS = { halloween: ['#ff7a1a', '#9b5de5', '#6fbf3f', '#f1e9ff', '#ffb35c', '#3a2c4d'] }; // 🎃 candy
const GRAVITY = 0.35;
const DRAG = 0.985;

// origin: { x, y } in page pixels where the burst starts (default: upper middle).
export function confetti({ origin, count = 160, duration = 3200 } = {}) {
  if (matchMedia('(prefers-reduced-motion: reduce)').matches) return;

  const canvas = document.createElement('canvas');
  canvas.className = 'confetti';
  canvas.setAttribute('aria-hidden', 'true');
  document.body.append(canvas);

  const ctx = canvas.getContext('2d');
  const dpr = window.devicePixelRatio || 1;
  canvas.width = innerWidth * dpr;
  canvas.height = innerHeight * dpr;
  ctx.scale(dpr, dpr);

  const ox = origin?.x ?? innerWidth / 2;
  const oy = origin?.y ?? innerHeight * 0.3;
  const pieces = Array.from({ length: count }, (_, i) => {
    const angle = -Math.PI / 2 + (Math.random() - 0.5) * Math.PI * 0.9; // mostly upwards
    const speed = 8 + Math.random() * 12;
    return {
      x: ox, y: oy,
      vx: Math.cos(angle) * speed,
      vy: Math.sin(angle) * speed,
      w: 6 + Math.random() * 6,
      h: 9 + Math.random() * 8,
      rot: Math.random() * Math.PI,
      spin: (Math.random() - 0.5) * 0.4,
      color: (SEASON_COLORS[getSeason()] ?? COLORS)[i % (SEASON_COLORS[getSeason()] ?? COLORS).length],
    };
  });

  const start = performance.now();
  function frame(now) {
    const t = now - start;
    ctx.clearRect(0, 0, innerWidth, innerHeight);
    ctx.globalAlpha = Math.min(1, (duration - t) / 800); // fade out at the end

    for (const p of pieces) {
      p.vx *= DRAG;
      p.vy = p.vy * DRAG + GRAVITY;
      p.x += p.vx;
      p.y += p.vy;
      p.rot += p.spin;
      ctx.save();
      ctx.translate(p.x, p.y);
      ctx.rotate(p.rot);
      ctx.scale(1, Math.cos(p.rot * 2)); // flutter: looks like it's flipping
      ctx.fillStyle = p.color;
      ctx.fillRect(-p.w / 2, -p.h / 2, p.w, p.h);
      ctx.restore();
    }

    if (t < duration) requestAnimationFrame(frame);
    else canvas.remove();
  }
  requestAnimationFrame(frame);
}
