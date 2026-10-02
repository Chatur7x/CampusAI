import { useGSAP } from '@gsap/react';
import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import type { RefObject } from 'react';

gsap.registerPlugin(ScrollTrigger);

/**
 * Scroll-cinematic layer for long analytics pages.
 *
 * - `.cinematic-reveal` — batched entrance (rise + deblur) as sections
 *   scroll into view. Fires once per element.
 * - `.cinematic-parallax` — gentle scrub-linked drift for headers,
 *   giving depth while scrolling through charts.
 *
 * Honors `prefers-reduced-motion` (renders static), scopes everything to
 * `scope` via gsap.context, and kills all triggers on unmount / dep change.
 * Pass data-loading flags in `deps` so positions refresh after charts mount.
 */
export function useScrollCinematic(
  scope: RefObject<HTMLElement | null>,
  deps: unknown[] = [],
) {
  useGSAP(
    () => {
      if (
        typeof window !== 'undefined' &&
        window.matchMedia('(prefers-reduced-motion: reduce)').matches
      ) {
        return;
      }

      // Entrance state is applied here (not in CSS) so content stays
      // visible when JS or motion is unavailable.
      gsap.set('.cinematic-reveal', { opacity: 0, y: 28, filter: 'blur(6px)' });

      ScrollTrigger.batch('.cinematic-reveal', {
        start: 'top 88%',
        once: true,
        onEnter: (batch) =>
          gsap.to(batch, {
            opacity: 1,
            y: 0,
            filter: 'blur(0px)',
            duration: 0.7,
            stagger: 0.08,
            ease: 'power3.out',
            overwrite: true,
          }),
      });

      gsap.utils.toArray<HTMLElement>('.cinematic-parallax').forEach((el) => {        gsap.fromTo(
          el,
          { yPercent: 6 },
          {
            yPercent: -6,
            ease: 'none',
            scrollTrigger: {
              trigger: el,
              start: 'top bottom',
              end: 'bottom top',
              scrub: 1,
            },
          },
        );
      });

      // Safety net: batch onEnter can miss above-the-fold cards when charts
      // mount asynchronously after this effect runs. Reveal anything already
      // in view on the next frame so nothing stays stuck at opacity 0.
      requestAnimationFrame(() => {
        const stuck = gsap.utils
          .toArray<HTMLElement>('.cinematic-reveal')
          .filter((el) => {
            const r = el.getBoundingClientRect();
            return (
              r.top < window.innerHeight * 0.92 &&
              window.getComputedStyle(el).opacity === '0'
            );
          });
        if (stuck.length > 0) {
          gsap.to(stuck, {
            opacity: 1,
            y: 0,
            filter: 'blur(0px)',
            duration: 0.7,
            stagger: 0.08,
            ease: 'power3.out',
            overwrite: true,
          });
        }
      });

      ScrollTrigger.refresh();
    },
    { scope, dependencies: deps },
  );
}
