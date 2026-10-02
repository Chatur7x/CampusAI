import { motion, useReducedMotion, type Variant, type Variants } from 'framer-motion';
import { useMemo } from 'react';
import { cn } from '@/lib/utils';

/**
 * TextEffect — per-word blur-fade headline reveal
 * (motion-primitives text-effect pattern, project-styled).
 *
 * Splits `text` into words and staggers them in with a blur rise.
 * Renders plain text under prefers-reduced-motion. Purely presentational:
 * no layout shift (words keep their flow), transform+opacity only.
 */
const PRESETS: Record<string, { hidden: Variant; visible: Variant }> = {
  blur: {
    hidden: { opacity: 0, y: 12, filter: 'blur(8px)' },
    visible: { opacity: 1, y: 0, filter: 'blur(0px)' },
  },
  fade: {
    hidden: { opacity: 0 },
    visible: { opacity: 1 },
  },
  slide: {
    hidden: { opacity: 0, y: 20 },
    visible: { opacity: 1, y: 0 },
  },
};

export function TextEffect({
  text,
  preset = 'blur',
  per = 'word',
  delay = 0,
  stagger = 0.045,
  className,
  as = 'h1',
}: {
  text: string;
  preset?: keyof typeof PRESETS;
  per?: 'word' | 'line';
  delay?: number;
  stagger?: number;
  className?: string;
  as?: 'h1' | 'h2' | 'p' | 'span';
}) {
  const reduce = useReducedMotion();
  const units = useMemo(
    () => (per === 'line' ? text.split('\n') : text.split(/(\s+)/)),
    [text, per],
  );

  if (reduce) {
    const Comp = as as 'h1';
    return <Comp className={className}>{text}</Comp>;
  }

  const container: Variants = {
    hidden: {},
    visible: { transition: { staggerChildren: stagger, delayChildren: delay } },
  };
  const child: Variants = {
    hidden: PRESETS[preset].hidden,
    visible: {
      ...PRESETS[preset].visible,
      transition: { type: 'spring', stiffness: 160, damping: 24 },
    },
  };

  const Comp = motion[as] as typeof motion.h1;
  return (
    <Comp
      className={cn(className)}
      variants={container}
      initial="hidden"
      whileInView="visible"
      viewport={{ once: true, margin: '-40px' }}
      aria-label={text}
    >
      {units.map((u, i) =>
        per === 'word' && /^\s+$/.test(u) ? (
          <span key={i} aria-hidden>
            {u}
          </span>
        ) : (
          <motion.span
            key={i}
            className="inline-block will-change-transform"
            variants={child}
            aria-hidden
          >
            {u}
          </motion.span>
        ),
      )}
    </Comp>
  );
}
