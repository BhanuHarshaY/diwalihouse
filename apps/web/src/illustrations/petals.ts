import { PALETTE as C } from '@/design-system/palette';
import { gsap } from '@/lib/gsap';

/**
 * A short shower of marigold petals, the welcome thrown over arriving
 * guests. One-shot: petals are created, fall, and are removed. Callers skip
 * it under reduced motion.
 */

const COLOURS = [C.marigold500, C.marigold400, C.marigold600, C.vermilion500, C.rani500];
const PETAL = 'M0 -9C5 -5 5 4 0 9C-5 4 -5 -5 0 -9Z';

export function showerPetals(container: HTMLElement, count = 30): void {
  const { width, height } = container.getBoundingClientRect();
  for (let i = 0; i < count; i++) {
    const petal = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    petal.setAttribute('viewBox', '-6 -10 12 20');
    petal.setAttribute('aria-hidden', 'true');
    const size = 9 + Math.random() * 9;
    Object.assign(petal.style, {
      position: 'absolute',
      left: '0',
      top: '0',
      width: `${size}px`,
      height: `${size * 1.6}px`,
      pointerEvents: 'none',
      willChange: 'transform, opacity',
    });
    const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
    path.setAttribute('d', PETAL);
    path.setAttribute('fill', COLOURS[i % COLOURS.length]!);
    petal.appendChild(path);
    container.appendChild(petal);

    const startX = width * (0.15 + Math.random() * 0.7);
    gsap
      .timeline({ delay: Math.random() * 0.9, onComplete: () => petal.remove() })
      .set(petal, { x: startX, y: -20, rotation: Math.random() * 360, opacity: 0 })
      .to(petal, { opacity: 1, duration: 0.25 })
      .to(
        petal,
        {
          y: height * (0.75 + Math.random() * 0.35),
          x: startX + (Math.random() - 0.5) * width * 0.5,
          rotation: `+=${(Math.random() > 0.5 ? 1 : -1) * (180 + Math.random() * 360)}`,
          duration: 2.6 + Math.random() * 1.6,
          ease: 'power1.in',
        },
        0,
      )
      .to(petal, { opacity: 0, duration: 0.6 }, '>-0.6');
  }
}
