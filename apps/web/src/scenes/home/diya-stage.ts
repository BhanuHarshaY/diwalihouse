import { cuspedArch } from '@/design-system/geometry/arch';
import { gsap, ScrollTrigger } from '@/lib/gsap';
import { lampOffsets, placeLamp, stageLayout, zoomToShow, type StageLayout } from './camera';

/**
 * Scene 1, "One Diya", as an imperative controller.
 *
 * React renders the markup once; this module animates it. Nothing here
 * triggers a React render per frame: lamps are moved with direct transform
 * writes, and React only hears about discrete events (a lamp was lit).
 *
 * Timeline, as the visitor scrolls through the pinned stage:
 *   0.00–0.42  camera pulls back from the single lamp to the whole row;
 *              unlit lamps catch the flame as they come into view
 *   0.06–0.18  the opening lines leave
 *   0.42–0.58  "Deepavali" arrives above the row
 *   0.58–1.00  hold, then the page scrolls on
 */

export const MAX_LAMPS = 9;
export const LAMP_OFFSETS = lampOffsets(MAX_LAMPS);

export interface StageElements {
  section: HTMLElement;
  stage: HTMLElement;
  lamps: Map<number, HTMLElement>;
  ambient: HTMLElement;
  archGroup: SVGGElement;
  archOuter: SVGPathElement;
  archInner: SVGPathElement;
  bulbs: SVGGElement;
  ledge: SVGGElement;
  openingOut: HTMLElement;
  openingIn: HTMLElement;
  titleOut: HTMLElement;
}

export interface StageOptions {
  /** Light the first lamp immediately (returning visitors). */
  quickStart: boolean;
  onLitChange: (lit: number, total: number) => void;
}

export interface StageController {
  /** Pass the flame to the next pair of lamps. */
  share: () => void;
  /** Scroll position at which the "Deepavali" title is fully shown. */
  titleScrollY: () => number;
  destroy: () => void;
}

const SVG_NS = 'http://www.w3.org/2000/svg';

