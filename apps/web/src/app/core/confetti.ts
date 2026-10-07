import { prefersReducedMotion } from './motion';

const COLORS = ['#ff5a36', '#ffd23f', '#3ee0a5', '#6cc4ff', '#b79cff', '#ff8fc7'];

/**
 * A small burst of paper confetti from a point. Pure DOM + Web Animations (no canvas, no library),
 * loaded on demand, skipped under `prefers-reduced-motion`, and removed when finished.
 */
export function confetti(originX: number, originY: number, count = 28): void {
  if (prefersReducedMotion() || typeof Element.prototype.animate !== 'function') return;

  const layer = document.createElement('div');
  layer.setAttribute('aria-hidden', 'true');
  layer.style.cssText = 'position:fixed;inset:0;pointer-events:none;z-index:100;overflow:hidden';
  document.body.append(layer);

  const finished = Array.from({ length: count }, (_, index) => {
    const piece = document.createElement('i');
    const size = 8 + Math.random() * 8;
    piece.style.cssText = `position:absolute;left:${originX}px;top:${originY}px;width:${size}px;height:${size * (index % 3 === 0 ? 0.4 : 1)}px;background:${COLORS[index % COLORS.length]};border:2px solid #17120f;border-radius:${index % 2 ? '50%' : '2px'}`; // rtl-ok: physical viewport coordinates from the pointer, not layout
    layer.append(piece);

    const angle = (Math.PI * 2 * index) / count + Math.random() * 0.6;
    const distance = 90 + Math.random() * 150;
    const dx = Math.cos(angle) * distance;
    const dy = Math.sin(angle) * distance - 60;
    return piece.animate(
      [
        { transform: 'translate(0,0) rotate(0)', opacity: 1 },
        {
          transform: `translate(${dx}px, ${dy}px) rotate(${180 + Math.random() * 360}deg)`,
          opacity: 1,
          offset: 0.55,
        },
        {
          transform: `translate(${dx * 1.15}px, ${dy + 220}px) rotate(${540 + Math.random() * 360}deg)`,
          opacity: 0,
        },
      ],
      {
        duration: 1100 + Math.random() * 500,
        easing: 'cubic-bezier(0.2, 0.7, 0.3, 1)',
        fill: 'forwards',
      },
    ).finished;
  });

  void Promise.allSettled(finished).then(() => layer.remove());
}