export function createDiyaStage(el: StageElements, options: StageOptions): StageController {
  let layout: StageLayout = stageLayout(size(el.stage));
  const lit = new Set<number>();
  /** Furthest lit lamp from the centre; -1 before the first is lit. */
  let litRadius = -1;
  const camera = { pull: 0, zFit: layout.zMax };
  let fitTween: gsap.core.Tween | null = null;
  const leans = new Map<number, (value: number) => void>();

  function size(node: HTMLElement) {
    return { width: node.clientWidth, height: node.clientHeight };
  }

  function half() {
    return (layout.count - 1) / 2;
  }

  function visibleOffsets() {
    return LAMP_OFFSETS.filter((offset) => Math.abs(offset) <= half());
  }

  // -------------------------------------------------------------------------
  // Geometry
  // -------------------------------------------------------------------------

  function measure() {
    layout = stageLayout(size(el.stage));
    el.stage.style.setProperty('--lamp-base', `${layout.baseWidth}px`);
    for (const [offset, lamp] of el.lamps) {
      lamp.toggleAttribute('data-off-stage', Math.abs(offset) > half());
    }
    camera.zFit = zoomToShow(layout, Math.max(0, litRadius));
    drawArch();
    apply();
  }

  function drawArch() {
    const { width, height } = layout.viewport;
    const narrow = width < 640;
    const cx = width / 2;
    const baseY = layout.rowY + 4;
    const springY = height * (narrow ? 0.4 : 0.42);
    const apexY = height * (narrow ? 0.09 : 0.08);
    const halfWidth = layout.archHalfWidth;
    const lobes = narrow ? 4 : 5;

    const outer = cuspedArch({ cx, baseY, springY, apexY, halfWidth, lobes });
    const inner = cuspedArch({
      cx,
      baseY,
      springY,
      apexY: apexY + 12,
      halfWidth: halfWidth - 10,
      lobes,
    });
    el.archOuter.setAttribute('d', outer.d);
    el.archInner.setAttribute('d', inner.d);

    const bulbPoints: Array<readonly [number, number]> = [...outer.cusps];
    const step = narrow ? 30 : 36;
    for (let y = springY + step * 0.6; y < baseY - step * 0.4; y += step) {
      bulbPoints.push([cx - halfWidth, y], [cx + halfWidth, y]);
    }
    el.bulbs.replaceChildren(
      ...bulbPoints.flatMap(([x, y]) => {
        const glow = document.createElementNS(SVG_NS, 'circle');
        glow.setAttribute('cx', String(x));
        glow.setAttribute('cy', String(y));
        glow.setAttribute('r', '7');
        glow.setAttribute('class', 'bulb-glow');
        const bulb = document.createElementNS(SVG_NS, 'circle');
        bulb.setAttribute('cx', String(x));
        bulb.setAttribute('cy', String(y));
        bulb.setAttribute('r', '2.6');
        bulb.setAttribute('class', 'bulb');
        return [glow, bulb];
      }),
    );

    const ledgeHalf = halfWidth + (narrow ? 12 : 28);
    const lines = el.ledge.querySelectorAll('line');
    const ledgeYs = [baseY, baseY + 8];
    lines.forEach((line, i) => {
      line.setAttribute('x1', String(cx - ledgeHalf));
      line.setAttribute('x2', String(cx + ledgeHalf));
      line.setAttribute('y1', String(ledgeYs[i] ?? baseY));
      line.setAttribute('y2', String(ledgeYs[i] ?? baseY));
    });
  }

  function zoom() {
    const zScroll = layout.zMax - (layout.zMax - 1) * camera.pull;
    return Math.min(camera.zFit, zScroll);
  }

  /** Writes every lamp's transform for the current zoom. */
  function apply() {
    const z = zoom();
    for (const offset of visibleOffsets()) {
      const lamp = el.lamps.get(offset);
      if (!lamp) continue;
      const p = placeLamp(layout, offset, z);
      lamp.style.transform = `translate3d(${p.x}px, ${p.y}px, 0) scale(${p.scale})`;
      if (offset === 0) {
        const rendered = layout.baseWidth * p.scale;
        // Flame centre: 54% down the lamp box (see SceneDiya.module.css).
        const fx = p.centerX;
        const fy =
          p.y + layout.baseWidth * layout.aspect * (1 - p.scale) + rendered * layout.aspect * 0.54;
        el.ambient.style.transform = `translate3d(${fx}px, ${fy}px, 0) translate(-50%, -50%)`;
      }
    }
    // The architecture belongs to the scroll transition, so it never
    // crowds the opening lines while the visitor is passing the flame.
    el.archGroup.style.opacity = String(gsap.utils.clamp(0, 1, (camera.pull - 0.3) / 0.55));
  }

  // -------------------------------------------------------------------------
  // Light
  // -------------------------------------------------------------------------

  function ignite(offset: number, pace: 'first' | 'quick' | 'normal', delay = 0) {
    const lamp = el.lamps.get(offset);
    if (!lamp || lit.has(offset)) return;
    lit.add(offset);
    lamp.setAttribute('data-lit', '');

    const d = pace === 'first' ? 2.4 : pace === 'quick' ? 0.5 : 1;
    const spark = lamp.querySelector('[data-spark]');
    const flame = lamp.querySelector('[data-flame]');
    const body = lamp.querySelector('[data-body]');
    const halo = lamp.querySelector('[data-halo]');

    gsap
      .timeline({ delay })
      .fromTo(
        spark,
        { scale: 0, autoAlpha: 0 },
        { scale: 1, autoAlpha: 1, duration: d * 0.16, ease: 'power2.out' },
      )
      .to(spark, { scale: 1.8, autoAlpha: 0, duration: d * 0.3, ease: 'power1.out' }, '>')
      .fromTo(
        flame,
        { scaleX: 0.35, scaleY: 0.08, autoAlpha: 0 },
        { scaleX: 1, scaleY: 1, autoAlpha: 1, duration: d * 0.55, ease: 'back.out(1.7)' },
        d * 0.12,
      )
      .to(body, { opacity: 1, duration: d * 0.8, ease: 'power1.out' }, d * 0.14)
      .fromTo(
        halo,
        { autoAlpha: 0, scale: 0.6 },
        { autoAlpha: 1, scale: 1, duration: d, ease: 'power2.out' },
        d * 0.14,
      );

    gsap.to(el.ambient, {
      autoAlpha: 0.55 + 0.45 * (lit.size / layout.count),
      duration: d * 1.2,
      delay: delay + d * 0.15,
      ease: 'power1.out',
    });

    options.onLitChange(lit.size, layout.count);
  }

  function lightOut(radius: number, pace: 'quick' | 'normal') {
    const target = Math.min(radius, half());
    if (target <= litRadius) return;
    for (let r = litRadius + 1; r <= target; r++) {
      const stagger = (r - litRadius - 1) * 0.12;
      if (r === 0) ignite(0, pace);
      else {
        ignite(-r, pace, stagger);
        ignite(r, pace, stagger + 0.08);
      }
    }
    litRadius = target;
    fitTween?.kill();
    fitTween = gsap.to(camera, {
      zFit: zoomToShow(layout, litRadius),
      duration: 1.6,
      ease: 'power2.inOut',
      onUpdate: apply,
    });
  }

  // -------------------------------------------------------------------------
  // Pointer: flames lean away from a nearby cursor, as from a breath.
  // -------------------------------------------------------------------------

  for (const [offset, lamp] of el.lamps) {
    const lean = lamp.querySelector('[data-lean]');
    if (lean)
      leans.set(offset, gsap.quickTo(lean, 'rotation', { duration: 0.9, ease: 'power3.out' }));
  }

  const finePointer = window.matchMedia('(hover: hover) and (pointer: fine)').matches;

  function onPointerMove(event: PointerEvent) {
    const z = zoom();
    for (const offset of visibleOffsets()) {
      if (!lit.has(offset)) continue;
      const p = placeLamp(layout, offset, z);
      const width = layout.baseWidth * p.scale;
      const dx = event.clientX - p.centerX;
      const reach = width * 2.2;
      const falloff = Math.max(0, 1 - Math.abs(dx) / reach);
      leans.get(offset)?.(-Math.sign(dx) * falloff * 11);
    }
  }

  function onPointerLeave() {
    for (const set of leans.values()) set(0);
  }

  if (finePointer) {
    el.stage.addEventListener('pointermove', onPointerMove);
    el.stage.addEventListener('pointerleave', onPointerLeave);
  }

  // -------------------------------------------------------------------------
  // Scroll
  // -------------------------------------------------------------------------

  const timeline = gsap.timeline({
    defaults: { ease: 'none' },
    scrollTrigger: {
      trigger: el.section,
      start: 'top top',
      end: 'bottom bottom',
      scrub: 0.6,
      invalidateOnRefresh: true,
      onUpdate: (self) => {
        if (self.progress > 0.01) {
          lightOut(Math.ceil(gsap.utils.clamp(0, 1, self.progress / 0.34) * half()), 'quick');
        }
      },
    },
  });
  timeline
    .to(camera, { pull: 1, duration: 0.42, ease: 'power1.inOut', onUpdate: apply }, 0)
    .to(el.openingOut, { autoAlpha: 0, y: -28, duration: 0.12 }, 0.06)
    .fromTo(el.titleOut, { autoAlpha: 0, y: 32 }, { autoAlpha: 1, y: 0, duration: 0.16 }, 0.42)
    .to({}, { duration: 0.42 });

  // -------------------------------------------------------------------------
  // Start
  // -------------------------------------------------------------------------

  measure();
  const resize = new ResizeObserver(() => measure());
  resize.observe(el.stage);

  if (options.quickStart) {
    lightOut(0, 'quick');
    gsap.set(el.openingIn, { autoAlpha: 1 });
  } else {
    gsap.delayedCall(0.5, () => {
      if (litRadius >= 0) return;
      litRadius = 0;
      ignite(0, 'first');
    });
    gsap.fromTo(
      el.openingIn,
      { autoAlpha: 0, y: 14 },
      { autoAlpha: 1, y: 0, duration: 1.6, delay: 1.9, ease: 'power2.out' },
    );
  }

  return {
    share: () => lightOut(litRadius + 1, litRadius < 0 ? 'quick' : 'normal'),
    titleScrollY: () => {
      const trigger = timeline.scrollTrigger;
      if (!trigger) return window.scrollY;
      return trigger.start + (trigger.end - trigger.start) * 0.6;
    },
    destroy: () => {
      resize.disconnect();
      el.stage.removeEventListener('pointermove', onPointerMove);
      el.stage.removeEventListener('pointerleave', onPointerLeave);
      fitTween?.kill();
      timeline.scrollTrigger?.kill();
      timeline.kill();
    },
  };
}

export { ScrollTrigger };
